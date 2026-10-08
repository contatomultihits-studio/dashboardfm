-- =====================================================================
-- DESFAZER a migração 016 (só em emergência): volta a dashboard pública e
-- as regras antigas, recriando as políticas salvas em
-- backup_antes_acessos.politicas antes da mudança (08/10/2026).
-- As regras novas por área continuam (não atrapalham).
-- =====================================================================
do $$
declare
  p record;
begin
  for p in select * from backup_antes_acessos.politicas loop
    if not exists (select 1 from pg_policies x where x.schemaname = p.schemaname and x.tablename = p.tablename and x.policyname = p.policyname) then
      execute format('create policy %I on %I.%I for %s to %s%s%s',
        p.policyname, p.schemaname, p.tablename, p.cmd,
        array_to_string(p.roles, ', '),
        case when p.qual is not null then ' using (' || p.qual || ')' else '' end,
        case when p.with_check is not null then ' with check (' || p.with_check || ')' else '' end);
    end if;
  end loop;
end;
$$;

grant select on public.prioridades, public.recados, public.conexoes, public.pautas, public.pautas_realizadas,
  public.convidados, public.eventos, public.locutores, public.escala, public.premios, public.promo_rodadas to anon;
grant execute on function public.marcar_pauta_feita(uuid, date), public.desmarcar_pauta(uuid, date),
  public.registrar_leitura(text, uuid, text), public.promocao_ganhadores_hoje(date), public.is_equipe() to anon;
-- As três funções acima, na versão da 016, exigem login: para o modo antigo completo,
-- rode também as migrações 006, 009 e 014 (recriam as versões sem essa checagem).
