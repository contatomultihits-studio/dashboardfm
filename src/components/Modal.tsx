"use client";

import { useEffect, useRef } from "react";

export function Modal({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  const fecharRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    fecharRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      anterior?.focus();
    };
  }, [onFechar]);

  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="modal-topo">
          <h2>{titulo}</h2>
          <button ref={fecharRef} type="button" className="branco pequeno" onClick={onFechar}>Fechar ✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
