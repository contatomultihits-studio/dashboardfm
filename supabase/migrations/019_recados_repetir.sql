-- =====================================================================
-- 019: Recados que repetem em dias e horários
--
-- "Período corrido" (como sempre): repetir = false, nada muda.
-- "Só em alguns dias e horários": repetir = true, dias da semana marcados
-- (0 = domingo … 6 = sábado) e a faixa diária (das … às …). Se o "às" for
-- menor que o "das" (ex.: 22h às 01h), vai até o dia seguinte.
-- O período (entra / sai do ar) continua valendo como validade.
--
-- Só acrescenta. Pode rodar de novo.
-- =====================================================================
alter table public.recados add column if not exists repetir boolean not null default false;
alter table public.recados add column if not exists dias_semana smallint[] not null default '{}';
alter table public.recados add column if not exists janela_inicio time;
alter table public.recados add column if not exists janela_fim time;
alter table public.recados drop constraint if exists recados_repetir_check;
alter table public.recados add constraint recados_repetir_check check (
  not repetir or (
    cardinality(dias_semana) > 0
    and dias_semana <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    and janela_inicio is not null and janela_fim is not null
    and janela_inicio <> janela_fim
  )
);
