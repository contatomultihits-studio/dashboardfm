"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Premio } from "@/lib/promocao";

/** Catálogo de prêmios (para escolher na grade e no ganhador). */
export function usePremios(sb: SupabaseClient) {
  const [premios, setPremios] = useState<Premio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(async () => {
    const { data, error } = await sb.from("premios").select("*").order("ativo", { ascending: false }).order("nome");
    setErro(error?.message ?? null);
    if (!error) setPremios(data as Premio[]);
    setCarregando(false);
  }, [sb]);
  useEffect(() => {
    recarregar();
  }, [recarregar]);
  return { premios, carregando, erro, recarregar };
}
