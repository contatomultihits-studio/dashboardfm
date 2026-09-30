export function AvisoConfig() {
  return (
    <div className="aviso erro">
      Supabase não configurado. Defina <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> nas
      variáveis de ambiente (na Vercel: Settings → Environment Variables) e faça um novo deploy. Veja o <code>DEPLOY.md</code>.
    </div>
  );
}
