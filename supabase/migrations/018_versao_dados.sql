-- =====================================================================
-- 018: "Mudou alguma coisa?" para a tela do locutor
--
-- A TV pergunta a cada minuto só o número da última alteração (alguns
-- bytes). Se o número for o mesmo da última vez, não baixa nada; se mudou,
-- baixa tudo de novo. O número vem do histórico (cada criar/editar/excluir
-- já gera uma linha lá). Ouvintes e usuários ficam de fora: não aparecem
-- na tela do locutor.
--
-- Só acrescenta. Pode rodar de novo.
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
