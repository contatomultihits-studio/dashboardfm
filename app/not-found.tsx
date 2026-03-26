import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="card" style={{ marginTop: '1rem' }}>
      <h1>Página não encontrada</h1>
      <p>A rota solicitada não existe nesta dashboard.</p>
      <Link href="/">Voltar para o início</Link>
    </section>
  );
}
