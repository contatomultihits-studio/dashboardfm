-- Prioridades ganham um título curto, que aparece no card junto com a imagem.
-- As que já existem ficam sem título (o card mostra o começo do texto até alguém editar).

alter table public.prioridades add column if not exists titulo text not null default '';
