# Dashboard FM — Central do Locutor

Tudo o que o locutor precisa para tocar o horário, numa tela só:

- **Prioridades no ar** do dia, com imagem e texto (3 por vez, com setas).
- **Próximos convidados**, com foto, data e horário. Clicando, abre a mini pauta.
- **Agenda de eventos**, com etiqueta *Rádio oficial* ou *Apoio*, data e local.

A **dashboard é aberta** (sem login) e mostra só o que foi marcado como "Exibir na dashboard".
A aba **Artístico** exige login e é onde a produção cadastra, edita, oculta e exclui cada item.

**Para colocar no ar, siga o [DEPLOY.md](DEPLOY.md).**

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript, hospedado na **Vercel**
- [Supabase](https://supabase.com): banco Postgres, login (Auth) e fotos (Storage)
- Regras de acesso direto no banco (Row Level Security): ver [`supabase/schema.sql`](supabase/schema.sql)

## Estrutura

```
supabase/schema.sql          tabelas, regras de acesso e bucket de fotos (rodar no SQL Editor)
src/app/page.tsx             dashboard pública
src/app/login/               login da equipe
src/app/artistico/           área da equipe
src/components/Dashboard.tsx carrosséis e janelas de detalhe
src/components/artistico/    formulários e listas (prioridades, convidados, eventos)
src/lib/                     datas, filtro de HTML, imagens, cliente Supabase
src/proxy.ts                 mantém a sessão e protege /artistico
tests/                       testes (datas e filtro de HTML)
```

## Rodar no computador

```bash
cp .env.example .env.local   # preencha com a URL e a chave pública do Supabase
npm install
npm run dev                  # http://localhost:3000
```

Outros comandos: `npm test`, `npm run typecheck`, `npm run build`.

## Próximas etapas

- Ganhadores: busca, histórico, "prêmio retirado" e importação do Microsoft Planner (exportação para Excel).
- Prêmio da hora na dashboard.
