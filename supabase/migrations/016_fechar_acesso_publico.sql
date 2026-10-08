-- =====================================================================
-- 016: Acessos por pessoa e por área (parte 2: a virada)
--
-- Depois desta parte, NADA fica aberto para quem não está logado:
-- * saem as regras antigas (dashboard pública e "equipe pode tudo");
-- * ficam só as regras por área da migração 015;
-- * marcar pauta feita, registrar leitura e ver os ganhadores do dia
--   passam a exigir login de alguém autorizado.
--
-- Para desfazer: supabase/backup/restaurar_acesso_publico.sql
-- Rode uma vez no SQL Editor. Pode rodar de novo sem problema.
-- =====================================================================

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
