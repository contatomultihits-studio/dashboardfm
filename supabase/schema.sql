-- =====================================================================
-- Dashboard FM — Artístico (prioridades, recados, conexões, pautas, locutores, escala, convidados, eventos)
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
                   check (vinculo in ('RADIO_OFICIAL', 'APOIO', 'CAMAROTE')),
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
-- Locutores (perfil + horário fixo) e escala por data (fins de semana e trocas).
-- Mesmo conteúdo da migração 007.
-- ---------------------------------------------------------------------
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


-- "Fixar em primeiro" (migração 008).
alter table public.prioridades add column if not exists fixado boolean not null default false;
alter table public.conexoes add column if not exists fixado boolean not null default false;


-- ---------------------------------------------------------------------
-- Leituras de prioridades e conexões (relatório de leituras). Migração 009.
-- ---------------------------------------------------------------------
create table if not exists public.leituras (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('prioridade', 'conexao')),
  item_id    uuid not null,
  titulo     text not null default '',
  dia        date not null,
  lido_em    timestamptz not null default now(),
  locutor    text not null default ''
);

create index if not exists leituras_dia_idx on public.leituras (dia, lido_em);
create index if not exists leituras_item_idx on public.leituras (item_id, lido_em);

alter table public.leituras enable row level security;
revoke all on table public.leituras from anon, authenticated;
grant select, delete on table public.leituras to authenticated;

drop policy if exists leituras_select_equipe on public.leituras;
create policy leituras_select_equipe on public.leituras for select to authenticated using ((select public.is_equipe()));
drop policy if exists leituras_delete_equipe on public.leituras;
create policy leituras_delete_equipe on public.leituras for delete to authenticated using ((select public.is_equipe()));

-- Registra uma leitura. Só vale para prioridade/conexão ativa; cliques repetidos
-- no mesmo card em menos de 1 minuto contam uma vez só.
create or replace function public.registrar_leitura(p_tipo text, p_item uuid, p_locutor text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titulo text;
begin
  if p_tipo = 'prioridade' then
    select titulo into v_titulo from public.prioridades where id = p_item and ativo;
  elsif p_tipo = 'conexao' then
    select titulo into v_titulo from public.conexoes where id = p_item and ativo;
  else
    raise exception 'Tipo inválido.';
  end if;
  if v_titulo is null then
    raise exception 'Card não encontrado.';
  end if;
  if exists (select 1 from public.leituras where item_id = p_item and lido_em > now() - interval '1 minute') then
    return;
  end if;
  insert into public.leituras (tipo, item_id, titulo, dia, locutor)
  values (p_tipo, p_item, v_titulo, (now() at time zone 'America/Sao_Paulo')::date, left(coalesce(p_locutor, ''), 80));
end;
$$;

revoke all on function public.registrar_leitura(text, uuid, text) from public;
grant execute on function public.registrar_leitura(text, uuid, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- Jornalismo: pautas com secao = 'jornalismo' e aviso opcional. Migração 010.
-- ---------------------------------------------------------------------
alter table public.pautas add column if not exists secao text not null default 'partiu';
alter table public.pautas add column if not exists aviso boolean not null default true;
alter table public.pautas alter column cliente set default '';

alter table public.pautas drop constraint if exists pautas_tipo_check;
alter table public.pautas drop constraint if exists pautas_secao_tipo_check;
alter table public.pautas add constraint pautas_secao_tipo_check check (
  (secao = 'partiu' and tipo in ('EXPECTATIVA', 'VALENDO'))
  or (secao = 'jornalismo' and tipo in ('ESPN', 'NOTA', 'CONTA_TUDO', 'CE_VIU', 'CLASSICOS', 'EM_CARTAZ', 'DESAFIO_RD'))
);

create index if not exists pautas_secao_idx on public.pautas (secao, data_inicio, data_fim);


-- ---------------------------------------------------------------------
-- Promoção: prêmios, grade por horário, ouvintes e ganhadores (migração 011)
-- ---------------------------------------------------------------------
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

-- Faixa do prêmio (migração 013): fica na tela do locutor até horario_fim; sem fim, vale 1 hora.
alter table public.promo_rodadas add column if not exists horario_fim time;
alter table public.promo_rodadas drop constraint if exists promo_rodadas_faixa_check;
alter table public.promo_rodadas add constraint promo_rodadas_faixa_check
  check (horario_fim is null or horario_fim > horario);

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

-- Igual, com o final do telefone (migração 014). É a que o site usa.
create or replace function public.promocao_ganhadores_hoje(p_dia date)
returns table (rodada_id uuid, nome text, bairro text, cidade text, telefone_final text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.rodada_id, o.nome, o.bairro, o.cidade, right(o.telefone, 4)
  from public.ganhadores g
  join public.ouvintes o on o.id = g.ouvinte_id
  join public.promo_rodadas r on r.id = g.rodada_id
  where r.data = p_dia and r.ativo
  order by g.ganho_em;
$$;

revoke all on function public.promocao_ganhadores_hoje(date) from public;
grant execute on function public.promocao_ganhadores_hoje(date) to anon, authenticated;


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
-- Acessos por pessoa e por área (migrações 015 e 016)
-- =====================================================================


create table if not exists public.perfis (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  nome           text not null check (length(trim(nome)) > 0),
  email          text not null,
  tipo           text not null check (tipo in ('admin', 'equipe', 'locutor')),
  ativo          boolean not null default true,
  senha_alterada boolean not null default false,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references auth.users (id) on delete set null,
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.permissoes (
  user_id uuid not null references public.perfis (user_id) on delete cascade,
  area    text not null check (area in (
            'prioridades', 'recados', 'partiu', 'jornalismo', 'promocao', 'conexoes',
            'convidados', 'eventos', 'locutores', 'relatorios')),
  nivel   text not null check (nivel in ('ver', 'editar')),
  primary key (user_id, area)
);

drop trigger if exists perfis_atualizado on public.perfis;
create or replace function public.perfis_tocar()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
create trigger perfis_atualizado before update on public.perfis
  for each row execute function public.perfis_tocar();


-- ---------------------------------------------------------------------
-- Funções de checagem (as regras das tabelas chamam estas)
-- ---------------------------------------------------------------------
create or replace function public.usuario_autorizado()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.user_id = (select auth.uid()) and p.ativo
  );
$$;

create or replace function public.eh_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.user_id = (select auth.uid()) and p.ativo and p.tipo = 'admin'
  );
$$;

-- "ver" vale para quem tem ver ou editar; "editar" só para quem tem editar.
create or replace function public.pode(p_area text, p_nivel text default 'ver')
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.user_id = (select auth.uid()) and p.ativo
      and (
        p.tipo = 'admin'
        or (p.tipo = 'equipe' and exists (
          select 1 from public.permissoes x
          where x.user_id = p.user_id and x.area = p_area
            and (p_nivel = 'ver' or x.nivel = 'editar')
        ))
      )
  );
$$;

-- Pode enviar fotos: quem edita alguma área.
create or replace function public.pode_editar_algo()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.user_id = (select auth.uid()) and p.ativo
      and (p.tipo = 'admin' or exists (select 1 from public.permissoes x where x.user_id = p.user_id and x.nivel = 'editar'))
  );
$$;

-- O que o site precisa saber de quem entrou (null = não autorizado).
create or replace function public.meu_acesso()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'nome', p.nome,
    'email', p.email,
    'tipo', p.tipo,
    'ativo', p.ativo,
    'senha_alterada', p.senha_alterada,
    'permissoes', coalesce((select jsonb_object_agg(x.area, x.nivel) from public.permissoes x where x.user_id = p.user_id), '{}'::jsonb)
  )
  from public.perfis p
  where p.user_id = (select auth.uid());
$$;

-- Depois de trocar a senha no primeiro acesso.
create or replace function public.marcar_senha_alterada()
returns void
language sql volatile security definer set search_path = ''
as $$
  update public.perfis set senha_alterada = true where user_id = (select auth.uid());
$$;

-- O administrador muda tipo, ativo e as áreas de alguém (não mexe no próprio acesso de admin).
create or replace function public.admin_salvar_acesso(p_user uuid, p_nome text, p_tipo text, p_ativo boolean, p_permissoes jsonb)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.eh_admin() then
    raise exception 'Só o administrador pode mudar acessos.';
  end if;
  if p_user = (select auth.uid()) and (p_tipo <> 'admin' or not p_ativo) then
    raise exception 'Você não pode tirar o seu próprio acesso de administrador.';
  end if;
  if p_tipo not in ('admin', 'equipe', 'locutor') then
    raise exception 'Tipo inválido.';
  end if;
  update public.perfis set nome = trim(p_nome), tipo = p_tipo, ativo = p_ativo where user_id = p_user;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;
  delete from public.permissoes where user_id = p_user;
  if p_tipo = 'equipe' then
    insert into public.permissoes (user_id, area, nivel)
    select p_user, e.key, e.value
    from jsonb_each_text(coalesce(p_permissoes, '{}'::jsonb)) e
    where e.value in ('ver', 'editar')
      and e.key in ('prioridades', 'recados', 'partiu', 'jornalismo', 'promocao', 'conexoes',
                    'convidados', 'eventos', 'locutores', 'relatorios');
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- Regras de perfis e permissões
-- ---------------------------------------------------------------------
alter table public.perfis enable row level security;
alter table public.permissoes enable row level security;
revoke all on table public.perfis from anon, authenticated;
revoke all on table public.permissoes from anon, authenticated;
grant select on table public.perfis to authenticated;
grant select on table public.permissoes to authenticated;

drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis for select to authenticated
  using (user_id = (select auth.uid()) or (select public.eh_admin()));
drop policy if exists permissoes_select on public.permissoes;
create policy permissoes_select on public.permissoes for select to authenticated
  using (user_id = (select auth.uid()) or (select public.eh_admin()));
-- Escrita em perfis/permissões: só pelas funções acima e pela Edge Function.

revoke all on function public.usuario_autorizado() from public, anon;
revoke all on function public.eh_admin() from public, anon;
revoke all on function public.pode(text, text) from public, anon;
revoke all on function public.pode_editar_algo() from public, anon;
revoke all on function public.meu_acesso() from public, anon;
revoke all on function public.marcar_senha_alterada() from public, anon;
revoke all on function public.admin_salvar_acesso(uuid, text, text, boolean, jsonb) from public, anon;
revoke all on function public.perfis_tocar() from public, anon, authenticated;
grant execute on function public.usuario_autorizado() to authenticated;
grant execute on function public.eh_admin() to authenticated;
grant execute on function public.pode(text, text) to authenticated;
grant execute on function public.pode_editar_algo() to authenticated;
grant execute on function public.meu_acesso() to authenticated;
grant execute on function public.marcar_senha_alterada() to authenticated;
grant execute on function public.admin_salvar_acesso(uuid, text, text, boolean, jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- Novas regras das tabelas (somam com as antigas até a parte 2)
-- Área de cada tabela; pautas usam a seção (Partiu ou Jornalismo).
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select * from (values
      ('prioridades', 'prioridades'), ('recados', 'recados'), ('conexoes', 'conexoes'),
      ('convidados', 'convidados'), ('eventos', 'eventos'),
      ('locutores', 'locutores'), ('escala', 'locutores'),
      ('premios', 'promocao'), ('promo_rodadas', 'promocao')
    ) as t(tabela, area)
  loop
    execute format('drop policy if exists %1$s_ver_autorizado on public.%1$I', r.tabela);
    execute format('create policy %1$s_ver_autorizado on public.%1$I for select to authenticated using ((select public.usuario_autorizado()))', r.tabela);
    execute format('drop policy if exists %1$s_inserir_area on public.%1$I', r.tabela);
    execute format('create policy %1$s_inserir_area on public.%1$I for insert to authenticated with check ((select public.pode(%2$L, ''editar'')))', r.tabela, r.area);
    execute format('drop policy if exists %1$s_mudar_area on public.%1$I', r.tabela);
    execute format('create policy %1$s_mudar_area on public.%1$I for update to authenticated using ((select public.pode(%2$L, ''editar''))) with check ((select public.pode(%2$L, ''editar'')))', r.tabela, r.area);
    execute format('drop policy if exists %1$s_apagar_area on public.%1$I', r.tabela);
    execute format('create policy %1$s_apagar_area on public.%1$I for delete to authenticated using ((select public.pode(%2$L, ''editar'')))', r.tabela, r.area);
  end loop;
end;
$$;

-- Pautas: a área é a seção.
drop policy if exists pautas_ver_autorizado on public.pautas;
create policy pautas_ver_autorizado on public.pautas for select to authenticated using ((select public.usuario_autorizado()));
drop policy if exists pautas_inserir_area on public.pautas;
create policy pautas_inserir_area on public.pautas for insert to authenticated
  with check (public.pode(case when secao = 'jornalismo' then 'jornalismo' else 'partiu' end, 'editar'));
drop policy if exists pautas_mudar_area on public.pautas;
create policy pautas_mudar_area on public.pautas for update to authenticated
  using (public.pode(case when secao = 'jornalismo' then 'jornalismo' else 'partiu' end, 'editar'))
  with check (public.pode(case when secao = 'jornalismo' then 'jornalismo' else 'partiu' end, 'editar'));
drop policy if exists pautas_apagar_area on public.pautas;
create policy pautas_apagar_area on public.pautas for delete to authenticated
  using (public.pode(case when secao = 'jornalismo' then 'jornalismo' else 'partiu' end, 'editar'));

-- "Feita": todos os autorizados veem; corrigir no relatório = quem edita a seção ou os relatórios.
create or replace function public.pode_corrigir_pauta(p_pauta uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.pode('relatorios', 'editar') or exists (
    select 1 from public.pautas pa where pa.id = p_pauta
      and public.pode(case when pa.secao = 'jornalismo' then 'jornalismo' else 'partiu' end, 'editar')
  );
$$;
revoke all on function public.pode_corrigir_pauta(uuid) from public, anon;
grant execute on function public.pode_corrigir_pauta(uuid) to authenticated;

drop policy if exists pautas_realizadas_ver_autorizado on public.pautas_realizadas;
create policy pautas_realizadas_ver_autorizado on public.pautas_realizadas for select to authenticated using ((select public.usuario_autorizado()));
drop policy if exists pautas_realizadas_inserir_area on public.pautas_realizadas;
create policy pautas_realizadas_inserir_area on public.pautas_realizadas for insert to authenticated with check (public.pode_corrigir_pauta(pauta_id));
drop policy if exists pautas_realizadas_mudar_area on public.pautas_realizadas;
create policy pautas_realizadas_mudar_area on public.pautas_realizadas for update to authenticated using (public.pode_corrigir_pauta(pauta_id)) with check (public.pode_corrigir_pauta(pauta_id));
drop policy if exists pautas_realizadas_apagar_area on public.pautas_realizadas;
create policy pautas_realizadas_apagar_area on public.pautas_realizadas for delete to authenticated using (public.pode_corrigir_pauta(pauta_id));

-- Ouvintes e ganhadores (dados pessoais): Promoção; os relatórios só leem.
do $$
declare t text;
begin
  foreach t in array array['ouvintes', 'ganhadores'] loop
    execute format('drop policy if exists %1$s_ver_area on public.%1$I', t);
    execute format('create policy %1$s_ver_area on public.%1$I for select to authenticated using ((select public.pode(''promocao'', ''ver'')) or (select public.pode(''relatorios'', ''ver'')))', t);
    execute format('drop policy if exists %1$s_inserir_area on public.%1$I', t);
    execute format('create policy %1$s_inserir_area on public.%1$I for insert to authenticated with check ((select public.pode(''promocao'', ''editar'')))', t);
    execute format('drop policy if exists %1$s_mudar_area on public.%1$I', t);
    execute format('create policy %1$s_mudar_area on public.%1$I for update to authenticated using ((select public.pode(''promocao'', ''editar''))) with check ((select public.pode(''promocao'', ''editar'')))', t);
    execute format('drop policy if exists %1$s_apagar_area on public.%1$I', t);
    execute format('create policy %1$s_apagar_area on public.%1$I for delete to authenticated using ((select public.pode(''promocao'', ''editar'')))', t);
  end loop;
end;
$$;

-- Leituras: só os relatórios.
drop policy if exists leituras_ver_area on public.leituras;
create policy leituras_ver_area on public.leituras for select to authenticated using ((select public.pode('relatorios', 'ver')));
drop policy if exists leituras_apagar_area on public.leituras;
create policy leituras_apagar_area on public.leituras for delete to authenticated using ((select public.pode('relatorios', 'editar')));

-- Fotos: quem edita alguma área envia, troca e apaga.
drop policy if exists imagens_inserir_quem_edita on storage.objects;
create policy imagens_inserir_quem_edita on storage.objects for insert to authenticated
  with check (bucket_id = 'imagens' and (select public.pode_editar_algo()));
drop policy if exists imagens_mudar_quem_edita on storage.objects;
create policy imagens_mudar_quem_edita on storage.objects for update to authenticated
  using (bucket_id = 'imagens' and (select public.pode_editar_algo()))
  with check (bucket_id = 'imagens' and (select public.pode_editar_algo()));
drop policy if exists imagens_apagar_quem_edita on storage.objects;
create policy imagens_apagar_quem_edita on storage.objects for delete to authenticated
  using (bucket_id = 'imagens' and (select public.pode_editar_algo()));
drop policy if exists imagens_ver_quem_edita on storage.objects;
create policy imagens_ver_quem_edita on storage.objects for select to authenticated
  using (bucket_id = 'imagens' and (select public.pode_editar_algo()));



-- 1) Regras antigas
do $$
declare
  t text;
begin
  foreach t in array array['prioridades', 'recados', 'convidados', 'eventos', 'conexoes', 'pautas',
                           'locutores', 'escala', 'premios', 'promo_rodadas', 'ouvintes', 'ganhadores'] loop
    execute format('drop policy if exists %1$s_select_publico on public.%1$I', t);
    execute format('drop policy if exists %1$s_select_equipe on public.%1$I', t);
    execute format('drop policy if exists %1$s_insert_equipe on public.%1$I', t);
    execute format('drop policy if exists %1$s_update_equipe on public.%1$I', t);
    execute format('drop policy if exists %1$s_delete_equipe on public.%1$I', t);
  end loop;
end;
$$;
drop policy if exists pautas_realizadas_select_publico on public.pautas_realizadas;
drop policy if exists pautas_realizadas_insert_equipe on public.pautas_realizadas;
drop policy if exists pautas_realizadas_update_equipe on public.pautas_realizadas;
drop policy if exists pautas_realizadas_delete_equipe on public.pautas_realizadas;
drop policy if exists leituras_select_equipe on public.leituras;
drop policy if exists leituras_delete_equipe on public.leituras;
drop policy if exists imagens_select_equipe on storage.objects;
drop policy if exists imagens_insert_equipe on storage.objects;
drop policy if exists imagens_update_equipe on storage.objects;
drop policy if exists imagens_delete_equipe on storage.objects;

-- 2) Visitante sem login: nenhuma tabela.
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end;
$$;

-- 3) "Equipe" antiga: agora é quem tem perfil ativo de admin ou equipe.
create or replace function public.is_equipe()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.user_id = (select auth.uid()) and p.ativo and p.tipo in ('admin', 'equipe')
  );
$$;

-- 4) Ações da tela do locutor: só com login autorizado.
create or replace function public.marcar_pauta_feita(p_pauta uuid, p_dia date)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_em timestamptz;
begin
  if not public.usuario_autorizado() then
    raise exception 'Acesso não autorizado.';
  end if;
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

create or replace function public.desmarcar_pauta(p_pauta uuid, p_dia date)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.usuario_autorizado() then
    raise exception 'Acesso não autorizado.';
  end if;
  delete from public.pautas_realizadas
  where pauta_id = p_pauta and dia = p_dia
    and ((origem = 'locutor' and realizado_em > now() - interval '15 minutes')
         or public.pode_corrigir_pauta(p_pauta));
  return found;
end;
$$;

create or replace function public.registrar_leitura(p_tipo text, p_item uuid, p_locutor text default '')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_titulo text;
begin
  if not public.usuario_autorizado() then
    raise exception 'Acesso não autorizado.';
  end if;
  if p_tipo = 'prioridade' then
    select titulo into v_titulo from public.prioridades where id = p_item and ativo;
  elsif p_tipo = 'conexao' then
    select titulo into v_titulo from public.conexoes where id = p_item and ativo;
  else
    raise exception 'Tipo inválido.';
  end if;
  if v_titulo is null then
    raise exception 'Card não encontrado.';
  end if;
  if exists (select 1 from public.leituras where item_id = p_item and lido_em > now() - interval '1 minute') then
    return;
  end if;
  insert into public.leituras (tipo, item_id, titulo, dia, locutor)
  values (p_tipo, p_item, v_titulo, (now() at time zone 'America/Sao_Paulo')::date, left(coalesce(p_locutor, ''), 80));
end;
$$;

create or replace function public.promocao_ganhadores_hoje(p_dia date)
returns table (rodada_id uuid, nome text, bairro text, cidade text, telefone_final text)
language sql stable security definer set search_path = ''
as $$
  select g.rodada_id, o.nome, o.bairro, o.cidade, right(o.telefone, 4)
  from public.ganhadores g
  join public.ouvintes o on o.id = g.ouvinte_id
  join public.promo_rodadas r on r.id = g.rodada_id
  where r.data = p_dia and r.ativo and public.usuario_autorizado()
  order by g.ganho_em;
$$;

-- 5) Salvar acessos na página Usuários (versão completa, com as áreas)
create or replace function public.admin_salvar_acesso(p_user uuid, p_nome text, p_tipo text, p_ativo boolean, p_permissoes jsonb)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.eh_admin() then
    raise exception 'Só o administrador pode mudar acessos.';
  end if;
  if p_user = (select auth.uid()) and (p_tipo <> 'admin' or not p_ativo) then
    raise exception 'Você não pode tirar o seu próprio acesso de administrador.';
  end if;
  if p_tipo not in ('admin', 'equipe', 'locutor') then
    raise exception 'Tipo inválido.';
  end if;
  update public.perfis set nome = trim(p_nome), tipo = p_tipo, ativo = p_ativo where user_id = p_user;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;
  delete from public.permissoes where user_id = p_user;
  if p_tipo = 'equipe' then
    insert into public.permissoes (user_id, area, nivel)
    select p_user, e.key, e.value
    from jsonb_each_text(coalesce(p_permissoes, '{}'::jsonb)) e
    where e.value in ('ver', 'editar')
      and e.key in ('prioridades', 'recados', 'partiu', 'jornalismo', 'promocao', 'conexoes',
                    'convidados', 'eventos', 'locutores', 'relatorios');
  end if;
end;
$$;

-- 6) Quem pode chamar o quê
revoke all on function public.admin_salvar_acesso(uuid, text, text, boolean, jsonb) from public, anon;
revoke all on function public.is_equipe() from public, anon;
revoke all on function public.marcar_pauta_feita(uuid, date) from public, anon;
revoke all on function public.desmarcar_pauta(uuid, date) from public, anon;
revoke all on function public.registrar_leitura(text, uuid, text) from public, anon;
revoke all on function public.promocao_ganhadores_hoje(date) from public, anon;
revoke all on function public.promocao_ganhadores_dia(date) from public, anon, authenticated; -- versão antiga, sem uso
revoke all on function public.ganhadores_regras() from public, anon, authenticated;            -- só gatilho
revoke all on function public.set_updated_at() from public, anon, authenticated;               -- só gatilho
grant execute on function public.admin_salvar_acesso(uuid, text, text, boolean, jsonb) to authenticated;
grant execute on function public.is_equipe() to authenticated;
grant execute on function public.marcar_pauta_feita(uuid, date) to authenticated;
grant execute on function public.desmarcar_pauta(uuid, date) to authenticated;
grant execute on function public.registrar_leitura(text, uuid, text) to authenticated;
grant execute on function public.promocao_ganhadores_hoje(date) to authenticated;


-- =====================================================================
-- Promoção, segunda versão (migração 017)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Validade e parceria
-- ---------------------------------------------------------------------
alter table public.premios add column if not exists data_inicio date;
alter table public.premios add column if not exists data_fim date;
alter table public.premios add column if not exists evento boolean not null default false;
alter table public.premios add column if not exists parceria text;
alter table public.premios drop constraint if exists premios_parceria_check;
alter table public.premios add constraint premios_parceria_check
  check (parceria is null or parceria in ('RADIO_OFICIAL', 'APOIO', 'CAMAROTE'));
alter table public.premios drop constraint if exists premios_validade_check;
alter table public.premios add constraint premios_validade_check
  check (data_inicio is null or data_fim is null or data_fim >= data_inicio);

-- A grade só aceita o prêmio dentro da validade (prêmios antigos, sem datas, valem sempre).
create or replace function public.promo_rodadas_validade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.premios;
begin
  if new.premio_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.premio_id is not distinct from old.premio_id and new.data = old.data then
    return new;
  end if;
  select * into v from public.premios where id = new.premio_id;
  if (v.data_inicio is not null and new.data < v.data_inicio) or (v.data_fim is not null and new.data > v.data_fim) then
    raise exception '"%" vale de % a %: não dá para colocar em %.',
      v.nome,
      coalesce(to_char(v.data_inicio, 'DD/MM/YYYY'), '…'),
      coalesce(to_char(v.data_fim, 'DD/MM/YYYY'), '…'),
      to_char(new.data, 'DD/MM/YYYY');
  end if;
  return new;
end;
$$;
revoke all on function public.promo_rodadas_validade() from public, anon, authenticated;
drop trigger if exists promo_rodadas_validade on public.promo_rodadas;
create trigger promo_rodadas_validade before insert or update on public.promo_rodadas
  for each row execute function public.promo_rodadas_validade();


-- ---------------------------------------------------------------------
-- 2) Prêmio entregue no ar ("Concluído")
-- ---------------------------------------------------------------------
create table if not exists public.promo_entregas (
  id          uuid primary key default gen_random_uuid(),
  rodada_id   uuid unique references public.promo_rodadas (id) on delete set null,
  data        date not null,
  horario     time not null,
  horario_fim time,
  premio_id   uuid references public.premios (id) on delete set null,
  premio_nome text not null default '',
  locutor     text not null default '',
  entregue_em timestamptz not null default now(),
  feito_por   uuid default auth.uid() references auth.users (id) on delete set null
);
create index if not exists promo_entregas_data_idx on public.promo_entregas (data);

alter table public.promo_entregas enable row level security;
revoke all on table public.promo_entregas from anon, authenticated;
grant select, delete on table public.promo_entregas to authenticated;

drop policy if exists promo_entregas_ver_autorizado on public.promo_entregas;
create policy promo_entregas_ver_autorizado on public.promo_entregas for select to authenticated
  using ((select public.usuario_autorizado()));
-- Desfazer: o próprio locutor em até 15 min; depois, só quem edita a promoção ou os relatórios.
drop policy if exists promo_entregas_desfazer on public.promo_entregas;
create policy promo_entregas_desfazer on public.promo_entregas for delete to authenticated
  using (
    ((select public.usuario_autorizado()) and entregue_em > now() - interval '15 minutes')
    or (select public.pode('promocao', 'editar'))
    or (select public.pode('relatorios', 'editar'))
  );

-- O locutor marca: a hora vem do servidor, o prêmio e o horário vêm da grade.
create or replace function public.concluir_premio(p_rodada uuid, p_locutor text default '')
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  r  public.promo_rodadas;
  em timestamptz;
begin
  if not public.usuario_autorizado() then
    raise exception 'Acesso não autorizado.';
  end if;
  select * into r from public.promo_rodadas where id = p_rodada and ativo;
  if r.id is null then
    raise exception 'Prêmio não encontrado na grade.';
  end if;
  if r.data <> (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Só dá para concluir prêmios de hoje.';
  end if;
  insert into public.promo_entregas (rodada_id, data, horario, horario_fim, premio_id, premio_nome, locutor)
  values (r.id, r.data, r.horario, r.horario_fim, r.premio_id,
          coalesce((select p.nome from public.premios p where p.id = r.premio_id), ''),
          left(coalesce(p_locutor, ''), 120))
  on conflict (rodada_id) do nothing;
  select e.entregue_em into em from public.promo_entregas e where e.rodada_id = r.id;
  return em;
end;
$$;
revoke all on function public.concluir_premio(uuid, text) from public, anon;
grant execute on function public.concluir_premio(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 3) Busca de ouvintes para o locutor (só consulta, sem telefone completo)
-- ---------------------------------------------------------------------
create or replace function public.buscar_ouvintes_locutor(p_busca text)
returns table (
  nome text, bairro text, cidade text, telefone_final text,
  bloqueado boolean, motivo_bloqueio text,
  ultima_vitoria date, ultimo_premio text, vitorias integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select translate(lower(trim(coalesce(p_busca, ''))), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') as termo,
           regexp_replace(coalesce(p_busca, ''), '\D', '', 'g') as digitos
  )
  select o.nome, o.bairro, o.cidade, right(o.telefone, 4), o.bloqueado, o.motivo_bloqueio,
         u.data, u.premio_nome, coalesce(c.n, 0)::integer
  from t cross join public.ouvintes o
  left join lateral (
    select g.data, g.premio_nome from public.ganhadores g
    where g.ouvinte_id = o.id order by g.data desc, g.ganho_em desc limit 1
  ) u on true
  left join lateral (select count(*) as n from public.ganhadores g where g.ouvinte_id = o.id) c on true
  where public.usuario_autorizado()
    and length(t.termo) >= 2
    and (o.nome_busca like '%' || t.termo || '%'
         or (length(t.digitos) >= 4 and o.telefone like '%' || t.digitos || '%'))
  order by o.nome
  limit 20;
$$;
revoke all on function public.buscar_ouvintes_locutor(text) from public, anon;
grant execute on function public.buscar_ouvintes_locutor(text) to authenticated;


-- ---------------------------------------------------------------------
-- 4) Histórico de alterações (só o administrador vê)
-- ---------------------------------------------------------------------
create table if not exists public.historico (
  id        bigint generated always as identity primary key,
  em        timestamptz not null default now(),
  tabela    text not null,
  acao      text not null check (acao in ('criou', 'editou', 'excluiu')),
  registro  text not null default '',
  resumo    text not null default '',
  quem      uuid,
  quem_nome text not null default '',
  mudancas  jsonb,
  dados     jsonb
);
create index if not exists historico_em_idx on public.historico (em desc);
create index if not exists historico_tabela_idx on public.historico (tabela, em desc);

alter table public.historico enable row level security;
revoke all on table public.historico from anon, authenticated;
grant select on table public.historico to authenticated;
drop policy if exists historico_admin on public.historico;
create policy historico_admin on public.historico for select to authenticated
  using ((select public.eh_admin()));

create or replace function public.registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo   jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  velho  jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  linha  jsonb := coalesce(novo, velho);
  difs   jsonb := '{}'::jsonb;
  k      text;
  uid    uuid := auth.uid();
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(novo) loop
      continue when k in ('updated_at', 'atualizado_em', 'nome_busca');
      if novo -> k is distinct from velho -> k then
        difs := difs || jsonb_build_object(k, jsonb_build_object(
          'de', left(coalesce(velho ->> k, ''), 300),
          'para', left(coalesce(novo ->> k, ''), 300)));
      end if;
    end loop;
    if difs = '{}'::jsonb then
      return new;
    end if;
  end if;
  insert into public.historico (tabela, acao, registro, resumo, quem, quem_nome, mudancas, dados)
  values (
    tg_table_name,
    case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'editou' else 'excluiu' end,
    coalesce(linha ->> 'id', linha ->> 'user_id', ''),
    left(coalesce(nullif(linha ->> 'nome', ''), nullif(linha ->> 'titulo', ''), nullif(linha ->> 'cliente', ''),
                  nullif(linha ->> 'premio_nome', ''), nullif(linha ->> 'area', ''), nullif(linha ->> 'data', ''), ''), 160),
    uid,
    coalesce((select p.nome from public.perfis p where p.user_id = uid), case when uid is null then 'Sistema' else '' end),
    case when tg_op = 'UPDATE' then difs end,
    case when tg_op = 'DELETE' then velho end
  );
  return coalesce(new, old);
end;
$$;
revoke all on function public.registrar_historico() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['prioridades', 'recados', 'conexoes', 'pautas', 'pautas_realizadas', 'convidados',
                           'eventos', 'locutores', 'escala', 'premios', 'promo_rodadas', 'ouvintes',
                           'ganhadores', 'promo_entregas', 'perfis', 'permissoes'] loop
    execute format('drop trigger if exists %1$s_historico on public.%1$I', t);
    execute format('create trigger %1$s_historico after insert or update or delete on public.%1$I
                    for each row execute function public.registrar_historico()', t);
  end loop;
end;
$$;


-- =====================================================================
-- "Mudou alguma coisa?" para a tela do locutor (migração 018)
-- =====================================================================
create or replace function public.versao_dados()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.usuario_autorizado() then (
    select coalesce(max(h.id), 0) from public.historico h
    where h.tabela not in ('ouvintes', 'perfis', 'permissoes')
  ) end;
$$;
revoke all on function public.versao_dados() from public, anon;
grant execute on function public.versao_dados() to authenticated;


-- =====================================================================
-- Recados que repetem em dias e horários (migração 019)
-- =====================================================================
alter table public.recados add column if not exists repetir boolean not null default false;
alter table public.recados add column if not exists dias_semana smallint[] not null default '{}';
alter table public.recados add column if not exists janela_inicio time;
alter table public.recados add column if not exists janela_fim time;
alter table public.recados drop constraint if exists recados_repetir_check;
alter table public.recados add constraint recados_repetir_check check (
  not repetir or (
    cardinality(dias_semana) > 0
    and dias_semana <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    and janela_inicio is not null and janela_fim is not null
    and janela_inicio <> janela_fim
  )
);


-- =====================================================================
-- Recado-lembrete com pop-up (migração 020)
-- =====================================================================
alter table public.recados add column if not exists lembrete boolean not null default false;


-- =====================================================================
-- DEPOIS: crie o SEU usuário em Authentication > Users (Auto Confirm) e
-- torne-o administrador (troque o e-mail e o nome). Os outros usuários
-- você cria pelo site, na página Usuários.
--
--   insert into public.perfis (user_id, nome, email, tipo, senha_alterada)
--   select id, 'Seu nome', email, 'admin', true from auth.users
--   where email = 'voce@exemplo.com'
--   on conflict (user_id) do nothing;
-- =====================================================================
