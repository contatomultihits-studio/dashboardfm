-- Prioridades passam a ter período no ar (entra / sai) em vez de uma data só.
-- Registros antigos ficam com entrada e saída no mesmo dia.

alter table public.prioridades rename column data to data_inicio;
alter table public.prioridades add column data_fim date;
update public.prioridades set data_fim = data_inicio;
alter table public.prioridades alter column data_fim set not null;
alter table public.prioridades
  add constraint prioridades_periodo_check check (data_fim >= data_inicio);

drop index if exists public.prioridades_data_idx;
create index if not exists prioridades_periodo_idx on public.prioridades (data_inicio, data_fim);
