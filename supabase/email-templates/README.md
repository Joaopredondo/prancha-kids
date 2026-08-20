# E-mail de recuperação de senha

Diferente do convite (que tem uma [Edge Function própria](../functions/convidar/)),
este e-mail é o Supabase Auth quem manda — não passa por código nosso, então
não dá pra usar a mesma técnica. A configuração fica no painel do Supabase.

## Por que link, não código

O convite usa um código de 6 caracteres porque, mesmo adivinhado, ele só
libera entrar numa equipe — e ainda passa pelo trigger `aplicar_convites()`.
Recuperação de senha é diferente: adivinhar o segredo dá controle total da
conta. Por isso aqui é o link nativo do Supabase (token longo, gerado e
verificado pelo próprio Auth) — mais seguro que qualquer código curto que a
gente inventasse, e sem reescrever a proteção contra força bruta que o
Supabase já tem pronta.

## Configurar (uma vez)

### 1. SMTP customizado (pra sair da Brevo, com a cara do app)

Sem isso, todo e-mail do Auth (recuperação incluída) sai de
`noreply@mail.app.supabase.io` — genérico e sem identidade.

Em **Project Settings → Authentication → SMTP Settings**, ative "Enable
Custom SMTP" e preencha com as credenciais **SMTP** da Brevo (diferente da
API key usada em `convidar` — pegue em Brevo → SMTP & API → aba SMTP):

- Host: `smtp-relay.brevo.com`
- Port: `587`
- Username: o login SMTP da Brevo
- Password: a chave SMTP da Brevo
- Sender email: o mesmo remetente já validado em `convidar`
- Sender name: `Prancha Kids · 2ª IPI`

### 2. Redirect URL permitida

Em **Authentication → URL Configuration**:

- **Site URL**: `https://prancha-kids.vercel.app` (o template lê o logo daqui,
  em `{{ .SiteURL }}/ipi.png`)
- **Redirect URLs**: adicione `https://prancha-kids.vercel.app` — sem isso o
  Supabase recusa o `redirectTo` que `pedirRecuperacaoDeSenha()` manda, e o
  link do e-mail falha.

### 3. Template

Em **Authentication → Email Templates → Reset Password**, aba "Message
body": cole o conteúdo de [`redefinir-senha.html`](./redefinir-senha.html).

## Testar

1. Na tela de entrar, "Esqueci minha senha" → digita um e-mail que tem conta.
2. O e-mail chega com a faixa de cards e o botão "Escolher senha nova".
3. Clicar no link volta pro app já com a sessão de recuperação — o
   `PortaoDoVoluntario` detecta isso sozinho (`aoRecuperarSenha` em
   `dados/sessao.ts`) e pula direto pra tela de nova senha, sem precisar
   passar pelo formulário de novo.
