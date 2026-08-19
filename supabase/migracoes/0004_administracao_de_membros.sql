-- Administração da equipe: coordenador enxerga, promove, rebaixa e remove.
--
-- Hoje isso é impossível. A única policy de `membros` no 0001 é
-- `using (usuario_id = auth.uid())`: cada um vê só a própria linha, não existe
-- update, e delete não existe em lugar nenhum do projeto. Qualquer tela de
-- administração listaria exatamente uma pessoa.
--
-- O que esta migração faz, e por quê:
--
-- 1. `apagado_em` em `membros` — remoção é lógica, como em `criancas` e
--    `fichas`. Isso abre um buraco que **precisa** ser fechado no mesmo
--    arquivo: todas as policies do 0001 perguntam
--    `ministerio_id in (select ministerio_id from membros where usuario_id =
--    auth.uid())`, sem olhar `apagado_em`. Sem recriar essas policies, quem
--    saiu da equipe continuaria lendo ficha e laudo de criança. Por isso as
--    policies de `ministerios`, `convites`, `criancas`, `fichas`, `rotinas` e
--    `storage.objects` são todas refeitas aqui.
--
-- 2. `meus_ministerios()` e `sou_coordenador()` como `security definer`. Uma
--    policy de `membros` que consultasse `membros` daria recursão infinita —
--    é justamente o que o 0001 evitou ao deixar cada um vendo só a própria
--    linha. A função quebra o ciclo e vira o único lugar onde a regra de
--    pertencimento mora.
--
-- 3. `email` e `nome` em `membros`. `auth.users` não é legível por
--    `authenticated`, então a lista da equipe sairia com UUID na tela. Os dois
--    campos são preenchidos no trigger que já existe e retroalimentados aqui.
--
-- 4. Trava do último coordenador. Ministério sem coordenação é ministério onde
--    ninguém consegue mais convidar nem arrumar permissão — e o conserto
--    exigiria SQL manual em produção, sobre dado de criança.
--
-- Rode depois do 0003. Pode rodar mais de uma vez sem estragar nada.
--
-- **Aplique esta migração antes de publicar o código que a acompanha.**
-- `src/dados/sessao.ts` passa a selecionar `apagado_em` e a filtrar por
-- `usuario_id`. Sem a coluna, aquele select falha e todo mundo aparece como
-- "sem ministério vinculado" até a migração rodar — a prancha e a ficha
-- continuam funcionando (são locais), mas a sincronização para.
--
-- O filtro por `usuario_id` no app não é zelo: a policy de select abaixo passa
-- a revelar a equipe inteira, e a consulta antiga (`limit(1)` sem where)
-- devolveria a linha de outra pessoa — inclusive o papel dela.

-- ------------------------------------------------------------- colunas ---

alter table membros add column if not exists email        text;
alter table membros add column if not exists nome         text;
alter table membros add column if not exists apagado_em   timestamptz;
alter table membros add column if not exists atualizado_em timestamptz not null default now();

comment on column membros.apagado_em is
  'Preenchido quando a pessoa sai da equipe. Nunca use delete: a linha some da '
  'equipe mas o histórico de quem atendeu a criança continua fazendo sentido.';

-- A tela lista a equipe de um ministério; é a consulta que ela faz sempre.
create index if not exists membros_por_ministerio on membros (ministerio_id)
  where apagado_em is null;

-- ------------------------------------------------------------- funções ---
-- `security definer` de propósito: rodam como dono da tabela, fora da RLS, e
-- é isso que permite uma policy de `membros` consultar `membros` sem recursão.
-- `set search_path = public` fecha a porta de sequestro de nome de tabela.

create or replace function meus_ministerios()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select ministerio_id
  from membros
  where usuario_id = auth.uid()
    and apagado_em is null;
$$;

create or replace function sou_coordenador(alvo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from membros
    where usuario_id = auth.uid()
      and ministerio_id = alvo
      and papel = 'coordenador'
      and apagado_em is null
  );
$$;

-- Função `security definer` é pública por padrão. Só quem entrou executa.
revoke execute on function meus_ministerios()      from public;
revoke execute on function sou_coordenador(uuid)   from public;
grant  execute on function meus_ministerios()      to authenticated;
grant  execute on function sou_coordenador(uuid)   to authenticated;

-- ------------------------------------------- identificação dos membros ---

-- Quem já é membro entrou antes destas colunas existirem.
update membros m
set email = lower(u.email),
    nome  = coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'nome'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      ''
    )
from auth.users u
where u.id = m.usuario_id
  and (m.email is null or m.email = '');

-- O trigger do 0001 já tinha o e-mail em mãos e o descartava.
create or replace function aplicar_convites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
  -- Reconvidar quem tinha saído devolve o acesso, em vez de falhar calado.
  on conflict (usuario_id, ministerio_id) do update
    set papel      = excluded.papel,
        email      = excluded.email,
        nome       = excluded.nome,
        apagado_em = null;

  delete from convites where lower(email) = lower(new.email);
  return new;
end;
$$;

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
           nullif(trim(u.raw_user_meta_data ->> 'nome'), ''),
           nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
           ''
         )
  from auth.users u
  where u.id = auth.uid();

  return novo;
end;
$$;

grant execute on function criar_ministerio(text) to authenticated;

-- ------------------------------------------------ trava de coordenação ---

create or replace function revisar_mudanca_de_membro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  outros_coordenadores int;
begin
  -- Mudar a linha de dono ou de ministério não é editar: é forjar vínculo.
  if new.usuario_id <> old.usuario_id or new.ministerio_id <> old.ministerio_id then
    raise exception 'Não dá para mover um vínculo de pessoa ou de ministério.';
  end if;

  -- A policy já barra isso, mas em silêncio (0 linhas afetadas). Aqui a pessoa
  -- descobre o motivo em vez de achar que o botão não funcionou.
  if new.usuario_id = auth.uid()
     and (new.papel <> old.papel or new.apagado_em is distinct from old.apagado_em) then
    raise exception
      'Você não pode mudar o seu próprio papel nem se remover. Peça a outra coordenação.';
  end if;

  -- Só interessa a mudança que tira uma coordenação de cena.
  if old.papel = 'coordenador'
     and old.apagado_em is null
     and (new.papel <> 'coordenador' or new.apagado_em is not null) then

    select count(*) into outros_coordenadores
    from membros
    where ministerio_id = old.ministerio_id
      and usuario_id   <> old.usuario_id
      and papel         = 'coordenador'
      and apagado_em is null;

    if outros_coordenadores = 0 then
      raise exception
        'Este é o último coordenador do ministério. Promova outra pessoa antes de mudar este.';
    end if;
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists ao_mudar_membro on membros;
create trigger ao_mudar_membro
  before update on membros
  for each row execute function revisar_mudanca_de_membro();

-- --------------------------------------------------------- permissões ---
-- Cancelar convite é o único delete do projeto, e é coerente: o próprio
-- `aplicar_convites()` já apaga a linha quando a pessoa entra. Convite não é
-- histórico de ninguém.

grant delete on convites to authenticated;

-- Reforço explícito: remover membro é `apagado_em`, nunca delete.
revoke delete on membros from authenticated;

-- ---------------------------------------------------------------- RLS ---
-- Daqui para baixo é a reescrita das policies do 0001 em cima de
-- `meus_ministerios()`. O que muda em todas: quem tem `apagado_em` preenchido
-- deixa de enxergar qualquer coisa do ministério.

drop policy if exists "vejo meus vínculos" on membros;
drop policy if exists "vejo a equipe do meu ministério" on membros;
create policy "vejo a equipe do meu ministério" on membros
  for select using (
    -- O próprio vínculo sempre: é o que sustenta o login de quem ainda não
    -- carregou nada, e o que faz a pessoa removida descobrir que saiu.
    usuario_id = auth.uid()
    or ministerio_id in (select meus_ministerios())
  );

drop policy if exists "coordenador administra a equipe" on membros;
create policy "coordenador administra a equipe" on membros
  for update
  using (sou_coordenador(ministerio_id))
  with check (
    sou_coordenador(ministerio_id)
    -- Ninguém mexe no próprio vínculo, nem para se promover, nem para se
    -- remover. Quem precisa sair pede para outra coordenação.
    and usuario_id <> auth.uid()
  );

drop policy if exists "vejo meus ministérios" on ministerios;
create policy "vejo meus ministérios" on ministerios
  for select using (id in (select meus_ministerios()));

drop policy if exists "vejo convites do meu ministério" on convites;
create policy "vejo convites do meu ministério" on convites
  for select using (ministerio_id in (select meus_ministerios()));

drop policy if exists "coordenador convida" on convites;
create policy "coordenador convida" on convites
  for insert with check (sou_coordenador(ministerio_id));

drop policy if exists "coordenador ajusta convite" on convites;
create policy "coordenador ajusta convite" on convites
  for update
  using (sou_coordenador(ministerio_id))
  with check (sou_coordenador(ministerio_id));

drop policy if exists "coordenador cancela convite" on convites;
create policy "coordenador cancela convite" on convites
  for delete using (sou_coordenador(ministerio_id));

-- Dados do ministério: continua sem separação por papel. O voluntário precisa
-- registrar durante o culto, e travar por papel aqui criaria bloqueio no
-- momento em que a criança está em crise. O que mudou é só o "quem é membro".

drop policy if exists "leio crianças do meu ministério" on criancas;
create policy "leio crianças do meu ministério" on criancas
  for select using (ministerio_id in (select meus_ministerios()));

drop policy if exists "crio crianças no meu ministério" on criancas;
create policy "crio crianças no meu ministério" on criancas
  for insert with check (ministerio_id in (select meus_ministerios()));

drop policy if exists "atualizo crianças do meu ministério" on criancas;
create policy "atualizo crianças do meu ministério" on criancas
  for update using (ministerio_id in (select meus_ministerios()));

drop policy if exists "leio fichas do meu ministério" on fichas;
create policy "leio fichas do meu ministério" on fichas
  for select using (ministerio_id in (select meus_ministerios()));

drop policy if exists "crio fichas no meu ministério" on fichas;
create policy "crio fichas no meu ministério" on fichas
  for insert with check (ministerio_id in (select meus_ministerios()));

drop policy if exists "atualizo fichas do meu ministério" on fichas;
create policy "atualizo fichas do meu ministério" on fichas
  for update using (ministerio_id in (select meus_ministerios()));

drop policy if exists "leio rotinas do meu ministério" on rotinas;
create policy "leio rotinas do meu ministério" on rotinas
  for select using (ministerio_id in (select meus_ministerios()));

drop policy if exists "escrevo rotinas no meu ministério" on rotinas;
create policy "escrevo rotinas no meu ministério" on rotinas
  for insert with check (ministerio_id in (select meus_ministerios()));

drop policy if exists "atualizo rotinas do meu ministério" on rotinas;
create policy "atualizo rotinas do meu ministério" on rotinas
  for update using (ministerio_id in (select meus_ministerios()));

-- Arquivos: foto de criança. O caminho é sempre {ministerio_id}/..., e é isso
-- que a regra confere — agora pelo mesmo `meus_ministerios()`.

drop policy if exists "leio arquivos do meu ministério" on storage.objects;
create policy "leio arquivos do meu ministério" on storage.objects
  for select using (
    bucket_id = 'arquivos'
    and (storage.foldername(name))[1] in (select m::text from meus_ministerios() m)
  );

drop policy if exists "envio arquivos do meu ministério" on storage.objects;
create policy "envio arquivos do meu ministério" on storage.objects
  for insert with check (
    bucket_id = 'arquivos'
    and (storage.foldername(name))[1] in (select m::text from meus_ministerios() m)
  );

drop policy if exists "substituo arquivos do meu ministério" on storage.objects;
create policy "substituo arquivos do meu ministério" on storage.objects
  for update using (
    bucket_id = 'arquivos'
    and (storage.foldername(name))[1] in (select m::text from meus_ministerios() m)
  );

drop policy if exists "removo arquivos do meu ministério" on storage.objects;
create policy "removo arquivos do meu ministério" on storage.objects
  for delete using (
    bucket_id = 'arquivos'
    and (storage.foldername(name))[1] in (select m::text from meus_ministerios() m)
  );
