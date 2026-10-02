"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fmtData, fmtDiaSemana, hojeISO, somarDias } from "@/lib/datas";
import { csvRelatorio, instanteNoFuso, linhasRelatorio, resumoRelatorio, textoRelatorio } from "@/lib/pautas";
import { TIPO_PAUTA_LABEL, type Pauta, type PautaRealizada } from "@/lib/tipos";
import { erroMsg, type Avisar } from "./comum";

/** Relatório do dia: horário previsto x horário em que o locutor marcou "feita". */
export function RelatorioPautas({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  const [dia, setDia] = useState(hojeISO);
  const [pautas, setPautas] = useState<Pauta[]>([]);
  const [realizadas, setRealizadas] = useState<PautaRealizada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [horaManual, setHoraManual] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [p, r] = await Promise.all([
      sb.from("pautas").select("*").lte("data_inicio", dia).gte("data_fim", dia).eq("ativo", true).order("horario"),
      sb.from("pautas_realizadas").select("*").eq("dia", dia),
    ]);
    const falha = p.error ?? r.error;
    setErro(falha?.message ?? null);
    if (!falha) {
      setPautas(p.data as Pauta[]);
      setRealizadas(r.data as PautaRealizada[]);
    }
    setCarregando(false);
  }, [sb, dia]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const linhas = useMemo(() => linhasRelatorio(pautas, realizadas), [pautas, realizadas]);
  const resumo = resumoRelatorio(linhas);
  const texto = useMemo(() => textoRelatorio(dia, linhas), [dia, linhas]);
  const assunto = `Partiu Rádio Disney — pautas de ${fmtData(dia)}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      avisar("Relatório copiado: é só colar no e-mail");
    } catch {
      avisar("Não deu para copiar automaticamente. Selecione o texto abaixo e copie.", true);
    }
  }

  function baixar() {
    const url = URL.createObjectURL(new Blob([csvRelatorio(dia, linhas)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pautas-${dia}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function registrar(pauta: Pauta) {
    const hora = horaManual[pauta.id];
    if (!hora) return avisar("Coloque o horário em que a pauta foi feita.", true);
    try {
      const { error } = await sb
        .from("pautas_realizadas")
        .insert({ pauta_id: pauta.id, dia, realizado_em: instanteNoFuso(dia, hora), origem: "producao" });
      if (error) throw new Error(error.message);
      avisar(`${pauta.cliente}: registrada às ${hora}`);
      carregar();
    } catch (e) {
      avisar(erroMsg(e), true);
    }
  }

  async function desfazer(pauta: Pauta) {
    if (!confirm(`Desmarcar a pauta de ${pauta.cliente} como feita?`)) return;
    const { error } = await sb.from("pautas_realizadas").delete().eq("pauta_id", pauta.id).eq("dia", dia);
    if (error) return avisar(error.message, true);
    avisar("Pauta desmarcada");
    carregar();
  }

  return (
    <section className="card">
      <div className="secao-topo" style={{ flexWrap: "wrap" }}>
        <h2>Relatório de pautas · {fmtDiaSemana(dia)}</h2>
        <div className="tabela-acoes">
          <button type="button" className="pequeno verde" onClick={() => setDia((d) => somarDias(d, -1))}>◀ Dia anterior</button>
          <input type="date" aria-label="Dia do relatório" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} />
          <button type="button" className="pequeno verde" onClick={() => setDia((d) => somarDias(d, 1))}>Próximo dia ▶</button>
          <button type="button" className="pequeno branco" onClick={carregar}>↻ Atualizar</button>
        </div>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}

      {!carregando && linhas.length === 0 ? (
        <div className="vazio">Nenhuma pauta do Partiu Rádio Disney neste dia.</div>
      ) : (
        <>
          <div className="relatorio-resumo" aria-label="Resumo do dia">
            <span><strong>{resumo.feitas}</strong> de {resumo.total} feitas</span>
            <span><strong>{resumo.noHorario}</strong> no horário</span>
            <span className={resumo.naoFeitas ? "falta" : ""}><strong>{resumo.naoFeitas}</strong> não feitas</span>
          </div>
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr><th>Previsto</th><th>Cliente</th><th>Tipo</th><th>Locutor</th><th>Feita às</th><th>Situação</th><th>Ajuste</th></tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.pauta.id}>
                    <td><strong>{l.previsto}</strong></td>
                    <td className="texto">
                      <strong>{l.pauta.cliente}</strong>
                      {l.pauta.titulo && <div className="trecho">{l.pauta.titulo}</div>}
                    </td>
                    <td><span className={`etiqueta ${l.pauta.tipo === "EXPECTATIVA" ? "expectativa" : "valendo"}`}>{TIPO_PAUTA_LABEL[l.pauta.tipo]}</span></td>
                    <td>{l.pauta.locutor}</td>
                    <td>
                      {l.realizado ? <strong>{l.realizado}</strong> : "—"}
                      {l.ajusteProducao && <div className="trecho">pela produção</div>}
                    </td>
                    <td>
                      <span className={`etiqueta ${!l.realizado ? "relatorio-falta" : l.situacao === "No horário" ? "situacao-no-ar" : "ultimo-dia"}`}>{l.situacao}</span>
                    </td>
                    <td>
                      {l.realizado ? (
                        <button type="button" className="pequeno branco" onClick={() => desfazer(l.pauta)}>Desmarcar</button>
                      ) : (
                        <div className="tabela-acoes">
                          <input
                            type="time"
                            aria-label={`Horário em que a pauta de ${l.pauta.cliente} foi feita`}
                            value={horaManual[l.pauta.id] ?? ""}
                            onChange={(e) => setHoraManual((h) => ({ ...h, [l.pauta.id]: e.target.value }))}
                          />
                          <button type="button" className="pequeno" onClick={() => registrar(l.pauta)}>Registrar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: 18 }}>Para enviar à Opec e aos produtores</h3>
          <div className="acoes">
            <button type="button" className="verde" onClick={copiar}>Copiar texto do e-mail</button>
            <a className="botao branco" href={`mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`}>Abrir no e-mail</a>
            <button type="button" className="branco" onClick={baixar}>Baixar planilha (.csv)</button>
          </div>
          <pre className="relatorio-texto" aria-label="Texto do relatório">{texto}</pre>
        </>
      )}
    </section>
  );
}
