"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fmtData, hojeISO } from "@/lib/datas";
import { lerParticipantes, localOuvinte, normalizarBusca, situacaoLocutor, sortear, type OuvinteLocutor, type Participante } from "@/lib/promocao";

async function buscar(sb: SupabaseClient, termo: string): Promise<OuvinteLocutor[]> {
  const { data, error } = await sb.rpc("buscar_ouvintes_locutor", { p_busca: termo });
  if (error) throw new Error(error.message);
  return (data as OuvinteLocutor[]) ?? [];
}

function Situacao({ o, hoje }: { o: OuvinteLocutor; hoje: string }) {
  const s = situacaoLocutor(o, hoje);
  return <span className={`situacao-ouvinte ${s.tipo}`}>{s.texto}</span>;
}

function LinhaOuvinte({ o, hoje }: { o: OuvinteLocutor; hoje: string }) {
  return (
    <tr>
      <td className="texto">
        <strong>{o.nome}</strong>
        <div className="trecho">{[localOuvinte(o), o.telefone_final ? `final ${o.telefone_final}` : ""].filter(Boolean).join(" · ") || "Sem endereço"}</div>
      </td>
      <td className="texto">
        {o.ultima_vitoria ? <>{fmtData(o.ultima_vitoria)}<div className="trecho">{o.ultimo_premio}{o.vitorias > 1 ? ` · ${o.vitorias} prêmios no total` : ""}</div></> : "Nunca ganhou"}
      </td>
      <td><Situacao o={o} hoje={hoje} /></td>
    </tr>
  );
}

/** Na base, quem bate com o sorteado: pelo final do telefone (se a lista tinha número) ou pelo nome. */
function confere(p: Participante, achados: OuvinteLocutor[]): OuvinteLocutor[] {
  if (p.telefone) return achados.filter((o) => o.telefone_final && p.telefone.endsWith(o.telefone_final));
  const n = normalizarBusca(p.nome);
  return achados.filter((o) => normalizarBusca(o.nome) === n);
}

/**
 * Para o locutor, só consulta: buscar ouvinte ("já ganhou?") e sortear entre os participantes colados.
 * Não mostra o telefone completo nem deixa editar nada.
 */
export function OuvintesLocutor({ sb }: { sb: SupabaseClient }) {
  const hoje = hojeISO();
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<OuvinteLocutor[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2) {
      setAchados([]);
      return;
    }
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        setAchados(await buscar(sb, t));
        setErro(null);
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
      setBuscando(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [sb, termo]);

  // Sorteio
  const [lista, setLista] = useState("");
  const participantes = useMemo(() => lerParticipantes(lista), [lista]);
  const [sorteados, setSorteados] = useState<number[]>([]);
  const [conferindo, setConferindo] = useState(false);
  const [naBase, setNaBase] = useState<OuvinteLocutor[] | null>(null);
  useEffect(() => {
    setSorteados([]);
    setNaBase(null);
  }, [lista]);
  const atual = sorteados.length ? participantes[sorteados[sorteados.length - 1]] : null;

  async function sortearAgora() {
    const i = sortear(participantes, new Set(sorteados));
    if (i === null) return;
    setSorteados((s) => [...s, i]);
    setNaBase(null);
    setConferindo(true);
    const p = participantes[i];
    try {
      const r = await buscar(sb, p.telefone ? p.telefone.slice(-8) : p.nome);
      setNaBase(confere(p, r));
    } catch {
      setNaBase([]);
    }
    setConferindo(false);
  }

  return (
    <>
      <section className="card" aria-label="Buscar ouvinte">
        <div className="secao-topo"><h2>🔎 Buscar ouvinte · já ganhou?</h2></div>
        <label className="campo">
          Nome ou telefone
          <input type="search" placeholder="Ex.: Maria Silva ou 99999-8888" value={termo} onChange={(e) => setTermo(e.target.value)} />
        </label>
        <p className="dica" style={{ marginTop: 8 }}>Só consulta. Regra: quem ganhou só pode ganhar de novo depois de 30 dias.</p>
        {erro && <div className="aviso erro">{erro}</div>}
        {termo.trim().length >= 2 && !buscando && achados.length === 0 && !erro && (
          <div className="vazio">Ninguém na base com “{termo.trim()}”: pode ganhar (nunca ganhou).</div>
        )}
        {achados.length > 0 && (
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Ouvinte</th><th>Último prêmio</th><th>Situação hoje</th></tr></thead>
              <tbody>{achados.map((o, i) => <LinhaOuvinte key={i} o={o} hoje={hoje} />)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card sorteio" aria-label="Sorteio">
        <div className="secao-topo"><h2>🎲 Sorteio</h2></div>
        <label className="campo">
          Participantes (um por linha; pode colar do WhatsApp com o telefone)
          <textarea rows={6} value={lista} placeholder={"Maria Souza - (11) 99999-8888\nJoão da Silva\n…"} onChange={(e) => setLista(e.target.value)} />
        </label>
        <div className="acoes">
          <button type="button" className="amarelo" disabled={!participantes.length || sorteados.length >= participantes.length} onClick={sortearAgora}>
            {sorteados.length ? "🎲 Sortear outro" : "🎲 Sortear"}
          </button>
          <span className="resumo-periodo">
            {participantes.length} {participantes.length === 1 ? "participante" : "participantes"}{sorteados.length ? ` · ${sorteados.length} sorteado${sorteados.length > 1 ? "s" : ""}` : ""}
          </span>
          {lista && <button type="button" className="branco pequeno" onClick={() => setLista("")}>Limpar</button>}
        </div>
        {atual && (
          <div className="sorteado" role="status" aria-live="polite">
            <span className="sorteado-rotulo">Sorteado</span>
            <strong className="sorteado-nome">{atual.nome}</strong>
            {atual.telefone && <span className="trecho">final {atual.telefone.slice(-4)}</span>}
            <div className="sorteado-base">
              {conferindo ? (
                "Conferindo na base…"
              ) : naBase && naBase.length === 0 ? (
                <span className="situacao-ouvinte livre">Não está na base: pode ganhar (nunca ganhou)</span>
              ) : naBase ? (
                <table>
                  <tbody>{naBase.map((o, i) => <LinhaOuvinte key={i} o={o} hoje={hoje} />)}</tbody>
                </table>
              ) : null}
            </div>
          </div>
        )}
        {sorteados.length > 1 && (
          <p className="dica" style={{ marginTop: 10 }}>Já sorteados: {sorteados.slice(0, -1).map((i) => participantes[i].nome).join(", ")}</p>
        )}
      </section>
    </>
  );
}
