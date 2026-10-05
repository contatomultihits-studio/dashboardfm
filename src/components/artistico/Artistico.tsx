"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AvisoConfig } from "@/components/AvisoConfig";
import { Topbar } from "@/components/Topbar";
import { getSupabase } from "@/lib/supabase/client";
import { Conexoes } from "./Conexoes";
import { Convidados } from "./Convidados";
import { Escala } from "./Escala";
import { Eventos } from "./Eventos";
import { Locutores } from "./Locutores";
import { Pautas } from "./Pautas";
import { Prioridades } from "./Prioridades";
import { Recados } from "./Recados";
import { RelatorioPautas } from "./RelatorioPautas";

const ABAS = [
  { id: "prioridades", rotulo: "Prioridades do ar" },
  { id: "recados", rotulo: "Recados" },
  { id: "pautas", rotulo: "Partiu Rádio Disney" },
  { id: "conexoes", rotulo: "Conexões" },
  { id: "convidados", rotulo: "Convidados" },
  { id: "eventos", rotulo: "Eventos" },
  { id: "relatorio", rotulo: "Relatório de pautas" },
  { id: "locutores", rotulo: "Locutores" },
  { id: "escala", rotulo: "Escala" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

export function Artistico() {
  const sb = getSupabase();
  const router = useRouter();
  const [estado, setEstado] = useState<"verificando" | "sem-permissao" | "ok">("verificando");
  const [email, setEmail] = useState("");
  const [aba, setAba] = useState<Aba>("prioridades");
  const [toast, setToast] = useState<{ msg: string; erro: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const avisar = useCallback((msg: string, erro = false) => {
    setToast({ msg, erro });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), erro ? 6000 : 2500);
  }, []);

  useEffect(() => {
    if (!sb) return;
    (async () => {
      const { data } = await sb.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setEmail(data.user.email ?? "");
      const { data: ok } = await sb.rpc("is_equipe");
      setEstado(ok ? "ok" : "sem-permissao");
    })();
  }, [sb, router]);

  async function sair() {
    await sb?.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <>
      <Topbar atual="artistico">
        {email && <button type="button" className="branco pequeno" onClick={sair} title={email}>Sair</button>}
      </Topbar>
      <main className="container">
        {!sb ? (
          <AvisoConfig />
        ) : estado === "verificando" ? (
          <div className="vazio">Verificando acesso…</div>
        ) : estado === "sem-permissao" ? (
          <div className="aviso">
            Você entrou como <strong>{email}</strong>, mas esse usuário ainda não foi liberado para editar.
            Peça para quem administra o Supabase rodar o comando de liberar equipe (final do arquivo <code>supabase/schema.sql</code>).
          </div>
        ) : (
          <>
            <div className="abas" role="tablist" aria-label="Seções do artístico">
              {ABAS.map((a) => (
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
            {aba === "prioridades" && <Prioridades sb={sb} avisar={avisar} />}
            {aba === "recados" && <Recados sb={sb} avisar={avisar} />}
            {aba === "pautas" && <Pautas sb={sb} avisar={avisar} />}
            {aba === "conexoes" && <Conexoes sb={sb} avisar={avisar} />}
            {aba === "convidados" && <Convidados sb={sb} avisar={avisar} />}
            {aba === "eventos" && <Eventos sb={sb} avisar={avisar} />}
            {aba === "relatorio" && <RelatorioPautas sb={sb} avisar={avisar} />}
            {aba === "locutores" && <Locutores sb={sb} avisar={avisar} />}
            {aba === "escala" && <Escala sb={sb} avisar={avisar} />}
          </>
        )}
      </main>
      {toast && <div className={`toast ${toast.erro ? "erro" : ""}`} role="status">{toast.msg}</div>}
    </>
  );
}
