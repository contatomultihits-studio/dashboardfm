"use client";

import { useEffect, useRef } from "react";

/** `leitura`: janela larga e letra grande, para o locutor ler no ar. */
export function Modal({ titulo, onFechar, leitura, children }: {
  titulo: string;
  onFechar: () => void;
  leitura?: boolean;
  children: React.ReactNode;
}) {
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
      <div className={`card modal ${leitura ? "modal-leitura" : ""}`} role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="modal-topo">
          <h2>{titulo}</h2>
          <button ref={fecharRef} type="button" className="branco pequeno" onClick={onFechar}>Fechar ✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
