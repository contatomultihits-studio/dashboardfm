"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locutor } from "@/lib/tipos";

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
  /** Filtro fixo de igualdade, ex.: ["secao", "jornalismo"]. */
  filtro?: [string, string],
) {
  const [itens, setItens] = useState<T[]>([]);
  const [anteriores, setAnteriores] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    let q = sb.from(tabela).select("*");
    if (filtro) q = q.eq(filtro[0], filtro[1]);
    if (!anteriores) q = q.gte(colunaFiltro, desde);
    q = q.order(colunaData, { ascending: !anteriores });
    if (ordemExtra) q = q.order(ordemExtra, { nullsFirst: false });
    const { data, error } = await q.order("created_at").limit(500);
    setErro(error?.message ?? null);
    if (!error) setItens(data as T[]);
    setCarregando(false);
  }, [sb, tabela, colunaData, desde, ordemExtra, colunaFiltro, anteriores, filtro?.[0], filtro?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

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

/** Locutores cadastrados (para escolher na escala e nas pautas). */
export function useLocutoresEquipe(sb: SupabaseClient) {
  const [locutores, setLocutores] = useState<Locutor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const recarregar = useCallback(async () => {
    const { data } = await sb.from("locutores").select("*").order("hora_inicio", { nullsFirst: false }).order("nome");
    setLocutores((data as Locutor[]) ?? []);
    setCarregando(false);
  }, [sb]);
  useEffect(() => {
    recarregar();
  }, [recarregar]);
  return { locutores, carregando, recarregar };
}
