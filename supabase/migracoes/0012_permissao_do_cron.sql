-- Permissão de leitura para o cron de aniversário.
--
-- Mesma lição da 0007, que na época foi para a função `convidar`: a função
-- `aniversario` lê `membros` com `service_role` (não há usuário logado num
-- cron), e `service_role` tem `bypassrls` — pula a RLS, mas GRANT é outra
-- camada. Tudo que existia até aqui lia `membros` como `authenticated` (a
-- tela, com JWT de usuário), então a falta de grant nunca apareceu.
--
-- `parabens_enviados` (0011) completa o que o cron toca: reserva o dia
-- (insert) e devolve a reserva quando o provedor recusa (delete).
--
-- Rode depois do 0011. Pode rodar mais de uma vez sem estragar nada.

grant select on membros to service_role;
grant select, insert, delete on parabens_enviados to service_role;
