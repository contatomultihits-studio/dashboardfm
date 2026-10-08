"use client";

import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { AvisoConfig } from "@/components/AvisoConfig";
import { entraNoArtistico, type Acesso } from "@/lib/acesso";
import { getSupabase } from "@/lib/supabase/client";

const AcessoCtx = createContext<Acesso | null>(null);

/** Quem entrou (null fora das páginas protegidas, como o login). */
export const useAcesso = () => useContext(AcessoCtx);

// Último acesso conferido, para a dashboard abrir mesmo se a internet ou o Supabase caírem
// (os dados continuam protegidos pelo banco; isto só evita a tela travada no estúdio).
const CHAVE = "acesso-guardado";
type Guardado = { user: string; acesso: Acesso };
function guardado(user: string): Acesso | null {
  try {
    const g = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as Guardado | null;
    return g?.user === user && g.acesso.ativo && g.acesso.senha_alterada ? g.acesso : null;
  } catch {
    return null;
  }
}
function guardar(g: Guardado | null) {
  try {
    if (g) localStorage.setItem(CHAVE, JSON.stringify(g));
    else localStorage.removeItem(CHAVE);
  } catch {}
}
/** Falha de rede ou do servidor (não é "sessão inválida"). */
const ehFalhaDeConexao = (e: AuthError | { message: string; code?: string } | null) =>
  !!e && (("status" in e && (isAuthRetryableFetchError(e) || !e.status || e.status >= 500)) || /fetch|network/i.test(e.message));

export async function sair() {
  guardar(null);
  await getSupabase()?.auth.signOut();
  window.location.assign("/login");
}

const aqui = () => window.location.pathname + window.location.search;

/**
 * Só mostra a página para quem entrou, está liberado e já trocou a senha inicial.
 * `exigir`: regra extra da página ("artistico": alguma área liberada; "admin": só o administrador).
 */
const REGRAS: Record<"artistico" | "admin", (a: Acesso) => boolean> = {
  artistico: entraNoArtistico,
  admin: (a) => a.tipo === "admin",
};

export function ComAcesso({ exigir, children }: { exigir?: keyof typeof REGRAS; children: React.ReactNode }) {
  const sb = getSupabase();
  const [acesso, setAcesso] = useState<Acesso | null>(null);
  const [falha, setFalha] = useState(false);

  useEffect(() => {
    if (!sb) return;
    let vivo = true;
    let espera: ReturnType<typeof setTimeout>;
    async function verificar() {
      const { data: sessao } = await sb!.auth.getSession();
      const id = sessao.session?.user.id;
      if (!vivo) return;
      if (!id) {
        window.location.replace(`/login?redirect=${encodeURIComponent(aqui())}`);
        return;
      }
      const semConexao = () => {
        // Internet caiu ou o servidor oscilou: não desloga. Abre com o último acesso conferido e tenta de novo.
        const g = guardado(id);
        if (g) setAcesso((a) => a ?? g);
        else setFalha(true);
        espera = setTimeout(verificar, g ? 30_000 : 10_000);
      };
      const { data: u, error: eu } = await sb!.auth.getUser();
      if (!vivo) return;
      if (ehFalhaDeConexao(eu)) return semConexao();
      if (!u.user) {
        guardar(null);
        window.location.replace(`/login?redirect=${encodeURIComponent(aqui())}`);
        return;
      }
      const { data, error } = await sb!.rpc("meu_acesso");
      if (!vivo) return;
      if (error) return semConexao();
      const a = data as Acesso | null;
      if (!a || !a.ativo) {
        guardar(null);
        await sb!.auth.signOut();
        window.location.replace("/login?erro=nao-autorizado");
        return;
      }
      if (!a.senha_alterada) {
        window.location.replace(`/trocar-senha?redirect=${encodeURIComponent(aqui())}`);
        return;
      }
      guardar({ user: u.user.id, acesso: a });
      setFalha(false);
      setAcesso(a);
    }
    verificar();
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [sb]);

  if (!sb) return <main className="container"><AvisoConfig /></main>;
  if (!acesso) {
    return (
      <main className="container">
        <div className="vazio">{falha ? "Sem conexão com o servidor. Tentando de novo…" : "Verificando acesso…"}</div>
      </main>
    );
  }
  if (exigir && !REGRAS[exigir](acesso)) {
    return (
      <AcessoCtx.Provider value={acesso}>
        <main className="container">
          <div className="aviso" role="alert">
            Você entrou como <strong>{acesso.email}</strong>, mas não tem acesso a esta página. <a href="/">Ir para a dashboard</a>
          </div>
        </main>
      </AcessoCtx.Provider>
    );
  }
  return <AcessoCtx.Provider value={acesso}>{children}</AcessoCtx.Provider>;
}
