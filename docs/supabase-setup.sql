-- Execute no SQL Editor do Supabase
-- Objetivo: permitir uso da dashboard com ANON KEY (sem login)

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table public.programas to anon, authenticated;
grant select, insert, update, delete on table public.participacoes to anon, authenticated;
grant select, insert, update, delete on table public.prioridades_ar to anon, authenticated;
grant select, insert, update, delete on table public.gestao_convidados to anon, authenticated;
grant select, insert, update, delete on table public.gestao_eventos to anon, authenticated;
grant select, insert, update, delete on table public.premios to anon, authenticated;
grant select on table public.resumo_participacoes to anon, authenticated;

alter table public.programas enable row level security;
alter table public.participacoes enable row level security;
alter table public.prioridades_ar enable row level security;
alter table public.gestao_convidados enable row level security;
alter table public.gestao_eventos enable row level security;
alter table public.premios enable row level security;

-- Programas
DROP POLICY IF EXISTS programas_select_public ON public.programas;
create policy programas_select_public
on public.programas for select to anon, authenticated
using (true);

-- Participações
DROP POLICY IF EXISTS participacoes_select_public ON public.participacoes;
create policy participacoes_select_public
on public.participacoes for select to anon, authenticated
using (true);

DROP POLICY IF EXISTS participacoes_insert_public ON public.participacoes;
create policy participacoes_insert_public
on public.participacoes for insert to anon, authenticated
with check (true);

DROP POLICY IF EXISTS participacoes_update_public ON public.participacoes;
create policy participacoes_update_public
on public.participacoes for update to anon, authenticated
using (true)
with check (true);

DROP POLICY IF EXISTS participacoes_delete_public ON public.participacoes;
create policy participacoes_delete_public
on public.participacoes for delete to anon, authenticated
using (true);

-- Prioridades no ar
DROP POLICY IF EXISTS prioridades_select_public ON public.prioridades_ar;
create policy prioridades_select_public
on public.prioridades_ar for select to anon, authenticated
using (true);

DROP POLICY IF EXISTS prioridades_insert_public ON public.prioridades_ar;
create policy prioridades_insert_public
on public.prioridades_ar for insert to anon, authenticated
with check (true);

DROP POLICY IF EXISTS prioridades_update_public ON public.prioridades_ar;
create policy prioridades_update_public
on public.prioridades_ar for update to anon, authenticated
using (true)
with check (true);

DROP POLICY IF EXISTS prioridades_delete_public ON public.prioridades_ar;
create policy prioridades_delete_public
on public.prioridades_ar for delete to anon, authenticated
using (true);

-- Gestão de convidados
DROP POLICY IF EXISTS convidados_select_public ON public.gestao_convidados;
create policy convidados_select_public
on public.gestao_convidados for select to anon, authenticated
using (true);

DROP POLICY IF EXISTS convidados_insert_public ON public.gestao_convidados;
create policy convidados_insert_public
on public.gestao_convidados for insert to anon, authenticated
with check (true);

DROP POLICY IF EXISTS convidados_update_public ON public.gestao_convidados;
create policy convidados_update_public
on public.gestao_convidados for update to anon, authenticated
using (true)
with check (true);

DROP POLICY IF EXISTS convidados_delete_public ON public.gestao_convidados;
create policy convidados_delete_public
on public.gestao_convidados for delete to anon, authenticated
using (true);

-- Gestão de eventos
DROP POLICY IF EXISTS eventos_select_public ON public.gestao_eventos;
create policy eventos_select_public
on public.gestao_eventos for select to anon, authenticated
using (true);

DROP POLICY IF EXISTS eventos_insert_public ON public.gestao_eventos;
create policy eventos_insert_public
on public.gestao_eventos for insert to anon, authenticated
with check (true);

DROP POLICY IF EXISTS eventos_update_public ON public.gestao_eventos;
create policy eventos_update_public
on public.gestao_eventos for update to anon, authenticated
using (true)
with check (true);

DROP POLICY IF EXISTS eventos_delete_public ON public.gestao_eventos;
create policy eventos_delete_public
on public.gestao_eventos for delete to anon, authenticated
using (true);

-- Prêmios
DROP POLICY IF EXISTS premios_select_public ON public.premios;
create policy premios_select_public
on public.premios for select to anon, authenticated
using (true);

DROP POLICY IF EXISTS premios_insert_public ON public.premios;
create policy premios_insert_public
on public.premios for insert to anon, authenticated
with check (true);

DROP POLICY IF EXISTS premios_update_public ON public.premios;
create policy premios_update_public
on public.premios for update to anon, authenticated
using (true)
with check (true);

DROP POLICY IF EXISTS premios_delete_public ON public.premios;
create policy premios_delete_public
on public.premios for delete to anon, authenticated
using (true);

-- Programas edição/exclusão
DROP POLICY IF EXISTS programas_insert_public ON public.programas;
create policy programas_insert_public
on public.programas for insert to anon, authenticated
with check (true);

DROP POLICY IF EXISTS programas_update_public ON public.programas;
create policy programas_update_public
on public.programas for update to anon, authenticated
using (true)
with check (true);

DROP POLICY IF EXISTS programas_delete_public ON public.programas;
create policy programas_delete_public
on public.programas for delete to anon, authenticated
using (true);
