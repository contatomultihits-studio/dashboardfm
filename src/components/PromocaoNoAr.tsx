"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Avatares } from "@/components/Avatar";
import { Imagem } from "@/components/Imagem";
import { tocarAviso } from "@/components/LembretePautas";
import { Modal } from "@/components/Modal";
import { TextoRico } from "@/components/TextoRico";
import { agoraHHMM, hojeISO, horaCurta, somarDias } from "@/lib/datas";
import { noArEm, nomesFaixa, type Faixa } from "@/lib/escala";
import { textoPuro } from "@/lib/html";
import { urlImagem } from "@/lib/imagens";
import { estadoPremio, faixaPremio, fotoPromo, localOuvinte, momentoPromo, novidadesPromo, premiosParaLembrar, textoFaltamPremio, type FotoPromo, type GanhadorPublico, type NovidadePromo, type Premio, type Rodada } from "@/lib/promocao";
import type { ItemEscala, Locutor } from "@/lib/tipos";

type Papel = "ultimo" | "daHora" | "proximo";

const ROTULO: Record<Papel, string> = { ultimo: "Último prêmio", daHora: "Prêmio da hora", proximo: "Próximo prêmio" };
const VAZIO: Record<Papel, string> = {
  ultimo: "Ainda não teve prêmio hoje",
  daHora: "Nenhum prêmio rolando agora",
  proximo: "Sem mais prêmios hoje",
};

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
 * Promoção na tela do locutor: último prêmio, prêmio da hora (em destaque) e o próximo,
 * a linha do dia com todos os horários e o pop-up de aviso. Busca os próprios dados,
 * para poder ir para a dashboard sem mudar nada.
 */
export function PromocaoNoAr({ sb }: { sb: SupabaseClient }) {
  const [agora, setAgora] = useState(agoraHHMM());
  const hoje = useMemo(() => hojeISO(), [agora]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rodadas, setRodadas] = useState<Rodada[]>([]);
  const [premios, setPremios] = useState<Premio[]>([]);
  const [ganhadores, setGanhadores] = useState<GanhadorPublico[]>([]);
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

  const carregar = useCallback(async () => {
    const [r, p, g, l, e] = await Promise.all([
      sb.from("promo_rodadas").select("*").eq("data", hoje).eq("ativo", true).order("horario"),
      sb.from("premios").select("*").eq("ativo", true),
      sb.rpc("promocao_ganhadores_dia", { p_dia: hoje }),
      sb.from("locutores").select("*").eq("ativo", true),
      sb.from("escala").select("*").in("data", [hoje, somarDias(hoje, -1)]),
    ]);
    const falha = r.error ?? p.error ?? g.error ?? l.error ?? e.error;
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
    }
    setCarregando(false);
  }, [sb, hoje]);

  useEffect(() => {
    carregar();
    const timer = setInterval(carregar, ATUALIZAR_PROMO_MS);
    // Voltou para a aba (ou o computador acordou): busca na hora.
    const aoVoltar = () => document.visibilityState === "visible" && carregar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [carregar]);

  const premioPorId = useMemo(() => new Map(premios.map((p) => [p.id, p])), [premios]);
  const ganhadoresDe = useCallback((id: string) => ganhadores.filter((g) => g.rodada_id === id), [ganhadores]);
  const comGanhador = useMemo(() => new Set(ganhadores.map((g) => g.rodada_id)), [ganhadores]);
  const momento = useMemo(() => momentoPromo(rodadas, agora), [rodadas, agora]);
  const faixaDe = useCallback(
    (r: Rodada): Faixa | null => (locutores.length ? noArEm(r.data, horaCurta(r.horario)!, locutores, escala) : null),
    [locutores, escala],
  );

  const lembretes = useMemo(
    () => premiosParaLembrar(rodadas, comGanhador, dispensadas, agora).filter((l) => l.rodada.id !== aberta?.id),
    [rodadas, comGanhador, dispensadas, agora, aberta],
  );

  const novidadePorRodada = useMemo(() => new Map(novidades.map((n) => [n.rodada_id, n])), [novidades]);
  // Abrir o prêmio já conta como "visto".
  const abrir = useCallback((r: Rodada) => {
    setAberta(r);
    setNovidades((ns) => ns.filter((n) => n.rodada_id !== r.id));
  }, []);
  const rodadaPorId = useMemo(() => new Map(rodadas.map((r) => [r.id, r])), [rodadas]);

  if (!carregando && rodadas.length === 0) {
    return (
      <section className="card secao-promo" aria-label="Promoção">
        <div className="secao-topo"><h2>🎁 Promoção</h2></div>
        <div className="vazio">Sem prêmios programados para hoje.</div>
      </section>
    );
  }

  const card = (papel: Papel) => {
    const r = momento[papel];
    if (!r) {
      return (
        <div key={papel} className={`promo-card vazio-card papel-${papel}`}>
          <span className="promo-fita">{ROTULO[papel]}</span>
          <span className="promo-vazio">{carregando ? "…" : VAZIO[papel]}</span>
        </div>
      );
    }
    const p = r.premio_id ? premioPorId.get(r.premio_id) : undefined;
    const gs = ganhadoresDe(r.id);
    const f = faixaDe(r);
    return (
      <button key={papel} type="button" className={`promo-card papel-${papel} ${gs.length ? "com-ganhador" : ""} ${novidadePorRodada.has(r.id) ? "com-novidade" : ""}`} onClick={() => abrir(r)}>
        <span className="promo-fita">
          {ROTULO[papel]}
          {novidadePorRodada.has(r.id) && <span className="promo-novo">{novidadePorRodada.get(r.id)!.tipo === "ganhador" ? "Ganhador novo" : "Atualizado"}</span>}
        </span>
        <span className="promo-foto">
          <Imagem src={urlImagem(sb, p?.imagem_path)} alt="" className="thumb" ajustar prioridade={papel === "daHora"} />
          <span className="promo-hora">{faixaPremio(r)}</span>
        </span>
        <span className="promo-info">
          <span className="promo-nome">{p?.nome || "Prêmio a definir"}</span>
          {p?.patrocinador && <span className="promo-sub">Cliente: {p.patrocinador}</span>}
          {f && <span className="promo-locutor"><Avatares sb={sb} locutores={f.locutores} tamanho={28} /> {nomesFaixa(f)}</span>}
          <span className={`promo-ganhador-box ${gs.length ? "com" : ""}`}>
            <span className="promo-ganhador-rotulo">🏆 Ganhador</span>
            {gs.length ? (
              gs.map((g, i) => (
                <span key={i} className="promo-ganhador-nome">{g.nome}{localOuvinte(g) && <small> · {localOuvinte(g)}</small>}</span>
              ))
            ) : (
              <span className="promo-ganhador-espera">{papel === "proximo" ? "Ainda vai ser sorteado" : "Aguardando a promoção"}</span>
            )}
          </span>
        </span>
      </button>
    );
  };

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
                <button type="button" className={`promo-chip ${estado} ${comGanhador.has(r.id) ? "ganho" : ""}`} onClick={() => abrir(r)} title={premioPorId.get(r.premio_id ?? "")?.nome ?? "Prêmio a definir"}>
                  {comGanhador.has(r.id) ? "✓ " : estado === "agora" ? "● " : ""}{horaH(r.horario)}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {erro && <div className="aviso erro">Erro ao buscar a promoção: {erro}</div>}
      <div className="promo-trio">
        {card("ultimo")}
        {card("daHora")}
        {card("proximo")}
      </div>

      {aberta && (
        <Modal titulo={`${premioAberto?.nome || "Prêmio"} · ${faixaPremio(aberta)}`} onFechar={() => setAberta(null)} leitura>
          <dl className="promo-ficha">
            <div><dt>Prêmio</dt><dd>{premioAberto?.nome ?? "A definir"}</dd></div>
            <div><dt>Cliente</dt><dd>{premioAberto?.patrocinador || "—"}</dd></div>
            <div><dt>Na tela</dt><dd>{faixaPremio(aberta)}</dd></div>
            {faixaDe(aberta) && <div><dt>Locutor</dt><dd>🎙 {nomesFaixa(faixaDe(aberta)!)}</dd></div>}
          </dl>
          {textoPuro(premioAberto?.descricao_html) ? <TextoRico html={premioAberto!.descricao_html} /> : <p className="dica">Sem descrição cadastrada para este prêmio.</p>}
          <div className={`promo-modal-ganhador ${ganhadoresDe(aberta.id).length ? "com" : ""}`}>
            <span className="promo-ganhador-rotulo">🏆 Ganhador</span>
            {ganhadoresDe(aberta.id).length ? (
              ganhadoresDe(aberta.id).map((g, i) => (
                <strong key={i}>{g.nome}{localOuvinte(g) ? ` · ${localOuvinte(g)}` : ""}</strong>
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
                    <strong>{n.tipo === "ganhador" ? n.nomes.join(", ") : p?.nome || "Prêmio"}</strong>
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
