import { createClient } from 'jsr:@supabase/supabase-js@2';
import { assuntoDoParabens, htmlDoParabens, textoDoParabens } from './email.ts';

/**
 * Manda o e-mail de parabéns no dia do aniversário de quem é da equipe.
 *
 * Diferente de `convidar` e `recuperar-senha`, ninguém chama isto do navegador:
 * é o cron do Supabase (`pg_cron` + `pg_net`, migração 0011) todo dia às 09:00
 * de Brasília. Por isso não há CORS nem JWT de usuário — a porta é um segredo
 * próprio (`CRON_SECRET`), sem o qual qualquer um conseguiria gastar a cota
 * diária da Brevo chamando em loop.
 *
 * Quem recebe: `membros` com `apagado_em` nulo e `nascimento` caindo no dia de
 * hoje (mês e dia, em `America/Sao_Paulo` — o Brasil não tem horário de verão,
 * 12:00 UTC é sempre 09:00 daqui). O filtro mês/dia é feito aqui, em TypeScript,
 * de propósito: equipe é pequena, e a alternativa seria uma função SQL que não
 * pode filtrar por ministério sem virar ponto de leitura de e-mail alheio.
 *
 * Sem repetição: cada aniversariante do dia é **reservado** em
 * `parabens_enviados (usuario_id, hoje)` antes do envio; se a função rodar de
 * novo no mesmo dia — reexecução manual ou retry — quem já recebeu é pulado.
 * A reserva é devolvida quando a Brevo recusa o envio, para um retry poder
 * tentar de novo. Entre um e-mail raro duplicado (crash entre o envio e a
 * reserva) e um parabéns que não chega nunca, fica-se com o primeiro.
 *
 * Deploy: `supabase functions deploy aniversario --no-verify-jwt`
 * Segredos: os de `convidar` (BREVO_API_KEY, EMAIL_REMETENTE, NOME_REMETENTE,
 * URL_DO_APP) + CRON_SECRET — ver README.
 */

function responder(corpo: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function falhar(mensagem: string, status: number, detalhe?: unknown): Response {
  // Detalhe fica no log do servidor — a resposta para o cron carrega só o erro
  // legível, sem dado de pessoa.
  if (detalhe !== undefined) console.error(mensagem, detalhe);
  return responder({ erro: mensagem }, status);
}

/** O dia de hoje em `America/Sao_Paulo`, como `YYYY-MM-DD`. */
function hojeEmBrasilia(): string {
  // `en-CA` é o locale que formata como ISO — truque conhecido para tirar
  // `YYYY-MM-DD` do `toLocaleDateString` sem biblioteca.
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return falhar('Método não suportado.', 405);

  const segredo = Deno.env.get('CRON_SECRET');
  const urlDoSupabase = Deno.env.get('SUPABASE_URL');
  const chaveDeServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const chaveDaBrevo = Deno.env.get('BREVO_API_KEY');
  const emailRemetente = Deno.env.get('EMAIL_REMETENTE');
  const nomeRemetente = Deno.env.get('NOME_REMETENTE') ?? 'Prancha Kids';
  const urlDoApp = Deno.env.get('URL_DO_APP');

  if (!segredo || !urlDoSupabase || !chaveDeServico || !chaveDaBrevo || !emailRemetente || !urlDoApp) {
    console.error('Parabéns de aniversário não está configurado no servidor.', {
      faltando: {
        CRON_SECRET: !segredo,
        SUPABASE_URL: !urlDoSupabase,
        SUPABASE_SERVICE_ROLE_KEY: !chaveDeServico,
        BREVO_API_KEY: !chaveDaBrevo,
        EMAIL_REMETENTE: !emailRemetente,
        URL_DO_APP: !urlDoApp,
      },
    });
    return falhar('E-mail de aniversário não está configurado no servidor.', 500);
  }

  // A porta do cron. Comparado como string inteira, em tempo constante, porque
  // é segredo — não é para vazar por timing nem aceitar prefixo.
  const autorizacao = req.headers.get('Authorization') ?? '';
  const esperado = `Bearer ${segredo}`;
  if (autorizacao.length !== esperado.length || autorizacao !== esperado) {
    return falhar('Não autorizado.', 401);
  }

  const hoje = hojeEmBrasilia();
  const mesEDia = hoje.slice(5); // "MM-DD"

  const comoServico = createClient(urlDoSupabase, chaveDeServico);

  const { data: membros, error: erroDaConsulta } = await comoServico
    .from('membros')
    .select('usuario_id, nome, email, nascimento')
    .is('apagado_em', null)
    .not('nascimento', 'is', null);

  if (erroDaConsulta) return falhar('Não deu para ler a equipe.', 500, erroDaConsulta.message);

  // `nascimento` vem como `YYYY-MM-DD`; comparar os 5 últimos caracteres é o
  // teste de aniversário em qualquer ano — sem parse de data, sem fuso.
  const aniversariantes = (membros ?? []).filter((m) =>
    String(m.nascimento).endsWith(mesEDia),
  );

  let enviados = 0;
  let falhas = 0;

  for (const pessoa of aniversariantes) {
    const nome = String(pessoa.nome ?? '').trim() || String(pessoa.email ?? '').split('@')[0];
    const email = String(pessoa.email ?? '').trim().toLowerCase();

    // Reserva o dia desta pessoa: `ignoreDuplicates` + `.select()` só devolve
    // linha quando a reserva foi criada agora — vazio significa que alguém
    // (a execução anterior) já mandou o parabéns de hoje.
    const { data: reserva, error: erroDaReserva } = await comoServico
      .from('parabens_enviados')
      .upsert(
        { usuario_id: pessoa.usuario_id, enviada_em: hoje },
        { onConflict: 'usuario_id,enviada_em', ignoreDuplicates: true },
      )
      .select('usuario_id');

    if (erroDaReserva) {
      console.error('Não deu para reservar o parabéns do dia.', {
        usuario: pessoa.usuario_id,
        detalhe: erroDaReserva.message,
      });
      falhas += 1;
      continue;
    }
    if (!reserva || reserva.length === 0) continue; // já recebeu hoje

    if (!email) {
      falhas += 1;
      continue;
    }

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
          subject: assuntoDoParabens(nome),
          htmlContent: htmlDoParabens({ nome, urlDoApp }),
          textContent: textoDoParabens({ nome, urlDoApp }),
        }),
      });
    } catch {
      // Falha num não derruba os outros: aniversário dos demais não espera
      // pelo retry de um só endereço. A reserva é devolvida para o retry.
      falhas += 1;
      console.error('Falha de rede ao enviar parabéns.', { usuario: pessoa.usuario_id });
      await comoServico
        .from('parabens_enviados')
        .delete()
        .eq('usuario_id', pessoa.usuario_id)
        .eq('enviada_em', hoje);
      continue;
    }

    if (!envio.ok) {
      falhas += 1;
      console.error('A Brevo recusou o envio do parabéns.', {
        usuario: pessoa.usuario_id,
        status: envio.status,
      });
      await comoServico
        .from('parabens_enviados')
        .delete()
        .eq('usuario_id', pessoa.usuario_id)
        .eq('enviada_em', hoje);
      continue;
    }

    enviados += 1;
  }

  // Contagens apenas: nome e e-mail não vão para a resposta nem para o log.
  return responder({ ok: true, aniversariantes: aniversariantes.length, enviados, falhas });
});
