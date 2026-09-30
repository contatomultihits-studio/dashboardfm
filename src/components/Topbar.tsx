import Link from "next/link";

export function Topbar({
  atual,
  meio,
  children,
}: {
  atual: "dashboard" | "artistico" | "login";
  /** Conteúdo antes do menu (na dashboard: dia e botões de navegação). */
  meio?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="topbar">
      <div className="container topbar-conteudo">
        {meio && <div className="topbar-meio">{meio}</div>}
        <nav className="nav" aria-label="Principal">
          <Link href="/" className={`pill ${atual === "dashboard" ? "ativo" : ""}`}>Dashboard</Link>
          <Link href="/artistico" prefetch={false} className={`pill ${atual === "artistico" ? "ativo" : ""}`}>Artístico</Link>
          {children}
        </nav>
      </div>
    </header>
  );
}
