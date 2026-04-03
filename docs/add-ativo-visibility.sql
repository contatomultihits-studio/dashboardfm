-- Adiciona coluna de controle de exibição (ativo) em prioridades, convidados e eventos

alter table if exists public.prioridades_ar
  add column if not exists ativo boolean not null default true;

alter table if exists public.gestao_convidados
  add column if not exists ativo boolean not null default true;

alter table if exists public.gestao_eventos
  add column if not exists ativo boolean not null default true;
