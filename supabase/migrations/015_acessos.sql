-- =====================================================================
-- 015: Acessos por pessoa e por área (parte 1: base, sem efeito visível)
--
-- * perfis: quem pode entrar (admin, equipe, locutor), ativo, se já trocou
--   a senha inicial. Só o administrador cria usuários (Edge Function
--   admin-usuarios, com a chave secreta só no servidor).
-- * permissoes: por área, "ver" ou "editar". Admin pode tudo; locutor só
--   a dashboard (tela do locutor).
-- * Funções que as regras do banco usam:
--     usuario_autorizado()  -> perfil ativo (qualquer tipo): vê a dashboard
--     eh_admin()            -> o administrador
--     pode(area, nivel)     -> admin, ou equipe com a área liberada
--     meu_acesso()          -> o que o site precisa saber de quem entrou
--
-- Esta parte só ACRESCENTA. As regras antigas continuam até a parte 2 (016).
-- Rode uma vez no SQL Editor. Pode rodar de novo sem problema.
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
