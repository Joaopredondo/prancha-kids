# Recuperação de senha por e-mail

Manda o link de "esqueci minha senha", com a mesma cara do convite. Antes
disso o Supabase Auth mandava sozinho (`resetPasswordForEmail`), mas aí o
e-mail saía do mailer genérico dele — remetente `noreply@mail.app.supabase.io`
e template colado à mão no painel, em sintaxe Go que não passa por revisão de
código nenhuma. Ver `../convidar/README.md` para o porquê de existir função de
servidor no projeto.

## Como funciona

1. A tela "Esqueci minha senha" chama esta função com o e-mail digitado.
2. A função pede ao Auth (`admin.generateLink`, tipo `recovery`) um link de
   recuperação — o mesmo token longo, gerado e verificado pelo Supabase, que
   `resetPasswordForEmail` geraria. Só o envio deixa de ser do Supabase.
3. O link vai pela Brevo, com o template de `email.ts`.
4. A pessoa abre o link, o app detecta a sessão de recuperação
   (`aoRecuperarSenha` em `src/dados/sessao.ts`) e pede a senha nova.

**Por que link, não código**: adivinhar um código de convite só libera entrar
numa equipe, e ainda passa pelo trigger `aplicar_convites()`. Adivinhar o
segredo de recuperação dá controle total da conta — por isso aqui é o token
longo do Auth, não um código curto reinventado à mão.

**Sem enumeração**: a resposta é sempre `{ ok: true }`, exista ou não conta com
aquele e-mail — é o que impede alguém de descobrir e-mails cadastrados só
chamando esta função em loop. Se `generateLink` falhar (e-mail sem conta,
Brevo fora do ar, etc.), o detalhe vai só para o log da função.

## Configurar (uma vez)

Nenhum segredo novo — reaproveita os mesmos de `convidar`:

```sh
supabase functions deploy recuperar-senha
```

`BREVO_API_KEY`, `EMAIL_REMETENTE`, `NOME_REMETENTE`, `URL_DO_APP`,
`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente das
funções, configurados junto com `convidar`.

Diferente de `convidar`, esta função é chamada **sem login** (é assim que
alguém que esqueceu a senha entra em contato) — não precisa de nenhuma config
adicional de CORS ou de RLS, ela usa `service_role` direto.

## Sobre abuso

Esta função é pública e não tem limite de chamadas próprio — diferente de
`resetPasswordForEmail`, que o Supabase limitava sozinho pelo rate limit de
e-mail do projeto, `admin.generateLink` só gera o link, quem manda o e-mail é
a nossa chamada à Brevo, e nada aqui hoje impede chamar essa função em loop
para o mesmo endereço (gasto de cota da Brevo, ou incômodo para quem recebe).
Não implementado ainda por ser fora do escopo pedido; se virar problema real,
a correção é um cooldown por e-mail (tabela pequena, mesmo padrão de upsert
que `convites` já usa).

## Mexer no e-mail

Template em `email.ts`, texto puro junto. Ver `../convidar/README.md` para
como pré-visualizar sem enviar nada de verdade (mesmo comando `deno eval`,
trocando `htmlDoConvite` por `htmlDaRecuperacao` e os dados por
`{ link, urlDoApp }`).
