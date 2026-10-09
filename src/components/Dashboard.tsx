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
import { COLUNAS, ESCALA_DIAS_A_FRENTE } from "@/lib/colunas";
import { noArRepetido } from "@/lib/repeticao";
import { useAtualizacao } from "@/lib/useAtualizacao";
import { ATUALIZAR_A_CADA_MS, MOSTRAR_YOUTUBE } from "@/lib/config";
import { agoraHHMM, ehSemPrazo, fmtData, fmtDiaMes, fmtDiaSemana, fmtHora, hojeISO, horaCurta, noArAgora, partesData, quando, somarDias, type PeriodoComHora } from "@/lib/datas";
import { textoPuro } from "@/lib/html";
import { urlImagem } from "@/lib/imagens";
import { datasEntre, type DataComemorativa } from "@/lib/datasComemorativas";
import { noArEm, nomesFaixa, quemVemDepois } from "@/lib/escala";
import { lerLeituras, ordenarPorLeitura, salvarLeituras, type Leituras } from "@/lib/leituras";
import { haQuanto, type VideoYoutube } from "@/lib/youtube";
import { getSupabase } from "@/lib/supabase/client";
import { horaNoFuso, ordenarPautas, pautasParaLembrar, situacaoPauta } from "@/lib/pautas";
import { classeTipo, classeVinculo, nomePauta, SECAO_PAUTA_LABEL, TIPO_PAUTA_LABEL, VINCULO_LABEL, type Conexao, type Convidado, type ItemEscala, type Locutor, type Evento, type Pauta, type PautaRealizada, type Prioridade, type Recado } from "@/lib/tipos";

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

/** "⭐ Fixado" (fica na frente) ou "Lido às 10:32" (foi para o fim da fila). */
function MarcaLeitura({ fixado, lido }: { fixado?: boolean; lido?: string }) {
  if (fixado) return <span className="etiqueta fixado">⭐ Fixado</span>;
  if (!lido) return null;
  return <span className="etiqueta lido">✓ Lido às {agoraHHMM(new Date(lido))}</span>;
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
  // "Já lido vai para o fim": quando cada card foi aberto nesta tela, hoje.
  const [lidos, setLidos] = useState<Leituras>({});
  // Quem está no ar, para registrar junto com a leitura (o relatório mostra quem leu).
  const noArRef = useRef("");
  const abrir = useCallback((a: Aberto) => {
    setMsgPauta(null);
    setAberto(a);
    if (a && (a.tipo === "prioridade" || a.tipo === "conexao")) {
      const hoje = hojeISO();
      setLidos((l) => {
        const novo = { ...lerLeituras(hoje), ...l, [a.item.id]: new Date().toISOString() };
        salvarLeituras(hoje, novo);
        return novo;
      });
      // Também no banco, para o relatório de leituras (se falhar, a dashboard segue normal).
      sb?.rpc("registrar_leitura", { p_tipo: a.tipo, p_item: a.item.id, p_locutor: noArRef.current }).then(() => {}, () => {});
    }
  }, [sb]);
  const ultimaBusca = useRef(0);

  // O dia só é definido no navegador, para usar o fuso de quem está vendo.
  useEffect(() => setDia(hojeISO()), []);

  // A dashboard mostra sempre hoje: a cada minuto confere se já virou o dia.
  useEffect(() => {
    const timer = setInterval(() => setDia((atual) => (atual && atual !== hojeISO() ? hojeISO() : atual)), 60_000);
    return () => clearInterval(timer);
  }, []);

  const carregar = useCallback(async (): Promise<boolean> => {
    if (!sb || !dia) return false;
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
      sb.from("prioridades").select(COLUNAS.prioridades).lte("data_inicio", dia).gte("data_fim", dia).eq("ativo", true)
        .order("data_fim").order("created_at"),
      // Recados no ar no dia: os destacados primeiro, depois os que saem antes.
      // (desde ontem: recado que repete e passa da meia-noite continua na madrugada seguinte)
      sb.from("recados").select(COLUNAS.recados).lte("data_inicio", dia).gte("data_fim", somarDias(dia, -1)).eq("ativo", true)
        .order("destaque", { ascending: false }).order("data_fim").order("created_at"),
      sb.from("conexoes").select(COLUNAS.conexoes).lte("data_inicio", dia).gte("data_fim", dia).eq("ativo", true)
        .order("data_inicio", { ascending: false }).order("created_at"),
      // Partiu Rádio Disney: pautas do dia e o que o locutor já marcou como feito.
      sb.from("pautas").select(COLUNAS.pautas).lte("data_inicio", dia).gte("data_fim", dia).eq("ativo", true).order("horario"),
      sb.from("pautas_realizadas").select(COLUNAS.pautas_realizadas).eq("dia", dia),
      // Escala: o escalado de ontem (madrugada) até as próximas duas semanas (cobre o próximo fim de semana).
      sb.from("locutores").select(COLUNAS.locutores).eq("ativo", true),
      sb.from("escala").select(COLUNAS.escala).gte("data", somarDias(hojeISO(), -1)).lte("data", somarDias(hojeISO(), ESCALA_DIAS_A_FRENTE)).limit(1000),
      sb.from("convidados").select(COLUNAS.convidados).gte("data_visita", dia).eq("ativo", true).eq("concluido", false)
        .order("data_visita").order("horario", { nullsFirst: false }).limit(60),
      // Últimos que já vieram: data anterior ao dia ou marcados como "já veio".
      sb.from("convidados").select(COLUNAS.convidados).eq("ativo", true).or(`data_visita.lt.${dia},concluido.eq.true`)
        .order("data_visita", { ascending: false }).order("horario", { ascending: false, nullsFirst: false })
        .limit(ULTIMOS_CONVIDADOS),
      sb.from("eventos").select(COLUNAS.eventos).gte("data_evento", dia).eq("ativo", true).order("data_evento").limit(60),
    ]);
    if (busca !== ultimaBusca.current) return false; // já trocaram de dia; descarta resposta antiga
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
    return !falha;
  }, [sb, dia]);

  // A cada minuto pergunta só "mudou algo?"; baixa tudo apenas quando mudou (ou a cada 15 min, por garantia).
  const atualizar = useAtualizacao(sb, carregar, {
    intervaloMs: ATUALIZAR_A_CADA_MS,
    forcarAposMs: 15 * 60_000,
    onConferido: useCallback(() => setAtualizadoEm(new Date()), []),
  });

  // Últimos vídeos do canal no YouTube (o servidor guarda por 10 min; aqui pedimos a cada 10 min).
  useEffect(() => {
    if (!MOSTRAR_YOUTUBE) return;
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
    () => ordenarPorLeitura(dia ? prioridades.filter((p) => noArAgora(p, dia, hojeISO(), agora)) : prioridades, lidos),
    [prioridades, dia, agora, lidos],
  );
  const recadosNoAr = useMemo(
    () => (dia ? recados.filter((r) => (r.repetir ? noArRepetido(r, hojeISO(), agora) : noArAgora(r, dia, hojeISO(), agora))) : recados),
    [recados, dia, agora],
  );
  const conexoesNoAr = useMemo(
    () => ordenarPorLeitura(dia ? conexoes.filter((x) => noArAgora(x, dia, hojeISO(), agora)) : conexoes, lidos),
    [conexoes, dia, agora, lidos],
  );
  const feitas = useMemo(() => new Map(realizadas.map((x) => [x.pauta_id, x])), [realizadas]);
  // Partiu Rádio Disney e Jornalismo usam as mesmas pautas, separadas pela seção.
  const pautasDoDia = useMemo(() => ordenarPautas(pautas.filter((p) => (p.secao ?? "partiu") === "partiu"), feitas), [pautas, feitas]);
  const jornalismoDoDia = useMemo(() => ordenarPautas(pautas.filter((p) => p.secao === "jornalismo"), feitas), [pautas, feitas]);
  const locutorPorId = useMemo(() => new Map(locutores.map((l) => [l.id, l])), [locutores]);
  // Quem está no ar é sempre sobre agora (mesmo olhando outro dia); `agora` muda a cada 15s.
  const hojeAgora = useMemo(() => hojeISO(), [agora]); // eslint-disable-line react-hooks/exhaustive-deps
  // Leituras guardadas nesta tela; virou o dia, começa do zero.
  useEffect(() => setLidos(lerLeituras(hojeAgora)), [hojeAgora]);
  const noAr = useMemo(() => noArEm(hojeAgora, agora, locutores, escala), [hojeAgora, agora, locutores, escala]);
  useEffect(() => {
    noArRef.current = noAr ? nomesFaixa(noAr) : "";
  }, [noAr]);
  const depois = useMemo(() => quemVemDepois(hojeAgora, agora, locutores, escala), [hojeAgora, agora, locutores, escala]);
  // Lembrete na tela 5 min antes de cada pauta de hoje (o locutor pode fechar o aviso).
  const [dispensadas, setDispensadas] = useState<Set<string>>(() => new Set());
  const lembretes = useMemo(
    () => (ehHoje ? pautasParaLembrar(pautas.filter((p) => p.aviso !== false), feitas, dispensadas, agora) : []),
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

  /** Card de pauta (Partiu ou Jornalismo): tipo, situação, horário grande, nome e locutor. */
  const cardPauta = (p: Pauta) => {
    const st = situacaoPauta(p.horario, feitas.get(p.id), dia ?? "", hojeISO(), agora);
    const loc = p.locutor_id ? locutorPorId.get(p.locutor_id) : undefined;
    return (
      <button type="button" className={`item-card pauta-card pauta-${st.tipo} ${p.secao === "jornalismo" ? "jornal" : ""}`} onClick={() => abrir({ tipo: "pauta", item: p })}>
        <span className="pauta-topo">
          <span className={`etiqueta ${classeTipo(p.tipo)}`}>{TIPO_PAUTA_LABEL[p.tipo]}</span>
          <span className={`etiqueta pauta-status status-${st.tipo}`}>{st.tipo === "feita" ? "✓ " : ""}{st.texto}</span>
        </span>
        <span className="pauta-hora">{horaCurta(p.horario)}</span>
        <span className="pauta-cliente">{nomePauta(p)}</span>
        {p.secao !== "jornalismo" && p.titulo && <span className="pauta-acao">{p.titulo}</span>}
        <span className="pauta-locutor">
          {loc ? <Avatar sb={sb} locutor={loc} tamanho={30} /> : "🎙"} {p.locutor}
        </span>
      </button>
    );
  };

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
                  Hoje
                  {atualizadoEm &&
                    ` · atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                </small>
                <strong>{dia ? fmtDiaSemana(dia) : "…"}</strong>
              </div>
              <div className="barra-dia-acoes">
                <button type="button" className="pequeno branco" onClick={atualizar} title="Buscar de novo agora">↻ Atualizar</button>
              </div>
            </div>
          )
        }
      />
      <main className="container tela-cheia">
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
              porPaginaMax={4}
              render={(p) => (
                <button type="button" className="item-card" onClick={() => abrir({ tipo: "prioridade", item: p })}>
                  <Imagem src={urlImagem(sb, p.imagem_path)} alt="" className="thumb" ajustar prioridade={prioridadesNoAr.indexOf(p) < 3} />
                  <span className="item-titulo">{p.titulo || textoPuro(p.conteudo_html) || "Prioridade do ar"}</span>
                  <span className="item-rodape">
                    {dia && <AteQuando p={p} dia={dia} />}
                    <MarcaLeitura fixado={p.fixado} lido={lidos[p.id]} />
                  </span>
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
              render={cardPauta}
            />

            <Carrossel
              key={`jornal-${dia}`}
              titulo="Jornalismo"
              className="secao-pautas secao-jornalismo"
              itens={jornalismoDoDia}
              carregando={carregando}
              porPaginaMax={4}
              vazio="Sem pautas do jornalismo para este dia."
              render={cardPauta}
            />

            <Carrossel
              key={`conv-${dia}`}
              titulo={convidados.some((c) => !c.jaVeio) || convidados.length === 0 ? "Próximos convidados" : "Últimos convidados"}
              itens={convidados}
              carregando={carregando}
              vazio="Sem convidados programados."
              porPaginaMax={4}
              render={(c) => (
                <button type="button" className={`item-card ${c.jaVeio ? "ja-veio" : ""}`} onClick={() => abrir({ tipo: "convidado", item: c })}>
                  <span className="thumb-wrap">
                    <Imagem src={urlImagem(sb, c.imagem_path)} alt="" className="thumb" ajustar />
                    <Folhinha data={c.data_visita} />
                  </span>
                  <span className="item-titulo">{c.nome}</span>
                  <span className="item-rodape rodape-etiquetas">
                    {c.jaVeio && <span className="etiqueta cinza">Já veio</span>}
                    <Quando data={c.data_visita} hora={c.jaVeio ? null : c.horario} />
                  </span>
                </button>
              )}
            />

            <Carrossel
              key={`evt-${dia}`}
              titulo="Agenda de eventos"
              itens={eventos}
              carregando={carregando}
              vazio="Sem eventos na agenda."
              porPaginaMax={4}
              render={(e) => (
                <button type="button" className="item-card" onClick={() => abrir({ tipo: "evento", item: e })}>
                  <span className="thumb-wrap">
                    <Imagem src={urlImagem(sb, e.imagem_path)} alt="" className="thumb" ajustar />
                    <Folhinha data={e.data_evento} />
                  </span>
                  <span className="item-titulo">{e.nome}</span>
                  {e.local && <span className="item-local">📍 {e.local}</span>}
                  <span className="item-rodape rodape-etiquetas">
                    <Quando data={e.data_evento} />
                    <span className={`etiqueta ${classeVinculo(e.vinculo)}`}>{VINCULO_LABEL[e.vinculo]}</span>
                  </span>
                </button>
              )}
            />

            <Carrossel
              key={`conex-${dia}`}
              titulo="Conexões"
              itens={conexoesNoAr}
              carregando={carregando}
              vazio="Sem conexões no ar."
              porPaginaMax={4}
              render={(x) => (
                <button type="button" className="item-card" onClick={() => abrir({ tipo: "conexao", item: x })}>
                  <Imagem src={urlImagem(sb, x.imagem_path)} alt="" className="thumb" ajustar />
                  <span className="item-titulo">{x.titulo || textoPuro(x.conteudo_html) || "Conexão"}</span>
                  <span className="item-rodape">
                    {dia && <AteQuando p={x} dia={dia} />}
                    <MarcaLeitura fixado={x.fixado} lido={lidos[x.id]} />
                  </span>
                </button>
              )}
            />

            {MOSTRAR_YOUTUBE && videos.length > 0 && (
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
          <Modal titulo={`${nomePauta(p)} · ${horaCurta(p.horario)}`} onFechar={fechar} leitura>
            <div className="modal-meta">
              <span className="etiqueta cinza">{SECAO_PAUTA_LABEL[p.secao ?? "partiu"]}</span>
              <span className={`etiqueta ${classeTipo(p.tipo)}`}>{TIPO_PAUTA_LABEL[p.tipo]}</span>
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
            <span className={`etiqueta ${classeVinculo(aberto.item.vinculo)}`}>{VINCULO_LABEL[aberto.item.vinculo]}</span>
            <span className="etiqueta cinza">{fmtData(aberto.item.data_evento)}</span>
            {aberto.item.local && <span className="etiqueta cinza">{aberto.item.local}</span>}
          </div>
          <TextoRico html={aberto.item.descricao_html} />
        </Modal>
      )}
    </>
  );
}
