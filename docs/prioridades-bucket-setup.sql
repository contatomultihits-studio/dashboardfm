-- Configuração do bucket público para imagens de prioridades do ar
insert into storage.buckets (id, name, public)
values ('prioridades', 'prioridades', true)
on conflict (id) do nothing;

-- Leitura pública das imagens
DROP POLICY IF EXISTS prioridades_public_read ON storage.objects;
create policy prioridades_public_read
on storage.objects for select
to anon, authenticated
using (bucket_id = 'prioridades');

-- Upload via dashboard (ANON KEY)
DROP POLICY IF EXISTS prioridades_public_insert ON storage.objects;
create policy prioridades_public_insert
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'prioridades');

DROP POLICY IF EXISTS prioridades_public_update ON storage.objects;
create policy prioridades_public_update
on storage.objects for update
to anon, authenticated
using (bucket_id = 'prioridades')
with check (bucket_id = 'prioridades');

DROP POLICY IF EXISTS prioridades_public_delete ON storage.objects;
create policy prioridades_public_delete
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'prioridades');
