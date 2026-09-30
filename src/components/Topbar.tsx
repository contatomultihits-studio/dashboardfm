import Link from "next/link";
import { NOME_RADIO } from "@/lib/config";

export function Topbar({ atual, children }: { atual: "dashboard" | "artistico" | "login"; children?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div className="container topbar-conteudo">
        <Link href="/" className="logo">
          <span aria-hidden>🎵</span> {NOME_RADIO}
        </Link>
        <nav className="nav" aria-label="Principal">
          <Link href="/" className={`pill ${atual === "dashboard" ? "ativo" : ""}`}>Dashboard</Link>
          <Link href="/artistico" prefetch={false} className={`pill ${atual === "artistico" ? "ativo" : ""}`}>Artístico</Link>
          {children}
        </nav>
      </div>
    </header>
  );
}
