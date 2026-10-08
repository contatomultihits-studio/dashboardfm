-- =====================================================================
-- 012: Eventos ganham o vínculo "Camarote Rádio Disney" (CAMAROTE),
-- além de Rádio oficial e Apoio.
--
-- Rode uma vez no SQL Editor. Pode rodar de novo sem problema.
-- =====================================================================

alter table public.eventos drop constraint if exists eventos_vinculo_check;
alter table public.eventos add constraint eventos_vinculo_check
  check (vinculo in ('RADIO_OFICIAL', 'APOIO', 'CAMAROTE'));
