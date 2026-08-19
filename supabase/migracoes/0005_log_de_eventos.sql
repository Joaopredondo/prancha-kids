-- Log de uso: quem fez o quê e quando, para a coordenação supervisionar a
-- equipe sem virar vigilância de clique.
--
-- Só os marcos que já significam algo no app entram: salvou ficha, cadastrou
-- ou editou criança, gravou voz. Não é telemetria de navegação — é o mesmo
-- gesto que a pessoa já fazia, com um carimbo de quem e quando ao lado.
--
-- Desenho segue fichas/crianças/rotinas: grava no aparelho primeiro (fila em
-- `dados/fila.ts`), sobe quando há rede. Evento perdido por falha de sync
-- nunca impede a ação real — é log, não requisito. Por isso é append-only:
-- nem coordenador edita ou apaga uma linha, porque um log que se apaga não
-- prova nada.
--
-- "Último acesso" **não** vira evento — duplicaria o que o Supabase Auth já
-- guarda em `auth.users.last_sign_in_at`. `ultimo_acesso_da_equipe()` só
-- destranca a leitura disso para quem pode ver.
--
-- Rode depois do 0004.

-- ---------------------------------------------------------------- tabela ---

create table if not exists eventos (
  id text primary key,                    -- gerado no aparelho, como fichas/criancas
  ministerio_id uuid not null references ministerios on delete cascade,
  usuario_id uuid not null references auth.users on delete cascade,
  tipo text not null check (tipo in ('ficha', 'crianca', 'voz')),
  -- Criança envolvida, quando existe uma — nulo para gravação de voz de card
  -- (que é vocabulário, não criança).
  crianca_id text references criancas on delete set null,
  -- Rótulo curto e legível ("Ficha de Sofia", "Gravou: Água"), gravado no
  -- momento do evento. Sobrevive mesmo se a criança for renomeada ou o card
  -- mudar de nome depois — um log que muda de texto sozinho engana.
  detalhe text not null default '',
  criado_em timestamptz not null default now(),
  registrado_em timestamptz not null default now()
);

comment on column eventos.criado_em is
  'Quando a ação aconteceu de verdade, no relógio do aparelho — pode ser bem '
  'antes de registrado_em, se a pessoa estava offline.';
comment on column eventos.registrado_em is
  'Quando a linha chegou no banco. Serve para depurar atraso de sincronização, '
  'não para mostrar na tela — quem lê o log quer saber quando a ação aconteceu.';

create index if not exists eventos_por_ministerio on eventos (ministerio_id, criado_em desc);
create index if not exists eventos_por_usuario on eventos (ministerio_id, usuario_id, criado_em desc);

-- ------------------------------------------------------------ permissões ---

grant select, insert on eventos to authenticated;
-- Sem update, sem delete: um log que a própria pessoa registrada pode editar
-- ou apagar não prova nada para ninguém. Nem a coordenação tem esse poder.

-- ------------------------------------------------------------------ RLS ---

alter table eventos enable row level security;

-- Cada membro registra a própria ação — sem isto, o voluntário no meio do
-- culto não conseguiria nem gravar o próprio log, e a tela pareceria travada.
create policy "registro meus eventos" on eventos
  for insert with check (
    usuario_id = auth.uid()
    and ministerio_id in (select meus_ministerios())
  );

-- Só coordenação lê: é ferramenta de supervisão, não mural público. Um
-- voluntário não precisa — nem deveria — ver quando o colega gravou uma voz.
create policy "coordenador lê os eventos do ministério" on eventos
  for select using (sou_coordenador(ministerio_id));

-- ---------------------------------------------------------- último acesso ---
-- `auth.users` não é legível por `authenticated` (mesma razão do 0004 para
-- email/nome de membro). Esta função destranca só `last_sign_in_at`, e só
-- para quem coordena aquele ministério em particular.

create or replace function ultimo_acesso_da_equipe(ministerio uuid)
returns table (usuario_id uuid, ultimo_acesso timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.last_sign_in_at
  from auth.users u
  join membros m on m.usuario_id = u.id
  where m.ministerio_id = ministerio
    and m.apagado_em is null
    and sou_coordenador(ministerio);
$$;

revoke execute on function ultimo_acesso_da_equipe(uuid) from public;
grant  execute on function ultimo_acesso_da_equipe(uuid) to authenticated;
