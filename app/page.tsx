import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="grid" style={{ gap: '1.2rem' }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Stack sugerida: Supabase + Vercel + GitHub</h1>
        <p>
          Estrutura pronta para operação diária por colaboradores (abastecimento), administração central
          (gerenciamento) e leitura executiva para gestores (Big Numbers).
        </p>
        <small>Defina as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para conectar.</small>
      </div>

      <div className="grid grid-3">
        <Link href="/colaborador" className="card">
          <h3>Área do colaborador</h3>
          <p>Cadastro de participações e prioridades no ar por data.</p>
        </Link>
        <Link href="/gerenciamento" className="card">
          <h3>Área de gerenciamento</h3>
          <p>CRUD de programas e prêmios para manter estrutura ativa.</p>
        </Link>
        <Link href="/gestor" className="card">
          <h3>Dashboard de gestores</h3>
          <p>Visão consolidada com KPIs e ranking por programa.</p>
        </Link>
      </div>
    </section>
  );
}
