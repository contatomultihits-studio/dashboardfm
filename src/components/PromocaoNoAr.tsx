"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Avatares } from "@/components/Avatar";
import { Imagem } from "@/components/Imagem";
import { useItensPorPagina } from "@/components/Carrossel";
import { COLUNAS } from "@/lib/colunas";
import { useAtualizacao } from "@/lib/useAtualizacao";
import { tocarAviso } from "@/components/LembretePautas";
import { Modal } from "@/components/Modal";
import { TextoRico } from "@/components/TextoRico";
import { agoraHHMM, hojeISO, horaCurta, somarDias } from "@/lib/datas";
import { horaNoFuso } from "@/lib/pautas";
import { noArEm, nomesFaixa, type Faixa } from "@/lib/escala";
import { textoPuro } from "@/lib/html";
import { urlImagem } from "@/lib/imagens";
import { detalheGanhador, estadoPremio, faixaPremio, filaPromo, fotoPromo, novidadesPromo, premiosParaLembrar, textoFaltamPremio, tipoPremio, type Entrega, type EstadoFila, type FotoPromo, type GanhadorPublico, type NovidadePromo, type Premio, type Rodada } from "@/lib/promocao";
import type { ItemEscala, Locutor } from "@/lib/tipos";

/** O locutor desfaz o "Concluído" sozinho até este tempo; depois, só a promoção, no relatório. */
const DESFAZER_MIN = 15;

/** A promoção confere mais seguido que o resto: o ganhador precisa chegar rápido ao locutor. */
const ATUALIZAR_PROMO_MS = 15_000;

/** Última versão vista nesta tela (para avisar o que mudou, mesmo depois de recarregar a página). */
const chaveFoto = (dia: string) => `dashboardfm:promo-foto:${dia}`;
function lerFoto(dia: string): FotoPromo | null {
  try {
    const bruto = localStorage.getItem(chaveFoto(dia));
    return bruto ? (JSON.parse(bruto) as FotoPromo) : null;
  } catch {
    return null;
  }
}
function salvarFoto(dia: string, foto: FotoPromo) {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("dashboardfm:promo-foto:") && k !== chaveFoto(dia)) localStorage.removeItem(k);
    localStorage.setItem(chaveFoto(dia), JSON.stringify(foto));
  } catch {
    // sem espaço ou navegação privada: segue sem guardar
  }
}

/** "15h" / "15h30" */
const horaH = (h: string) => {
  const c = horaCurta(h)!;
  return c.endsWith(":00") ? `${c.slice(0, 2)}h` : c.replace(":", "h");
};

/**
 * Promoção na tela do locutor: todos os prêmios do dia num carrossel (3 por vez), em ordem de horário,
 * com "Concluído" igual ao Partiu (o concluído muda de cor e vai para o fim da fila). Prêmio que passou
 * da hora sem "Concluído" fica como pendente. Busca os próprios dados, para poder ir para a dashboard
 * sem mudar nada.
 */
export function PromocaoNoAr({ sb }: { sb: SupabaseClient }) {
  const [agora, setAgora] = useState(agoraHHMM());
  const hoje = useMemo(() => hojeISO(), [agora]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rodadas, setRodadas] = useState<Rodada[]>([]);
  const [premios, setPremios] = useState<Premio[]>([]);
  const [ganhadores, setGanhadores] = useState<GanhadorPublico[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [inicio, setInicio] = useState(0);
  const porPagina = useItensPorPagina(3);
  const [locutores, setLocutores] = useState<Locutor[]>([]);
  const [escala, setEscala] = useState<ItemEscala[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<Rodada | null>(null);
  const [dispensadas, setDispensadas] = useState<Set<string>>(() => new Set());
  // Ganhador incluído / prêmio trocado pela promoção desde a última olhada: aviso até o locutor abrir ou fechar.
  const [novidades, setNovidades] = useState<NovidadePromo[]>([]);
  const fotoRef = useRef<{ dia: string; foto: FotoPromo } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setAgora(agoraHHMM()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const carregar = useCallback(async (): Promise<boolean> => {
    const [r, p, g, l, e, x] = await Promise.all([
      sb.from("promo_rodadas").select(COLUNAS.promo_rodadas).eq("data", hoje).eq("ativo", true).order("horario"),
      sb.from("premios").select(COLUNAS.premios).eq("ativo", true),
      sb.rpc("promocao_ganhadores_hoje", { p_dia: hoje }),
      sb.from("locutores").select(COLUNAS.locutores).eq("ativo", true),
      sb.from("escala").select(COLUNAS.escala).in("data", [hoje, somarDias(hoje, -1)]),
      sb.from("promo_entregas").select(COLUNAS.promo_entregas).eq("data", hoje),
    ]);
    const falha = r.error ?? p.error ?? g.error ?? l.error ?? e.error ?? x.error;
    setErro(falha?.message ?? null);
    if (!falha) {
      const rs = r.data as Rodada[];
      const gs = (g.data as GanhadorPublico[]) ?? [];
      const nova = fotoPromo(rs, gs);
      const antes = fotoRef.current?.dia === hoje ? fotoRef.current.foto : lerFoto(hoje);
      if (antes) {
        const novas = novidadesPromo(antes, nova);
        if (novas.length) {
          setNovidades((atuais) => [...atuais.filter((a) => !novas.some((n) => n.rodada_id === a.rodada_id)), ...novas]);
          tocarAviso();
        }
      }
      fotoRef.current = { dia: hoje, foto: nova };
      salvarFoto(hoje, nova);
      setRodadas(rs);
      setPremios(p.data as Premio[]);
      setGanhadores(gs);
      setLocutores(l.data as Locutor[]);
      setEscala(e.data as ItemEscala[]);
      setEntregas(x.data as Entrega[]);
    }
    setCarregando(false);
    return !falha;
  }, [sb, hoje]);

  // Pergunta "mudou algo?" a cada 15 s; baixa tudo só quando mudou (ou a cada 5 min, por garantia).
  useAtualizacao(sb, carregar, { intervaloMs: ATUALIZAR_PROMO_MS, forcarAposMs: 5 * 60_000 });

  const premioPorId = useMemo(() => new Map(premios.map((p) => [p.id, p])), [premios]);
  const ganhadoresDe = useCallback((id: string) => ganhadores.filter((g) => g.rodada_id === id), [ganhadores]);
  const comGanhador = useMemo(() => new Set(ganhadores.map((g) => g.rodada_id)), [ganhadores]);
  const entregaDe = useMemo(() => new Map(entregas.filter((e) => e.rodada_id).map((e) => [e.rodada_id!, e])), [entregas]);
  const concluidas = useMemo(() => new Set(entregaDe.keys()), [entregaDe]);
  const fila = useMemo(() => filaPromo(rodadas, concluidas, agora), [rodadas, concluidas, agora]);
  const faixaDe = useCallback(
    (r: Rodada): Faixa | null => (locutores.length ? noArEm(r.data, horaCurta(r.horario)!, locutores, escala) : null),
    [locutores, escala],
  );

  const lembretes = useMemo(
    () => premiosParaLembrar(rodadas, new Set([...comGanhador, ...concluidas]), dispensadas, agora).filter((l) => l.rodada.id !== aberta?.id),
    [rodadas, comGanhador, concluidas, dispensadas, agora, aberta],
  );

  const novidadePorRodada = useMemo(() => new Map(novidades.map((n) => [n.rodada_id, n])), [novidades]);
  // Abrir o prêmio já conta como "visto".
  const abrir = useCallback((r: Rodada) => {
    setAberta(r);
    setNovidades((ns) => ns.filter((n) => n.rodada_id !== r.id));
  }, []);
  const rodadaPorId = useMemo(() => new Map(rodadas.map((r) => [r.id, r])), [rodadas]);

  // Quem está no ar agora assina a entrega (a hora vem do servidor).
  const noArAgora = useMemo(() => (locutores.length ? noArEm(hoje, agora, locutores, escala) : null), [hoje, agora, locutores, escala]);

  async function concluir(r: Rodada) {
    setMarcando(r.id);
    setMsg(null);
    const { data, error } = await sb.rpc("concluir_premio", { p_rodada: r.id, p_locutor: noArAgora ? nomesFaixa(noArAgora) : "" });
    setMarcando(null);
    if (error) return setMsg({ texto: `Não deu para concluir: ${error.message}`, erro: true });
    const p = r.premio_id ? premioPorId.get(r.premio_id) : undefined;
    const nova: Entrega = {
      id: `local-${r.id}`, rodada_id: r.id, data: r.data, horario: r.horario, horario_fim: r.horario_fim ?? null,
      premio_id: r.premio_id, premio_nome: p?.nome ?? "", locutor: noArAgora ? nomesFaixa(noArAgora) : "", entregue_em: String(data),
    };
    setEntregas((es) => [...es.filter((e) => e.rodada_id !== r.id), nova]);
    setMsg({ texto: `Prêmio das ${horaH(r.horario)} concluído às ${horaNoFuso(nova.entregue_em)}. Valeu!` });
  }

  async function desfazer(r: Rodada) {
    setMarcando(r.id);
    const { data, error } = await sb.from("promo_entregas").delete().eq("rodada_id", r.id).select("id");
    setMarcando(null);
    if (error) return setMsg({ texto: error.message, erro: true });
    if (!data?.length) return setMsg({ texto: `Passou de ${DESFAZER_MIN} minutos: peça para a promoção corrigir no relatório.`, erro: true });
    setEntregas((es) => es.filter((e) => e.rodada_id !== r.id));
    setMsg({ texto: "Desfeito: o prêmio voltou para a fila." });
  }

  if (!carregando && rodadas.length === 0) {
    return (
      <section className="card secao-promo" aria-label="Promoção">
        <div className="secao-topo"><h2>🎁 Promoção</h2></div>
        <div className="vazio">Sem prêmios programados para hoje.</div>
      </section>
    );
  }

  const ROTULO: Record<EstadoFila, string> = { agora: "No ar agora", pendente: "Pendente", depois: "Próximo", concluido: "Concluído" };

  const card = ({ rodada: r, estado }: { rodada: Rodada; estado: EstadoFila }) => {
    const p = r.premio_id ? premioPorId.get(r.premio_id) : undefined;
    const gs = ganhadoresDe(r.id);
    const f = faixaDe(r);
    const ent = entregaDe.get(r.id);
    const podeDesfazer = ent && Date.now() - Date.parse(ent.entregue_em) < DESFAZER_MIN * 60_000;
    const tipo = p ? tipoPremio(p) : "";
    return (
      <article key={r.id} className={`promo-card estado-${estado} ${gs.length ? "com-ganhador" : ""} ${novidadePorRodada.has(r.id) ? "com-novidade" : ""}`} aria-label={`Prêmio das ${horaH(r.horario)}`}>
        <span className="promo-fita">
          {estado === "pendente" ? `⚠ Pendente · passou das ${faixaPremio(r).split(" às ")[1]}` : estado === "concluido" && ent ? `✓ Concluído às ${horaNoFuso(ent.entregue_em)}` : ROTULO[estado]}
          {novidadePorRodada.has(r.id) && <span className="promo-novo">{novidadePorRodada.get(r.id)!.tipo === "ganhador" ? "Ganhador novo" : "Atualizado"}</span>}
        </span>
        <button type="button" className="promo-abrir" onClick={() => abrir(r)} aria-label={`Abrir prêmio das ${horaH(r.horario)}: ${p?.nome || "a definir"}`}>
          <span className="promo-foto">
            <Imagem src={urlImagem(sb, p?.imagem_path)} alt="" className="thumb" ajustar prioridade={estado === "agora"} />
            <span className="promo-hora">{faixaPremio(r)}</span>
          </span>
          <span className="promo-info">
            <span className="promo-nome">{p?.nome || "Prêmio a definir"}</span>
            {tipo && <span className="promo-sub">{tipo}</span>}
            {f && <span className="promo-locutor"><Avatares sb={sb} locutores={f.locutores} tamanho={28} /> {nomesFaixa(f)}</span>}
            <span className={`promo-ganhador-box ${gs.length ? "com" : ""}`}>
              <span className="promo-ganhador-rotulo">🏆 Ganhador</span>
              {gs.length ? (
                gs.map((g, i) => (
                  <span key={i} className="promo-ganhador-nome">{g.nome}{detalheGanhador(g) && <small> · {detalheGanhador(g)}</small>}</span>
                ))
              ) : (
                <span className="promo-ganhador-espera">{estado === "depois" ? "Ainda vai ser sorteado" : "Aguardando a promoção"}</span>
              )}
            </span>
          </span>
        </button>
        <div className="promo-acoes">
          {ent ? (
            podeDesfazer && <button type="button" className="pequeno branco" disabled={marcando === r.id} onClick={() => desfazer(r)}>Desfazer</button>
          ) : (
            <button type="button" className="verde" disabled={marcando === r.id} onClick={() => concluir(r)} aria-label={`Concluído: prêmio das ${horaH(r.horario)}`}>
              {marcando === r.id ? "Salvando…" : "✓ Concluído"}
            </button>
          )}
        </div>
      </article>
    );
  };

  const maxInicio = Math.max(0, fila.length - porPagina);
  const atual = Math.min(inicio, maxInicio);
  const visiveis = fila.slice(atual, atual + porPagina);
  const ultimoVisivel = Math.min(fila.length, atual + porPagina);
  const pendentes = fila.filter((x) => x.estado === "pendente").length;

  const premioAberto = aberta?.premio_id ? premioPorId.get(aberta.premio_id) : undefined;

  return (
    <section className="card secao-promo" aria-label="Promoção">
      <div className="secao-topo" style={{ flexWrap: "wrap" }}>
        <h2>🎁 Promoção</h2>
        <ol className="promo-linha" aria-label="Prêmios de hoje">
          {rodadas.map((r) => {
            const estado = estadoPremio(r, agora);
            return (
              <li key={r.id}>
                <button type="button" className={`promo-chip ${estado} ${concluidas.has(r.id) ? "ganho" : !concluidas.has(r.id) && estado === "passou" ? "pendente" : ""}`} onClick={() => abrir(r)} title={premioPorId.get(r.premio_id ?? "")?.nome ?? "Prêmio a definir"}>
                  {concluidas.has(r.id) ? "✓ " : estado === "agora" ? "● " : estado === "passou" ? "⚠ " : ""}{horaH(r.horario)}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {erro && <div className="aviso erro">Erro ao buscar a promoção: {erro}</div>}
      {pendentes > 0 && <div className="aviso promo-pendentes" role="status">⚠ {pendentes === 1 ? "1 prêmio passou da hora" : `${pendentes} prêmios passaram da hora`} sem “Concluído”.</div>}
      {msg && <div className={`aviso ${msg.erro ? "erro" : "ok"}`} role="status">{msg.texto}</div>}
      <div className="carrossel-nav promo-nav">
        <button type="button" className="icone branco" aria-label="Prêmios anteriores" disabled={atual <= 0} onClick={() => setInicio(Math.max(0, atual - porPagina))}>◀</button>
        <span aria-live="polite" style={{ whiteSpace: "nowrap" }}>{fila.length ? `${atual + 1}–${ultimoVisivel} de ${fila.length}` : "…"}</span>
        <button type="button" className="icone" aria-label="Próximos prêmios" disabled={atual >= maxInicio} onClick={() => setInicio(Math.min(maxInicio, atual + porPagina))}>▶</button>
      </div>
      <div className="promo-fila" style={{ gridTemplateColumns: `repeat(${porPagina}, minmax(0, 1fr))` }}>
        {visiveis.map(card)}
      </div>

      {aberta && (
        <Modal titulo={`${premioAberto?.nome || "Prêmio"} · ${faixaPremio(aberta)}`} onFechar={() => setAberta(null)} leitura>
          <dl className="promo-ficha">
            <div><dt>Cliente / Evento / Prêmio</dt><dd>{premioAberto?.nome ?? "A definir"}</dd></div>
            {premioAberto && tipoPremio(premioAberto) && <div><dt>Parceria</dt><dd>{tipoPremio(premioAberto)}</dd></div>}
            {premioAberto?.patrocinador && <div><dt>Cliente</dt><dd>{premioAberto.patrocinador}</dd></div>}
            <div><dt>Horário</dt><dd>{faixaPremio(aberta)}</dd></div>
            {faixaDe(aberta) && <div><dt>Locutor</dt><dd>🎙 {nomesFaixa(faixaDe(aberta)!)}</dd></div>}
          </dl>
          {entregaDe.get(aberta.id) && <p className="aviso ok">✓ Concluído às {horaNoFuso(entregaDe.get(aberta.id)!.entregue_em)}{entregaDe.get(aberta.id)!.locutor ? ` · ${entregaDe.get(aberta.id)!.locutor}` : ""}</p>}
          {textoPuro(premioAberto?.descricao_html) ? <TextoRico html={premioAberto!.descricao_html} /> : <p className="dica">Sem nota cadastrada para este prêmio.</p>}
          <div className={`promo-modal-ganhador ${ganhadoresDe(aberta.id).length ? "com" : ""}`}>
            <span className="promo-ganhador-rotulo">🏆 Ganhador</span>
            {ganhadoresDe(aberta.id).length ? (
              ganhadoresDe(aberta.id).map((g, i) => (
                <strong key={i}>{g.nome}{detalheGanhador(g) ? ` · ${detalheGanhador(g)}` : ""}</strong>
              ))
            ) : (
              <span>Ainda não registrado pela promoção.</span>
            )}
          </div>
        </Modal>
      )}

      <div className="lembretes">
        {novidades.length > 0 && (
          <div className="lembretes-grupo" role="alert" aria-label="Novidade da promoção">
            {novidades.map((n) => {
              const r = rodadaPorId.get(n.rodada_id);
              if (!r) return null;
              const p = r.premio_id ? premioPorId.get(r.premio_id) : undefined;
              return (
                <div key={n.rodada_id} className={`lembrete lembrete-novidade ${n.tipo}`}>
                  <span className="lembrete-sino" aria-hidden>{n.tipo === "ganhador" ? "🏆" : "✏️"}</span>
                  <div className="lembrete-texto">
                    <span className="lembrete-quando">
                      {n.tipo === "ganhador" ? `Ganhador do prêmio das ${horaH(r.horario)}` : `Prêmio das ${horaH(r.horario)} foi alterado`} · Promoção
                    </span>
                    <strong>
                      {n.tipo === "ganhador"
                        ? ganhadoresDe(r.id).filter((g) => n.nomes.includes(g.nome)).map((g) => `${g.nome}${g.telefone_final ? ` · final ${g.telefone_final}` : ""}`).join(", ") || n.nomes.join(", ")
                        : p?.nome || "Prêmio"}
                    </strong>
                  </div>
                  <div className="lembrete-acoes">
                    <button type="button" className="verde" onClick={() => abrir(r)}>Abrir prêmio</button>
                    <button type="button" className="branco pequeno" aria-label={`Fechar novidade do prêmio das ${horaCurta(r.horario)}`} onClick={() => setNovidades((ns) => ns.filter((x) => x.rodada_id !== n.rodada_id))}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <LembretePremios
          sb={sb}
          lembretes={lembretes}
          premioPorId={premioPorId}
          onAbrir={abrir}
          onFechar={(id) => setDispensadas((d) => new Set(d).add(id))}
        />
      </div>
    </section>
  );
}

/** Pop-up fixo na tela quando um prêmio com aviso está para sair. */
function LembretePremios({ sb, lembretes, premioPorId, onAbrir, onFechar }: {
  sb: SupabaseClient;
  lembretes: { rodada: Rodada; faltam: number }[];
  premioPorId: Map<string, Premio>;
  onAbrir: (r: Rodada) => void;
  onFechar: (id: string) => void;
}) {
  const avisados = useRef(new Set<string>());
  useEffect(() => {
    let novo = false;
    for (const l of lembretes) {
      const marca = `${l.rodada.id}:${l.faltam <= 0 ? "hora" : "antes"}`;
      if (!avisados.current.has(marca)) {
        avisados.current.add(marca);
        novo = true;
      }
    }
    if (novo) tocarAviso();
  }, [lembretes]);

  if (!lembretes.length) return null;
  return (
    <div className="lembretes-grupo" role="alert" aria-label="Aviso de prêmio">
      {lembretes.map(({ rodada: r, faltam }) => {
        const p = r.premio_id ? premioPorId.get(r.premio_id) : undefined;
        const foto = urlImagem(sb, p?.imagem_path);
        return (
          <div key={r.id} className={`lembrete lembrete-premio ${faltam === 0 ? "agora" : ""}`}>
            {foto ? (
              <span className="lembrete-premio-foto"><Imagem src={foto} alt="" className="thumb" largura={112} altura={112} sizes="56px" /></span>
            ) : (
              <span className="lembrete-sino" aria-hidden>🎁</span>
            )}
            <div className="lembrete-texto">
              <span className="lembrete-quando">{textoFaltamPremio(faltam)} · Promoção</span>
              <strong>{horaH(r.horario)} · {p?.nome || "Prêmio"}</strong>
            </div>
            <div className="lembrete-acoes">
              <button type="button" className="verde" onClick={() => onAbrir(r)}>Abrir prêmio</button>
              <button type="button" className="branco pequeno" aria-label={`Fechar aviso do prêmio das ${horaCurta(r.horario)}`} onClick={() => onFechar(r.id)}>✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
