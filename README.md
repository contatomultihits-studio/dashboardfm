# Dashboard FM — Central do Locutor

Tudo o que o locutor precisa para tocar o horário, numa tela só:

- **Recados rápidos** no topo, com a data comemorativa do dia como primeiro card.
- **No ar agora** na barra do topo (foto, até quando e quem vem a seguir) e a **escala do fim de semana**
  (sábado e domingo, com quem está de folga). Segunda a sexta vem do horário fixo de cada locutor;
  fins de semana e trocas, da aba Escala.
- **Prioridades no ar** do dia, com imagem e texto (3 por vez, com setas). A produção pode **fixar em primeiro**;
  os demais entram no rodízio "já lido vai para o fim" (cada tela lembra o que o locutor já abriu no dia).
  Cada leitura também fica registrada (horário e quem estava no ar) no **Relatório de leituras** do Artístico.
- **Partiu Rádio Disney**: pautas das ações externas com cliente, locutor, horário e *Expectativa* / *Valendo*.
  Lembrete na tela 5 min antes (com som e "Abrir pauta"). O locutor marca "feita" na própria pauta, e isso vira o **Relatório de pautas** do dia (Artístico),
  pronto para copiar no e-mail da Opec e dos produtores ou baixar em planilha.
- **Jornalismo** (logo abaixo do Partiu): pautas do jornalismo — ESPN, Nota, Conta Tudo, Cê Viu?, Clássicos,
  Em Cartaz, Desafio RD — com o mesmo "feita" e relatório próprio; o aviso de 5 min é opcional por pauta.
- **Conexões**: conteúdo institucional e atemporal da emissora (pode ficar "sem prazo").
- **Próximos convidados**, com foto, data e horário. Clicando, abre a mini pauta.
- **Agenda de eventos**, com etiqueta *Rádio oficial* ou *Apoio*, data e local.
- **Últimos vídeos do YouTube**: desligado por enquanto (`MOSTRAR_YOUTUBE` em `src/lib/config.ts`).
- **Promoção** (em teste na página `/promocao`, ainda fora da dashboard): último prêmio, **prêmio da hora** e
  próximo prêmio, com foto, ganhador e pop-up opcional 5 min antes. No Artístico, a aba Promoção tem o catálogo
  de prêmios, a grade por horário (de hora em hora, a cada 2 h…), o registro de ganhadores com a busca
  "já ganhou?" e a lista de bloqueados. Quem ganhou só ganha de novo depois de 30 dias (o banco garante).
  Telefone e dados dos ouvintes ficam só para a equipe; a tela do locutor mostra nome, bairro e cidade.

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
src/components/artistico/    formulários e listas (prioridades, recados, pautas, conexões, convidados, eventos, relatório)
src/components/PromocaoNoAr.tsx  promoção na tela do locutor (hoje na prévia /promocao)
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

- Envio automático do relatório de pautas por e-mail no fim do dia (Opec e produtores).
- Aba Novidades do digital.
- Promoção: levar o carrossel para a dashboard e importar os ganhadores antigos da planilha.
- Usuários e permissões por área (só ver, editar), com tela do usuário mestre.
