-- =====================================================================
-- 014: A tela do locutor mostra o final do telefone de quem ganhou
-- (últimos 4 números), para conferir no ar. O número inteiro continua
-- só para a equipe. Função nova (a antiga, promocao_ganhadores_dia,
-- fica para telas abertas com a versão anterior do site).
--
-- Rode uma vez no SQL Editor. Pode rodar de novo sem problema.
-- =====================================================================

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
