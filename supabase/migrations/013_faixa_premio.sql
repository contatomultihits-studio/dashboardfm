-- =====================================================================
-- 013: Prêmio com faixa de horário (ex.: das 06h às 09h). Fica na tela
-- do locutor durante a faixa. Sem fim (horários antigos) vale 1 hora.
--
-- Rode uma vez no SQL Editor. Pode rodar de novo sem problema.
-- =====================================================================

alter table public.promo_rodadas add column if not exists horario_fim time;

alter table public.promo_rodadas drop constraint if exists promo_rodadas_faixa_check;
alter table public.promo_rodadas add constraint promo_rodadas_faixa_check
  check (horario_fim is null or horario_fim > horario);
