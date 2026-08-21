# Parabéns de aniversário

Manda, no dia do aniversário de quem é da equipe, um e-mail de parabéns pela
mesma Brevo do convite — mesma casca visual, decoração de festa. É a única
function que ninguém chama do navegador: quem dispara é o cron do banco
(`pg_cron` + `pg_net`, migração `0011`), todo dia às 09:00 de Brasília.

## Como funciona

1. O cron chama esta function com um segredo próprio no header (`CRON_SECRET`)
   — sem ele, `401`. É a porta da function, já que não há usuário logado.
2. A function calcula "hoje" em `America/Sao_Paulo` (o Brasil não tem horário
   de verão; 12:00 UTC é sempre 09:00 daqui).
3. Lê `membros` com `apagado_em` nulo e `nascimento` preenchido, e fica com
   quem faz aniversário naquele mês/dia. Só equipe: criança não tem data de
   nascimento no cadastro, só idade em texto livre.
4. Para cada aniversariante, **reserva** o dia em `parabens_enviados` antes de
   mandar — reexecução no mesmo dia pula quem já recebeu. Se a Brevo recusar, a
   reserva é devolvida e um retry pode tentar de novo.
5. Resposta e log carregam só contagens; nome e e-mail de pessoa não vão para
   nenhum dos dois.

Bônus: o cron toca o projeto todos os dias, e o plano Free pausa projeto após
1 semana sem atividade (risco registrado em `docs/SINCRONIZACAO.md`). Este
agendamento resolve de graça.

## Configurar (uma vez)

Os segredos de `../convidar` já valem aqui (`BREVO_API_KEY`, `EMAIL_REMETENTE`,
`NOME_REMETENTE`, `URL_DO_APP`). Falta um, exclusivo desta function:

### 1. O segredo do cron

```sh
openssl rand -hex 24          # gere um valor aleatório e guarde
npx supabase secrets set CRON_SECRET=<valor-gerado>
```

O mesmo valor entra no cofre do banco, para o cron colocar no header (o valor
nunca vai para o repositório). No SQL Editor:

```sql
select vault.create_secret('<mesmo-valor>', 'cron_secret');
```

### 2. Deploy

```sh
npx supabase functions deploy aniversario --no-verify-jwt
```

`--no-verify-jwt` é obrigatório: a chamada do cron não é um usuário do Auth, e
a porta desta function é o `CRON_SECRET`, conferido dentro dela.

### 3. O agendamento

Rode `supabase/migracoes/0011_parabens_de_aniversario.sql` no SQL Editor. Ele
cria as extensões `pg_cron` e `pg_net`, a tabela `parabens_enviados` (RLS
ligado, sem policy — invisível ao app) e o agendamento diário.

> Se o painel reclamar de `pg_cron` no SQL Editor, ative antes em
> **Database → Extensions** (o nome lá é `pg_cron`); o resto do arquivo segue
> igual.

### 4. Testar sem esperar um aniversário

Coloque **a sua** data de nascimento como hoje no app (☰ → ✎ Meus dados) e
dispare na mão:

```sh
curl -X POST \
  https://vsbhmvpbpucngqqwsxne.supabase.co/functions/v1/aniversario \
  -H "Authorization: Bearer <valor-do-CRON_SECRET>"
```

Resposta esperada: `{"ok":true,"aniversariantes":1,"enviados":1,"falhas":0}` e
o e-mail na caixa. Chamar de novo no mesmo dia não reenvia:
`{"ok":true,"aniversariantes":1,"enviados":0,"falhas":0}`.

## Mexer no e-mail

O template está em `email.ts`, com o texto puro junto — filtro de spam pontua
pior quem manda só HTML, e leitor de tela às vezes cai na versão texto.

Para ver como ficou sem enviar nada:

```sh
deno eval --ext=ts '
  import { htmlDoParabens } from "./supabase/functions/aniversario/email.ts";
  await Deno.writeTextFile("/tmp/parabens.html", htmlDoParabens({
    nome: "Joana",
    urlDoApp: "https://prancha-kids.vercel.app",
  }));
'
```

Regras que não são as da web: tabela para layout, CSS inline, e nenhuma imagem
indispensável — cliente de e-mail bloqueia imagem por padrão, e o cabeçalho
precisa se sustentar sem o logo carregar. O confete e os cards de festa são
célula de tabela colorida e emoji: carregam sempre.

## Desligar ou adiar

```sql
select cron.unschedule('parabens-de-aniversario');
```

Conferir as últimas execuções (inclusive erro de header/segredo):

```sql
select * from cron.job_run_details order by start_time desc limit 10;
```

## Sobre privacidade

O e-mail usa só o primeiro nome (ou o e-mail, quando não há nome) e não
menciona idade — dado opcional e que muita gente prefere não ver destacado. A
data de nascimento fica no cadastro da própria pessoa, editável em "Meus
dados"; o rodapé do e-mail diz exatamente isso para quem quiser corrigir.
