"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fmtData, hojeISO } from "@/lib/datas";
import { horaNoFuso } from "@/lib/pautas";
import { csvEntregas, faixaPremio, relatorioEntregas, type Entrega, type LinhaEntrega, type Rodada } from "@/lib/promocao";
import type { Avisar } from "./comum";

/** Prêmios entregues no ar: o horário da grade x a hora em que o locutor clicou "Concluído". */
export function RelatorioEntregas({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  const [de, setDe] = useState(hojeISO);
  const [ate, setAte] = useState(hojeISO);
  const [linhas, setLinhas] = useState<LinhaEntrega[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [r, e, p] = await Promise.all([
      sb.from("promo_rodadas").select("id,data,horario,horario_fim,premio_id").gte("data", de).lte("data", ate).eq("ativo", true).order("data").order("horario").limit(2000),
      sb.from("promo_entregas").select("*").gte("data", de).lte("data", ate).limit(2000),
      sb.from("premios").select("id,nome"),
    ]);
    const falha = r.error ?? e.error ?? p.error;
    setErro(falha?.message ?? null);
    if (!falha) {
      const nomes = new Map((p.data as { id: string; nome: string }[]).map((x) => [x.id, x.nome]));
      const rodadas = (r.data as Rodada[]).map((x) => ({ ...x, premio: x.premio_id ? nomes.get(x.premio_id) ?? "" : "" }));
      setLinhas(relatorioEntregas(rodadas, e.data as Entrega[]));
    }
    setCarregando(false);
  }, [sb, de, ate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const entregues = useMemo(() => linhas.filter((l) => l.entregue_em).length, [linhas]);

  function baixar() {
    const url = URL.createObjectURL(new Blob([csvEntregas(linhas, horaNoFuso)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `premios-entregues-${de}-a-${ate}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function desfazer(l: LinhaEntrega) {
    if (!l.rodada_id || !confirm(`Desfazer o "Concluído" do prêmio das ${faixaPremio(l)} (${fmtData(l.data)})?`)) return;
    const { data, error } = await sb.from("promo_entregas").delete().eq("rodada_id", l.rodada_id).select("id");
    if (error) return avisar(error.message, true);
    if (!data?.length) return avisar("Você não tem permissão para desfazer esta entrega.", true);
    avisar("Entrega desfeita");
    carregar();
  }

  return (
    <section className="card">
      <div className="secao-topo" style={{ flexWrap: "wrap" }}>
        <h2>Prêmios entregues no ar</h2>
        <div className="tabela-acoes" style={{ flexWrap: "wrap" }}>
          <input type="date" aria-label="Desde" value={de} onChange={(e) => e.target.value && setDe(e.target.value)} />
          <span style={{ alignSelf: "center", fontWeight: 800 }}>até</span>
          <input type="date" aria-label="Até" value={ate} onChange={(e) => e.target.value && setAte(e.target.value)} />
          <button type="button" className="pequeno branco" onClick={carregar}>↻ Atualizar</button>
        </div>
      </div>
      {erro && <div className="aviso erro">{erro}</div>}
      <div className="acoes" style={{ marginBottom: 12 }}>
        {linhas.length > 0 && <button type="button" className="branco" onClick={baixar}>Baixar planilha (.csv)</button>}
        {!carregando && (
          <span className="resumo-periodo">
            {entregues} de {linhas.length} {linhas.length === 1 ? "prêmio entregue" : "prêmios entregues"} · {de === ate ? fmtData(de) : `${fmtData(de)} a ${fmtData(ate)}`}
          </span>
        )}
      </div>
      {!carregando && linhas.length === 0 ? (
        <div className="vazio">Nenhum prêmio na grade nesse período.</div>
      ) : (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr><th>Data</th><th>Horário</th><th>Prêmio</th><th>Entregue no ar</th><th>Locutor</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtData(l.data)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{faixaPremio(l)}</td>
                  <td className="texto">{l.premio || "—"}</td>
                  <td>
                    {l.entregue_em
                      ? <span className="etiqueta situacao-no-ar">✓ {horaNoFuso(l.entregue_em)}</span>
                      : <span className="etiqueta relatorio-falta">Não entregue</span>}
                  </td>
                  <td>{l.locutor || "—"}</td>
                  <td>
                    {l.entregue_em && l.rodada_id && (
                      <div className="tabela-acoes">
                        <button type="button" className="pequeno branco" onClick={() => desfazer(l)}>Desfazer</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
