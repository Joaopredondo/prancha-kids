-- Convite com código: fecha o acesso que hoje está aberto.
--
-- Até aqui, o convite era só uma linha em `convites` com o e-mail. Quem
-- soubesse (ou chutasse) o e-mail de alguém convidado podia criar conta com
-- ele e o trigger `aplicar_convites()` entregava o ministério de bandeja —
-- com laudo, idade e foto das crianças junto. Nunca houve segredo nenhum
-- entre o convite e o acesso.
--
-- Agora existe: um código de 6 caracteres que sai só no e-mail do convidado.
-- Quem confere é o trigger, não a tela. Validar no cliente serve para dar
-- mensagem decente; validar no banco é o que impede a entrada.
--
-- Rode depois do 0005.

-- ---------------------------------------------------------------- tabela ---

alter table convites add column if not exists codigo text;
alter table convites add column if not exists expira_em timestamptz;

comment on column convites.codigo is
  'Segredo de 6 caracteres que viaja só no e-mail do convidado. Sem ele, o '
  'trigger aplicar_convites() não vincula ninguém.';
comment on column convites.expira_em is
  'Convite parado vira porta aberta esquecida. Sete dias cobre o domingo em '
  'que foi feito e a semana seguinte.';

/**
 * Gera o código.
 *
 * Fora do alfabeto: O, 0, I, 1. Quem digita o código está lendo de um e-mail
 * no celular e batendo em outro aparelho — confundir zero com O transforma um
 * convite válido em "código errado", e a pessoa desiste antes de pedir ajuda.
 */
create or replace function gerar_codigo_de_convite()
returns text
language sql
volatile
as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32 + 1)::int, 1),
    ''
  )
  from generate_series(1, 6);
$$;

-- Convites que já existiam ficam sem código e sem validade. Não dá para
-- inventar um: o e-mail com o código nunca foi enviado a essas pessoas.
-- Preenchemos para que nenhuma linha antiga permita entrada sem segredo —
-- a coordenação reenvia o convite, e aí sim o código chega a quem deve.
update convites
   set codigo    = gerar_codigo_de_convite(),
       expira_em = now()
 where codigo is null;

alter table convites alter column codigo set not null;
alter table convites alter column codigo set default gerar_codigo_de_convite();
alter table convites alter column expira_em set default now() + interval '7 days';
alter table convites alter column expira_em set not null;

-- --------------------------------------------------------------- trigger ---
-- A mudança que realmente tranca a porta.

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
    -- As duas condições novas. Sem elas, o e-mail sozinho abria o ministério.
    and c.codigo = codigo_informado
    and c.expira_em > now()
  on conflict (usuario_id, ministerio_id) do update
    set papel      = excluded.papel,
        email      = excluded.email,
        nome       = excluded.nome,
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

-- ------------------------------------------------------------- validação ---

/**
 * Confere o par e-mail + código antes do cadastro.
 *
 * Existe só pela mensagem: sem isto, código errado criaria a conta e a pessoa
 * cairia numa tela de "sem ministério vinculado" sem saber que o problema foi
 * o código. Não é a trava de segurança — a trava é o trigger acima, que roda
 * de novo mesmo se alguém pular esta função.
 *
 * Roda como `security definer` porque quem chama ainda não tem conta: é
 * anônimo por definição. Devolve booleano e nada mais — nunca o código certo,
 * nunca o ministério, nunca quem convidou. Uma função de conferir segredo que
 * devolve detalhe vira oráculo para quem está tentando adivinhar.
 */
create or replace function conferir_convite(email_do_convite text, codigo_informado text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from convites
    where lower(email) = lower(trim(email_do_convite))
      and codigo = upper(trim(codigo_informado))
      and expira_em > now()
  );
$$;

-- `anon` de propósito: quem está aceitando um convite ainda não tem conta.
grant execute on function conferir_convite(text, text) to anon, authenticated;

-- Gerar código é coisa de quem convida, não de quem chega.
revoke execute on function gerar_codigo_de_convite() from public, anon;

-- --------------------------------------------------------------- leitura ---
-- A policy de select do 0004 deixa qualquer membro ler os convites do próprio
-- ministério — o que agora significa ler o código de outra pessoa. O painel
-- não precisa disso: ele mostra e-mail, papel e data, nunca o código.

revoke select on convites from authenticated;
grant select (email, ministerio_id, papel, criado_em, expira_em) on convites to authenticated;
grant insert, delete on convites to authenticated;
grant update (papel) on convites to authenticated;
