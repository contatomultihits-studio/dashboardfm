"use client";

import { useEffect, useId, useRef } from "react";
import { normalizarTamanhos, sanitizarHtml, TAMANHOS } from "@/lib/html";

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
  // Última seleção dentro do editor: o seletor de tamanho tira o foco do texto, então restauramos antes de aplicar.
  const selecao = useRef<Range | null>(null);

  useEffect(() => {
    const guardar = () => {
      const sel = document.getSelection();
      if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) selecao.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener("selectionchange", guardar);
    return () => document.removeEventListener("selectionchange", guardar);
  }, []);

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

  function aplicarTamanho(comando: string) {
    if (!ref.current) return;
    ref.current.focus();
    const sel = document.getSelection();
    if (sel && selecao.current) {
      sel.removeAllRanges();
      sel.addRange(selecao.current);
    }
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("fontSize", false, comando);
    normalizarTamanhos(ref.current);
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
          <select
            className="editor-tamanho"
            aria-label="Tamanho da fonte"
            title="Tamanho da fonte (selecione o texto antes)"
            value=""
            onChange={(e) => {
              if (e.target.value) aplicarTamanho(e.target.value);
            }}
          >
            <option value="">Tamanho…</option>
            {TAMANHOS.map((t) => (
              <option key={t.comando} value={t.comando}>{t.rotulo}</option>
            ))}
          </select>
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
