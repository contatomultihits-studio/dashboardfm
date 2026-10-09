-- =====================================================================
-- 020: Recado-lembrete com pop-up
--
-- Recados curtos (o site já marca sozinho abaixo de 30 minutos no mesmo
-- dia) abrem um pop-up com som na tela do locutor na hora em que começam.
-- Fechar o pop-up não tira o recado da faixa: ele fica até o fim do horário.
--
-- Só acrescenta. Pode rodar de novo.
-- =====================================================================
alter table public.recados add column if not exists lembrete boolean not null default false;
