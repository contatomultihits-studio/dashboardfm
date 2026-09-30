"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Avisar = (mensagem: string, erro?: boolean) => void;

/**
 * Carrega uma tabela ordenada por `colunaData`. Por padrão só traz o que ainda não passou
 * (`colunaFiltro` >= `desde`); marcando "anteriores", traz tudo.
 */
export function useLista<T>(
  sb: SupabaseClient,
  tabela: string,
  colunaData: string,
  desde: string,
  ordemExtra?: string,
  colunaFiltro: string = colunaData,
) {
  const [itens, setItens] = useState<T[]>([]);
  const [anteriores, setAnteriores] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    let q = sb.from(tabela).select("*");
    if (!anteriores) q = q.gte(colunaFiltro, desde);
    q = q.order(colunaData, { ascending: !anteriores });
    if (ordemExtra) q = q.order(ordemExtra, { nullsFirst: false });
    const { data, error } = await q.order("created_at").limit(500);
    setErro(error?.message ?? null);
    if (!error) setItens(data as T[]);
    setCarregando(false);
  }, [sb, tabela, colunaData, desde, ordemExtra, colunaFiltro, anteriores]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { itens, carregando, erro, recarregar, anteriores, setAnteriores };
}

export function CabecalhoLista({ titulo, anteriores, setAnteriores, rotuloAnteriores }: {
  titulo: string;
  anteriores: boolean;
  setAnteriores: (v: boolean) => void;
  rotuloAnteriores: string;
}) {
  return (
    <div className="secao-topo" style={{ flexWrap: "wrap" }}>
      <h2>{titulo}</h2>
      <label className="check">
        <input type="checkbox" checked={anteriores} onChange={(e) => setAnteriores(e.target.checked)} />
        {rotuloAnteriores}
      </label>
    </div>
  );
}

export function erroMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
