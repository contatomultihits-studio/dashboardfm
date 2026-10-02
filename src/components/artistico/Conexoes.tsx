"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Avisar } from "./comum";
import { ItensNoAr, type ConfigItensNoAr } from "./ItensNoAr";

const CONFIG: ConfigItensNoAr = {
  tabela: "conexoes",
  comImagem: true,
  comDestaque: false,
  feminino: true,
  nome: "conexão",
  plural: "Conexões",
  tituloNovo: "Nova conexão",
  rotuloTitulo: "Título (aparece no card, junto com a imagem)",
  exemploTitulo: "Rádio Disney no app",
  semPrazo: true,
};

export function Conexoes({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  return <ItensNoAr sb={sb} avisar={avisar} config={CONFIG} />;
}
