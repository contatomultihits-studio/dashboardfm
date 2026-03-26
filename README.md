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

- `/` (atalhos para os módulos)
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

## 4) Troubleshooting

- **404 na Vercel após deploy**: verifique se a branch com o código foi realmente selecionada no projeto da Vercel e se o deploy atual inclui a pasta `app/`.
- **Erro `No Output Directory named "public"` na Vercel**: este repositório inclui `vercel.json` fixando `outputDirectory` para `.next`; se o erro persistir, remova o override de Output Directory nas configurações do projeto na Vercel.
- **Tela em branco/erro ao abrir páginas**: valide as variáveis de ambiente acima. Sem elas, o app exibe mensagem de configuração ausente.

## 5) Observações

- A aplicação está pronta para usar o padrão de tabelas informado.
- Recomendado configurar **RLS policies** no Supabase por perfil (colaborador x gestor x admin).
