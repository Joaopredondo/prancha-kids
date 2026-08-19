# Convite por e-mail

Manda o código do convite para quem a coordenação convidou. É o único pedaço
de servidor do projeto — existe porque a chave do provedor de e-mail e a
leitura do código recém-gerado não podem morar no navegador.

## Como o convite funciona

1. A coordenação digita o e-mail no painel de equipe.
2. Esta função confere que quem pediu é coordenador **pelo vínculo dele**, não
   pelo que o cliente mandou, grava o convite e envia o e-mail.
3. O banco gera um código de 6 caracteres (`gerar_codigo_de_convite()`), com
   validade de 7 dias.
4. A pessoa abre o link, informa o código e cria a senha.
5. O trigger `aplicar_convites()` compara o código e só então vincula ao
   ministério. **É essa comparação que tranca a porta** — a conferência na tela
   serve para dar mensagem decente, e um atacante pode pular ela.

## Configurar (uma vez)

### 1. Remetente na Brevo

Não precisa de domínio próprio para começar. Em
[brevo.com](https://www.brevo.com) → **Senders & IP** → adicione um remetente
(ex.: `pranchakids@gmail.com`) e confirme pelo e-mail que chega. O plano
gratuito manda 300 por dia.

Em **SMTP & API** → **API Keys**, gere uma chave v3.

> Quando houver domínio próprio, troque o remetente e verifique SPF/DKIM na
> Brevo. A entregabilidade melhora e nada no código muda.

### 2. Segredos

```sh
supabase secrets set \
  BREVO_API_KEY=xkeysib-... \
  EMAIL_REMETENTE=pranchakids@gmail.com \
  NOME_REMETENTE="Prancha Kids · 2ª IPI" \
  URL_DO_APP=https://prancha-kids.vercel.app
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já existem no
ambiente das funções — não precisa declarar, e a `service_role` **nunca** entra
no `.env` do app.

### 3. Deploy

```sh
supabase functions deploy convidar
```

### 4. Confirmação de e-mail no Auth

Em **Authentication → Sign In / Providers → Email**, deixe *Confirm email*
**desligado**. O código do convite já prova que a pessoa tem acesso àquela
caixa de entrada; manter ligado faz ela receber dois e-mails e criar a senha
sem conseguir entrar.

## Mexer no e-mail

O template está em `email.ts`, com o texto puro junto — os dois precisam
mostrar o código, senão quem lê em texto não entra.

Para ver como ficou sem enviar nada:

```sh
deno eval --ext=ts '
  import { htmlDoConvite } from "./supabase/functions/convidar/email.ts";
  await Deno.writeTextFile("/tmp/convite.html", htmlDoConvite({
    ministerio: "Kids Manhã", convidadoPor: "Joana", papel: "voluntario",
    codigo: "K7M2QX", link: "https://exemplo/", diasDeValidade: 7,
    urlDoApp: "https://prancha-kids.vercel.app",
  }));
'
```

Regras que não são as da web: tabela para layout, CSS inline, e nenhuma imagem
indispensável — cliente de e-mail bloqueia imagem por padrão, e o cabeçalho
precisa se sustentar sem o logo carregar.
