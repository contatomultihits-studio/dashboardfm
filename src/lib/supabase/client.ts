import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(url && key);

let cliente: SupabaseClient | null = null;

/** Cliente do navegador. Retorna null se as variáveis não foram configuradas. */
export function getSupabase(): SupabaseClient | null {
  if (!url || !key) return null;
  cliente ??= createBrowserClient(url, key);
  return cliente;
}
