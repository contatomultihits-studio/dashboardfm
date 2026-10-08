-- =====================================================================
-- VIRADA FINAL (rode uma vez no SQL Editor do Supabase)
--
-- O resto da migração 016 já foi aplicado. Falta só esta parte, que
-- precisa de confirmação porque remove as regras antigas:
-- * sai a regra "quem é da equipe pode editar tudo" (agora vale a área
--   de cada pessoa) e a leitura pública antiga;
-- * "desfazer pauta feita" passa a exigir login;
-- * a página Usuários passa a salvar as áreas de cada pessoa.
-- Nenhum dado é apagado. Para desfazer: supabase/backup/restaurar_acesso_publico.sql
-- =====================================================================

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

revoke all on function public.desmarcar_pauta(uuid, date) from public, anon;
grant execute on function public.desmarcar_pauta(uuid, date) to authenticated;
revoke all on function public.admin_salvar_acesso(uuid, text, text, boolean, jsonb) from public, anon;
grant execute on function public.admin_salvar_acesso(uuid, text, text, boolean, jsonb) to authenticated;

-- Conferência: deve mostrar 0
select count(*) as regras_antigas from pg_policies
where policyname ~ '_(select_publico|select_equipe|insert_equipe|update_equipe|delete_equipe)$';
