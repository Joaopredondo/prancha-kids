-- A rotina do aparelho (sem criança escolhida) não cabia na tabela.
--
-- `rotinas` foi criada com `primary key (ministerio_id, crianca_id)`, e o
-- Postgres força NOT NULL em coluna de chave primária. Então o plano de usar
-- `crianca_id = null` para "rotina geral" nunca funcionaria: o insert falharia.
--
-- Solução: um valor reservado, 'geral'. Isso exige soltar a referência para
-- `criancas`, porque 'geral' não é uma criança. A troca é consciente — rotina
-- é uma lista de passos, não histórico de atendimento, e integridade
-- referencial aqui vale menos que o app funcionar sem criança cadastrada.
--
-- Rode depois do 0002. Pode rodar mais de uma vez.

alter table rotinas drop constraint if exists rotinas_crianca_id_fkey;
alter table rotinas alter column crianca_id set default 'geral';

comment on column rotinas.crianca_id is
  'Id da criança, ou o valor reservado ''geral'' para a rotina do aparelho.';
