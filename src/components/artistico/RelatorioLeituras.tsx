"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fmtData, fmtDiaSemana, hojeISO, somarDias } from "@/lib/datas";
import { csvLeituras, linhasLeituras, resumoLeituras, textoLeituras, TIPO_LEITURA_LABEL, type ItemLido } from "@/lib/relatorioLeituras";
import type { Leitura } from "@/lib/tipos";
import type { Avisar } from "./comum";

/** Relatório do dia: quantas vezes e em que horários cada prioridade/conexão foi aberta na dashboard. */
export function RelatorioLeituras({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  const [dia, setDia] = useState(hojeISO);
  const [noAr, setNoAr] = useState<ItemLido[]>([]);
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [p, c, l] = await Promise.all([
      sb.from("prioridades").select("id,titulo").lte("data_inicio", dia).gte("data_fim", dia).eq("ativo", true),
      sb.from("conexoes").select("id,titulo").lte("data_inicio", dia).gte("data_fim", dia).eq("ativo", true),
      sb.from("leituras").select("*").eq("dia", dia).order("lido_em"),
    ]);
    const falha = p.error ?? c.error ?? l.error;
    setErro(falha?.message ?? null);
    if (!falha) {
      setNoAr([
        ...(p.data as { id: string; titulo: string }[]).map((x) => ({ ...x, tipo: "prioridade" as const })),
        ...(c.data as { id: string; titulo: string }[]).map((x) => ({ ...x, tipo: "conexao" as const })),
      ]);
      setLeituras(l.data as Leitura[]);
    }
    setCarregando(false);
  }, [sb, dia]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const linhas = useMemo(() => linhasLeituras(noAr, leituras), [noAr, leituras]);
  const resumo = resumoLeituras(linhas);
  const texto = useMemo(() => textoLeituras(dia, linhas), [dia, linhas]);
  const assunto = `Prioridades e conexões — leituras de ${fmtData(dia)}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      avisar("Relatório copiado: é só colar no e-mail");
    } catch {
      avisar("Não deu para copiar automaticamente. Selecione o texto abaixo e copie.", true);
    }
  }

  function baixar() {
    const url = URL.createObjectURL(new Blob([csvLeituras(dia, linhas)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `leituras-${dia}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="card">
      <div className="secao-topo" style={{ flexWrap: "wrap" }}>
        <h2>Relatório de leituras · {fmtDiaSemana(dia)}</h2>
        <div className="tabela-acoes">
          <button type="button" className="pequeno verde" onClick={() => setDia((d) => somarDias(d, -1))}>◀ Dia anterior</button>
          <input type="date" aria-label="Dia do relatório de leituras" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} />
          <button type="button" className="pequeno verde" onClick={() => setDia((d) => somarDias(d, 1))}>Próximo dia ▶</button>
          <button type="button" className="pequeno branco" onClick={carregar}>↻ Atualizar</button>
        </div>
      </div>
      <p className="dica">Conta cada vez que um locutor abriu a prioridade ou conexão na dashboard (cliques repetidos em menos de 1 minuto contam uma vez).</p>

      {erro && <div className="aviso erro">{erro}</div>}

      {!carregando && linhas.length === 0 ? (
        <div className="vazio">Nenhuma prioridade ou conexão no ar neste dia.</div>
      ) : (
        <>
          <div className="relatorio-resumo" aria-label="Resumo das leituras">
            <span><strong>{resumo.total}</strong> leituras</span>
            <span><strong>{resumo.lidos}</strong> de {resumo.cards} cards lidos</span>
            <span className={resumo.naoLidos ? "falta" : ""}><strong>{resumo.naoLidos}</strong> sem leitura</span>
          </div>
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr><th>Tipo</th><th>Card</th><th>Leituras</th><th>Horários (quem estava no ar)</th></tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className={l.leituras.length ? "" : "nao-lido"}>
                    <td><span className="etiqueta cinza">{TIPO_LEITURA_LABEL[l.tipo]}</span></td>
                    <td className="texto"><strong>{l.titulo}</strong></td>
                    <td>
                      <span className={`etiqueta ${l.leituras.length ? "situacao-no-ar" : "relatorio-falta"}`}>
                        {l.leituras.length ? `${l.leituras.length}x` : "Não lido"}
                      </span>
                    </td>
                    <td>
                      <div className="leituras-horarios">
                        {l.leituras.map((x, i) => (
                          <span key={i} className="leitura-horario"><strong>{x.hora}</strong>{x.locutor ? ` · ${x.locutor}` : ""}</span>
                        ))}
                        {l.leituras.length === 0 && "—"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: 18 }}>Para enviar por e-mail</h3>
          <div className="acoes">
            <button type="button" className="verde" onClick={copiar}>Copiar texto do e-mail</button>
            <a className="botao branco" href={`mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`}>Abrir no e-mail</a>
            <button type="button" className="branco" onClick={baixar}>Baixar planilha (.csv)</button>
          </div>
          <pre className="relatorio-texto" aria-label="Texto do relatório de leituras">{texto}</pre>
        </>
      )}
    </section>
  );
}
