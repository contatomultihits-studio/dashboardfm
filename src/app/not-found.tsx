import Link from "next/link";

export default function NotFound() {
  return (
    <main className="main">
      <section className="hero">
        <h1>Página não encontrada</h1>
        <p>O painel principal está disponível na rota inicial do sistema.</p>
        <Link className="btn" href="/">Voltar para o dashboard</Link>
      </section>
    </main>
  );
}
