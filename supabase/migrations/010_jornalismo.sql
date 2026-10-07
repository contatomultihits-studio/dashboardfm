-- =====================================================================
-- 010: Jornalismo
--
-- As pautas do Jornalismo usam a mesma estrutura do Partiu Rádio Disney
-- (horário, locutor, "feita" e relatório), separadas pela coluna "secao".
-- Tipos do Jornalismo: ESPN, Nota, Conta Tudo, Cê Viu?, Clássicos,
-- Em Cartaz, Desafio RD. O aviso de 5 minutos passa a ser opcional.
--
-- Rode uma vez no SQL Editor. Pode rodar de novo sem problema.
-- =====================================================================

alter table public.pautas add column if not exists secao text not null default 'partiu';
alter table public.pautas add column if not exists aviso boolean not null default true;
alter table public.pautas alter column cliente set default '';

alter table public.pautas drop constraint if exists pautas_tipo_check;
alter table public.pautas drop constraint if exists pautas_secao_tipo_check;
alter table public.pautas add constraint pautas_secao_tipo_check check (
  (secao = 'partiu' and tipo in ('EXPECTATIVA', 'VALENDO'))
  or (secao = 'jornalismo' and tipo in ('ESPN', 'NOTA', 'CONTA_TUDO', 'CE_VIU', 'CLASSICOS', 'EM_CARTAZ', 'DESAFIO_RD'))
);

create index if not exists pautas_secao_idx on public.pautas (secao, data_inicio, data_fim);
