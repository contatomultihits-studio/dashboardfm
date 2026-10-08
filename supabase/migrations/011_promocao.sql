-- =====================================================================
-- 011: Promoção (prêmios do dia a dia, ganhadores, ouvintes e bloqueados)
--
-- * premios: o catálogo (nome, título, foto, descrição, patrocinador).
-- * promo_rodadas: a grade do dia ("prêmio das 15h"), com aviso opcional.
-- * ouvintes: quem já ganhou ou está bloqueado. Só o nome é obrigatório.
-- * ganhadores: quem ganhou o quê, quando. Regra: não pode ganhar de novo
--   em 30 dias, e bloqueado não ganha (o banco recusa).
--
-- Prêmios e rodadas são públicos (a dashboard mostra). Ouvintes e
-- ganhadores têm dados pessoais: só a equipe vê. A dashboard recebe só o
-- nome, bairro e cidade de quem ganhou cada rodada, pela função
-- promocao_ganhadores_dia (nunca o telefone).
--
-- Rode uma vez no SQL Editor. Pode rodar de novo sem problema.
-- =====================================================================

create table if not exists public.premios (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (length(trim(nome)) > 0),
  titulo         text not null default '',
  descricao_html text not null default '',
  patrocinador   text not null default '',
  imagem_path    text,
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid default auth.uid() references auth.users (id) on delete set null
);

create table if not exists public.promo_rodadas (
  id         uuid primary key default gen_random_uuid(),
  data       date not null,
  horario    time not null,
  premio_id  uuid references public.premios (id) on delete set null,
  aviso      boolean not null default false,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);

create index if not exists promo_rodadas_dia_idx on public.promo_rodadas (data, horario);

-- Mesmas regras das outras tabelas: público vê o que está ativo; equipe faz tudo.
do $$
declare
  t text;
begin
  foreach t in array array['premios', 'promo_rodadas'] loop
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
-- Ouvintes e ganhadores: só a equipe (dados pessoais).
-- ---------------------------------------------------------------------
create table if not exists public.ouvintes (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (length(trim(nome)) > 0),
  -- Só os números (ex.: 11999998888); a tela formata.
  telefone        text not null default '',
  bairro          text not null default '',
  cidade          text not null default '',
  bloqueado       boolean not null default false,
  motivo_bloqueio text not null default '',
  -- Para buscar sem acento e sem maiúscula ("joao" acha "João").
  nome_busca      text generated always as (
    translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid() references auth.users (id) on delete set null
);

create index if not exists ouvintes_telefone_idx on public.ouvintes (telefone) where telefone <> '';
create index if not exists ouvintes_nome_idx on public.ouvintes (nome_busca);

create table if not exists public.ganhadores (
  id          uuid primary key default gen_random_uuid(),
  ouvinte_id  uuid not null references public.ouvintes (id) on delete cascade,
  rodada_id   uuid references public.promo_rodadas (id) on delete set null,
  premio_id   uuid references public.premios (id) on delete set null,
  -- Guarda o nome do prêmio: o histórico continua certo mesmo se o prêmio for apagado.
  premio_nome text not null default '',
  data        date not null default (now() at time zone 'America/Sao_Paulo')::date,
  ganho_em    timestamptz not null default now(),
  locutor     text not null default '',
  -- Veio da planilha antiga: não passa pela regra dos 30 dias.
  importado   boolean not null default false,
  obs         text not null default '',
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null
);

create index if not exists ganhadores_ouvinte_idx on public.ganhadores (ouvinte_id, data desc);
create index if not exists ganhadores_data_idx on public.ganhadores (data);
create index if not exists ganhadores_rodada_idx on public.ganhadores (rodada_id);

drop trigger if exists ouvintes_updated_at on public.ouvintes;
create trigger ouvintes_updated_at before update on public.ouvintes
  for each row execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['ouvintes', 'ganhadores'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
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


-- Regras do ganhador: bloqueado não ganha; quem ganhou não ganha de novo
-- em 30 dias (contando para os dois lados, para lançamentos atrasados).
create or replace function public.ganhadores_regras()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ouvinte public.ouvintes;
  v_ultima  date;
begin
  if new.importado then
    return new;
  end if;
  select * into v_ouvinte from public.ouvintes where id = new.ouvinte_id;
  if v_ouvinte.bloqueado then
    raise exception 'Ouvinte bloqueado: %', coalesce(nullif(v_ouvinte.motivo_bloqueio, ''), 'sem motivo informado');
  end if;
  select max(g.data) into v_ultima
  from public.ganhadores g
  where g.ouvinte_id = new.ouvinte_id
    and g.id <> new.id
    and abs(g.data - new.data) < 30;
  if v_ultima is not null then
    raise exception 'Este ouvinte ganhou em % e só pode ganhar de novo a partir de %.',
      to_char(v_ultima, 'DD/MM/YYYY'), to_char(v_ultima + 30, 'DD/MM/YYYY');
  end if;
  return new;
end;
$$;

drop trigger if exists ganhadores_regras on public.ganhadores;
create trigger ganhadores_regras
  before insert or update of ouvinte_id, data, importado on public.ganhadores
  for each row execute function public.ganhadores_regras();


-- Para a dashboard: quem ganhou cada rodada do dia (nome, bairro e cidade).
create or replace function public.promocao_ganhadores_dia(p_dia date)
returns table (rodada_id uuid, nome text, bairro text, cidade text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.rodada_id, o.nome, o.bairro, o.cidade
  from public.ganhadores g
  join public.ouvintes o on o.id = g.ouvinte_id
  join public.promo_rodadas r on r.id = g.rodada_id
  where r.data = p_dia and r.ativo
  order by g.ganho_em;
$$;

revoke all on function public.promocao_ganhadores_dia(date) from public;
grant execute on function public.promocao_ganhadores_dia(date) to anon, authenticated;
