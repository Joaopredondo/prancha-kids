/**
 * O e-mail de recuperação de senha.
 *
 * Mesma casca visual de `../convidar/email.ts` — logo, faixa de cards do
 * Código Fitzgerald, cartão arredondado — de propósito: os dois e-mails
 * precisam parecer irmãos, vindos do mesmo app, não de sistemas diferentes.
 *
 * Regras de e-mail, que não são as da web: tabela para layout (Outlook ignora
 * flexbox/grid), CSS inline (Gmail descarta `<style>`), nada de imagem
 * externa além do logo (cliente de e-mail bloqueia imagem por padrão — a
 * faixa de cards é célula de tabela colorida e emoji, carrega sempre).
 */

const COR = {
  acao: '#16a34a',
  coisa: '#ea580c',
  social: '#db2777',
  pessoa: '#ca8a04',
  urgencia: '#dc2626',
  fundo: '#fbf7f0',
  superficie: '#ffffff',
  texto: '#1c1917',
  textoSuave: '#57534e',
  linha: '#e7e0d5',
} as const;

/** A faixa do topo: seis cards da prancha, agora com "Senha" e "Segura" no lugar de dois da prancha real. */
const CARDS_DO_TOPO = [
  { emoji: '👍', label: 'Sim', borda: COR.social, tinta: '#fbe5ef' },
  { emoji: '🔑', label: 'Senha', borda: COR.acao, tinta: '#e3f4e9' },
  { emoji: '🔒', label: 'Segura', borda: COR.coisa, tinta: '#fcebe2' },
  { emoji: '🤝', label: 'Ajuda', borda: COR.acao, tinta: '#e3f4e9' },
  { emoji: '🧒', label: 'Eu', borda: COR.pessoa, tinta: '#f9f1e1' },
  { emoji: '🛑', label: 'Parar', borda: COR.urgencia, tinta: '#fbe5e5' },
];

const FONTE =
  "'Nunito', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif";

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const faixaDeCards = CARDS_DO_TOPO.map(
  (card) => `
              <td align="center" width="16.66%" style="padding: 0 2px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 3px solid ${card.borda}; border-radius: 14px; background-color: ${COR.superficie};">
                  <tr>
                    <td align="center" style="padding: 5px 3px 4px 3px;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${card.tinta}; border-radius: 9px;">
                        <tr>
                          <td align="center" style="padding: 7px 2px; font-size: 21px; line-height: 1;">${card.emoji}</td>
                        </tr>
                      </table>
                      <div style="font-size: 10px; font-weight: 800; color: ${COR.texto}; padding-top: 4px; font-family: ${FONTE};">${card.label}</div>
                    </td>
                  </tr>
                </table>
              </td>`,
).join('');

export interface DadosDaRecuperacao {
  /** Link de recuperação já gerado e verificado pelo Supabase Auth (admin.generateLink). */
  link: string;
  /** Raiz do app, sem barra no fim — é de onde sai o logo. */
  urlDoApp: string;
}

export function assuntoDaRecuperacao(): string {
  return 'Redefinir sua senha — Prancha Kids';
}

/**
 * Versão em texto puro.
 *
 * Não é enfeite: filtro de spam pontua pior quem manda só HTML, e leitor de
 * tela em cliente antigo às vezes cai aqui.
 */
export function textoDaRecuperacao(dados: DadosDaRecuperacao): string {
  return [
    'Alguém pediu para trocar a senha desta conta no Prancha Kids.',
    'Se foi você, abra o link abaixo para escolher uma senha nova:',
    '',
    dados.link,
    '',
    'O link vale por um tempo curto. Se expirar, é só pedir de novo na tela de entrada.',
    '',
    '---',
    'Se você não pediu essa troca, pode ignorar este e-mail — sua senha atual',
    'continua valendo, e ninguém entra na conta só com este link sem também',
    'saber o e-mail.',
  ].join('\n');
}

export function htmlDaRecuperacao(dados: DadosDaRecuperacao): string {
  const link = escapar(dados.link);
  const urlDoLogo = escapar(`${dados.urlDoApp.replace(/\/$/, '')}/ipi.png`);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinir senha — Prancha Kids</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COR.fundo};">

  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
    Toque no botão para escolher uma senha nova. Se você não pediu isso, ignore este e-mail.
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COR.fundo}; padding: 24px 12px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: ${COR.superficie}; border-radius: 20px; border: 2px solid ${COR.linha}; overflow: hidden;">

          <!-- Identidade -->
          <tr>
            <td style="padding: 22px 26px 0 26px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right: 12px;" valign="middle">
                    <img src="${urlDoLogo}" width="52" height="52" alt=""
                         style="display: block; width: 52px; height: 52px; border-radius: 14px; border: 0;">
                  </td>
                  <td valign="middle">
                    <div style="font-family: ${FONTE}; font-size: 21px; font-weight: 800; color: ${COR.texto}; line-height: 1.15;">
                      Prancha Kids
                    </div>
                    <div style="font-family: ${FONTE}; font-size: 12px; font-weight: 600; color: ${COR.textoSuave}; padding-top: 2px;">
                      2ª IPI · Ministério Infantil
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- A prancha, em miniatura -->
          <tr>
            <td style="padding: 18px 22px 4px 22px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>${faixaDeCards}
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 24px 32px 8px 32px; text-align: center;">
              <h1 style="margin: 0; font-family: ${FONTE}; font-size: 26px; font-weight: 800; color: ${COR.texto}; line-height: 1.25;">
                Redefinir sua <span style="color: ${COR.acao};">senha</span>
              </h1>
              <p style="margin: 14px 0 0 0; font-family: ${FONTE}; font-size: 15px; line-height: 1.65; color: ${COR.textoSuave};">
                Alguém pediu para trocar a senha desta conta no <strong style="color: ${COR.texto};">Prancha Kids</strong>.
                Se foi você, toque no botão abaixo para escolher uma senha nova.
              </p>
            </td>
          </tr>

          <!-- Botão -->
          <tr>
            <td align="center" style="padding: 8px 32px 8px 32px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color: ${COR.acao}; border-radius: 999px;">
                    <a href="${link}" style="display: inline-block; padding: 15px 36px; font-family: ${FONTE}; font-size: 17px; font-weight: 800; color: #ffffff; text-decoration: none;">
                      Escolher senha nova
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 14px 0 0 0; font-family: ${FONTE}; font-size: 13px; line-height: 1.6; color: ${COR.textoSuave};">
                O link vale por um tempo curto. Se expirar, é só pedir de novo na tela de entrada.
              </p>
            </td>
          </tr>

          <!-- Aviso de segurança -->
          <tr>
            <td style="padding: 20px 32px 4px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 2px solid ${COR.linha};">
                <tr>
                  <td style="padding-top: 16px; font-family: ${FONTE}; font-size: 12px; line-height: 1.6; color: ${COR.textoSuave};">
                    Se você não pediu essa troca, pode ignorar este e-mail — sua senha atual continua
                    valendo, e ninguém entra na conta só com este link sem também saber o e-mail.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 20px 32px 26px 32px; text-align: center;">
              <p style="margin: 0; font-family: ${FONTE}; font-size: 11px; line-height: 1.6; color: ${COR.textoSuave};">
                Você recebeu este e-mail porque tem conta no Prancha Kids com este endereço.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}
