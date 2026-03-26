# Dashboard FM (Supabase + Vercel)

Painel web para operação diária de rádio, com três frentes:

- **Colaborador**: abastecimento dos dados (`participacoes` e `prioridades_ar`).
- **Gerenciamento**: manutenção de cadastros (`programas` e `premios`).
- **Gestores**: visão executiva de **Big Numbers** via `resumo_participacoes`.

## 1) Configuração local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Preencha as variáveis em `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SEU_ANON_KEY
```

## 2) Estrutura de páginas

- `/colaborador`
- `/gerenciamento`
- `/gestor`

## 3) Fluxo de deploy com GitHub + Vercel

1. Suba este projeto para um repositório no GitHub.
2. Na Vercel, escolha **New Project** e importe o repositório.
3. Em **Environment Variables**, configure:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Faça deploy.

## 4) Observações

- A aplicação está pronta para usar o padrão de tabelas informado.
- Recomendado configurar **RLS policies** no Supabase por perfil (colaborador x gestor x admin).
