import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "imagens";
/** Tamanho máximo da foto escolhida (antes de reduzir). */
export const TAMANHO_MAXIMO = 20 * 1024 * 1024;
/** Limite do bucket no Supabase (depois de reduzir). */
const LIMITE_BUCKET = 5 * 1024 * 1024;
const LADO_MAXIMO = 1600;

export function urlImagem(sb: SupabaseClient | null, path: string | null | undefined): string | null {
  if (!sb || !path) return null;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Reduz a foto no navegador antes de enviar: no máximo 1600px no maior lado, em WebP.
 * GIF fica como está (pode ser animado). Se a versão reduzida não ficar menor, usa a original.
 */
export async function reduzirImagem(arquivo: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type) || typeof createImageBitmap === "undefined") return arquivo;
  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", 0.85));
    if (!blob || blob.type !== "image/webp" || blob.size >= arquivo.size) return arquivo;
    return new File([blob], arquivo.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return arquivo;
  }
}

export async function enviarImagem(sb: SupabaseClient, pasta: string, original: File): Promise<string> {
  if (original.size > TAMANHO_MAXIMO) throw new Error("A imagem passa de 20 MB. Escolha uma menor.");
  const arquivo = await reduzirImagem(original);
  if (arquivo.size > LIMITE_BUCKET) throw new Error("Mesmo reduzida, a imagem passou de 5 MB. Escolha outra.");
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

/**
 * Remove a imagem só se nenhum outro registro da tabela ainda usa
 * (com "Duplicar", várias versões podem dividir a mesma foto).
 */
export async function removerImagemSemUso(sb: SupabaseClient, tabela: string, path: string | null | undefined) {
  if (!path) return;
  const { count, error } = await sb.from(tabela).select("id", { count: "exact", head: true }).eq("imagem_path", path);
  if (error || count !== 0) return; // na dúvida, mantém
  await removerImagem(sb, path);
}
