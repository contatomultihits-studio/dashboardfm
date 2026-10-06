"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AvisoConfig } from "@/components/AvisoConfig";
import { Carrossel } from "@/components/Carrossel";
import { Imagem } from "@/components/Imagem";
import { Avatar } from "@/components/Avatar";
import { EscalaFimDeSemana } from "@/components/EscalaFimDeSemana";
import { NoArTopo } from "@/components/NoArTopo";
import { LembretePautas } from "@/components/LembretePautas";
import { Modal } from "@/components/Modal";
import { TextoRico } from "@/components/TextoRico";
import { Topbar } from "@/components/Topbar";
import { ATUALIZAR_A_CADA_MS, VOLTAR_PARA_HOJE_MS } from "@/lib/config";
import { agoraHHMM, ehSemPrazo, fmtData, fmtDiaMes, fmtDiaSemana, fmtHora, hojeISO, horaCurta, noArAgora, partesData, quando, somarDias, type PeriodoComHora } from "@/lib/datas";
import { textoPuro } from "@/lib/html";
import { urlImagem } from "@/lib/imagens";
import { datasEntre, type DataComemorativa } from "@/lib/datasComemorativas";
import { noArEm, quemVemDepois } from "@/lib/escala";
import { haQuanto, type VideoYoutube } from "@/lib/youtube";
import { getSupabase } from "@/lib/supabase/client";
import { horaNoFuso, ordenarPautas, pautasParaLembrar, situacaoPauta } from "@/lib/pautas";
import { TIPO_PAUTA_LABEL, VINCULO_LABEL, type Conexao, type Convidado, type ItemEscala, type Locutor, type Evento, type Pauta, type PautaRealizada, type Prioridade, type Recado } from "@/lib/tipos";

/** Convidado na dashboard: os que já vieram aparecem depois dos próximos, em preto e branco. */
type ConvidadoCard = Convidado & { jaVeio: boolean };

const ULTIMOS_CONVIDADOS = 6;

/** Quanto tempo o locutor tem para desfazer um "feita" por engano (igual ao banco). */
const DESFAZER_PAUTA_MS = 15 * 60_000;

/** Folhinha de calendário no canto da foto: QUI · 02 · OUT. */
type ItemTopo = { id: string; tipo: "data"; d: DataComemorativa } | { id: string; tipo: "recado"; r: Recado };

function Folhinha({ data }: { data: string }) {
  const p = partesData(data);
  return (
    <span className="folhinha" aria-hidden>
      <span className="folhinha-semana">{p.semana}</span>
      <span className="folhinha-dia">{p.dia}</span>
      <span className="folhinha-mes">{p.mes}</span>
    </span>
  );
}

/** "HOJE · 14:00", "AMANHÃ", "EM 5 DIAS"... em relação ao dia de verdade. */
function Quando({ data, hora }: { data: string; hora?: string | null }) {
  const q = quando(data, hojeISO());
  return (
    <span className={`quando quando-${q.tipo}`}>
      {q.texto}
      {hora ? ` · ${fmtHora(hora)}` : ""}
    </span>
  );
}

/** Rodapé do card: "Último dia", "Até 18:00", "Até 03/10", "Até 03/10 às 18:00". */
function AteQuando({ p, dia }: { p: PeriodoComHora; dia: string }) {
  if (ehSemPrazo(p.data_fim)) return null;
  const hf = horaCurta(p.hora_fim);
  if (p.data_fim === dia) return <span className="etiqueta ultimo-dia">{hf ? `Até ${hf}` : "Último dia"}</span>;
  return <span className="etiqueta cinza">Até {fmtDiaMes(p.data_fim)}{hf ? ` às ${hf}` : ""}</span>;
}

/** "No ar de 01/10 08:00 a 03/10 18:00" */
function periodoTexto(p: PeriodoComHora) {
  if (ehSemPrazo(p.data_fim)) return `No ar desde ${fmtData(p.data_inicio)}`;
  const hi = horaCurta(p.hora_inicio);
  const hf = horaCurta(p.hora_fim);
  return `No ar de ${fmtData(p.data_inicio)}${hi ? ` ${hi}` : ""} a ${fmtData(p.data_fim)}${hf ? ` ${hf}` : ""}`;
}

/** Última versão de cada dia, guardada no navegador para a tela abrir na hora (depois atualiza). */
type Retrato = {
  prioridades: Prioridade[];
  recados: Recado[];
  conexoes?: Conexao[];
  pautas?: Pauta[];
  realizadas?: PautaRealizada[];
  locutores?: Locutor[];
  escala?: ItemEscala[];
  convidados: ConvidadoCard[];
  eventos: Evento[];
  em: string;
};
const chaveRetrato = (dia: string) => `dashboardfm:retrato:${dia}`;

function lerRetrato(dia: string): Retrato | null {
  try {
    const bruto = localStorage.getItem(chaveRetrato(dia));
    return bruto ? (JSON.parse(bruto) as Retrato) : null;
  } catch {
    return null;
  }
}

function salvarRetrato(dia: string, r: Retrato) {
  try {
    // Guarda só o dia atual, para não acumular lixo no navegador.
    for (const k of Object.keys(localStorage)) if (k.startsWith("dashboardfm:retrato:")) localStorage.removeItem(k);
    localStorage.setItem(chaveRetrato(dia), JSON.stringify(r));
  } catch {
    // sem espaço ou navegação privada: segue sem cache
  }
}

type Aberto =
  | { tipo: "prioridade"; item: Prioridade }
  | { tipo: "recado"; item: Recado }
  | { tipo: "conexao"; item: Conexao }
  | { tipo: "pauta"; item: Pauta }
  | { tipo: "data"; item: DataComemorativa }
  | { tipo: "video"; item: VideoYoutube }
  | { tipo: "convidado"; item: ConvidadoCard }
  | { tipo: "evento"; item: Evento }
  | null;

export function Dashboard() {
  const sb = getSupabase();
  const [dia, setDia] = useState<string | null>(null);
  const [prioridades, setPrioridades] = useState<Prioridade[]>([]);
  const [recados, setRecados] = useState<Recado[]>([]);
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [pautas, setPautas] = useState<Pauta[]>([]);
  const [realizadas, setRealizadas] = useState<PautaRealizada[]>([]);
  const [locutores, setLocutores] = useState<Locutor[]>([]);
  const [escala, setEscala] = useState<ItemEscala[]>([]);
  const [convidados, setConvidados] = useState<ConvidadoCard[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [videos, setVideos] = useState<VideoYoutube[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [aberto, setAberto] = useState<Aberto>(null);
  const fechar = useCallback(() => setAberto(null), []);
  const abrir = useCallback((a: Aberto) => {
    setMsgPauta(null);
    setAberto(a);
  }, []);
  const ultimaBusca = useRef(0);

  // O dia só é definido no navegador, para usar o fuso de quem está vendo.
  useEffect(() => setDia(hojeISO()), []);

  // Última vez que alguém trocou o dia na mão, e qual era "hoje" na última checagem.
  const ultimaTroca = useRef(0);
  const hojeNaChecagem = useRef(hojeISO());
  const mudarDia = useCallback((novo: string) => {
    ultimaTroca.current = Date.now();
    setDia(novo);
  }, []);

  // A cada minuto: vira o dia à meia-noite para quem está em "hoje", e volta para hoje
  // quem ficou parado muito tempo em outro dia (a tela do estúdio nunca fica presa num dia velho).
  useEffect(() => {
    const checar = () => {
      const agora = hojeISO();
      setDia((atual) => {
        if (!atual) return atual;
        if (atual === hojeNaChecagem.current && atual !== agora) return agora;
        if (atual !== agora && Date.now() - ultimaTroca.current >= VOLTAR_PARA_HOJE_MS) return agora;
        return atual;
      });
      hojeNaChecagem.current = agora;
    };
    const timer = setInterval(checar, 60_000);
    return () => clearInterval(timer);
  }, []);

  const carregar = useCallback(async () => {
    if (!sb || !dia) return;
    const busca = ++ultimaBusca.current;
    setCarregando(true);
    // Mostra na hora o que já tinha deste dia, enquanto busca a versão nova.
    const guardado = lerRetrato(dia);
    if (guardado) {
      setPrioridades(guardado.prioridades);
      setRecados(guardado.recados);
      setConexoes(guardado.conexoes ?? []);
      setPautas(guardado.pautas ?? []);
      setRealizadas(guardado.realizadas ?? []);
      setLocutores(guardado.locutores ?? []);
      setEscala(guardado.escala ?? []);
      setConvidados(guardado.convidados);
      setEventos(guardado.eventos);
    }
    // Filtra "ativo" também aqui: quem está logado enxerga os ocultos pelas regras do banco.
    const [p, r, cx, pa, pr, lo, es, c, cv, e] = await Promise.all([
      // No ar no dia escolhido: entrou até esse dia e só sai depois dele. As que saem primeiro vêm antes.
      sb.from("prioridades").select("*").lte("data_inicio", dia).gte("data_fim", dia).eq("ativo", true)
        .order("data_fim").order("created_at"),
      // Recados no ar no dia: os destacados primeiro, depois os que saem antes.
      sb.from("recados").select("*").lte("data_inicio", dia).gte("data_fim", dia).eq("ativo", true)
        .order("destaque", { ascending: false }).order("data_fim").order("created_at"),
      sb.from("conexoes").select("*").lte("data_inicio", dia).gte("data_fim", dia).eq("ativo", true)
        .order("data_inicio", { ascending: false }).order("created_at"),
      // Partiu Rádio Disney: pautas do dia e o que o locutor já marcou como feito.
      sb.from("pautas").select("*").lte("data_inicio", dia).gte("data_fim", dia).eq("ativo", true).order("horario"),
      sb.from("pautas_realizadas").select("*").eq("dia", dia),
      // Escala: locutores e o escalado de ontem (madrugada) até ~3 meses à frente (fins de semana prontos).
      sb.from("locutores").select("*").eq("ativo", true),
      sb.from("escala").select("*").gte("data", somarDias(hojeISO(), -1)).lte("data", somarDias(hojeISO(), 100)).limit(1000),
      sb.from("convidados").select("*").gte("data_visita", dia).eq("ativo", true).eq("concluido", false)
        .order("data_visita").order("horario", { nullsFirst: false }).limit(60),
      // Últimos que já vieram: data anterior ao dia ou marcados como "já veio".
      sb.from("convidados").select("*").eq("ativo", true).or(`data_visita.lt.${dia},concluido.eq.true`)
        .order("data_visita", { ascending: false }).order("horario", { ascending: false, nullsFirst: false })
        .limit(ULTIMOS_CONVIDADOS),
      sb.from("eventos").select("*").gte("data_evento", dia).eq("ativo", true).order("data_evento").limit(60),
    ]);
    if (busca !== ultimaBusca.current) return; // já trocaram de dia; descarta resposta antiga
    const falha = p.error ?? r.error ?? cx.error ?? pa.error ?? pr.error ?? lo.error ?? es.error ?? c.error ?? cv.error ?? e.error;
    if (falha) {
      setErro(falha.message);
    } else {
      setErro(null);
      const novo: Retrato = {
        prioridades: p.data as Prioridade[],
        recados: r.data as Recado[],
        conexoes: cx.data as Conexao[],
        pautas: pa.data as Pauta[],
        realizadas: pr.data as PautaRealizada[],
        locutores: lo.data as Locutor[],
        escala: es.data as ItemEscala[],
        convidados: [
          ...(c.data as Convidado[]).map((x) => ({ ...x, jaVeio: false })),
          ...(cv.data as Convidado[]).map((x) => ({ ...x, jaVeio: true })),
        ],
        eventos: e.data as Evento[],
        em: new Date().toISOString(),
      };
      setPrioridades(novo.prioridades);
      setRecados(novo.recados);
      setConexoes(novo.conexoes ?? []);
      setPautas(novo.pautas ?? []);
      setRealizadas(novo.realizadas ?? []);
      setLocutores(novo.locutores ?? []);
      setEscala(novo.escala ?? []);
      setConvidados(novo.convidados);
      setEventos(novo.eventos);
      setAtualizadoEm(new Date());
      salvarRetrato(dia, novo);
    }
    setCarregando(false);
  }, [sb, dia]);

  useEffect(() => {
    carregar();
    const timer = setInterval(carregar, ATUALIZAR_A_CADA_MS);
    const aoVoltar = () => document.visibilityState === "visible" && carregar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [carregar]);

  // Últimos vídeos do canal no YouTube (o servidor guarda por 10 min; aqui pedimos a cada 10 min).
  useEffect(() => {
    const buscar = async () => {
      try {
        const r = await fetch("/api/youtube");
        const j = (await r.json()) as { videos?: VideoYoutube[] };
        if (j.videos?.length) setVideos(j.videos);
      } catch {
        // sem internet: mantém os que já tinha
      }
    };
    buscar();
    const timer = setInterval(buscar, 10 * 60_000);
    return () => clearInterval(timer);
  }, []);

  // Relógio: a cada 30 s confere quem entrou ou saiu do ar pelo horário.
  const [agora, setAgora] = useState(agoraHHMM());
  useEffect(() => {
    const timer = setInterval(() => setAgora(agoraHHMM()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const ehHoje = dia === hojeISO();
  const prioridadesNoAr = useMemo(
    () => (dia ? prioridades.filter((p) => noArAgora(p, dia, hojeISO(), agora)) : prioridades),
    [prioridades, dia, agora],
  );
  const recadosNoAr = useMemo(
    () => (dia ? recados.filter((r) => noArAgora(r, dia, hojeISO(), agora)) : recados),
    [recados, dia, agora],
  );
  const conexoesNoAr = useMemo(
    () => (dia ? conexoes.filter((x) => noArAgora(x, dia, hojeISO(), agora)) : conexoes),
    [conexoes, dia, agora],
  );
  const feitas = useMemo(() => new Map(realizadas.map((x) => [x.pauta_id, x])), [realizadas]);
  const pautasDoDia = useMemo(() => ordenarPautas(pautas, feitas), [pautas, feitas]);
  const locutorPorId = useMemo(() => new Map(locutores.map((l) => [l.id, l])), [locutores]);
  // Quem está no ar é sempre sobre agora (mesmo olhando outro dia); `agora` muda a cada 15s.
  const hojeAgora = useMemo(() => hojeISO(), [agora]); // eslint-disable-line react-hooks/exhaustive-deps
  const noAr = useMemo(() => noArEm(hojeAgora, agora, locutores, escala), [hojeAgora, agora, locutores, escala]);
  const depois = useMemo(() => quemVemDepois(hojeAgora, agora, locutores, escala), [hojeAgora, agora, locutores, escala]);
  // Lembrete na tela 5 min antes de cada pauta de hoje (o locutor pode fechar o aviso).
  const [dispensadas, setDispensadas] = useState<Set<string>>(() => new Set());
  const lembretes = useMemo(
    () => (ehHoje ? pautasParaLembrar(pautas, feitas, dispensadas, agora) : []),
    [ehHoje, pautas, feitas, dispensadas, agora],
  );
  const [marcando, setMarcando] = useState(false);
  const [msgPauta, setMsgPauta] = useState<{ texto: string; erro?: boolean } | null>(null);

  async function marcarFeita(p: Pauta) {
    if (!sb || !dia) return;
    setMarcando(true);
    setMsgPauta(null);
    const { data, error } = await sb.rpc("marcar_pauta_feita", { p_pauta: p.id, p_dia: dia });
    setMarcando(false);
    if (error) return setMsgPauta({ texto: `Não deu para marcar: ${error.message}`, erro: true });
    const feita: PautaRealizada = { id: `local-${p.id}`, pauta_id: p.id, dia, realizado_em: String(data), origem: "locutor" };
    setRealizadas((rs) => [...rs.filter((x) => x.pauta_id !== p.id), feita]);
    setMsgPauta({ texto: `Pauta registrada às ${horaNoFuso(feita.realizado_em)}. Valeu!` });
  }

  async function desfazerFeita(p: Pauta) {
    if (!sb || !dia) return;
    setMarcando(true);
    const { data, error } = await sb.rpc("desmarcar_pauta", { p_pauta: p.id, p_dia: dia });
    setMarcando(false);
    if (error) return setMsgPauta({ texto: error.message, erro: true });
    if (!data) return setMsgPauta({ texto: "Passou de 15 minutos: peça para a produção corrigir no relatório.", erro: true });
    setRealizadas((rs) => rs.filter((x) => x.pauta_id !== p.id));
    setMsgPauta({ texto: "Desfeito: a pauta voltou para pendente." });
  }

  // Faixa do topo: a data comemorativa do dia (calculada, sem buscar nada) vem primeiro, depois os recados.
  const datasDoDia = useMemo(() => (dia ? datasEntre(dia, 1) : []), [dia]);
  const faixaTopo = useMemo<ItemTopo[]>(
    () => [
      ...datasDoDia.map((d) => ({ id: `data-${d.id}`, tipo: "data" as const, d })),
      ...recadosNoAr.map((r) => ({ id: `rec-${r.id}`, tipo: "recado" as const, r })),
    ],
    [datasDoDia, recadosNoAr],
  );

  return (
    <>
      <Topbar
        atual="dashboard"
        meio={
          sb && (
            <div className="barra-dia" role="group" aria-label="Dia">
              {locutores.length > 0 && <NoArTopo sb={sb} noAr={noAr} depois={depois} />}
              <div className="barra-dia-data">
                <small>
                  {ehHoje ? "Hoje" : "Dia selecionado"}
                  {atualizadoEm &&
                    ` · atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                </small>
                <strong>{dia ? fmtDiaSemana(dia) : "…"}</strong>
              </div>
              <div className="barra-dia-acoes">
                <button type="button" className="pequeno verde" disabled={!dia} onClick={() => dia && mudarDia(somarDias(dia, -1))}>◀ Dia anterior</button>
                <button type="button" className="pequeno" disabled={ehHoje} onClick={() => mudarDia(hojeISO())}>Hoje</button>
                <button type="button" className="pequeno verde" disabled={!dia} onClick={() => dia && mudarDia(somarDias(dia, 1))}>Próximo dia ▶</button>
                <button type="button" className="pequeno branco" onClick={carregar} title="Buscar de novo agora">↻ Atualizar</button>
              </div>
            </div>
          )
        }
      />
      <main className="container">
        {!sb ? (
          <AvisoConfig />
        ) : (
          <>

            {erro && <div className="aviso erro">Erro ao buscar dados: {erro}</div>}
            <Carrossel
              key={`rec-${dia}`}
              titulo="Recados rápidos"
              ocultarTitulo
              ocultarSeVazio
              className="secao-recados"
              itens={faixaTopo}
              carregando={carregando}
              porPaginaMax={4}
              vazio="Sem recados para este dia."
              render={(it) => {
                if (it.tipo === "data") {
                  const d = it.d;
                  return (
                    <button
                      type="button"
                      className="item-card data-card hoje topo"
                      onClick={() => abrir({ tipo: "data", item: d })}
                    >
                      <span className="item-rodape" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
                        <span className="etiqueta data-hoje">{ehHoje ? "Hoje" : "Neste dia"}</span>
                        {d.feriado && <span className="etiqueta destaque">Feriado</span>}
                      </span>
                      <span className="item-titulo">{d.titulo}</span>
                    </button>
                  );
                }
                const r = it.r;
                return (
                <button
                  type="button"
                  className={`item-card recado-card ${r.destaque ? "destaque" : ""}`}
                  onClick={() => abrir({ tipo: "recado", item: r })}
                >
                  {r.destaque && <span className="etiqueta destaque">Importante</span>}
                  <span className="item-titulo">{r.titulo || textoPuro(r.conteudo_html) || "Recado"}</span>
                  <span className="item-rodape">{dia && <AteQuando p={r} dia={dia} />}</span>
                </button>
                );
              }}
            />

            <Carrossel
              key={`prio-${dia}`}
              titulo="Prioridades no ar"
              itens={prioridadesNoAr}
              carregando={carregando}
              vazio="Sem prioridades para este dia."
              render={(p) => (
                <button type="button" className="item-card" onClick={() => abrir({ tipo: "prioridade", item: p })}>
                  <Imagem src={urlImagem(sb, p.imagem_path)} alt="" className="thumb" prioridade={prioridadesNoAr.indexOf(p) < 3} />
                  <span className="item-titulo">{p.titulo || textoPuro(p.conteudo_html) || "Prioridade do ar"}</span>
                  <span className="item-rodape">{dia && <AteQuando p={p} dia={dia} />}</span>
                </button>
              )}
            />

            <Carrossel
              key={`pautas-${dia}`}
              titulo="Partiu Rádio Disney"
              className="secao-pautas"
              itens={pautasDoDia}
              carregando={carregando}
              porPaginaMax={4}
              vazio="Sem pautas de ação externa para este dia."
              render={(p) => {
                const st = situacaoPauta(p.horario, feitas.get(p.id), dia ?? "", hojeISO(), agora);
                return (
                  <button type="button" className={`item-card pauta-card pauta-${st.tipo}`} onClick={() => abrir({ tipo: "pauta", item: p })}>
                    <span className="pauta-topo">
                      <span className={`etiqueta ${p.tipo === "EXPECTATIVA" ? "expectativa" : "valendo"}`}>{TIPO_PAUTA_LABEL[p.tipo]}</span>
                      <span className={`etiqueta pauta-status status-${st.tipo}`}>{st.tipo === "feita" ? "✓ " : ""}{st.texto}</span>
                    </span>
                    <span className="pauta-hora">{horaCurta(p.horario)}</span>
                    <span className="pauta-cliente">{p.cliente}</span>
                    {p.titulo && <span className="pauta-acao">{p.titulo}</span>}
                    <span className="pauta-locutor">
                      {p.locutor_id && locutorPorId.get(p.locutor_id) ? <Avatar sb={sb} locutor={locutorPorId.get(p.locutor_id)!} tamanho={30} /> : "🎙"} {p.locutor}
                    </span>
                  </button>
                );
              }}
            />

            <Carrossel
              key={`conv-${dia}`}
              titulo={convidados.some((c) => !c.jaVeio) || convidados.length === 0 ? "Próximos convidados" : "Últimos convidados"}
              itens={convidados}
              carregando={carregando}
              vazio="Sem convidados programados."
              render={(c) => (
                <button type="button" className={`item-card foto-card ${c.jaVeio ? "ja-veio" : ""}`} onClick={() => abrir({ tipo: "convidado", item: c })}>
                  <div className="foto-wrap">
                    <Imagem src={urlImagem(sb, c.imagem_path)} alt="" className="thumb" largura={600} altura={600} />
                    <Folhinha data={c.data_visita} />
                    <div className="foto-overlay">
                      <span className="foto-etiquetas">
                        {c.jaVeio && <span className="etiqueta cinza">Já veio</span>}
                        <Quando data={c.data_visita} hora={c.jaVeio ? null : c.horario} />
                      </span>
                      <strong>{c.nome}</strong>
                    </div>
                  </div>
                </button>
              )}
            />

            <Carrossel
              key={`evt-${dia}`}
              titulo="Agenda de eventos"
              itens={eventos}
              carregando={carregando}
              vazio="Sem eventos na agenda."
              render={(e) => (
                <button type="button" className="item-card foto-card" onClick={() => abrir({ tipo: "evento", item: e })}>
                  <div className="foto-wrap">
                    <Imagem src={urlImagem(sb, e.imagem_path)} alt="" className="thumb" largura={600} altura={600} />
                    <Folhinha data={e.data_evento} />
                    <div className="foto-overlay">
                      <span className="foto-etiquetas">
                        <Quando data={e.data_evento} />
                        <span className={`etiqueta ${e.vinculo === "RADIO_OFICIAL" ? "oficial" : "apoio"}`}>{VINCULO_LABEL[e.vinculo]}</span>
                      </span>
                      <strong>{e.nome}</strong>
                      {e.local && <small>📍 {e.local}</small>}
                    </div>
                  </div>
                </button>
              )}
            />

            <Carrossel
              key={`conex-${dia}`}
              titulo="Conexões"
              itens={conexoesNoAr}
              carregando={carregando}
              vazio="Sem conexões no ar."
              render={(x) => (
                <button type="button" className="item-card foto-card" onClick={() => abrir({ tipo: "conexao", item: x })}>
                  <div className="foto-wrap">
                    <Imagem src={urlImagem(sb, x.imagem_path)} alt="" className="thumb" largura={600} altura={600} />
                    <div className="foto-overlay">
                      {dia && !ehSemPrazo(x.data_fim) && (
                        <span className="foto-etiquetas"><AteQuando p={x} dia={dia} /></span>
                      )}
                      <strong>{x.titulo || textoPuro(x.conteudo_html) || "Conexão"}</strong>
                    </div>
                  </div>
                </button>
              )}
            />

            {videos.length > 0 && (
              <Carrossel
                titulo="Últimos vídeos no YouTube"
                className="secao-youtube"
                itens={videos}
                autoAvancarMs={8000}
                vazio=""
                render={(v) => (
                  <button type="button" className="item-card video-card" onClick={() => abrir({ tipo: "video", item: v })}>
                    <span className="video-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.thumb} alt="" className="thumb" loading="lazy" />
                      <span className="video-play" aria-hidden>▶</span>
                    </span>
                    <span className="item-titulo">{v.titulo}</span>
                    <span className="item-rodape" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
                      <span className="etiqueta cinza">{haQuanto(v.publicadoEm)}</span>
                      {v.short && <span className="etiqueta youtube">Shorts</span>}
                    </span>
                  </button>
                )}
              />
            )}

            {locutores.length > 0 && <EscalaFimDeSemana sb={sb} hoje={hojeAgora} locutores={locutores} escala={escala} noAr={noAr} />}
          </>
        )}
      </main>

      {aberto?.tipo === "prioridade" && (
        <Modal titulo={aberto.item.titulo || "Prioridade no ar"} onFechar={fechar} leitura>
          <div className="modal-meta">
            <span className="etiqueta cinza">
              {periodoTexto(aberto.item)}
            </span>
          </div>
          <TextoRico html={aberto.item.conteudo_html} />
        </Modal>
      )}
      <LembretePautas
        sb={sb}
        locutores={locutorPorId}
        lembretes={aberto?.tipo === "pauta" ? lembretes.filter((l) => l.pauta.id !== aberto.item.id) : lembretes}
        onAbrir={(p) => abrir({ tipo: "pauta", item: p })}
        onFechar={(id) => setDispensadas((d) => new Set(d).add(id))}
      />
      {aberto?.tipo === "conexao" && (
        <Modal titulo={aberto.item.titulo || "Conexão"} onFechar={fechar} leitura>
          <div className="modal-meta">
            <span className="etiqueta cinza">{periodoTexto(aberto.item)}</span>
          </div>
          <TextoRico html={aberto.item.conteudo_html} />
        </Modal>
      )}
      {aberto?.tipo === "pauta" && (() => {
        const p = aberto.item;
        const feita = feitas.get(p.id);
        const podeDesfazer = feita && feita.origem === "locutor" && Date.now() - Date.parse(feita.realizado_em) < DESFAZER_PAUTA_MS;
        return (
          <Modal titulo={`${p.cliente} · ${horaCurta(p.horario)}`} onFechar={fechar} leitura>
            <div className="modal-meta">
              <span className={`etiqueta ${p.tipo === "EXPECTATIVA" ? "expectativa" : "valendo"}`}>{TIPO_PAUTA_LABEL[p.tipo]}</span>
              <span className="etiqueta cinza">🎙 {p.locutor}</span>
              <span className="etiqueta cinza">No ar às {horaCurta(p.horario)}</span>
              {p.titulo && <span className="etiqueta cinza">{p.titulo}</span>}
            </div>
            <TextoRico html={p.conteudo_html} />
            <div className={`pauta-checkout ${feita ? "feita" : ""}`}>
              {feita ? (
                <>
                  <strong>✓ Pauta feita às {horaNoFuso(feita.realizado_em)}</strong>
                  {podeDesfazer && (
                    <button type="button" className="pequeno branco" disabled={marcando} onClick={() => desfazerFeita(p)}>Desfazer</button>
                  )}
                </>
              ) : ehHoje ? (
                <button type="button" className="verde grande" disabled={marcando} onClick={() => marcarFeita(p)}>
                  {marcando ? "Registrando…" : "✓ Marcar pauta como feita"}
                </button>
              ) : (
                <span>Só dá para marcar como feita no dia da pauta.</span>
              )}
              {msgPauta && <span className={`pauta-msg ${msgPauta.erro ? "erro" : ""}`} role="status">{msgPauta.texto}</span>}
            </div>
          </Modal>
        );
      })()}
      {aberto?.tipo === "recado" && (
        <Modal titulo={aberto.item.titulo || "Recado"} onFechar={fechar} leitura>
          <div className="modal-meta">
            {aberto.item.destaque && <span className="etiqueta destaque">Importante</span>}
            <span className="etiqueta cinza">
              {periodoTexto(aberto.item)}
            </span>
          </div>
          <TextoRico html={aberto.item.conteudo_html} />
        </Modal>
      )}
      {aberto?.tipo === "data" && (
        <Modal titulo={aberto.item.titulo} onFechar={fechar} leitura>
          <div className="modal-meta">
            <span className="etiqueta cinza">{fmtData(aberto.item.data)}</span>
            {aberto.item.feriado && <span className="etiqueta destaque">Feriado nacional</span>}
          </div>
          <div className="texto-rico"><p>{aberto.item.texto}</p></div>
        </Modal>
      )}
      {aberto?.tipo === "video" && (
        <Modal titulo={aberto.item.titulo} onFechar={fechar}>
          <div className="video-player">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${aberto.item.id}?autoplay=1&rel=0`}
              title={aberto.item.titulo}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
          <a className="botao branco" href={aberto.item.link} target="_blank" rel="noreferrer" style={{ justifySelf: "start", textDecoration: "none" }}>
            Abrir no YouTube ↗
          </a>
        </Modal>
      )}
      {aberto?.tipo === "convidado" && (
        <Modal titulo={aberto.item.nome} onFechar={fechar} leitura>
          <div className="modal-meta">
            {aberto.item.jaVeio && <span className="etiqueta cinza">Já veio</span>}
            <span className="etiqueta cinza">{fmtData(aberto.item.data_visita)}{aberto.item.horario ? ` às ${fmtHora(aberto.item.horario)}` : ""}</span>
          </div>
          <h3>Mini pauta</h3>
          <TextoRico html={aberto.item.mini_pauta_html} />
        </Modal>
      )}
      {aberto?.tipo === "evento" && (
        <Modal titulo={aberto.item.nome} onFechar={fechar} leitura>
          <div className="modal-meta">
            <span className={`etiqueta ${aberto.item.vinculo === "RADIO_OFICIAL" ? "oficial" : "apoio"}`}>{VINCULO_LABEL[aberto.item.vinculo]}</span>
            <span className="etiqueta cinza">{fmtData(aberto.item.data_evento)}</span>
            {aberto.item.local && <span className="etiqueta cinza">{aberto.item.local}</span>}
          </div>
          <TextoRico html={aberto.item.descricao_html} />
        </Modal>
      )}
    </>
  );
}
