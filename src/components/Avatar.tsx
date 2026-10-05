import type { SupabaseClient } from "@supabase/supabase-js";
import Image from "next/image";
import { urlImagem } from "@/lib/imagens";
import type { Locutor } from "@/lib/tipos";

/** Iniciais para quando o locutor ainda não tem foto: "M. Aurélio" → "MA". */
function iniciais(nome: string) {
  const partes = nome.replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : partes[0]?.[1] ?? "")).toUpperCase();
}

/** Foto redonda do locutor, com borda na cor dele; sem foto, as iniciais. */
export function Avatar({ sb, locutor, tamanho = 44 }: { sb: SupabaseClient | null; locutor: Pick<Locutor, "nome" | "cor" | "imagem_path">; tamanho?: number }) {
  const src = urlImagem(sb, locutor.imagem_path);
  const estilo = { width: tamanho, height: tamanho, borderColor: locutor.cor, background: locutor.cor };
  if (!src) {
    return (
      <span className="avatar sem-foto" style={{ ...estilo, fontSize: Math.round(tamanho * 0.38) }} aria-hidden>
        {iniciais(locutor.nome)}
      </span>
    );
  }
  return (
    <span className="avatar" style={estilo}>
      <Image src={src} alt="" width={tamanho * 2} height={tamanho * 2} sizes={`${tamanho}px`} />
    </span>
  );
}

/** Fotos lado a lado (dupla: Serginho & Suzana). */
export function Avatares({ sb, locutores, tamanho = 44 }: { sb: SupabaseClient | null; locutores: Pick<Locutor, "id" | "nome" | "cor" | "imagem_path">[]; tamanho?: number }) {
  return (
    <span className="avatares">
      {locutores.map((l) => <Avatar key={l.id} sb={sb} locutor={l} tamanho={tamanho} />)}
    </span>
  );
}
