"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Avatar, Avatares } from "@/components/Avatar";
import { fmtDiaMes, somarDias } from "@/lib/datas";
import { faixasDoDia, finsDeSemanaProntos, horarioFaixa, nomesFaixa, type Faixa } from "@/lib/escala";
import type { ItemEscala, Locutor } from "@/lib/tipos";

const mesmaFaixa = (a: Faixa | null, b: Faixa) => Boolean(a) && a!.data === b.data && a!.inicioMin === b.inicioMin && a!.origem === b.origem;

/**
 * Escala do fim de semana (sábado e domingo lado a lado), com a folga em destaque.
 * Começa no fim de semana atual/próximo; as setas passam pelos seguintes que já estão prontos.
 */
export function EscalaFimDeSemana({ sb, hoje, locutores, escala, noAr }: {
  sb: SupabaseClient | null;
  hoje: string;
  locutores: Locutor[];
  escala: ItemEscala[];
  noAr: Faixa | null;
}) {
  const sabados = finsDeSemanaProntos(hoje, escala);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  // Se o fim de semana escolhido já passou (ou sumiu), volta para o primeiro.
  const indice = Math.max(0, escolhido ? sabados.indexOf(escolhido) : 0);
  const sabado = sabados[indice];
  const domingo = somarDias(sabado, 1);

  const dias = [
    { rotulo: "Sábado", data: sabado, faixas: faixasDoDia(sabado, locutores, escala) },
    { rotulo: "Domingo", data: domingo, faixas: faixasDoDia(domingo, locutores, escala) },
  ];
  const escalados = new Set(dias.flatMap((d) => d.faixas.flatMap((f) => f.locutores.map((l) => l.id))));
  const folga = locutores.filter((l) => l.ativo && !l.freela && !escalados.has(l.id));
  const vazio = dias.every((d) => d.faixas.length === 0);

  return (
    <section className="card secao-fds" aria-label="Escala do fim de semana">
      <div className="secao-topo">
        <h2>Escala do fim de semana · {fmtDiaMes(sabado)} e {fmtDiaMes(domingo)}</h2>
        {sabados.length > 1 && (
          <div className="carrossel-nav">
            <button type="button" className="icone branco" aria-label="Fim de semana anterior" disabled={indice === 0} onClick={() => setEscolhido(sabados[indice - 1])}>◀</button>
            <span aria-live="polite" style={{ whiteSpace: "nowrap" }}>{indice + 1} de {sabados.length}</span>
            <button type="button" className="icone" aria-label="Próximo fim de semana" disabled={indice === sabados.length - 1} onClick={() => setEscolhido(sabados[indice + 1])}>▶</button>
          </div>
        )}
      </div>
      {vazio ? (
        <div className="vazio">Escala deste fim de semana ainda não definida.</div>
      ) : (
        <>
          <div className="fds-dias">
            {dias.map((d) => (
              <div key={d.data} className="fds-dia">
                <h3>{d.rotulo} <span>{fmtDiaMes(d.data)}</span></h3>
                {d.faixas.length === 0 ? (
                  <p className="dica">Ninguém escalado: programação gravada.</p>
                ) : (
                  <ul>
                    {d.faixas.map((f) => (
                      <li key={`${f.inicio}-${nomesFaixa(f)}`} className={mesmaFaixa(noAr, f) ? "no-ar" : ""} style={{ borderLeftColor: f.locutores[0]?.cor }}>
                        <span className="fds-horario">{horarioFaixa(f)}</span>
                        <Avatares sb={sb} locutores={f.locutores} tamanho={38} />
                        <strong>{nomesFaixa(f)}</strong>
                        {mesmaFaixa(noAr, f) && <span className="etiqueta no-ar-agora">● No ar</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          {folga.length > 0 && (
            <div className="fds-folga" role="group" aria-label="Folga dupla">
              <div className="fds-folga-titulo">Folga dupla</div>
              <ul className="fds-folga-nomes">
                {folga.map((l) => (
                  <li key={l.id}>
                    <Avatar sb={sb} locutor={l} tamanho={44} />
                    <strong>{l.nome}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
