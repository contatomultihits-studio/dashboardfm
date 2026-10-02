"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Avisar } from "./comum";
import { ItensNoAr, type ConfigItensNoAr } from "./ItensNoAr";

const CONFIG: ConfigItensNoAr = {
  tabela: "pautas",
  comImagem: false,
  comDestaque: false,
  feminino: true,
  nome: "pauta",
  plural: "Pautas do Partiu Rádio Disney",
  tituloNovo: "Nova pauta — Partiu Rádio Disney",
  rotuloTitulo: "Ação (opcional)",
  exemploTitulo: "Encontro de fãs na praça de eventos",
  pauta: true,
};

export function Pautas({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  return <ItensNoAr sb={sb} avisar={avisar} config={CONFIG} />;
}
