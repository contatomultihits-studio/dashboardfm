-- Prioridades e recados ganham horário de entrada e de saída (opcionais).
-- Sem horário, vale o dia todo. No mesmo dia, a saída precisa ser depois da entrada.

alter table public.prioridades add column if not exists hora_inicio time;
alter table public.prioridades add column if not exists hora_fim time;
alter table public.recados add column if not exists hora_inicio time;
alter table public.recados add column if not exists hora_fim time;

alter table public.prioridades drop constraint if exists prioridades_horario_check;
alter table public.prioridades add constraint prioridades_horario_check
  check (data_fim > data_inicio or hora_inicio is null or hora_fim is null or hora_fim > hora_inicio);

alter table public.recados drop constraint if exists recados_horario_check;
alter table public.recados add constraint recados_horario_check
  check (data_fim > data_inicio or hora_inicio is null or hora_fim is null or hora_fim > hora_inicio);
