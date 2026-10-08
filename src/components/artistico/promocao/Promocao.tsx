"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Avisar } from "../comum";
import { usePremios } from "./comum";
import { Ganhadores } from "./Ganhadores";
import { Ouvintes } from "./Ouvintes";
import { Premios } from "./Premios";
import { Rodadas } from "./Rodadas";

const SUBABAS = [
  { id: "grade", rotulo: "Grade do dia" },
  { id: "premios", rotulo: "Cliente / Evento / Prêmio" },
  { id: "ouvintes", rotulo: "Ouvintes e ganhadores" },
] as const;

/** Departamento de Promoção: prêmios, grade por horário, ganhadores e base de ouvintes. */
export function Promocao({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  const [aba, setAba] = useState<(typeof SUBABAS)[number]["id"]>("grade");
  const premios = usePremios(sb);

  return (
    <>
      <div className="promo-subabas card">
        <div className="abas" role="tablist" aria-label="Promoção">
          {SUBABAS.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={`pill ${aba === a.id ? "ativo" : ""}`} onClick={() => setAba(a.id)}>
              {a.rotulo}
            </button>
          ))}
        </div>
        <a className="botao amarelo" href="/promocao" target="_blank" rel="noreferrer">👁 Ver prévia (tela do locutor) ↗</a>
      </div>
      {aba === "grade" && <Rodadas sb={sb} avisar={avisar} premiosLista={premios} />}
      {aba === "premios" && <Premios sb={sb} avisar={avisar} lista={premios} />}
      {aba === "ouvintes" && (
        <>
          {/* Uma aba só: a base (busca, cadastro, bloqueados) e, embaixo, quem ganhou o quê no período. */}
          <Ouvintes sb={sb} avisar={avisar} />
          <Ganhadores sb={sb} avisar={avisar} premiosLista={premios} />
        </>
      )}
    </>
  );
}
