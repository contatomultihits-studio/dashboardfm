"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AvisoConfig } from "@/components/AvisoConfig";
import { useAcesso } from "@/components/ComAcesso";
import { Topbar } from "@/components/Topbar";
import { pode, type Area } from "@/lib/acesso";
import { getSupabase } from "@/lib/supabase/client";
import { Conexoes } from "./Conexoes";
import { Convidados } from "./Convidados";
import { Escala } from "./Escala";
import { Eventos } from "./Eventos";
import { Jornalismo } from "./Jornalismo";
import { Locutores } from "./Locutores";
import { Pautas } from "./Pautas";
import { Promocao } from "./promocao/Promocao";
import { Prioridades } from "./Prioridades";
import { Recados } from "./Recados";
import { Relatorios } from "./Relatorios";

// Cada aba pertence a uma área de acesso (Escala vai junto com Locutores).
const ABAS = [
  { id: "prioridades", rotulo: "Prioridades do ar", area: "prioridades" },
  { id: "recados", rotulo: "Recados", area: "recados" },
  { id: "pautas", rotulo: "Partiu Rádio Disney", area: "partiu" },
  { id: "jornalismo", rotulo: "Jornalismo", area: "jornalismo" },
  { id: "promocao", rotulo: "Promoção", area: "promocao" },
  { id: "conexoes", rotulo: "Conexões", area: "conexoes" },
  { id: "convidados", rotulo: "Convidados", area: "convidados" },
  { id: "eventos", rotulo: "Eventos", area: "eventos" },
  { id: "relatorios", rotulo: "Relatórios", area: "relatorios" },
  { id: "locutores", rotulo: "Locutores", area: "locutores" },
  { id: "escala", rotulo: "Escala", area: "locutores" },
] as const satisfies readonly { id: string; rotulo: string; area: Area }[];
type Aba = (typeof ABAS)[number]["id"];

export function Artistico() {
  const sb = getSupabase();
  const acesso = useAcesso();
  const abas = useMemo(() => ABAS.filter((a) => pode(acesso, a.area)), [acesso]);
  const [escolhida, setAba] = useState<Aba | null>(null);
  const aba = escolhida ?? abas[0]?.id;
  const area = ABAS.find((a) => a.id === aba)?.area;
  const soVer = area ? !pode(acesso, area, "editar") : true;
  const [toast, setToast] = useState<{ msg: string; erro: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const avisar = useCallback((msg: string, erro = false) => {
    setToast({ msg, erro });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), erro ? 6000 : 2500);
  }, []);

  return (
    <>
      <Topbar atual="artistico" />
      <main className="container tela-cheia">
        {!sb ? (
          <AvisoConfig />
        ) : (
          <>
            <div className="abas" role="tablist" aria-label="Seções do artístico">
              {abas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={aba === a.id}
                  className={`pill ${aba === a.id ? "ativo" : ""}`}
                  style={{ boxShadow: aba === a.id ? undefined : "none" }}
                  onClick={() => setAba(a.id)}
                >
                  {a.rotulo}
                </button>
              ))}
            </div>
            {soVer && <div className="aviso aviso-leitura">Nesta área você pode <strong>só ver</strong>. Para mudar algo, fale com o administrador.</div>}
            <div className={soVer ? "somente-leitura" : undefined}>
            {aba === "prioridades" && <Prioridades sb={sb} avisar={avisar} />}
            {aba === "recados" && <Recados sb={sb} avisar={avisar} />}
            {aba === "pautas" && <Pautas sb={sb} avisar={avisar} />}
            {aba === "jornalismo" && <Jornalismo sb={sb} avisar={avisar} />}
            {aba === "promocao" && <Promocao sb={sb} avisar={avisar} />}
            {aba === "conexoes" && <Conexoes sb={sb} avisar={avisar} />}
            {aba === "convidados" && <Convidados sb={sb} avisar={avisar} />}
            {aba === "eventos" && <Eventos sb={sb} avisar={avisar} />}
            {aba === "relatorios" && <Relatorios sb={sb} avisar={avisar} />}
            {aba === "locutores" && <Locutores sb={sb} avisar={avisar} />}
            {aba === "escala" && <Escala sb={sb} avisar={avisar} />}
            </div>
          </>
        )}
      </main>
      {toast && <div className={`toast ${toast.erro ? "erro" : ""}`} role="status">{toast.msg}</div>}
    </>
  );
}
