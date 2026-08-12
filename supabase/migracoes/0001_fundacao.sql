-- Fundação: ministérios, membros, crianças, fichas, rotinas e arquivos.
--
-- Contém dado pessoal sensível de menor (nome, idade, laudo, foto). Duas regras
-- valem em todo este arquivo:
--   1. Nada é legível sem login. O papel `anon` não recebe permissão nenhuma.
--   2. Ninguém enxerga fora do próprio ministério — garantido no banco, por RLS,
--      não na aplicação. Endpoint esquecido não vira vazamento.
--
-- Rode no painel: SQL Editor → New query → colar tudo → Run.

-- ---------------------------------------------------------------- tabelas ---

create table if not exists ministerios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

create table if not exists membros (
  usuario_id uuid not null references auth.users on delete cascade,
  ministerio_id uuid not null references ministerios on delete cascade,
  papel text not null default 'voluntario' check (papel in ('voluntario', 'coordenador')),
  criado_em timestamptz not null default now(),
  primary key (usuario_id, ministerio_id)
);

-- Convite por e-mail: quem entrar com este e-mail cai no ministério certo.
create table if not exists convites (
  email text not null,
  ministerio_id uuid not null references ministerios on delete cascade,
  papel text not null default 'voluntario' check (papel in ('voluntario', 'coordenador')),
  criado_em timestamptz not null default now(),
  primary key (email, ministerio_id)
);

create table if not exists criancas (
  id uuid primary key,                    -- gerado no aparelho, para funcionar offline
  ministerio_id uuid not null references ministerios on delete cascade,
  nome text not null default '',
  idade text not null default '',
  laudo text not null default '',
  tem_foto boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);

create table if not exists fichas (
  id text primary key,                    -- o id que o app já usa hoje
  ministerio_id uuid not null references ministerios on delete cascade,
  crianca_id uuid references criancas on delete set null,
  data timestamptz not null,
  conteudo jsonb not null default '{}',   -- campos da ficha, como já são no app
  marcacoes jsonb not null default '[]',  -- separado: tem união própria na sincronização
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);

create table if not exists rotinas (
  ministerio_id uuid not null references ministerios on delete cascade,
  crianca_id uuid references criancas on delete cascade,  -- null = rotina geral
  passos text[] not null default '{}',
  atualizado_em timestamptz not null default now(),
  primary key (ministerio_id, crianca_id)
);

-- Índices para o que a sincronização e os filtros realmente consultam.
create index if not exists fichas_por_ministerio_e_data on fichas (ministerio_id, data desc);
create index if not exists fichas_por_crianca on fichas (crianca_id);
create index if not exists fichas_por_atualizacao on fichas (ministerio_id, atualizado_em);
create index if not exists criancas_por_atualizacao on criancas (ministerio_id, atualizado_em);

-- ------------------------------------------------------------ permissões ---
-- `anon` (visitante sem login) não recebe nada. Só quem entrou com conta lê.

grant usage on schema public to authenticated;
grant select, insert, update on ministerios, membros, convites, criancas, fichas, rotinas
  to authenticated;

-- ------------------------------------------------------------------ RLS ---

alter table ministerios enable row level security;
alter table membros enable row level security;
alter table convites enable row level security;
alter table criancas enable row level security;
alter table fichas enable row level security;
alter table rotinas enable row level security;

-- Base de tudo: cada um só vê a própria linha de membro. Sem recursão.
create policy "vejo meus vínculos" on membros
  for select using (usuario_id = auth.uid());

create policy "vejo meus ministérios" on ministerios
  for select using (
    id in (select ministerio_id from membros where usuario_id = auth.uid())
  );

-- Coordenador convida; qualquer membro enxerga os convites do seu ministério.
create policy "vejo convites do meu ministério" on convites
  for select using (
    ministerio_id in (select ministerio_id from membros where usuario_id = auth.uid())
  );

create policy "coordenador convida" on convites
  for insert with check (
    ministerio_id in (
      select ministerio_id from membros
      where usuario_id = auth.uid() and papel = 'coordenador'
    )
  );

-- Dados do ministério: leitura e escrita para membros, sem exceção de papel.
-- O voluntário precisa registrar durante o culto; separar por papel aqui só
-- criaria travamento no momento em que a criança está em crise.
create policy "leio crianças do meu ministério" on criancas
  for select using (
    ministerio_id in (select ministerio_id from membros where usuario_id = auth.uid())
  );

create policy "crio crianças no meu ministério" on criancas
  for insert with check (
    ministerio_id in (select ministerio_id from membros where usuario_id = auth.uid())
  );

create policy "atualizo crianças do meu ministério" on criancas
  for update using (
    ministerio_id in (select ministerio_id from membros where usuario_id = auth.uid())
  );

create policy "leio fichas do meu ministério" on fichas
  for select using (
    ministerio_id in (select ministerio_id from membros where usuario_id = auth.uid())
  );

create policy "crio fichas no meu ministério" on fichas
  for insert with check (
    ministerio_id in (select ministerio_id from membros where usuario_id = auth.uid())
  );

create policy "atualizo fichas do meu ministério" on fichas
  for update using (
    ministerio_id in (select ministerio_id from membros where usuario_id = auth.uid())
  );

create policy "leio rotinas do meu ministério" on rotinas
  for select using (
    ministerio_id in (select ministerio_id from membros where usuario_id = auth.uid())
  );

create policy "escrevo rotinas no meu ministério" on rotinas
  for insert with check (
    ministerio_id in (select ministerio_id from membros where usuario_id = auth.uid())
  );

create policy "atualizo rotinas do meu ministério" on rotinas
  for update using (
    ministerio_id in (select ministerio_id from membros where usuario_id = auth.uid())
  );

-- Repare: **nenhuma policy de DELETE em lugar nenhum**. Apagar é preencher
-- `apagado_em`. Sincronização com erro não pode sumir com atendimento de
-- criança; limpeza definitiva é tarefa administrativa, feita pelo painel.

-- ------------------------------------------------------------- funções ---

-- Cria o ministério e já põe quem chamou como coordenador. `security definer`
-- porque na primeira vez a pessoa ainda não é membro de nada, e a RLS de
-- `membros` a impediria de se inserir.
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
  insert into membros (usuario_id, ministerio_id, papel)
    values (auth.uid(), novo, 'coordenador');

  return novo;
end;
$$;

grant execute on function criar_ministerio(text) to authenticated;

-- Quem foi convidado vira membro assim que confirma a conta.
create or replace function aplicar_convites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into membros (usuario_id, ministerio_id, papel)
  select new.id, c.ministerio_id, c.papel
  from convites c
  where lower(c.email) = lower(new.email)
  on conflict do nothing;

  delete from convites where lower(email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function aplicar_convites();

-- ------------------------------------------------------------ arquivos ---
-- Bucket privado. Foto de menor nunca em URL pública nem adivinhável: o app
-- pede URL assinada de curta duração quando precisa exibir.

insert into storage.buckets (id, name, public)
values ('arquivos', 'arquivos', false)
on conflict (id) do nothing;

-- Caminho é sempre {ministerio_id}/..., e é isso que a regra confere.
create policy "leio arquivos do meu ministério" on storage.objects
  for select using (
    bucket_id = 'arquivos'
    and (storage.foldername(name))[1] in (
      select ministerio_id::text from membros where usuario_id = auth.uid()
    )
  );

create policy "envio arquivos do meu ministério" on storage.objects
  for insert with check (
    bucket_id = 'arquivos'
    and (storage.foldername(name))[1] in (
      select ministerio_id::text from membros where usuario_id = auth.uid()
    )
  );

create policy "substituo arquivos do meu ministério" on storage.objects
  for update using (
    bucket_id = 'arquivos'
    and (storage.foldername(name))[1] in (
      select ministerio_id::text from membros where usuario_id = auth.uid()
    )
  );

create policy "removo arquivos do meu ministério" on storage.objects
  for delete using (
    bucket_id = 'arquivos'
    and (storage.foldername(name))[1] in (
      select ministerio_id::text from membros where usuario_id = auth.uid()
    )
  );
