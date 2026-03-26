-- COPIE APENAS ESTE ARQUIVO NO SQL EDITOR DO SUPABASE

grant usage on schema public to anon, authenticated;

grant select on table public.programas to anon, authenticated;
grant select, insert on table public.participacoes to anon, authenticated;
grant select, insert on table public.prioridades_ar to anon, authenticated;
grant select, insert on table public.premios to anon, authenticated;
grant select on table public.resumo_participacoes to anon, authenticated;

alter table public.programas enable row level security;
alter table public.participacoes enable row level security;
alter table public.prioridades_ar enable row level security;
alter table public.premios enable row level security;

DROP POLICY IF EXISTS programas_select_public ON public.programas;
create policy programas_select_public
on public.programas for select to anon, authenticated
using (true);

DROP POLICY IF EXISTS participacoes_select_public ON public.participacoes;
create policy participacoes_select_public
on public.participacoes for select to anon, authenticated
using (true);

DROP POLICY IF EXISTS participacoes_insert_public ON public.participacoes;
create policy participacoes_insert_public
on public.participacoes for insert to anon, authenticated
with check (true);

DROP POLICY IF EXISTS prioridades_select_public ON public.prioridades_ar;
create policy prioridades_select_public
on public.prioridades_ar for select to anon, authenticated
using (true);

DROP POLICY IF EXISTS prioridades_insert_public ON public.prioridades_ar;
create policy prioridades_insert_public
on public.prioridades_ar for insert to anon, authenticated
with check (true);

DROP POLICY IF EXISTS premios_select_public ON public.premios;
create policy premios_select_public
on public.premios for select to anon, authenticated
using (true);

DROP POLICY IF EXISTS premios_insert_public ON public.premios;
create policy premios_insert_public
on public.premios for insert to anon, authenticated
with check (true);
