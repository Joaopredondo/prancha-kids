import { createClient } from 'jsr:@supabase/supabase-js@2';
import { assuntoDaRecuperacao, htmlDaRecuperacao, textoDaRecuperacao } from './email.ts';

/**
 * Manda o link de recuperação de senha, com a mesma cara do convite.
 *
 * O Supabase Auth já resolveria isso sozinho (`resetPasswordForEmail`), mas aí
 * o e-mail sai pelo mailer dele — remetente genérico, template colado à mão
 * no painel, em sintaxe Go que não passa por revisão de código. Aqui o link é
 * gerado pelo Auth (`admin.generateLink`, mesmo token longo e verificado do
 * jeito nativo) e só o **envio** passa a ser nosso, pela mesma Brevo que já
 * manda o convite.
 *
 * Sem enumeração: a resposta é sempre "ok" — não dá para saber, pela resposta
 * desta função, se um e-mail tem conta ou não. Só manda mensagem de verdade
 * quando o Auth encontra a conta.
 *
 * Deploy: `supabase functions deploy recuperar-senha`
 * Segredos: os mesmos já usados em `convidar` (BREVO_API_KEY, EMAIL_REMETENTE,
 * NOME_REMETENTE, URL_DO_APP) — nenhum segredo novo.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function responder(corpo: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Resposta genérica de sucesso — igual haja conta ou não com esse e-mail.
 * É o que impede alguém de descobrir e-mails cadastrados só chamando esta
 * função em loop.
 */
const OK_GENERICO = { ok: true };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ erro: 'Método não suportado.' }, 405);

  const urlDoSupabase = Deno.env.get('SUPABASE_URL');
  const chaveDeServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const chaveDaBrevo = Deno.env.get('BREVO_API_KEY');
  const emailRemetente = Deno.env.get('EMAIL_REMETENTE');
  const nomeRemetente = Deno.env.get('NOME_REMETENTE') ?? 'Prancha Kids';
  const urlDoApp = Deno.env.get('URL_DO_APP');

  if (!urlDoSupabase || !chaveDeServico || !chaveDaBrevo || !emailRemetente || !urlDoApp) {
    console.error('Recuperação de senha não está configurada no servidor.', {
      faltando: {
        SUPABASE_URL: !urlDoSupabase,
        SUPABASE_SERVICE_ROLE_KEY: !chaveDeServico,
        BREVO_API_KEY: !chaveDaBrevo,
        EMAIL_REMETENTE: !emailRemetente,
        URL_DO_APP: !urlDoApp,
      },
    });
    // Mesmo aqui, sem detalhe: quem pede recuperação é sempre anônimo, e
    // "faltou variável de ambiente" é informação de servidor, não de tela.
    return responder({ erro: 'Não deu para enviar. Tente de novo mais tarde.' }, 500);
  }

  let corpo: { email?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return responder({ erro: 'Pedido malformado.' }, 400);
  }

  const email = String(corpo.email ?? '').trim().toLowerCase();
  if (!EMAIL_VALIDO.test(email)) return responder({ erro: 'E-mail inválido.' }, 400);

  const comoServico = createClient(urlDoSupabase, chaveDeServico);
  const raiz = urlDoApp.replace(/\/$/, '');

  const { data, error } = await comoServico.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: raiz },
  });

  // "Usuário não existe" cai aqui — e é exatamente o caso que não pode
  // vazar para quem chamou. Qualquer outro erro do Auth também não é
  // motivo para revelar nada a mais: só vai pro log.
  if (error || !data.properties?.action_link) {
    if (error) console.error('Não deu para gerar o link de recuperação.', error);
    return responder(OK_GENERICO, 200);
  }

  const dados = { link: data.properties.action_link, urlDoApp: raiz };

  try {
    const envio = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': chaveDaBrevo,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: nomeRemetente, email: emailRemetente },
        to: [{ email }],
        subject: assuntoDaRecuperacao(),
        htmlContent: htmlDaRecuperacao(dados),
        textContent: textoDaRecuperacao(dados),
      }),
    });
    if (!envio.ok) console.error('Brevo recusou o e-mail de recuperação.', await envio.text());
  } catch (erro) {
    console.error('Não deu para falar com o serviço de e-mail.', erro);
  }

  // Sucesso genérico mesmo se o envio falhar: o log já registrou o problema
  // para investigar depois, e a tela não tem por que distinguir "e-mail não
  // existe" de "Brevo caiu" — os dois terminam na mesma orientação para quem
  // pediu (conferir a caixa de entrada, tentar de novo mais tarde).
  return responder(OK_GENERICO, 200);
});
