-- =====================================================================
-- 007: Locutores e escala
--
-- * locutores: perfil (foto, nome, cor) e o horário fixo da semana
--   (ex.: Rodrigo, segunda a sexta, 10h às 14h).
-- * escala: quem fica em cada horário numa data específica — os fins de
--   semana e as trocas (folga, férias, freela). Numa data, a escala
--   substitui o horário fixo que bater no mesmo horário.
-- * pautas.locutor_id: o locutor escolhido na pauta do Partiu Rádio Disney.
--
-- Horário que vira a noite (22h às 03h) fica na data em que começa.
-- O que não tem ninguém escalado é programação gravada.
--
-- Rode uma vez no SQL Editor. Pode rodar de novo sem problema.
-- =====================================================================

create table if not exists public.locutores (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  nome_completo text not null default '',
  programa      text not null default '',
  cor           text not null default '#46ff9f',
  imagem_path   text,
  -- Horário fixo (opcional; freela não tem). Dias: 0 = domingo ... 6 = sábado.
  dias          smallint[] not null default '{1,2,3,4,5}',
  hora_inicio   time,
  hora_fim      time,
  freela        boolean not null default false,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  constraint locutores_horario_check check ((hora_inicio is null) = (hora_fim is null)),
  constraint locutores_cor_check check (cor ~ '^#[0-9a-fA-F]{6}$')
);

create table if not exists public.escala (
  id          uuid primary key default gen_random_uuid(),
  data        date not null,
  locutor_id  uuid not null references public.locutores (id) on delete cascade,
  hora_inicio time not null,
  hora_fim    time not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  constraint escala_horario_check check (hora_fim <> hora_inicio)
);

create index if not exists escala_data_idx on public.escala (data, hora_inicio);

alter table public.pautas add column if not exists locutor_id uuid references public.locutores (id) on delete set null;

do $$
declare
  t text;
begin
  foreach t in array array['locutores', 'escala'] loop
    execute format('drop trigger if exists %1$s_updated_at on public.%1$I', t);
    execute format(
      'create trigger %1$s_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
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

-- Público: locutores ativos e a escala inteira.
drop policy if exists locutores_select_publico on public.locutores;
create policy locutores_select_publico on public.locutores for select to anon, authenticated using (ativo);
drop policy if exists escala_select_publico on public.escala;
create policy escala_select_publico on public.escala for select to anon, authenticated using (true);
