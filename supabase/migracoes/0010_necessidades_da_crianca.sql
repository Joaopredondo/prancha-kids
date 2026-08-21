-- Alergia e necessidade de acessibilidade no cadastro da criança.
--
-- O campo "Observações de segurança" da ficha já dava para escrever alergias
-- — todo culto, de novo, porque é campo da ficha, não do cadastro. Agora o
-- cadastro guarda o que é da criança, e a ficha mostra como aviso fixo no
-- topo, lendo o cadastro atual: correção no cadastro propaga na hora, e o
-- registro do dia continua no campo livre da ficha.
--
-- Texto livre de propósito, como `idade` e `laudo`: a realidade das crianças
-- atendidas não cabe em lista fechada de alergias ou de necessidades.
--
-- O cartão do culto para os pais segue sem estes campos — dado de saúde, o
-- mesmo critério de exclusão do `laudo` (src/dados/cartao.ts).
--
-- Sem policy nova: RLS é por linha, e as policies de `criancas` (0001/0004)
-- já cobrem quem lê e escreve no próprio ministério. Rode depois do 0009.

alter table criancas add column if not exists alergia text not null default '';
alter table criancas add column if not exists acessibilidade text not null default '';

comment on column criancas.alergia is
  'Alergias e restrições (alimento, medicação, picada de inseto…), texto '
  'livre. A ficha mostra como aviso fixo enquanto preenchido.';
comment on column criancas.acessibilidade is
  'Necessidades de acessibilidade (mobilidade, visão, audição, apoio nas '
  'transições…), texto livre. A ficha mostra como aviso fixo enquanto preenchido.';
