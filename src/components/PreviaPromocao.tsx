"use client";

import { AvisoConfig } from "@/components/AvisoConfig";
import { PromocaoNoAr } from "@/components/PromocaoNoAr";
import { Topbar } from "@/components/Topbar";
import { getSupabase } from "@/lib/supabase/client";

/** Página de teste da Promoção, antes de ir para a dashboard (mesmo componente, sem mudar nada). */
export function PreviaPromocao() {
  const sb = getSupabase();
  return (
    <>
      <Topbar atual="promocao" />
      <main className="container">
        <div className="aviso previa-aviso">
          <strong>Prévia</strong> · É assim que a Promoção vai aparecer para o locutor. Ainda não está na dashboard.
        </div>
        {sb ? <PromocaoNoAr sb={sb} /> : <AvisoConfig />}
      </main>
    </>
  );
}
