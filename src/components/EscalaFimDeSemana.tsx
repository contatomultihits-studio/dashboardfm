"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Avatares } from "@/components/Avatar";
import { fmtDiaMes } from "@/lib/datas";
import { faixasDoDia, horarioFaixa, nomesFaixa, type Faixa } from "@/lib/escala";
import type { ItemEscala, Locutor } from "@/lib/tipos";

const mesmaFaixa = (a: Faixa | null, b: Faixa) => Boolean(a) && a!.data === b.data && a!.inicioMin === b.inicioMin && a!.origem === b.origem;

/** Escala do fim de semana (sábado e domingo lado a lado), com quem está de folga. */
export function EscalaFimDeSemana({ sb, sabado, domingo, locutores, escala, noAr }: {
  sb: SupabaseClient | null;
  sabado: string;
  domingo: string;
  locutores: Locutor[];
  escala: ItemEscala[];
  noAr: Faixa | null;
}) {
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
            <p className="fds-folga"><span className="etiqueta destaque">Folga</span> {folga.map((l) => l.nome).join(" · ")}</p>
          )}
        </>
      )}
    </section>
  );
}
