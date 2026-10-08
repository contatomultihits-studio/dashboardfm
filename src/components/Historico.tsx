"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { fmtData, hojeISO, somarDias } from "@/lib/datas";
import { DESCRICAO_CAMPO, NOME_TABELA, resumoDados, type RegistroHistorico } from "@/lib/historico";
import { getSupabase } from "@/lib/supabase/client";

const POR_VEZ = 50;
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Quem criou, editou ou excluiu cada item, com data e hora. Só o administrador vê. */
export function Historico() {
  const sb = getSupabase()!;
  const [de, setDe] = useState(() => somarDias(hojeISO(), -7));
  const [ate, setAte] = useState(hojeISO);
  const [tabela, setTabela] = useState("");
  const [acao, setAcao] = useState("");
  const [termo, setTermo] = useState("");
  const [linhas, setLinhas] = useState<RegistroHistorico[]>([]);
  const [limite, setLimite] = useState(POR_VEZ);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);

  useEffect(() => setLimite(POR_VEZ), [de, ate, tabela, acao, termo]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    let q = sb.from("historico").select("*")
      .gte("em", `${de}T00:00:00-03:00`).lt("em", `${somarDias(ate, 1)}T00:00:00-03:00`);
    if (tabela) q = q.eq("tabela", tabela);
    if (acao) q = q.eq("acao", acao);
    const t = termo.trim().replace(/[%,()]/g, " ");
    if (t) q = q.or(`resumo.ilike.%${t}%,quem_nome.ilike.%${t}%`);
    const { data, error } = await q.order("em", { ascending: false }).limit(limite + 1);
    setErro(error?.message ?? null);
    if (!error) {
      setTemMais(data.length > limite);
      setLinhas((data as RegistroHistorico[]).slice(0, limite));
    }
    setCarregando(false);
  }, [sb, de, ate, tabela, acao, termo, limite]);

  useEffect(() => {
    const timer = setTimeout(carregar, 250);
    return () => clearTimeout(timer);
  }, [carregar]);

  return (
    <>
      <Topbar atual="historico" />
      <main className="container">
        <section className="card">
          <div className="secao-topo" style={{ flexWrap: "wrap" }}>
            <h2>Histórico de alterações</h2>
            <button type="button" className="pequeno branco" onClick={carregar}>↻ Atualizar</button>
          </div>
          <div className="form-grade historico-filtros">
            <label className="campo">De<input type="date" value={de} onChange={(e) => e.target.value && setDe(e.target.value)} /></label>
            <label className="campo">Até<input type="date" value={ate} onChange={(e) => e.target.value && setAte(e.target.value)} /></label>
            <label className="campo">
              Área
              <select value={tabela} onChange={(e) => setTabela(e.target.value)}>
                <option value="">Todas</option>
                {Object.entries(NOME_TABELA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="campo">
              Ação
              <select value={acao} onChange={(e) => setAcao(e.target.value)}>
                <option value="">Todas</option>
                <option value="criou">Criou</option>
                <option value="editou">Editou</option>
                <option value="excluiu">Excluiu</option>
              </select>
            </label>
            <label className="campo">Buscar (item ou pessoa)<input type="search" value={termo} onChange={(e) => setTermo(e.target.value)} /></label>
          </div>
          <p className="dica">Registra a partir da ativação do histórico. Só o administrador vê esta página.</p>
          {erro && <div className="aviso erro">{erro}</div>}
          {!carregando && linhas.length === 0 ? (
            <div className="vazio">Nenhuma alteração nesse período.</div>
          ) : (
            <div className="tabela-wrap">
              <table>
                <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Área</th><th>Item</th><th></th></tr></thead>
                <tbody>
                  {linhas.map((l) => (
                    <Fragment key={l.id}>
                      <tr>
                        <td style={{ whiteSpace: "nowrap" }}>{quando(l.em)}</td>
                        <td>{l.quem_nome || "—"}</td>
                        <td><span className={`etiqueta acao-${l.acao}`}>{l.acao}</span></td>
                        <td>{NOME_TABELA[l.tabela] ?? l.tabela}</td>
                        <td className="texto">{/^\d{4}-\d{2}-\d{2}$/.test(l.resumo) ? fmtData(l.resumo) : l.resumo || "—"}</td>
                        <td>
                          {(l.mudancas || l.dados) && (
                            <button type="button" className="pequeno branco" aria-expanded={aberto === l.id} onClick={() => setAberto(aberto === l.id ? null : l.id)}>
                              {aberto === l.id ? "Fechar" : "Detalhes"}
                            </button>
                          )}
                        </td>
                      </tr>
                      {aberto === l.id && (
                        <tr className="historico">
                          <td colSpan={6}>
                            <ul>
                              {l.mudancas && Object.entries(l.mudancas).map(([campo, m]) => (
                                <li key={campo}><strong>{DESCRICAO_CAMPO[campo] ?? campo}:</strong> {m.de || "(vazio)"} → {m.para || "(vazio)"}</li>
                              ))}
                              {l.dados && resumoDados(l.dados).map(([campo, v]) => (
                                <li key={campo}><strong>{DESCRICAO_CAMPO[campo] ?? campo}:</strong> {v}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {temMais && (
            <div className="carregar-mais">
              <button type="button" className="branco" onClick={() => setLimite((n) => n + POR_VEZ)}>Carregar mais</button>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
