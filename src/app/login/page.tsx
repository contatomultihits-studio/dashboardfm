"use client";

import { useState } from "react";
import { AvisoConfig } from "@/components/AvisoConfig";
import { Topbar } from "@/components/Topbar";
import { getSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const sb = getSupabase();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setEnviando(true);
    setErro(null);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error) {
      setErro(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
      return;
    }
    // Navegação completa: descarta qualquer rota guardada de antes do login.
    window.location.assign("/artistico");
  }

  return (
    <>
      <Topbar atual="login" />
      <main className="container">
        {!sb ? (
          <AvisoConfig />
        ) : (
          <form className="card form login" onSubmit={entrar}>
            <h1>Área da equipe</h1>
            <p style={{ margin: 0, color: "var(--muted)", fontWeight: 700 }}>Entre para cadastrar prioridades, convidados e eventos.</p>
            <label className="campo">
              E-mail
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="campo">
              Senha
              <input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
            </label>
            {erro && <div className="aviso erro" role="alert">{erro}</div>}
            <button type="submit" className="verde" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
          </form>
        )}
      </main>
    </>
  );
}
