-- =====================================================================
-- 008: "Fixar em primeiro" nas prioridades e conexões
--
-- O que a produção fixar aparece sempre na frente da dashboard,
-- fora do rodízio de "já lido vai para o fim".
-- Rode uma vez no SQL Editor. Pode rodar de novo sem problema.
-- =====================================================================

alter table public.prioridades add column if not exists fixado boolean not null default false;
alter table public.conexoes add column if not exists fixado boolean not null default false;
