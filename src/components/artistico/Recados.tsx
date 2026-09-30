"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Avisar } from "./comum";
import { ItensNoAr, type ConfigItensNoAr } from "./ItensNoAr";

const CONFIG: ConfigItensNoAr = {
  tabela: "recados",
  comImagem: false,
  comDestaque: true,
  feminino: false,
  nome: "recado",
  plural: "Recados",
  tituloNovo: "Novo recado rápido",
  rotuloTitulo: "Título (aparece no card)",
  exemploTitulo: "Boas-vindas aos novos ouvintes",
};

export function Recados({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  return <ItensNoAr sb={sb} avisar={avisar} config={CONFIG} />;
}
