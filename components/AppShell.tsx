'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Início' },
  { href: '/colaborador', label: 'Abastecimento' },
  { href: '/gerenciamento', label: 'Gerenciamento' },
  { href: '/gestor', label: 'Gestão (Big Numbers)' }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <header style={{ borderBottom: '1px solid #273148', background: '#0d1320' }}>
        <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
          <strong>📻 Dashboard FM</strong>
          <nav style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '0.5rem 0.7rem',
                  borderRadius: '9px',
                  border: pathname === item.href ? '1px solid #35C4FF' : '1px solid transparent',
                  background: pathname === item.href ? '#16273f' : 'transparent'
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </main>
      </header>
      <main>{children}</main>
    </>
  );
}
