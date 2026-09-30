-- Recados rápidos: frases curtas e recados da diretoria, sem imagem,
-- com período no ar e opção de destaque. Mesmas regras de acesso das outras tabelas.

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

drop trigger if exists recados_updated_at on public.recados;
create trigger recados_updated_at before update on public.recados
  for each row execute function public.set_updated_at();

alter table public.recados enable row level security;

revoke all on table public.recados from anon, authenticated;
grant select on table public.recados to anon;
grant select, insert, update, delete on table public.recados to authenticated;

-- Público: só o que está marcado para exibir na dashboard.
drop policy if exists recados_select_publico on public.recados;
create policy recados_select_publico on public.recados
  for select to anon, authenticated
  using (ativo);

-- Equipe: vê tudo e pode criar, editar e apagar.
drop policy if exists recados_select_equipe on public.recados;
create policy recados_select_equipe on public.recados
  for select to authenticated
  using ((select public.is_equipe()));

drop policy if exists recados_insert_equipe on public.recados;
create policy recados_insert_equipe on public.recados
  for insert to authenticated
  with check ((select public.is_equipe()));

drop policy if exists recados_update_equipe on public.recados;
create policy recados_update_equipe on public.recados
  for update to authenticated
  using ((select public.is_equipe()))
  with check ((select public.is_equipe()));

drop policy if exists recados_delete_equipe on public.recados;
create policy recados_delete_equipe on public.recados
  for delete to authenticated
  using ((select public.is_equipe()));
