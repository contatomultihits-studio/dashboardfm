import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "imagens";
export const TAMANHO_MAXIMO = 5 * 1024 * 1024;

export function urlImagem(sb: SupabaseClient | null, path: string | null | undefined): string | null {
  if (!sb || !path) return null;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function enviarImagem(sb: SupabaseClient, pasta: string, arquivo: File): Promise<string> {
  if (arquivo.size > TAMANHO_MAXIMO) throw new Error("A imagem passa de 5 MB. Escolha uma menor.");
  const ext = (arquivo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${pasta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, arquivo, {
    cacheControl: "31536000",
    contentType: arquivo.type,
  });
  if (error) throw new Error(`Não foi possível enviar a imagem: ${error.message}`);
  return path;
}

/** Remove a imagem antiga. Falha aqui não deve travar o salvamento. */
export async function removerImagem(sb: SupabaseClient, path: string | null | undefined) {
  if (!path) return;
  await sb.storage.from(BUCKET).remove([path]);
}
