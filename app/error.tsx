'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <section className="card" style={{ marginTop: '1rem' }}>
      <h1>Falha ao carregar a dashboard</h1>
      <p>{error.message}</p>
      <button onClick={reset}>Tentar novamente</button>
    </section>
  );
}
