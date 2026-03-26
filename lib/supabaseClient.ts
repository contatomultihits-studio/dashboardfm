'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (cachedClient) return { client: cachedClient, error: null };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      client: null,
      error: 'Configuração ausente. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    };
  }

  cachedClient = createClient(supabaseUrl, supabaseAnonKey);
  return { client: cachedClient, error: null };
}
