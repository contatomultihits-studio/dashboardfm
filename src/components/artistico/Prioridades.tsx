"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Avisar } from "./comum";
import { ItensNoAr, type ConfigItensNoAr } from "./ItensNoAr";

const CONFIG: ConfigItensNoAr = {
  tabela: "prioridades",
  comImagem: true,
  comDestaque: false,
  feminino: true,
  nome: "prioridade",
  plural: "Prioridades",
  tituloNovo: "Nova prioridade do ar",
  rotuloTitulo: "Título (aparece no card, junto com a imagem)",
  exemploTitulo: "Festivalzinho em Alto-Mar",
};

export function Prioridades({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  return <ItensNoAr sb={sb} avisar={avisar} config={CONFIG} />;
}
