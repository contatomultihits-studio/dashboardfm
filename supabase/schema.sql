-- =====================================================================
-- Dashboard FM — Artístico (prioridades, recados, conexões, pautas, convidados, eventos)
--
-- COMO USAR: copie este arquivo inteiro, cole no Supabase em
-- SQL Editor > New query e clique em "Run". Pode rodar mais de uma vez
-- sem problema (não apaga dados).
--
-- Regras de acesso:
--   * Quem abre a dashboard SEM login só enxerga o que está marcado
--     como "exibir na dashboard" (ativo = true).
--   * Só quem está na tabela "equipe" pode criar, editar e apagar.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Equipe: quem pode editar. Adicione pessoas com o comando do final.
-- ---------------------------------------------------------------------
create table if not exists public.equipe (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nome       text,
  created_at timestamptz not null default now()
);

alter table public.equipe enable row level security;

-- Diz se o usuário logado faz parte da equipe.
create or replace function public.is_equipe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.equipe where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_equipe() from public;
grant execute on function public.is_equipe() to anon, authenticated;

drop policy if exists equipe_select_proprio on public.equipe;
create policy equipe_select_proprio
  on public.equipe for select to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- Atualiza "updated_at" sozinho a cada edição.
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- Prioridades no ar (ficam no ar de data_inicio até data_fim, inclusive)
-- ---------------------------------------------------------------------
create table if not exists public.prioridades (
  id            uuid primary key default gen_random_uuid(),
  data_inicio   date not null,
  data_fim      date not null,
  titulo        text not null default '',
  conteudo_html text not null default '',
  imagem_path   text,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  constraint prioridades_periodo_check check (data_fim >= data_inicio)
);

-- Atualiza bancos criados com a versão antiga (uma data só). Ver supabase/migrations/.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'prioridades' and column_name = 'data') then
    alter table public.prioridades rename column data to data_inicio;
    alter table public.prioridades add column data_fim date;
    update public.prioridades set data_fim = data_inicio;
    alter table public.prioridades alter column data_fim set not null;
    alter table public.prioridades add constraint prioridades_periodo_check check (data_fim >= data_inicio);
    drop index if exists public.prioridades_data_idx;
  end if;
end;
$$;

create index if not exists prioridades_periodo_idx on public.prioridades (data_inicio, data_fim);

-- Título curto que aparece no card (migração 003).
alter table public.prioridades add column if not exists titulo text not null default '';


-- ---------------------------------------------------------------------
-- Recados rápidos (frases curtas, recados da diretoria; sem imagem)
-- ---------------------------------------------------------------------
create table if not exists public.recados (
  id            uuid primary key default gen_random_uuid(),
  data_inicio   date not null,
  data_fim      date not null,
  titulo        text not null default '',
  conteudo_html text not null default '',
  destaque      boolean not null default false,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  constraint recados_periodo_check check (data_fim >= data_inicio)
);

create index if not exists recados_periodo_idx on public.recados (data_inicio, data_fim);


-- Horário de entrada e saída, opcionais (migração 005). Sem horário = o dia todo.
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


-- ---------------------------------------------------------------------
-- Convidados (próximas visitas)
-- ---------------------------------------------------------------------
create table if not exists public.convidados (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  data_visita     date not null,
  horario         time,
  mini_pauta_html text not null default '',
  imagem_path     text,
  concluido       boolean not null default false,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid() references auth.users (id) on delete set null
);

create index if not exists convidados_data_idx on public.convidados (data_visita, horario);


-- ---------------------------------------------------------------------
-- Agenda de eventos
-- ---------------------------------------------------------------------
create table if not exists public.eventos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  data_evento    date not null,
  local          text,
  vinculo        text not null default 'APOIO'
                   check (vinculo in ('RADIO_OFICIAL', 'APOIO')),
  descricao_html text not null default '',
  imagem_path    text,
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid default auth.uid() references auth.users (id) on delete set null
);

create index if not exists eventos_data_idx on public.eventos (data_evento);


-- ---------------------------------------------------------------------
-- Gatilhos, permissões e regras (RLS) das tabelas de conteúdo
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['prioridades', 'recados', 'convidados', 'eventos'] loop
    execute format('drop trigger if exists %1$s_updated_at on public.%1$I', t);
    execute format(
      'create trigger %1$s_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);

    execute format('alter table public.%I enable row level security', t);

    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);

    -- Público: só o que está marcado para exibir na dashboard.
    execute format('drop policy if exists %1$s_select_publico on public.%1$I', t);
    execute format(
      'create policy %1$s_select_publico on public.%1$I
         for select to anon, authenticated
         using (ativo)', t);

    -- Equipe: vê tudo e pode criar, editar e apagar.
    execute format('drop policy if exists %1$s_select_equipe on public.%1$I', t);
    execute format(
      'create policy %1$s_select_equipe on public.%1$I
         for select to authenticated
         using ((select public.is_equipe()))', t);

    execute format('drop policy if exists %1$s_insert_equipe on public.%1$I', t);
    execute format(
      'create policy %1$s_insert_equipe on public.%1$I
         for insert to authenticated
         with check ((select public.is_equipe()))', t);

    execute format('drop policy if exists %1$s_update_equipe on public.%1$I', t);
    execute format(
      'create policy %1$s_update_equipe on public.%1$I
         for update to authenticated
         using ((select public.is_equipe()))
         with check ((select public.is_equipe()))', t);

    execute format('drop policy if exists %1$s_delete_equipe on public.%1$I', t);
    execute format(
      'create policy %1$s_delete_equipe on public.%1$I
         for delete to authenticated
         using ((select public.is_equipe()))', t);
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- Conexões (institucional) e Partiu Rádio Disney (pautas + "feito" do locutor).
-- Mesmo conteúdo da migração 006.
-- ---------------------------------------------------------------------
create table if not exists public.conexoes (
  id            uuid primary key default gen_random_uuid(),
  data_inicio   date not null,
  data_fim      date not null,
  hora_inicio   time,
  hora_fim      time,
  titulo        text not null default '',
  conteudo_html text not null default '',
  imagem_path   text,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  constraint conexoes_periodo_check check (data_fim >= data_inicio),
  constraint conexoes_horario_check
    check (data_fim > data_inicio or hora_inicio is null or hora_fim is null or hora_fim > hora_inicio)
);

create index if not exists conexoes_periodo_idx on public.conexoes (data_inicio, data_fim);


create table if not exists public.pautas (
  id            uuid primary key default gen_random_uuid(),
  data_inicio   date not null,
  data_fim      date not null,
  horario       time not null,
  cliente       text not null,
  locutor       text not null default '',
  tipo          text not null default 'VALENDO' check (tipo in ('EXPECTATIVA', 'VALENDO')),
  titulo        text not null default '',
  conteudo_html text not null default '',
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  constraint pautas_periodo_check check (data_fim >= data_inicio)
);

create index if not exists pautas_periodo_idx on public.pautas (data_inicio, data_fim, horario);


-- Mesmas regras das outras tabelas: público vê o que está ativo; equipe faz tudo.
do $$
declare
  t text;
begin
  foreach t in array array['conexoes', 'pautas'] loop
    execute format('drop trigger if exists %1$s_updated_at on public.%1$I', t);
    execute format(
      'create trigger %1$s_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);

    execute format('drop policy if exists %1$s_select_publico on public.%1$I', t);
    execute format('create policy %1$s_select_publico on public.%1$I for select to anon, authenticated using (ativo)', t);
    execute format('drop policy if exists %1$s_select_equipe on public.%1$I', t);
    execute format('create policy %1$s_select_equipe on public.%1$I for select to authenticated using ((select public.is_equipe()))', t);
    execute format('drop policy if exists %1$s_insert_equipe on public.%1$I', t);
    execute format('create policy %1$s_insert_equipe on public.%1$I for insert to authenticated with check ((select public.is_equipe()))', t);
    execute format('drop policy if exists %1$s_update_equipe on public.%1$I', t);
    execute format('create policy %1$s_update_equipe on public.%1$I for update to authenticated using ((select public.is_equipe())) with check ((select public.is_equipe()))', t);
    execute format('drop policy if exists %1$s_delete_equipe on public.%1$I', t);
    execute format('create policy %1$s_delete_equipe on public.%1$I for delete to authenticated using ((select public.is_equipe()))', t);
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- Pautas realizadas: o locutor marca na dashboard (sem login) pelas
-- funções abaixo; a produção pode corrigir pelo Artístico.
-- ---------------------------------------------------------------------
create table if not exists public.pautas_realizadas (
  id           uuid primary key default gen_random_uuid(),
  pauta_id     uuid not null references public.pautas (id) on delete cascade,
  dia          date not null,
  realizado_em timestamptz not null default now(),
  origem       text not null default 'locutor' check (origem in ('locutor', 'producao')),
  created_at   timestamptz not null default now(),
  constraint pautas_realizadas_unica unique (pauta_id, dia)
);

create index if not exists pautas_realizadas_dia_idx on public.pautas_realizadas (dia);

alter table public.pautas_realizadas enable row level security;
revoke all on table public.pautas_realizadas from anon, authenticated;
grant select on table public.pautas_realizadas to anon;
grant select, insert, update, delete on table public.pautas_realizadas to authenticated;

drop policy if exists pautas_realizadas_select_publico on public.pautas_realizadas;
create policy pautas_realizadas_select_publico
  on public.pautas_realizadas for select to anon, authenticated using (true);

drop policy if exists pautas_realizadas_insert_equipe on public.pautas_realizadas;
create policy pautas_realizadas_insert_equipe
  on public.pautas_realizadas for insert to authenticated with check ((select public.is_equipe()));

drop policy if exists pautas_realizadas_update_equipe on public.pautas_realizadas;
create policy pautas_realizadas_update_equipe
  on public.pautas_realizadas for update to authenticated
  using ((select public.is_equipe())) with check ((select public.is_equipe()));

drop policy if exists pautas_realizadas_delete_equipe on public.pautas_realizadas;
create policy pautas_realizadas_delete_equipe
  on public.pautas_realizadas for delete to authenticated using ((select public.is_equipe()));


-- Locutor marca a pauta como feita. Só vale para pauta ativa, no ar hoje
-- (horário de Brasília). O horário registrado é o do servidor.
create or replace function public.marcar_pauta_feita(p_pauta uuid, p_dia date)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_em timestamptz;
begin
  if p_dia is distinct from (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Só dá para marcar pautas de hoje.';
  end if;
  if not exists (
    select 1 from public.pautas
    where id = p_pauta and ativo and p_dia between data_inicio and data_fim
  ) then
    raise exception 'Pauta não encontrada para hoje.';
  end if;
  insert into public.pautas_realizadas (pauta_id, dia, origem)
  values (p_pauta, p_dia, 'locutor')
  on conflict (pauta_id, dia) do nothing;
  select realizado_em into v_em
  from public.pautas_realizadas where pauta_id = p_pauta and dia = p_dia;
  return v_em;
end;
$$;

-- Desfazer um clique errado: o locutor tem 15 minutos; a equipe, sempre.
create or replace function public.desmarcar_pauta(p_pauta uuid, p_dia date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.pautas_realizadas
  where pauta_id = p_pauta and dia = p_dia
    and ((origem = 'locutor' and realizado_em > now() - interval '15 minutes')
         or (select public.is_equipe()));
  return found;
end;
$$;

revoke all on function public.marcar_pauta_feita(uuid, date) from public;
revoke all on function public.desmarcar_pauta(uuid, date) from public;
grant execute on function public.marcar_pauta_feita(uuid, date) to anon, authenticated;
grant execute on function public.desmarcar_pauta(uuid, date) to anon, authenticated;


-- ---------------------------------------------------------------------
-- Fotos: bucket "imagens" (leitura pública pelo link, envio só da equipe)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imagens', 'imagens', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists imagens_select_equipe on storage.objects;
create policy imagens_select_equipe
  on storage.objects for select to authenticated
  using (bucket_id = 'imagens' and (select public.is_equipe()));

drop policy if exists imagens_insert_equipe on storage.objects;
create policy imagens_insert_equipe
  on storage.objects for insert to authenticated
  with check (bucket_id = 'imagens' and (select public.is_equipe()));

drop policy if exists imagens_update_equipe on storage.objects;
create policy imagens_update_equipe
  on storage.objects for update to authenticated
  using (bucket_id = 'imagens' and (select public.is_equipe()))
  with check (bucket_id = 'imagens' and (select public.is_equipe()));

drop policy if exists imagens_delete_equipe on storage.objects;
create policy imagens_delete_equipe
  on storage.objects for delete to authenticated
  using (bucket_id = 'imagens' and (select public.is_equipe()));


-- =====================================================================
-- DEPOIS de criar os usuários em Authentication > Users, libere cada um
-- para editar rodando (troque o e-mail e o nome):
--
--   insert into public.equipe (user_id, nome)
--   select id, 'Nome da pessoa' from auth.users
--   where email = 'pessoa@exemplo.com'
--   on conflict (user_id) do nothing;
-- =====================================================================
