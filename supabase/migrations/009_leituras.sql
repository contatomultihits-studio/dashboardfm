-- =====================================================================
-- 009: Leituras de prioridades e conexões
--
-- Cada vez que o locutor abre uma prioridade ou conexão na dashboard,
-- fica registrado o horário (do servidor) e quem estava no ar. Vira o
-- "Relatório de leituras" no Artístico (separado do relatório de pautas).
--
-- A dashboard (sem login) só registra pela função abaixo; só a equipe lê.
-- Rode uma vez no SQL Editor. Pode rodar de novo sem problema.
-- =====================================================================

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
