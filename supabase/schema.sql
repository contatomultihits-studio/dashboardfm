-- =====================================================================
-- Dashboard FM — Artístico (prioridades, convidados, eventos)
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
-- Prioridades no ar
-- ---------------------------------------------------------------------
create table if not exists public.prioridades (
  id            uuid primary key default gen_random_uuid(),
  data          date not null,
  conteudo_html text not null default '',
  imagem_path   text,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null
);

create index if not exists prioridades_data_idx on public.prioridades (data);


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
-- Gatilhos, permissões e regras (RLS) das três tabelas
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['prioridades', 'convidados', 'eventos'] loop
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
