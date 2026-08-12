# Sincronização entre aparelhos (Supabase)

Plano da migração de "cada tablet com seus dados" para "vários voluntários,
mesmos dados". Escrito antes do código de propósito: a mudança altera o que o
projeto é do ponto de vista legal, e a ordem das etapas importa mais que a
escolha da biblioteca.

## Por que Supabase

Postgres gerenciado com login, regras de acesso por linha e storage de arquivo
no mesmo serviço — os três pedaços que aqui teriam que ser montados à mão.

O free tier serve com folga para o tamanho do projeto: 500 MB de banco (as
fichas são texto; milhares delas não passam de alguns MB), 1 GB de arquivos
(fotos de 20 KB), 50 mil usuários ativos por mês.

Duas ressalvas registradas para não virarem surpresa:

- **Projeto do plano Free é pausado depois de 1 semana sem atividade.** Uso
  semanal mantém vivo por pouco; duas semanas de férias, não. Despausar é um
  clique, mas ninguém quer descobrir isso dez minutos antes do culto. Mitigação:
  um ping semanal automático, ou o plano pago (US$ 25/mês).
- **Sem backup automático no Free.** O app já exporta backup local; manter o
  hábito continua sendo obrigatório.

AWS foi descartada por custo de operação, não por capacidade: desde 2025 contas
novas recebem créditos e **encerram em 6 meses**, sem o antigo free tier de 12
meses. Depois disso, RDS Postgres é conta recorrente. Como Supabase é Postgres
puro, sair depois é `pg_dump` — não há aprisionamento que justifique começar
mais caro.

## Princípio que não se negocia: offline primeiro

O wifi da igreja cai. A prancha é o que dá voz à criança e a ficha é preenchida
durante o culto: **nenhum dos dois pode depender de rede**.

Portanto o IndexedDB/localStorage continua sendo a fonte da verdade local, e o
Supabase é destino de sincronização — nunca o lugar de onde a tela lê. Se a
sincronização falhar, o app funciona igual e tenta de novo depois.

## Modelo de dados

```sql
-- Um ministério por igreja. Tudo é isolado por ele.
create table ministerios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

-- Quem pode entrar, e com qual papel.
create table membros (
  usuario_id uuid references auth.users on delete cascade,
  ministerio_id uuid references ministerios on delete cascade,
  papel text not null check (papel in ('voluntario', 'coordenador')),
  primary key (usuario_id, ministerio_id)
);

create table criancas (
  id uuid primary key,                    -- gerado no aparelho
  ministerio_id uuid not null references ministerios on delete cascade,
  nome text not null default '',
  idade text not null default '',
  laudo text not null default '',
  tem_foto boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz                  -- exclusão é lógica; ver "Conflitos"
);

create table fichas (
  id text primary key,                    -- id que já existe hoje no app
  ministerio_id uuid not null references ministerios on delete cascade,
  crianca_id uuid references criancas on delete set null,
  data timestamptz not null,
  conteudo jsonb not null,                -- os campos da ficha, como já são
  marcacoes jsonb not null default '[]',  -- separados: têm merge próprio
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);

create table rotinas (
  ministerio_id uuid not null references ministerios on delete cascade,
  crianca_id uuid references criancas on delete cascade,  -- null = rotina geral
  passos text[] not null,
  atualizado_em timestamptz not null default now(),
  primary key (ministerio_id, crianca_id)
);
```

`conteudo jsonb` em vez de vinte colunas é escolha deliberada: os campos da
ficha espelham uma folha de papel que o ministério pode mudar, e migração de
schema a cada campo novo é atrito que trava o projeto. O que precisa ser
consultado (data, criança, ministério) está fora do JSON.

### Arquivos

Bucket **privado** `arquivos`, com caminho `{ministerio_id}/fotos/{crianca_id}.webp`
e `{ministerio_id}/vozes/{card_id}.webm`. Acesso só por URL assinada de curta
duração. Foto de menor nunca em URL pública, nem em URL adivinhável.

## Regras de acesso (RLS)

Ligada em todas as tabelas, sem exceção. O princípio: **você só enxerga o
ministério do qual é membro**.

```sql
alter table criancas enable row level security;

create policy "membro lê o próprio ministério" on criancas
  for select using (
    ministerio_id in (select ministerio_id from membros where usuario_id = auth.uid())
  );

create policy "membro escreve no próprio ministério" on criancas
  for insert with check (
    ministerio_id in (select ministerio_id from membros where usuario_id = auth.uid())
  );

create policy "membro atualiza o próprio ministério" on criancas
  for update using (
    ministerio_id in (select ministerio_id from membros where usuario_id = auth.uid())
  );
```

Mesmo conjunto para `fichas` e `rotinas`. **Nenhuma policy de `delete`**:
apagar é marcar `apagado_em`, e só a coordenação limpa de vez, por rotina
administrativa. Isso evita que um erro de sincronização apague atendimento.

## Autenticação

- E-mail e senha, ou link mágico por e-mail. Sem cadastro aberto ao público.
- O coordenador convida: cria o membro com o e-mail; quem entra com aquele
  e-mail cai no ministério certo.
- Voluntário que sai do ministério tem a linha de `membros` removida — perde o
  acesso na hora, sem precisar apagar dado.
- O código de 4 dígitos que já existe **continua**, para outra coisa: proteger a
  tela do aparelho compartilhado. Login protege o dado na nuvem; o código
  protege o tablet em cima da mesa.

## Sincronização

Cada registro local ganha dois campos: `atualizadoEm` (epoch ms) e
`dispositivoId` (sorteado uma vez por aparelho).

**Fila de pendências** em IndexedDB: toda gravação local também empilha
`{tabela, id, atualizadoEm}`. Nada é enviado no meio da digitação.

**Enviar** (quando houver rede, ao abrir e a cada poucos minutos): `upsert` dos
pendentes; sucesso limpa a fila.

**Receber**: `select ... where atualizado_em > ultimoSync`, aplicando local.

### Conflitos

- **Padrão: vence a gravação mais recente** (`atualizado_em`). Simples e
  suficiente para o caso real, em que duas pessoas raramente editam a mesma
  ficha ao mesmo tempo.
- **Exceção — `marcacoes`: nunca sobrescrever, sempre unir** por `(hora, tipo)`.
  Dois voluntários carimbando "crise" e "saiu" em aparelhos diferentes precisam
  terminar com os dois carimbos; last-write-wins aqui apagaria registro de
  comportamento, que é justamente o que a ficha existe para guardar.
- **Exclusão nunca vence sincronização automática.** `apagado_em` some da lista,
  mas o dado continua lá para a coordenação recuperar.

### Primeira entrada

Ao logar pela primeira vez num aparelho que já tem dados locais, tudo é enviado
marcado com o ministério do usuário. Nada é apagado localmente.

## Fases (uma branch/PR cada)

1. **Fundação** — projeto Supabase, schema, RLS, login e convite. Nenhuma tela
   existente muda; dá para testar com o app do jeito que está.
2. **Sync de crianças e fichas** — fila, envio, recebimento, união de marcações.
   Indicador discreto de "salvo no aparelho / sincronizado".
3. **Arquivos** — fotos e vozes no bucket privado, com URL assinada.
4. **Coordenação** — visão de todas as crianças do ministério, exportação
   consolidada, remoção de membro.

Cada fase é publicável sozinha e reversível: se a fase 2 der problema no
domingo, desligar a sincronização deixa o app exatamente como é hoje.

## LGPD — o que muda ao sair do aparelho

Hoje o dado é local e o app é um caderno digital do voluntário. Com servidor, a
igreja passa a ser controladora de **dado pessoal sensível de menor** (saúde).
Antes da fase 1 ir para produção:

- **Consentimento dos pais por escrito**, específico: quais dados, para quê,
  quem vê, por quanto tempo. Um formulário de papel assinado basta.
- **Página de privacidade** no app dizendo o mesmo, em linguagem simples.
- **Retenção definida**: por quanto tempo a ficha fica guardada, e o que
  acontece quando a criança sai do ministério.
- **Direito de exclusão**: pedido dos pais apaga cadastro, fichas e foto — na
  nuvem e nos aparelhos.
- **Responsável nomeado** na igreja por esses pedidos. Não pode ser "o app".

Nada disso é opcional por ser projeto voluntário: dado de saúde de criança é a
categoria mais protegida da lei.

## O que não fazer

- Não tirar o funcionamento offline para "simplificar".
- Não colocar nome, laudo ou id de criança em URL, log ou mensagem de erro.
- Não deixar o bucket público.
- Não sincronizar sem login — banco aberto é pior que localStorage.
- Não usar `delete` real vindo de sincronização.

## Como verificar cada fase

1. Dois navegadores logados no mesmo ministério: criar criança num, ver aparecer
   no outro depois do sync.
2. Um terceiro usuário, de outro ministério, **não** enxerga nada — teste que
   comprova o RLS.
3. Modo avião: preencher ficha inteira, salvar, voltar a rede, conferir que subiu.
4. Carimbar marcações diferentes nos dois aparelhos offline e conferir que, ao
   sincronizar, ficam as duas.
5. Apagar criança num aparelho e conferir que some no outro, mas continua
   recuperável pela coordenação.
