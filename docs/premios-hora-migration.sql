-- Ajuste ideal para prêmio vigente por hora e ganhador exibido ao locutor

alter table public.premios
  add column if not exists inicio_vigencia timestamptz,
  add column if not exists fim_vigencia timestamptz,
  add column if not exists ganhador_nome text,
  add column if not exists status text default 'ativo';

-- Índice para consulta de prêmio vigente no horário atual
create index if not exists idx_premios_vigencia
  on public.premios (inicio_vigencia, fim_vigencia);

-- Exemplo de prêmio vigente das 14h até 14h59
-- (ajuste data/hora conforme necessidade)
-- insert into public.premios (
--   nome, descricao, estoque_inicial, programa_id,
--   inicio_vigencia, fim_vigencia, ganhador_nome, status
-- ) values (
--   'PAR DE INGRESSOS SHOW',
--   'VALENDO INGRESSOS PARA O SHOW',
--   2,
--   'UUID_DO_PROGRAMA',
--   '2026-03-26T14:00:00-03:00',
--   '2026-03-26T14:59:59-03:00',
--   null,
--   'ativo'
-- );
