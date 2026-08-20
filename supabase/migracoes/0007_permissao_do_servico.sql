-- `service_role` nunca tinha sido usado no projeto até a função `convidar`
-- (supabase/functions/convidar). Todo escrita anterior passava por
-- `authenticated` + RLS, e RLS não se aplica a `service_role` — por isso a
-- ausência de grant nunca apareceu: não existia código rodando como ele.
--
-- `service_role` tem `bypassrls`, mas isso só ignora RLS. GRANT/REVOKE é
-- outra camada, e sem grant explícito a tabela fica ilegível mesmo para quem
-- pula a RLS. A migração 0001 nunca concedeu nada a `service_role` porque
-- nada precisava dele ainda.
--
-- Rode depois do 0006.

grant select, insert, update, delete on convites to service_role;

-- O 0006 revogou de `public` (cascata para todo mundo, `service_role`
-- incluso) para impedir que qualquer pessoa gerasse código à vontade. Mas
-- `codigo` tem essa função como `default`, e o default roda com o privilégio
-- de quem insere — sem isto, todo `insert`/`upsert` em `convites` falha,
-- mesmo já tendo grant na tabela.
grant execute on function gerar_codigo_de_convite() to service_role;
