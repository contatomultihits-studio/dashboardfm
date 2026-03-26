-- Adiciona o campo de telefone do ganhador na tabela de prêmios
-- Execute no SQL Editor do Supabase
alter table if exists public.premios
  add column if not exists ganhador_telefone text;

comment on column public.premios.ganhador_telefone is
  'Telefone do ganhador do prêmio (opcional).';
