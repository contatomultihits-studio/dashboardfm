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
  plural: "Pautas do Jornalismo",
  tituloNovo: "Nova pauta — Jornalismo",
  rotuloTitulo: "Assunto",
  exemploTitulo: "Final da Libertadores hoje às 21h30",
  pauta: true,
  secao: "jornalismo",
};

export function Jornalismo({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  return <ItensNoAr sb={sb} avisar={avisar} config={CONFIG} />;
}
