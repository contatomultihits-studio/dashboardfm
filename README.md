# Dashboard FM — estático (GitHub + Vercel) com tema musical

Estrutura atual:
- **Métricas**: inclusão de participações (tipo fixo `DIARIO_REALTIME`)
- **Gerenciamento**: programas, prêmios (com vigência por hora) e prioridade no ar
- **Gestor**: Big Numbers, ranking, prêmio vigente agora e ganhador

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

execute no Supabase SQL Editor:
- `docs/supabase-setup-clean.sql`

## Configuração ideal de prêmios por hora
Para destacar o prêmio vigente e mostrar ganhador ao locutor, execute:
- `docs/premios-hora-migration.sql`

Isso adiciona em `premios`:
- `inicio_vigencia`
- `fim_vigencia`
- `ganhador_nome`
- `status`

## Sem Supabase
Roda em `localStorage`.
