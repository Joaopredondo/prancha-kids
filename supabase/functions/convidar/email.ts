/**
 * O e-mail do convite.
 *
 * Mora no repositório, e não no painel do provedor, por dois motivos: entra em
 * revisão junto com o resto, e o texto que uma pessoa recebe em nome do
 * ministério não deveria mudar sem alguém aprovar.
 *
 * Regras de e-mail, que não são as da web:
 * - Tabela para layout. Outlook ignora flexbox e grid.
 * - CSS inline. Gmail descarta `<style>` em boa parte dos casos.
 * - Nada de imagem externa. Cliente de e-mail bloqueia imagem por padrão, e um
 *   convite cujo banner não carrega vira uma caixa cinza vazia. A faixa de
 *   cards no topo é feita com célula de tabela colorida e emoji — carrega
 *   sempre, e já é a cara do app.
 */

/** Paleta do Código Fitzgerald, a mesma de `src/index.css`. */
const COR = {
  acao: '#16a34a',
  coisa: '#ea580c',
  descricao: '#2563eb',
  social: '#db2777',
  pessoa: '#ca8a04',
  urgencia: '#dc2626',
  fundo: '#fbf7f0',
  superficie: '#ffffff',
  texto: '#1c1917',
  textoSuave: '#57534e',
  linha: '#e7e0d5',
} as const;

/**
 * A faixa do topo: seis cards da prancha de verdade.
 *
 * Copia a forma do `CardButton`: fundo branco, borda grossa na cor da classe
 * gramatical, e o emoji sobre um fundo suave dessa mesma cor. Card colorido
 * por inteiro seria mais chamativo e menos honesto — quem abrir o app depois
 * encontraria outra coisa.
 *
 * O `tinta` é o `color-mix(... 12%, branco)` do app resolvido à mão: e-mail
 * não tem `color-mix`, nem variável CSS. Sai uma aproximação em sRGB do que o
 * app calcula em oklab — perto o suficiente a olho nu, e a alternativa seria
 * não ter a cor.
 */
const CARDS_DO_TOPO = [
  { emoji: '👍', label: 'Sim', borda: COR.social, tinta: '#fbe5ef' },
  { emoji: '🤲', label: 'Quero', borda: COR.acao, tinta: '#e3f4e9' },
  { emoji: '💧', label: 'Água', borda: COR.coisa, tinta: '#fcebe2' },
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

export interface DadosDoConvite {
  ministerio: string;
  /** Quem convidou. Vazio quando o nome ainda não foi preenchido no cadastro. */
  convidadoPor: string;
  papel: 'voluntario' | 'coordenador';
  codigo: string;
  /** Link já com o e-mail na query string, para a tela não pedir de novo. */
  link: string;
  /** Quantos dias o código ainda vale. */
  diasDeValidade: number;
  /** Raiz do app, sem barra no fim — é de onde sai o logo. */
  urlDoApp: string;
}

export function assuntoDoConvite(ministerio: string): string {
  return `Seu acesso ao Prancha Kids — ${ministerio}`;
}

/**
 * Versão em texto puro.
 *
 * Não é enfeite: filtro de spam pontua pior quem manda só HTML, e leitor de
 * tela em cliente antigo às vezes cai aqui. O código precisa aparecer aqui
 * também, senão quem lê em texto não consegue entrar.
 */
export function textoDoConvite(dados: DadosDoConvite): string {
  const quem = dados.convidadoPor ? `${dados.convidadoPor} convidou você` : 'Você foi convidado';
  const papel = dados.papel === 'coordenador' ? 'coordenação' : 'voluntário';

  return [
    `${quem} para ajudar no ${dados.ministerio}, como ${papel}.`,
    '',
    'O Prancha Kids é a prancha de comunicação que dá voz às crianças do ministério:',
    'a criança toca na figura e o app fala por ela.',
    '',
    `Seu código de acesso: ${dados.codigo}`,
    `Vale por ${dados.diasDeValidade} dias.`,
    '',
    'Para entrar, abra o endereço abaixo, informe o código e crie sua senha:',
    dados.link,
    '',
    '---',
    'Você recebeu este e-mail porque alguém do ministério convidou você.',
    'Se não esperava por isso, é só ignorar — sem o código, nada acontece.',
  ].join('\n');
}

export function htmlDoConvite(dados: DadosDoConvite): string {
  const ministerio = escapar(dados.ministerio);
  const codigo = escapar(dados.codigo);
  const link = escapar(dados.link);
  // Servido pela hospedagem do próprio app: URL estável, sem hash de build.
  // Se o cliente de e-mail bloquear imagem (a maioria bloqueia por padrão), o
  // nome ao lado sustenta o cabeçalho sozinho — por isso o `alt` é vazio, e
  // não um texto que apareceria duplicado.
  const urlDoLogo = escapar(`${dados.urlDoApp.replace(/\/$/, '')}/ipi.png`);
  const quem = dados.convidadoPor
    ? `<strong>${escapar(dados.convidadoPor)}</strong> convidou você`
    : 'Você foi convidado';
  const papel = dados.papel === 'coordenador' ? 'coordenação' : 'voluntário';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite — Prancha Kids</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COR.fundo};">

  <!-- Prévia na caixa de entrada, antes de abrir. Escondida no corpo. -->
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
    Seu código é ${codigo} — vale por ${dados.diasDeValidade} dias.
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COR.fundo}; padding: 24px 12px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: ${COR.superficie}; border-radius: 20px; border: 2px solid ${COR.linha}; overflow: hidden;">

          <!-- Identidade: o mesmo logo e as mesmas duas linhas da tela de
               entrada do app. Quem clicar no botão precisa reconhecer onde
               chegou; cabeçalho diferente do destino é o que faz um convite
               legítimo parecer golpe. -->
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
                ${quem} para o<br><span style="color: ${COR.acao};">${ministerio}</span>
              </h1>
              <p style="margin: 14px 0 0 0; font-family: ${FONTE}; font-size: 15px; line-height: 1.65; color: ${COR.textoSuave};">
                O <strong style="color: ${COR.texto};">Prancha Kids</strong> é a prancha de comunicação do ministério:
                a criança toca na figura e o app fala por ela. Você entra como <strong style="color: ${COR.texto};">${papel}</strong>.
              </p>
            </td>
          </tr>

          <!-- Código -->
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COR.fundo}; border: 2px dashed ${COR.acao}; border-radius: 16px;">
                <tr>
                  <td align="center" style="padding: 18px 12px;">
                    <div style="font-family: ${FONTE}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${COR.textoSuave};">
                      Seu código de acesso
                    </div>
                    <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: ${COR.acao}; padding: 8px 0 0 0;">
                      ${codigo}
                    </div>
                    <div style="font-family: ${FONTE}; font-size: 12px; color: ${COR.textoSuave}; padding-top: 6px;">
                      vale por ${dados.diasDeValidade} dias
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Botão -->
          <tr>
            <td align="center" style="padding: 24px 32px 8px 32px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color: ${COR.acao}; border-radius: 999px;">
                    <a href="${link}" style="display: inline-block; padding: 15px 36px; font-family: ${FONTE}; font-size: 17px; font-weight: 800; color: #ffffff; text-decoration: none;">
                      Criar minha senha
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 14px 0 0 0; font-family: ${FONTE}; font-size: 13px; line-height: 1.6; color: ${COR.textoSuave};">
                Na tela que abrir, informe o código acima e escolha sua senha.
              </p>
            </td>
          </tr>

          <!-- Aviso de responsabilidade: quem entra vê dado de saúde de menor -->
          <tr>
            <td style="padding: 20px 32px 4px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 2px solid ${COR.linha};">
                <tr>
                  <td style="padding-top: 16px; font-family: ${FONTE}; font-size: 12px; line-height: 1.6; color: ${COR.textoSuave};">
                    Com esse acesso você passa a ver nome, idade, laudo, alergias, necessidades e
                    foto das crianças atendidas. São dados de saúde de menores — trate como o
                    ministério trata a ficha de papel.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 20px 32px 26px 32px; text-align: center;">
              <p style="margin: 0; font-family: ${FONTE}; font-size: 11px; line-height: 1.6; color: ${COR.textoSuave};">
                Se você não esperava este convite, pode ignorar esta mensagem —<br>
                sem o código, nada acontece.
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
