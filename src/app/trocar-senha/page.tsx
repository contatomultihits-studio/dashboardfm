"use client";

import { useEffect, useState } from "react";
import { AvisoConfig } from "@/components/AvisoConfig";
import { sair } from "@/components/ComAcesso";
import { Topbar } from "@/components/Topbar";
import { destinoSeguro, inicioDe, problemaSenha, type Acesso } from "@/lib/acesso";
import { getSupabase } from "@/lib/supabase/client";

/** Troca de senha: obrigatória no primeiro acesso (e depois de o administrador gerar uma nova). */
export default function TrocarSenhaPage() {
  const sb = getSupabase();
  const [acesso, setAcesso] = useState<Acesso | null>(null);
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!sb) return;
    (async () => {
      const { data: u } = await sb.auth.getUser();
      if (!u.user) return window.location.replace("/login");
      const { data } = await sb.rpc("meu_acesso");
      const a = data as Acesso | null;
      if (!a || !a.ativo) {
        await sb.auth.signOut();
        return window.location.replace("/login?erro=nao-autorizado");
      }
      setAcesso(a);
    })();
  }, [sb]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!sb || !acesso) return;
    const problema = problemaSenha(senha, confirmar);
    if (problema) return setErro(problema);
    setEnviando(true);
    setErro(null);
    const { error } = await sb.auth.updateUser({ password: senha });
    if (error) {
      setEnviando(false);
      const igual = error.code === "same_password" || /different from the old/i.test(error.message);
      const fraca = error.code === "weak_password" || /weak|pwned|leaked/i.test(error.message);
      return setErro(
        igual ? "A nova senha precisa ser diferente da senha atual." :
        fraca ? "Essa senha é fraca ou já vazou na internet. Escolha outra." :
        error.message,
      );
    }
    const { error: e2 } = await sb.rpc("marcar_senha_alterada");
    if (e2) {
      setEnviando(false);
      return setErro(`Senha trocada, mas não deu para registrar: ${e2.message}. Tente de novo.`);
    }
    const destino = new URLSearchParams(window.location.search).get("redirect");
    window.location.assign(destinoSeguro(destino, inicioDe(acesso)));
  }

  return (
    <>
      <Topbar atual="senha" />
      <main className="container">
        {!sb ? (
          <AvisoConfig />
        ) : !acesso ? (
          <div className="vazio">Verificando acesso…</div>
        ) : (
          <form className="card form login" onSubmit={salvar}>
            <h1>{acesso.senha_alterada ? "Trocar senha" : "Crie a sua senha"}</h1>
            <p style={{ margin: 0, color: "var(--muted)", fontWeight: 700 }}>
              {acesso.senha_alterada ? "" : `Olá, ${acesso.nome.split(" ")[0]}! No primeiro acesso é preciso trocar a senha que você recebeu. `}
              Use pelo menos 8 caracteres, com letras e números.
            </p>
            <label className="campo">
              Nova senha
              <input type="password" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
            </label>
            <label className="campo">
              Repita a nova senha
              <input type="password" autoComplete="new-password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
            </label>
            {erro && <div className="aviso erro" role="alert">{erro}</div>}
            <div className="acoes">
              <button type="submit" className="verde" disabled={enviando}>{enviando ? "Salvando…" : "Salvar nova senha"}</button>
              <button type="button" className="branco" onClick={sair}>Sair</button>
            </div>
          </form>
        )}
      </main>
    </>
  );
}
