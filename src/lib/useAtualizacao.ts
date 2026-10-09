"use client";

import { useCallback, useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Atualização econômica da tela do locutor: a cada `intervaloMs` pergunta ao banco só o número da
 * última alteração (versao_dados, alguns bytes). Baixa tudo de novo (`carregar`) só quando o número
 * mudou, ou depois de `forcarAposMs` sem baixar (garantia). Se a pergunta falhar (função ainda não
 * existe, por exemplo), volta ao jeito antigo: baixa tudo a cada intervalo.
 * `carregar` devolve true quando deu certo. `onConferido` avisa que conferiu e não havia novidade.
 */
export function useAtualizacao(
  sb: SupabaseClient | null,
  carregar: () => Promise<boolean>,
  { intervaloMs, forcarAposMs, onConferido }: { intervaloMs: number; forcarAposMs: number; onConferido?: () => void },
) {
  const versao = useRef<number | null>(null);
  const ultimaCarga = useRef(0);
  const conferido = useRef(onConferido);
  conferido.current = onConferido;

  const baixar = useCallback(async (v: number | null) => {
    if (await carregar()) {
      versao.current = v;
      ultimaCarga.current = Date.now();
    }
  }, [carregar]);

  const verificar = useCallback(async () => {
    if (!sb) return;
    const { data, error } = await sb.rpc("versao_dados");
    const v = error || typeof data !== "number" ? null : data;
    if (v === null || v !== versao.current || Date.now() - ultimaCarga.current > forcarAposMs) {
      await baixar(v);
    } else {
      conferido.current?.();
    }
  }, [sb, baixar, forcarAposMs]);

  useEffect(() => {
    // Trocou o que se busca (outro dia, por exemplo): baixa de novo na hora.
    versao.current = null;
    verificar();
    const timer = setInterval(verificar, intervaloMs);
    const aoVoltar = () => document.visibilityState === "visible" && verificar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [verificar, intervaloMs]);

  /** Botão "Atualizar": baixa tudo na hora, sem perguntar. */
  return useCallback(() => {
    if (!sb) return;
    sb.rpc("versao_dados").then(({ data, error }) => baixar(error || typeof data !== "number" ? null : data));
  }, [sb, baixar]);
}
