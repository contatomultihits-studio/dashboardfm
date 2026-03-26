# Dashboard FM — estático (GitHub + Vercel) com tema musical

Estrutura atual:
- **Métricas**: inclusão de participações (com data já preenchida com hoje)
- **Gerenciamento**: programas, prêmios e prioridade no ar
- **Gestor**: Big Numbers, ranking, prêmios da hora e filtro por período

## Filtro padrão
Ao abrir, o Gestor já vem em período mensal:
- de: 1º dia do mês atual
- até: hoje
- rótulo: **DADOS DE MÊS_ATUAL**

## Supabase automático
Se variáveis estiverem na Vercel:
- `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_ANON_KEY` (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

a conexão ocorre automaticamente via `/api/config`.

## Fallback manual
Botão **Conectar Supabase** no topo para salvar URL + KEY no navegador.

## Erro de permissão (RLS)
Se aparecer mensagens como:
- "Sem permissão na tabela programas"
- "Sem acesso à tabela programas"

então o ajuste é no **Supabase (policies/grants)**, não na Vercel.

Execute o script limpo (sem diff do git):
- `docs/supabase-setup-clean.sql`

no SQL Editor do Supabase para liberar `select/insert` para `anon`/`authenticated` nas tabelas usadas pela dashboard.

## Sem Supabase
Roda em `localStorage`.
