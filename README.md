# Rádio Disney — Controle e Métricas da Produção

Aplicação web responsiva para consolidar controles operacionais antes mantidos em 7 planilhas. Este repositório foi inicializado como protótipo full-stack em **Next.js + TypeScript + Prisma**, usando **SQLite local** por padrão e schema compatível para migração futura a PostgreSQL.

> Importante: os dados carregados pelo seed são fictícios. Nenhum dado histórico real das planilhas foi importado.

## Stack identificada

O repositório estava vazio, contendo apenas `.gitkeep`. Por isso a aplicação foi criada do zero com:

- Next.js App Router
- TypeScript
- Prisma ORM
- SQLite para protótipo local (`DATABASE_URL=file:./dev.db`)
- Vitest para testes de normalização
- CSS responsivo sem dependência de design system externo

## Módulos implementados

- Dashboard executivo com filtros por período.
- Central operacional com alertas básicos.
- Desafio RD com participantes, pontuação, vencedores e mascaramento por perfil.
- Programação com métricas normalizadas por programa/data.
- Pedidos musicais com normalização de artista/música.
- Xuguéder com episódios por tema/personagem/data.
- Concorrência SP com promoções por rádio/canal/mês.
- Música premiada com posição de 1 a 8.
- Breaks no ar/encerrados.
- Comenta Aí com ideias, enquetes e participações.
- Administração, importações e auditoria.

## Banco de dados

O schema Prisma inclui as entidades mínimas solicitadas: `User`, `Role`, `AuditLog`, `Listener`, `ChallengeParticipation`, `ChallengeWinnerDetails`, `XuguedEREpisode`, `Program`, `ProgramParticipation`, `MusicRequest`, `CompetitorRadio`, `CompetitorPromotion`, `AwardedSong`, `BreakItem`, `PollIdea`, `ImportBatch` e `ImportError`.

Campos de rastreabilidade (`sourceFile`, `sourceSheet`, `sourceRow`, `rawData`) foram previstos nos modelos operacionais para preservar a origem da importação e permitir correções auditáveis.

## Segurança e dados sensíveis

- Telefones são preservados no campo original e normalizados em campo separado.
- CPF é mascarado na persistência de demonstração.
- O dashboard não expõe telefone quando `APP_ROLE=PUBLICO` ou `APP_ROLE=ANALISTA`.
- A tabela `AuditLog` registra ações sensíveis.
- Pessoas usam UUID como chave; nomes nunca são usados como identificador técnico.

## Variáveis de ambiente

Copie `.env.example` para `.env`:

```bash
DATABASE_URL="file:./dev.db"
APP_ROLE="ADMIN"
```

Perfis aceitos em `APP_ROLE`: `ADMIN`, `PRODUCAO`, `ANALISTA`, `PUBLICO`.

## Instalação e execução

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Acesse `http://localhost:3000`.

## Testes

```bash
npm test
```

Os testes cobrem normalização de telefone, parsing de datas de planilha, extração de posição premiada e totais mensais.

## Importação CSV futura

O modelo inclui `ImportBatch` e `ImportError`. Templates iniciais estão em `public/templates`:

- `program_participation.csv`
- `challenge_participation.csv`

A próxima etapa é implementar a leitura de CSV com mapeamento por módulo, validação, preview antes de gravar, auditoria e exportação de erros por linha.

## Decisões de arquitetura

1. **Tabela normalizada para participações de programação**: uma linha por programa/data, evitando colunas fixas por programa.
2. **SQLite primeiro, PostgreSQL depois**: reduz atrito local e mantém Prisma como camada de compatibilidade.
3. **rawData opcional**: preserva valores originais das planilhas sem replicar layouts irregulares.
4. **RBAC simples por variável de ambiente**: suficiente para protótipo; em produção deve ser substituído por login real com sessão segura.
5. **Dados fictícios no seed**: atende demonstração sem misturar informação real/sensível.

## Pendências reais

- Implementar autenticação real com sessão e tela de login.
- Completar telas CRUD dedicadas por módulo além da API genérica inicial.
- Implementar importador CSV com preview, validação por linha e gravação transacional.
- Trocar SQLite por PostgreSQL em homologação/produção.
- Expandir alertas de duplicidade aproximada por nome e similaridade textual de promoções/enquetes.
