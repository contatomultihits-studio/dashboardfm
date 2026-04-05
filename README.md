# Rádio Disney — concentrador de informações

## Fluxo atual
- **Dashboard** (página inicial): Big Numbers, ranking, prêmio vigente agora, ganhador, atualização manual + automática (3 min)
- **Métricas**: inclusão de participações (tipo fixo `DIARIO_REALTIME`) + edição rápida
- **Gerenciamento**: programas, prêmios (vigência por hora), prioridades + edição rápida

## Atualização
- Auto refresh a cada 3 minutos
- Botão **Atualizar agora** no Dashboard

## Supabase automático
Se variáveis estiverem na Vercel:
- `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_ANON_KEY` (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

## Setup de permissões
Se houver erro de permissão execute:
- `docs/supabase-setup-clean.sql`

> Importante: esse script agora inclui `UPDATE` e `DELETE` para `prioridades_ar`, necessário para a edição/exclusão funcionar no Artístico.

## Config ideal para prêmio por hora
Execute:
- `docs/premios-hora-migration.sql`
- `docs/add-gestao-convidados.sql` (novo ecossistema de convidados)
- `docs/add-gestao-eventos.sql` (agenda de eventos)
- `docs/add-ativo-visibility.sql` (controle Exibir na Dashboard)

A tabela `premios` passa a ter:
- `inicio_vigencia`
- `fim_vigencia`
- `ganhador_nome`
- `status`
