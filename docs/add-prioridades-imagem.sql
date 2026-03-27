-- Campo opcional para armazenar imagem (data URL ou URL pública) nas prioridades do ar
alter table if exists public.prioridades_ar
  add column if not exists imagem_url text;

comment on column public.prioridades_ar.imagem_url is
  'Imagem da prioridade do ar (URL ou base64).';
