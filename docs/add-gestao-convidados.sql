-- Cria tabela para gestão de convidados (executar no Supabase SQL Editor)

create table if not exists public.gestao_convidados (
  id uuid primary key default gen_random_uuid(),
  nome_convidado text not null,
  data_visita date not null,
  horario_visita time not null,
  mini_pauta_html text not null,
  imagem_url text,
  concluido boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_gestao_convidados_data_hora
  on public.gestao_convidados (data_visita asc, horario_visita asc);
