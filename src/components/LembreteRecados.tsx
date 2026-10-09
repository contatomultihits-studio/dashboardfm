"use client";

import { useEffect, useRef } from "react";
import { tocarAviso } from "@/components/LembretePautas";
import { textoPuro } from "@/lib/html";
import { fimHoje } from "@/lib/repeticao";
import type { Recado } from "@/lib/tipos";

/**
 * Pop-up do recado-lembrete: aparece com som na hora em que o recado começa e some sozinho no fim do
 * horário. "Ok, lido" fecha só o pop-up: o recado continua na faixa de recados até o fim.
 */
export function LembreteRecados({ recados, agora, onAbrir, onLido }: {
  recados: Recado[];
  agora: string;
  onAbrir: (r: Recado) => void;
  onLido: (id: string) => void;
}) {
  const avisados = useRef(new Set<string>());
  useEffect(() => {
    let novo = false;
    for (const r of recados) {
      if (!avisados.current.has(r.id)) {
        avisados.current.add(r.id);
        novo = true;
      }
    }
    if (novo) tocarAviso();
  }, [recados]);

  if (!recados.length) return null;
  return (
    <div className="lembretes-grupo" role="alert" aria-label="Lembrete de recado">
      {recados.map((r) => {
        const f = fimHoje(r, agora);
        const texto = textoPuro(r.conteudo_html);
        return (
          <div key={r.id} className="lembrete lembrete-recado agora">
            <span className="lembrete-sino" aria-hidden>🔔</span>
            <div className="lembrete-texto">
              <span className="lembrete-quando">
                Lembrete{f ? ` · até ${f.fim}${f.faltam > 0 ? ` · faltam ${f.faltam} min` : ""}` : ""}
              </span>
              <strong>{r.titulo || "Recado"}</strong>
              {texto && <span className="lembrete-recado-texto">{texto.length > 160 ? `${texto.slice(0, 160)}…` : texto}</span>}
            </div>
            <div className="lembrete-acoes">
              <button type="button" className="verde" onClick={() => onLido(r.id)}>Ok, lido</button>
              {texto.length > 160 && <button type="button" className="branco pequeno" onClick={() => onAbrir(r)}>Ler tudo</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
