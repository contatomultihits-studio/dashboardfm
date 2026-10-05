"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Avatares } from "@/components/Avatar";
import { horarioFaixa, nomesFaixa, type Faixa } from "@/lib/escala";

const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

/**
 * Escala do dia na dashboard: quem está no ar em destaque, quem vem a seguir,
 * e quem já passou mais apagado. Em outro dia, só a lista.
 */
export function EscalaDia({ sb, dia, faixas, noAr, ehHoje, agora, titulo }: {
  sb: SupabaseClient | null;
  dia: string;
  faixas: Faixa[];
  noAr: Faixa | null;
  ehHoje: boolean;
  agora: string;
  titulo: string;
}) {
  const agoraMin = minutos(agora);
  // Minutos em relação a 00:00 do dia mostrado (a faixa que veio da noite anterior começa "antes" de 0).
  const desloc = (f: Faixa) => (f.data === dia ? 0 : -1440);
  const proxima = ehHoje ? faixas.find((f) => f.inicioMin + desloc(f) > agoraMin) : undefined;

  return (
    <section className="card secao-escala" aria-label="Escala de locutores">
      <div className="secao-topo">
        <h2>{titulo}</h2>
        {ehHoje && !noAr && faixas.length > 0 && <span className="etiqueta cinza">Agora: programação gravada</span>}
      </div>
      {faixas.length === 0 ? (
        <div className="vazio">Escala ainda não definida para este dia.</div>
      ) : (
        <ul className="escala-lista">
          {faixas.map((f) => {
            const estaNoAr = Boolean(noAr) && f.data === noAr!.data && f.inicioMin === noAr!.inicioMin && f.origem === noAr!.origem;
            const passou = ehHoje && !estaNoAr && f.fimMin + desloc(f) <= agoraMin;
            const classe = estaNoAr ? "no-ar" : f === proxima ? "a-seguir" : passou ? "passou" : "";
            return (
              <li key={`${f.data}-${f.inicio}-${nomesFaixa(f)}`} className={`escala-item ${classe}`} style={{ borderTopColor: f.locutores[0]?.cor }}>
                <Avatares sb={sb} locutores={f.locutores} tamanho={estaNoAr ? 64 : 48} />
                <span className="escala-texto">
                  {estaNoAr && <span className="etiqueta no-ar-agora">● No ar</span>}
                  {f === proxima && <span className="etiqueta cinza">A seguir</span>}
                  <strong>{nomesFaixa(f)}</strong>
                  <span className="escala-horario">{horarioFaixa(f)}</span>
                  {f.locutores.length === 1 && f.locutores[0].programa && <span className="escala-programa">{f.locutores[0].programa}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
