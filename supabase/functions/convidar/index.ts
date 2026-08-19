import { createClient } from 'jsr:@supabase/supabase-js@2';
import { assuntoDoConvite, htmlDoConvite, textoDoConvite } from './email.ts';

/**
 * Convida alguém para o ministério e manda o código por e-mail.
 *
 * Primeiro (e único) pedaço de servidor do projeto. Existe porque duas coisas
 * aqui não podem morar no navegador: a chave do provedor de e-mail, e a
 * leitura do código recém-gerado — que é justamente o segredo que separa um
 * convite de um acesso.
 *
 * A checagem de quem pode convidar **não** confia no que o cliente manda. O
 * ministério vem do vínculo de quem chamou, lido com o token dele; um
 * coordenador do ministério A não consegue convidar para o B nem mandando o
 * id do B no corpo do pedido.
 *
 * Falhar em enviar o e-mail desfaz o convite. Um convite gravado cujo código
 * ninguém recebeu é pior que nenhum convite: a coordenação vê "pendente" na
 * tela e fica esperando uma pessoa que nunca soube que foi convidada.
 *
 * Deploy: `supabase functions deploy convidar`
 * Segredos: `supabase secrets set BREVO_API_KEY=... EMAIL_REMETENTE=... NOME_REMETENTE=... URL_DO_APP=...`
 */

const DIAS_DE_VALIDADE = 7;

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

/**
 * Erro que a pessoa pode ler.
 *
 * Detalhe de infraestrutura fica no log, nunca na resposta: a tela de convite
 * é operada por voluntário de igreja, e "relation convites does not exist" não
 * ajuda ninguém — só vaza o formato do banco para quem estiver sondando.
 */
function falhar(mensagem: string, status: number, detalhe?: unknown): Response {
  if (detalhe) console.error(mensagem, detalhe);
  return responder({ erro: mensagem }, status);
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return falhar('Método não suportado.', 405);

  const urlDoSupabase = Deno.env.get('SUPABASE_URL');
  const chaveAnon = Deno.env.get('SUPABASE_ANON_KEY');
  const chaveDeServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const chaveDaBrevo = Deno.env.get('BREVO_API_KEY');
  const emailRemetente = Deno.env.get('EMAIL_REMETENTE');
  const nomeRemetente = Deno.env.get('NOME_REMETENTE') ?? 'Prancha Kids';
  const urlDoApp = Deno.env.get('URL_DO_APP');

  if (!urlDoSupabase || !chaveAnon || !chaveDeServico || !chaveDaBrevo || !emailRemetente || !urlDoApp) {
    return falhar('Convite por e-mail não está configurado no servidor.', 500, {
      faltando: {
        SUPABASE_URL: !urlDoSupabase,
        SUPABASE_ANON_KEY: !chaveAnon,
        SUPABASE_SERVICE_ROLE_KEY: !chaveDeServico,
        BREVO_API_KEY: !chaveDaBrevo,
        EMAIL_REMETENTE: !emailRemetente,
        URL_DO_APP: !urlDoApp,
      },
    });
  }

  const autorizacao = req.headers.get('Authorization');
  if (!autorizacao) return falhar('Faça login antes de convidar.', 401);

  let corpo: { email?: unknown; papel?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return falhar('Pedido malformado.', 400);
  }

  const email = String(corpo.email ?? '').trim().toLowerCase();
  const papel = corpo.papel === 'coordenador' ? 'coordenador' : 'voluntario';

  if (!EMAIL_VALIDO.test(email)) return falhar('E-mail inválido.', 400);

  // --- quem está convidando -------------------------------------------------
  // Client com o token de quem chamou: tudo que ele ler aqui passa pela mesma
  // RLS que a tela enfrenta.
  const comoUsuario = createClient(urlDoSupabase, chaveAnon, {
    global: { headers: { Authorization: autorizacao } },
  });

  const { data: sessao, error: erroDeSessao } = await comoUsuario.auth.getUser();
  if (erroDeSessao || !sessao.user) return falhar('Faça login antes de convidar.', 401);

  const { data: vinculo, error: erroDeVinculo } = await comoUsuario
    .from('membros')
    .select('ministerio_id, nome, email, ministerios(nome)')
    .eq('usuario_id', sessao.user.id)
    .eq('papel', 'coordenador')
    .is('apagado_em', null)
    .limit(1)
    .maybeSingle();

  if (erroDeVinculo) return falhar('Não deu para conferir sua permissão.', 500, erroDeVinculo);
  if (!vinculo) return falhar('Só a coordenação pode convidar.', 403);

  const ministerioId = vinculo.ministerio_id as string;
  const ministerios = vinculo.ministerios as unknown as { nome: string } | { nome: string }[] | null;
  const nomeDoMinisterio =
    (Array.isArray(ministerios) ? ministerios[0]?.nome : ministerios?.nome) ?? 'Ministério';

  if (email === String(vinculo.email ?? '').toLowerCase()) {
    return falhar('Esse é o seu próprio e-mail.', 400);
  }

  // --- grava o convite ------------------------------------------------------
  // Aqui entra o service_role, e só a partir daqui: o código é gerado por
  // default no banco e precisa ser lido de volta para entrar no e-mail —
  // leitura que nenhum membro tem, de propósito.
  const comoServico = createClient(urlDoSupabase, chaveDeServico);

  const expiraEm = new Date(Date.now() + DIAS_DE_VALIDADE * 86400000).toISOString();

  // Upsert, não insert: reconvidar quem já tem convite pendente troca o código
  // e renova o prazo. É o "reenviar" — e invalida o código antigo, que é o que
  // se espera de um reenvio.
  const { data: convite, error: erroDoConvite } = await comoServico
    .from('convites')
    .upsert(
      { email, ministerio_id: ministerioId, papel, expira_em: expiraEm },
      { onConflict: 'email,ministerio_id' },
    )
    .select('codigo')
    .single();

  if (erroDoConvite || !convite) {
    return falhar('Não deu para registrar o convite.', 500, erroDoConvite);
  }

  // --- manda o e-mail -------------------------------------------------------
  const raiz = urlDoApp.replace(/\/$/, '');
  const dados = {
    ministerio: nomeDoMinisterio,
    convidadoPor: String(vinculo.nome ?? '').trim(),
    papel: papel as 'voluntario' | 'coordenador',
    codigo: convite.codigo as string,
    link: `${raiz}/?convite=${encodeURIComponent(email)}`,
    diasDeValidade: DIAS_DE_VALIDADE,
    urlDoApp: raiz,
  };

  let envio: Response;
  try {
    envio = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': chaveDaBrevo,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: nomeRemetente, email: emailRemetente },
        to: [{ email }],
        subject: assuntoDoConvite(nomeDoMinisterio),
        htmlContent: htmlDoConvite(dados),
        textContent: textoDoConvite(dados),
      }),
    });
  } catch (erro) {
    await comoServico.from('convites').delete().eq('email', email).eq('ministerio_id', ministerioId);
    return falhar('Não deu para falar com o serviço de e-mail. Tente de novo.', 502, erro);
  }

  if (!envio.ok) {
    const detalhe = await envio.text();
    // Desfaz: convite gravado sem e-mail entregue deixa a coordenação
    // esperando alguém que nunca foi avisado.
    await comoServico.from('convites').delete().eq('email', email).eq('ministerio_id', ministerioId);
    return falhar('O e-mail não foi aceito pelo provedor. Confira o endereço.', 502, detalhe);
  }

  return responder({ ok: true, email, expiraEm }, 200);
});
