# Dashboard FM — estático (GitHub + Vercel) com tema musical

Layout inspirado no projeto musical, com conexão Supabase automática.

## Deploy (simples)

1. Suba no GitHub.
2. Importe na Vercel.
3. Build Command vazio.
4. Output Directory vazio.
5. Deploy.

## Supabase — conexão automática pela Vercel

Se você já definiu na Vercel:
- `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_ANON_KEY` (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

a dashboard conecta automaticamente via endpoint `/api/config`.

## Supabase — conexão manual (fallback)

Clique em **Conectar Supabase** no topo e cole URL + ANON KEY.
A configuração fica salva no navegador.

## O que puxa do Supabase
- `programas`
- `premios`
- `participacoes`
- `prioridades_ar`
- `resumo_participacoes` (usada no gestor)

Sem Supabase, roda em `localStorage`.

### Observação de permissões (RLS)
Se `resumo_participacoes` abrir mas `programas` estiver bloqueada, o app mostra os nomes a partir do resumo para não aparecer "Manhã Hits" fake.
