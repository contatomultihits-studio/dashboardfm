-- Cria tabela para gestão de eventos (executar no Supabase SQL Editor)

create table if not exists public.gestao_eventos (
  id uuid primary key default gen_random_uuid(),
  nome_evento text not null,
  data_evento date not null,
  local_evento text not null,
  vinculo text not null check (vinculo in ('RÁDIO OFICIAL', 'APOIO')),
  descricao_html text not null,
  imagem_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_gestao_eventos_data
  on public.gestao_eventos (data_evento asc);
