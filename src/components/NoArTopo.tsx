"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Avatares } from "@/components/Avatar";
import { nomesFaixa, type Faixa } from "@/lib/escala";

const hora = (h: string) => (h.endsWith(":00") ? `${h.slice(0, 2)}h` : h.replace(":", "h"));

/** No topo: quem está no ar agora (com foto), até quando, e quem entra depois. */
export function NoArTopo({ sb, noAr, depois }: {
  sb: SupabaseClient | null;
  noAr: Faixa | null;
  depois: { faixa: Faixa; amanha: boolean } | null;
}) {
  return (
    <div className="no-ar-topo" role="status" aria-label="No ar agora">
      {noAr ? <Avatares sb={sb} locutores={noAr.locutores} tamanho={46} /> : <span className="no-ar-topo-gravado" aria-hidden>▶</span>}
      <span className="no-ar-topo-texto">
        <small><span className="no-ar-ponto" aria-hidden>●</span> No ar{noAr ? ` · até ${hora(noAr.fim)}` : ""}</small>
        <strong>{noAr ? nomesFaixa(noAr) : "Programação gravada"}</strong>
        {depois && (
          <small className="no-ar-topo-depois">
            A seguir: {nomesFaixa(depois.faixa)} · {depois.amanha ? "amanhã " : ""}{hora(depois.faixa.inicio)}
          </small>
        )}
      </span>
    </div>
  );
}
