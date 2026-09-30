"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarImagem, removerImagem, TAMANHO_MAXIMO, urlImagem } from "@/lib/imagens";

/** Guarda o estado da imagem de um formulário: a atual (já salva), uma nova escolhida, ou remoção. */
export function useImagemForm() {
  const [atual, setAtual] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [remover, setRemover] = useState(false);

  return {
    atual,
    arquivo,
    remover,
    escolher(f: File | null) {
      setArquivo(f);
      setRemover(false);
    },
    marcarRemocao() {
      setArquivo(null);
      setRemover(true);
    },
    reiniciar(path: string | null) {
      setAtual(path);
      setArquivo(null);
      setRemover(false);
    },
    /**
     * Envia a imagem nova (se houver) e devolve o path a salvar no banco.
     * `confirmar` apaga a imagem antiga depois que o banco salvou; `desfazer` apaga a nova se o banco falhar.
     */
    async preparar(sb: SupabaseClient, pasta: string) {
      if (arquivo) {
        const novo = await enviarImagem(sb, pasta, arquivo);
        return { path: novo, confirmar: () => removerImagem(sb, atual), desfazer: () => removerImagem(sb, novo) };
      }
      if (remover) return { path: null, confirmar: () => removerImagem(sb, atual), desfazer: async () => {} };
      return { path: atual, confirmar: async () => {}, desfazer: async () => {} };
    },
  };
}

export function CampoImagem({ sb, imagem, rotulo = "Imagem" }: { sb: SupabaseClient; imagem: ReturnType<typeof useImagemForm>; rotulo?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const previaLocal = useMemo(() => (imagem.arquivo ? URL.createObjectURL(imagem.arquivo) : null), [imagem.arquivo]);
  useEffect(() => () => { if (previaLocal) URL.revokeObjectURL(previaLocal); }, [previaLocal]);

  // Limpa o input quando o formulário é reiniciado.
  useEffect(() => {
    if (!imagem.arquivo && inputRef.current) inputRef.current.value = "";
  }, [imagem.arquivo]);

  const previa = previaLocal ?? (imagem.remover ? null : urlImagem(sb, imagem.atual));

  return (
    <div className="campo" style={{ display: "grid", gap: 6 }}>
      <label htmlFor={`img-${rotulo}`} style={{ fontWeight: 800, fontSize: "0.8rem", textTransform: "uppercase" }}>{rotulo} (JPG, PNG ou WEBP, até 5 MB)</label>
      <div className="imagem-campo">
        {previa && <img src={previa} alt="Prévia" className="imagem-previa" />}
        <input
          ref={inputRef}
          id={`img-${rotulo}`}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > TAMANHO_MAXIMO) {
              setAviso("Essa imagem passa de 5 MB. Escolha uma menor.");
              e.target.value = "";
              return;
            }
            setAviso(null);
            imagem.escolher(f);
          }}
        />
        {previa && (
          <button type="button" className="pequeno branco" onClick={imagem.marcarRemocao}>Remover imagem</button>
        )}
      </div>
      {aviso && <span className="aviso erro">{aviso}</span>}
    </div>
  );
}
