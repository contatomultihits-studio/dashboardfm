"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fmtData, hojeISO, horaCurta } from "@/lib/datas";
import { csvGanhadores, fmtTelefone, localOuvinte, type Ganhador, type LinhaGanhador, type Ouvinte, type Rodada } from "@/lib/promocao";
import type { Avisar } from "../comum";
import type { usePremios } from "./comum";
import { RegistrarGanhador } from "./RegistrarGanhador";

const inicioDoMes = (iso: string) => `${iso.slice(0, 8)}01`;

/** Relatório de ganhadores por período, com planilha e lançamento manual. */
export function Ganhadores({ sb, avisar, premiosLista }: { sb: SupabaseClient; avisar: Avisar; premiosLista: ReturnType<typeof usePremios> }) {
  const [de, setDe] = useState(() => inicioDoMes(hojeISO()));
  const [ate, setAte] = useState(hojeISO);
  const [linhas, setLinhas] = useState<LinhaGanhador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [lancando, setLancando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await sb.from("ganhadores").select("*").gte("data", de).lte("data", ate)
      .order("data", { ascending: false }).order("ganho_em", { ascending: false }).limit(2000);
    if (error) {
      setErro(error.message);
      setCarregando(false);
      return;
    }
    const gs = data as Ganhador[];
    const idsO = [...new Set(gs.map((g) => g.ouvinte_id))];
    const idsR = [...new Set(gs.map((g) => g.rodada_id).filter(Boolean))] as string[];
    const [o, r] = await Promise.all([
      idsO.length ? sb.from("ouvintes").select("*").in("id", idsO) : Promise.resolve({ data: [], error: null }),
      idsR.length ? sb.from("promo_rodadas").select("id,horario").in("id", idsR) : Promise.resolve({ data: [], error: null }),
    ]);
    const ouv = new Map((o.data as Ouvinte[]).map((x) => [x.id, x]));
    const hor = new Map((r.data as Pick<Rodada, "id" | "horario">[]).map((x) => [x.id, horaCurta(x.horario)]));
    setErro(o.error?.message ?? r.error?.message ?? null);
    setLinhas(gs.map((g) => ({ ...g, ouvinte: ouv.get(g.ouvinte_id), horario: g.rodada_id ? hor.get(g.rodada_id) ?? null : null })));
    setCarregando(false);
  }, [sb, de, ate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function baixar() {
    const url = URL.createObjectURL(new Blob([csvGanhadores(linhas)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ganhadores-${de}-a-${ate}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function excluir(l: LinhaGanhador) {
    if (!confirm(`Apagar o prêmio de ${l.ouvinte?.nome ?? "ouvinte"} (${fmtData(l.data)} · ${l.premio_nome})? O ouvinte continua na base.`)) return;
    const { error } = await sb.from("ganhadores").delete().eq("id", l.id);
    if (error) return avisar(error.message, true);
    avisar("Registro apagado");
    carregar();
  }

  return (
    <section className="card">
      <div className="secao-topo" style={{ flexWrap: "wrap" }}>
        <h2>Ganhadores</h2>
        <div className="tabela-acoes" style={{ flexWrap: "wrap" }}>
          <input type="date" aria-label="Desde" value={de} onChange={(e) => e.target.value && setDe(e.target.value)} />
          <span style={{ alignSelf: "center", fontWeight: 800 }}>até</span>
          <input type="date" aria-label="Até" value={ate} onChange={(e) => e.target.value && setAte(e.target.value)} />
          <button type="button" className="pequeno branco" onClick={carregar}>↻ Atualizar</button>
        </div>
      </div>
      {erro && <div className="aviso erro">{erro}</div>}
      <div className="acoes" style={{ marginBottom: 12 }}>
        <button type="button" className="amarelo" onClick={() => setLancando(true)}>+ Lançar ganhador sem horário</button>
        {linhas.length > 0 && <button type="button" className="branco" onClick={baixar}>Baixar planilha (.csv)</button>}
        {!carregando && <span className="resumo-periodo">{linhas.length} {linhas.length === 1 ? "ganhador" : "ganhadores"} de {fmtData(de)} a {fmtData(ate)}</span>}
      </div>
      {!carregando && linhas.length === 0 ? (
        <div className="vazio">Nenhum ganhador nesse período.</div>
      ) : (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr><th>Data</th><th>Ouvinte</th><th>Prêmio</th><th>Locutor</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap" }}><strong>{fmtData(l.data)}</strong>{l.horario && ` ${l.horario}`}</td>
                  <td className="texto">
                    <strong>{l.ouvinte?.nome ?? "—"}</strong>
                    <div className="trecho">{l.ouvinte ? [fmtTelefone(l.ouvinte.telefone), localOuvinte(l.ouvinte)].filter(Boolean).join(" · ") : ""}</div>
                  </td>
                  <td className="texto">
                    {l.premio_nome}
                    {l.importado && <span className="etiqueta cinza" style={{ marginLeft: 6 }}>Planilha</span>}
                    {l.obs && <div className="trecho">{l.obs}</div>}
                  </td>
                  <td>{l.locutor || "—"}</td>
                  <td><button type="button" className="pequeno vermelho" onClick={() => excluir(l)}>Apagar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lancando && (
        <RegistrarGanhador
          sb={sb}
          avisar={avisar}
          rodada={null}
          premios={premiosLista.premios}
          dia={hojeISO()}
          locutorSugerido=""
          onSalvo={() => {
            setLancando(false);
            carregar();
          }}
          onFechar={() => setLancando(false)}
        />
      )}
    </section>
  );
}
