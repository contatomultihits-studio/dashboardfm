-- =====================================================================
-- 006: Conexões e "Partiu Rádio Disney" (pautas de ações externas)
--
-- * conexoes: igual às prioridades (institucional/atemporal da emissora).
-- * pautas: cliente, locutor, horário que vai ao ar, expectativa ou valendo.
-- * pautas_realizadas: o "feito" do locutor (um por pauta por dia), que
--   vira o relatório do dia para a Opec e a produção.
--
-- Rode uma vez no SQL Editor. Pode rodar de novo sem problema.
-- =====================================================================

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
