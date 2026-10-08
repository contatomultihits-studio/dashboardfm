"use client";

import { useEffect, useState } from "react";
import { AvisoConfig } from "@/components/AvisoConfig";
import { Topbar } from "@/components/Topbar";
import { destinoSeguro, inicioDe, type Acesso } from "@/lib/acesso";
import { getSupabase } from "@/lib/supabase/client";

const NAO_AUTORIZADO = "Acesso não autorizado. Fale com o administrador.";

export default function LoginPage() {
  const sb = getSupabase();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [destino, setDestino] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setDestino(q.get("redirect"));
    if (q.get("erro") === "nao-autorizado") setErro(NAO_AUTORIZADO);
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setEnviando(true);
    setErro(null);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) {
      setEnviando(false);
      setErro(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
      return;
    }
    // Entrou: só segue quem tem perfil ativo cadastrado pelo administrador.
    const { data, error: e2 } = await sb.rpc("meu_acesso");
    const acesso = data as Acesso | null;
    if (e2 || !acesso || !acesso.ativo) {
      await sb.auth.signOut();
      setEnviando(false);
      setErro(e2 ? `Não deu para conferir o acesso: ${e2.message}` : NAO_AUTORIZADO);
      return;
    }
    const ir = destinoSeguro(destino, inicioDe(acesso));
    // Navegação completa: descarta qualquer rota guardada de antes do login.
    window.location.assign(acesso.senha_alterada ? ir : `/trocar-senha?redirect=${encodeURIComponent(ir)}`);
  }

  return (
    <>
      <Topbar atual="login" />
      <main className="container">
        {!sb ? (
          <AvisoConfig />
        ) : (
          <form className="card form login" onSubmit={entrar}>
            <h1>Central do Locutor</h1>
            <p style={{ margin: 0, color: "var(--muted)", fontWeight: 700 }}>Entre com o e-mail e a senha que o administrador enviou.</p>
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
