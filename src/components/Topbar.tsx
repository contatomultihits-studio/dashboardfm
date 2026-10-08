"use client";

import Link from "next/link";
import { sair, useAcesso } from "@/components/ComAcesso";
import { entraNoArtistico } from "@/lib/acesso";

export function Topbar({
  atual,
  meio,
  children,
}: {
  atual: "dashboard" | "artistico" | "login" | "promocao" | "usuarios" | "historico" | "senha";
  /** Conteúdo antes do menu (na dashboard: dia e botões de navegação). */
  meio?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const acesso = useAcesso();
  return (
    <header className="topbar">
      <div className="container topbar-conteudo">
        {meio && <div className="topbar-meio">{meio}</div>}
        {acesso && (
          <nav className="nav" aria-label="Principal">
            <Link href="/" className={`pill ${atual === "dashboard" ? "ativo" : ""}`}>Dashboard</Link>
            {entraNoArtistico(acesso) && (
              <Link href="/artistico" prefetch={false} className={`pill ${atual === "artistico" ? "ativo" : ""}`}>Artístico</Link>
            )}
            {acesso.tipo === "admin" && (
              <>
                <Link href="/usuarios" prefetch={false} className={`pill ${atual === "usuarios" ? "ativo" : ""}`}>Usuários</Link>
                <Link href="/historico" prefetch={false} className={`pill ${atual === "historico" ? "ativo" : ""}`}>Histórico</Link>
              </>
            )}
            {children}
            <button type="button" className="branco pequeno" onClick={sair} title={`${acesso.nome} · ${acesso.email}`}>Sair</button>
          </nav>
        )}
      </div>
    </header>
  );
}
