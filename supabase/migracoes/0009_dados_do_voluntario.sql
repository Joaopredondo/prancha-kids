-- Dados pessoais do voluntário: nome editável, nascimento e profissão.
--
-- O nome já existia (0004, preenchido pelo trigger `aplicar_convites` no
-- signup), mas nunca pôde ser corrigido — erro de digitação ficava para
-- sempre. Nascimento e profissão são novos. A idade não é coluna de propósito:
-- data de nascimento é fixa, e idade calculada na hora nunca desatualiza.
--
-- A escrita segue a mesma decisão da foto (0008): a policy de update de
-- `membros` ("coordenador administra a equipe", 0004) barra explicitamente a
-- própria linha, e abrir um self-update genérico deixaria a pessoa mudar o
-- próprio papel ou se readmitir depois de removida. A função `security
-- definer` grava só estas três colunas, só na própria linha, e nada mais.
--
-- Rode depois do 0008. Pode rodar mais de uma vez sem estragar nada.
--
-- **Aplique esta migração antes de publicar o código que a acompanha.**
-- `src/dados/sessao.ts` e `src/dados/membros.ts` passam a selecionar
-- `nascimento` e `profissao`; sem as colunas o select falha e a conta aparece
-- como "sem ministério vinculado" — a prancha e a ficha continuam funcionando
-- (são locais), mas a sincronização para. Mesmo risco documentado na 0004.

-- ---------------------------------------------------------------- colunas ---

alter table membros add column if not exists nascimento date;
alter table membros add column if not exists profissao text not null default '';

comment on column membros.nascimento is
  'Data de nascimento informada pela própria pessoa — null é "não informou". '
  'Idade nunca é coluna: é calculada na hora, para não desatualizar a cada aniversário.';
comment on column membros.profissao is
  'Profissão informada pela própria pessoa, em texto livre — "Fisioterapeuta", "Estudante"…';

-- ----------------------------------------------------------------- escrita ---

-- Sem filtro de ministério de propósito: nascimento e profissão são da
-- pessoa, não do vínculo — mesma decisão da foto na 0008. Quem participa de
-- mais de um ministério aparece com os mesmos dados nos dois.
create or replace function definir_dados_do_membro(
  novo_nome text,
  novo_nascimento date,
  nova_profissao text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'precisa estar autenticado';
  end if;

  update membros
  set nome = novo_nome,
      nascimento = novo_nascimento,
      profissao = nova_profissao
  where usuario_id = auth.uid();
end;
$$;

grant execute on function definir_dados_do_membro(text, date, text) to authenticated;

-- --------------------------------------------------- nome que não regride ---

-- O `on conflict` do `aplicar_convites` (base 0006) sobrescrevia `nome` com o
-- `raw_user_meta_data` do signup. Agora que o nome é editável no app,
-- reconvidar quem saiu reverteria a correção. Nome vazio aceita o do convite;
-- nome já preenchido é preservado. É a única mudança — a validação de código
-- e validade do convite (0006) segue como está.
create or replace function aplicar_convites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  codigo_informado text;
begin
  -- Normaliza do mesmo jeito que a tela pede: sem espaço, em maiúscula. Quem
  -- copia o código do e-mail traz espaço junto com frequência.
  codigo_informado := upper(trim(coalesce(new.raw_user_meta_data ->> 'codigo', '')));

  insert into membros (usuario_id, ministerio_id, papel, email, nome)
  select
    new.id,
    c.ministerio_id,
    c.papel,
    lower(new.email),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      ''
    )
  from convites c
  where lower(c.email) = lower(new.email)
    -- As duas condições do 0006. Sem elas, o e-mail sozinho abria o ministério.
    and c.codigo = codigo_informado
    and c.expira_em > now()
  on conflict (usuario_id, ministerio_id) do update
    set papel      = excluded.papel,
        email      = excluded.email,
        -- Nome vazio aceita o do convite; nome já preenchido (signup ou
        -- edição no app) é preservado.
        nome       = coalesce(nullif(membros.nome, ''), excluded.nome),
        apagado_em = null;

  -- Só apaga o convite que foi de fato usado. Um convite com código errado
  -- continua de pé: quem errou de digitação merece uma segunda tentativa, e
  -- apagar aqui deixaria a pessoa presa sem entender por quê.
  delete from convites
   where lower(email) = lower(new.email)
     and codigo = codigo_informado
     and expira_em > now();

  return new;
end;
$$;

-- `criar_ministerio` (0004) lia o nome de `auth.users`. Quem cria um segundo
-- ministério depois de corrigir o nome no app herdaria o nome antigo no novo
-- vínculo — e a tela lê uma linha qualquer das duas. Agora aproveita o nome
-- que já está em `membros`, quando existe.
create or replace function criar_ministerio(nome_do_ministerio text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  novo uuid;
begin
  if auth.uid() is null then
    raise exception 'precisa estar autenticado';
  end if;

  insert into ministerios (nome) values (nome_do_ministerio) returning id into novo;

  insert into membros (usuario_id, ministerio_id, papel, email, nome)
  select auth.uid(), novo, 'coordenador', lower(u.email),
         coalesce(
           (select nullif(trim(m.nome), '') from membros m where m.usuario_id = auth.uid() limit 1),
           nullif(trim(u.raw_user_meta_data ->> 'nome'), ''),
           nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
           ''
         )
  from auth.users u
  where u.id = auth.uid();

  return novo;
end;
$$;
