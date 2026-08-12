-- Os ids são gerados no aparelho, e os que já existem não são UUID
-- (`perfil-msqhphpc-gpwx60`, `2026-08-12-a7f3k2b1`). Trocar o tipo para texto
-- evita converter dado de criança que já está em uso — migração de id é
-- exatamente o tipo de operação que perde registro.
--
-- Rode depois do 0001.

alter table fichas drop constraint if exists fichas_crianca_id_fkey;

alter table criancas alter column id type text using id::text;
alter table fichas alter column crianca_id type text using crianca_id::text;
alter table rotinas alter column crianca_id type text using crianca_id::text;

alter table fichas
  add constraint fichas_crianca_id_fkey
  foreign key (crianca_id) references criancas (id) on delete set null;

-- A sincronização pergunta "o que mudou desde a última vez", e é sempre por
-- ministério.
create index if not exists rotinas_por_atualizacao on rotinas (ministerio_id, atualizado_em);
