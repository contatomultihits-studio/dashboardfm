-- =====================================================================
-- 017: Promoção, segunda versão
--
-- * Cliente / Evento / Prêmio: validade (de / até) e, quando é evento,
--   o tipo de parceria (Rádio Oficial, Apoio, Camarote Rádio Disney).
--   A grade só aceita o prêmio dentro da validade.
-- * "Concluído" na tela do locutor (igual ao Partiu): promo_entregas
--   guarda prêmio, locutor e a hora exata em que foi entregue no ar.
-- * Busca de ouvintes para o locutor: só consulta, sem telefone completo.
-- * Histórico: quem criou, editou ou excluiu cada item (só o admin vê).
--
-- Só acrescenta; nenhum dado existente muda. Pode rodar de novo.
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
