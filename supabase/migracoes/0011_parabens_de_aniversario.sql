-- Parabéns de aniversário: o cron diário que dispara o e-mail.
--
-- Primeiro agendamento do projeto (pg_cron + pg_net). Todo dia às 09:00 de
-- Brasília (12:00 UTC — o Brasil não tem horário de verão, é fixo o ano todo)
-- o banco chama a Edge Function `aniversario`, que manda o e-mail de parabéns
-- para quem é da equipe e faz aniversário naquele dia.
--
-- Bônus de graça: o cron toca o projeto todos os dias, e o plano Free do
-- Supabase pausa projeto após 1 semana sem atividade — exatamente o risco
-- registrado em docs/SINCRONIZACAO.md ("um ping semanal automático"). Diário
-- resolve com folga.
--
-- A função é protegida por um segredo próprio (CRON_SECRET), então o cron
-- precisa dele no header. O valor NÃO vive neste arquivo (repositório é lugar
-- de código, não de segredo): vive no cofre do projeto — o `vault` do Supabase
-- — e o cron lê de lá na hora de chamar.
--
-- ANTES DE RODAR ESTE ARQUIVO, na ordem:
--   1. `supabase secrets set CRON_SECRET=<valor-aleatorio>` (mesmo valor do
--      passo 2; gere com `openssl rand -hex 24`)
--   2. No SQL Editor:
--      select vault.create_secret('<mesmo-valor>', 'cron_secret');
--   3. Deploy da function: `supabase functions deploy aniversario
--      --no-verify-jwt` (ver supabase/functions/aniversario/README.md)
--
-- Rode depois do 0010. Pode rodar mais de uma vez: `cron.schedule` substitui o
-- agendamento de mesmo nome, e o resto é `if not exists`.

-- ------------------------------------------------------------- extensões ---

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- --------------------------------------------------- controle de envio ---

-- Uma linha por parabéns enviado. A função reserva `(usuario_id, hoje)` antes
-- de mandar e devolve a reserva se o provedor recusar — é o que impede
-- reenvio no mesmo dia sem perder o retry de quem falhou.
create table if not exists parabens_enviados (
  usuario_id uuid not null,
  enviada_em date not null,
  primary key (usuario_id, enviada_em)
);

alter table parabens_enviados enable row level security;

comment on table parabens_enviados is
  'Registro dos parabéns de aniversário já enviados, um por pessoa por dia. '
  'RLS ligado sem nenhuma policy: o app não lê nem escreve aqui — só a função '
  'agendada, com service_role. Não é dado de criança, mas é hábito do projeto '
  'não deixar tabela legível por engano.';

-- ------------------------------------------------------------ agendamento ---

-- A URL carrega o id do projeto (vsbhmvpbpucngqqwsxne): este arquivo é deste
-- projeto, como todo o resto de supabase/migracoes.
select cron.schedule(
  'parabens-de-aniversario',
  '0 12 * * *',  -- 12:00 UTC = 09:00 de Brasília, todos os dias
  $$
  select net.http_post(
    url := 'https://vsbhmvpbpucngqqwsxne.supabase.co/functions/v1/aniversario',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'
      )
    )
  );
  $$
);

-- Para desligar (férias da função, mudança de horário…):
--   select cron.unschedule('parabens-de-aniversario');
-- Para conferir o que está agendado e as últimas execuções:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
