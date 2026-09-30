"use client";

import { useEffect, useId, useRef } from "react";
import { sanitizarHtml } from "@/lib/html";

const BOTOES: { rotulo: string; titulo: string; comando: string; valor?: string; estilo?: React.CSSProperties }[] = [
  { rotulo: "B", titulo: "Negrito", comando: "bold", estilo: { fontWeight: 900 } },
  { rotulo: "I", titulo: "Itálico", comando: "italic", estilo: { fontStyle: "italic" } },
  { rotulo: "S", titulo: "Sublinhado", comando: "underline", estilo: { textDecoration: "underline" } },
  { rotulo: "Vermelho", titulo: "Texto vermelho", comando: "foreColor", valor: "#dc2626", estilo: { color: "#dc2626" } },
  { rotulo: "Preto", titulo: "Texto preto", comando: "foreColor", valor: "#111111" },
  { rotulo: "Destaque", titulo: "Fundo amarelo", comando: "hiliteColor", valor: "#fff06a", estilo: { background: "#fff06a" } },
  { rotulo: "• Lista", titulo: "Lista com marcadores", comando: "insertUnorderedList" },
  { rotulo: "Limpar", titulo: "Remover formatação", comando: "removeFormat" },
];

/** Editor simples de texto com formatação. Para trocar o conteúdo, mude a `key` do componente. */
export function EditorTexto({
  rotulo,
  valorInicial,
  onChange,
  placeholder,
}: {
  rotulo: string;
  valorInicial: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitizarHtml(valorInicial);
    // Só no primeiro render: depois o conteúdo é do usuário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitir = () => onChange(ref.current?.innerHTML ?? "");

  function aplicar(comando: string, valor?: string) {
    ref.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(comando, false, valor);
    emitir();
  }

  return (
    <div className="campo" style={{ display: "grid", gap: 6 }}>
      <span id={id} style={{ fontWeight: 800, fontSize: "0.8rem", textTransform: "uppercase" }}>{rotulo}</span>
      <div className="editor-caixa">
        <div className="editor-barra" role="toolbar" aria-label={`Formatação: ${rotulo}`}>
          {BOTOES.map((b) => (
            <button
              key={b.titulo}
              type="button"
              className="pequeno branco"
              title={b.titulo}
              aria-label={b.titulo}
              style={{ textTransform: "none", ...b.estilo }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => aplicar(b.comando, b.valor)}
            >
              {b.rotulo}
            </button>
          ))}
        </div>
        <div
          ref={ref}
          className="editor"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-labelledby={id}
          data-placeholder={placeholder}
          onInput={emitir}
          onPaste={(e) => {
            // Cola só o texto, sem a formatação que vem do Word, WhatsApp etc.
            e.preventDefault();
            document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
            emitir();
          }}
        />
      </div>
    </div>
  );
}
