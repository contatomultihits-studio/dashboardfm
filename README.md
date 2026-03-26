# Dashboard FM (GitHub + Vercel, com ou sem Supabase)

Painel web para operação diária de rádio, com três frentes:

- **Colaborador**: abastecimento dos dados (`participacoes` e `prioridades_ar`).
- **Gerenciamento**: manutenção de cadastros (`programas` e `premios`).
- **Gestores**: visão executiva de **Big Numbers** via ranking e gráfico.

## 1) Rodar local

```bash
npm install
npm run dev
```

## 2) Modo de operação

### Modo A — GitHub + Vercel apenas (sem Supabase)
Se as variáveis de ambiente do Supabase **não** estiverem configuradas, a dashboard funciona em **modo local** usando `localStorage` no navegador.

### Modo B — Supabase conectado
Crie `.env.local` e configure:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SEU_ANON_KEY
```

Quando as variáveis existem, os módulos passam a ler/gravar nas tabelas do Supabase.

## 3) Estrutura de páginas

- `/` (atalhos para os módulos)
- `/colaborador`
- `/gerenciamento`
- `/gestor`

## 4) Deploy GitHub + Vercel

1. Suba este projeto no GitHub.
2. Na Vercel, importe o repositório.
3. Faça deploy.
4. Opcional: configure variáveis do Supabase para ativar modo B.

## 5) Troubleshooting

- **Dashboard não aparece**: confirme se o projeto na Vercel está com framework Next.js e sem override incorreto de pasta de output.
- **Erro `No Output Directory named "public"`**: este repo inclui `vercel.json` com `outputDirectory: .next`; remova override manual no painel da Vercel se existir.
- **Tela sem dados**: no modo sem Supabase, os dados aparecem após inserir registros nas telas.
