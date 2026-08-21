/**
 * O e-mail de parabéns de aniversário, para quem é da equipe.
 *
 * Mesma casca visual de `../convidar/email.ts` — paleta, fonte, tabela de
 * 560px, cabeçalho com logo, versão em texto puro — porque os e-mails do app
 * precisam parecer irmãos, vindos do mesmo lugar. O que muda é a festa: a
 * faixa de cards vira tema de aniversário, entra um filete de confete nas
 * cores do código Fitzgerald e o destaque troca o verde do convite pelo rosa
 * (`social`, a cor da comunicação) — aniversário é encontro, não tarefa.
 *
 * As regras de e-mail que não são as da web valem aqui também:
 * - Tabela para layout. Outlook ignora flexbox e grid.
 * - CSS inline. Gmail descarta `<style>` em boa parte dos casos.
 * - Nada de imagem externa: a decoração é célula de tabela colorida e emoji,
 *   carrega sempre. O confete é o exemplo — seis retângulos, nenhuma imagem.
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
 * A faixa do topo, em versão festa.
 *
 * Mesmo componente visual dos cards do convite (fundo branco, borda grossa na
 * cor, emoji sobre fundo suave), só que o vocabulário é de aniversário — quem
 * já recebeu um convite pelo app reconhece a família, e a decoração avisa que
 * desta vez não é trabalho.
 */
const CARDS_DA_FESTA = [
  { emoji: '🎂', label: 'Bolo', borda: COR.social, tinta: '#fbe5ef' },
  { emoji: '🎈', label: 'Balão', borda: COR.descricao, tinta: '#e5edfb' },
  { emoji: '🎁', label: 'Presente', borda: COR.urgencia, tinta: '#fbe5e5' },
  { emoji: '🎉', label: 'Festa', borda: COR.acao, tinta: '#e3f4e9' },
  { emoji: '✨', label: 'Alegria', borda: COR.pessoa, tinta: '#f9f1e1' },
  { emoji: '❤️', label: 'Carinho', borda: COR.coisa, tinta: '#fcebe2' },
];

/** O confete: um filete nas seis cores, célula por célula. */
const CORES_DO_CONFETE = [
  COR.social,
  COR.acao,
  COR.pessoa,
  COR.descricao,
  COR.coisa,
  COR.urgencia,
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

const faixaDeCards = CARDS_DA_FESTA.map(
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

const fileteDeConfete = CORES_DO_CONFETE.map(
  (cor) => `
                <td width="16.66%" style="padding: 0 3px;">
                  <div style="height: 6px; border-radius: 3px; background-color: ${cor}; font-size: 0; line-height: 0;">&nbsp;</div>
                </td>`,
).join('');

export interface DadosDoParabens {
  /** Primeiro nome ou como a pessoa se cadastrou — é o que aparece no título. */
  nome: string;
  /** Raiz do app, sem barra no fim — é de onde sai o logo. */
  urlDoApp: string;
}

export function assuntoDoParabens(nome: string): string {
  return `Feliz aniversário, ${nome}! 🎉`;
}

/**
 * Versão em texto puro.
 *
 * Pela mesma regra do convite: filtro de spam pontua pior quem manda só HTML,
 * e leitor de tela em cliente antigo às vezes cai aqui.
 */
export function textoDoParabens(dados: DadosDoParabens): string {
  return [
    `Feliz aniversário, ${dados.nome}!`,
    '',
    'Hoje é o seu dia, e a equipe do Prancha Kids não ia deixar passar:',
    'muito obrigado pelo carinho que você dedica às crianças do ministério.',
    '',
    'Que o seu novo ano venha cheio de alegria — daquela que você planta',
    'por aí todo domingo.',
    '',
    '---',
    'Você recebe este e-mail porque faz parte da equipe do Prancha Kids.',
    'Ele é enviado no dia do aniversário que está no seu cadastro — para',
    'corrigir a data, é só editar "Meus dados" no menu do voluntário.',
  ].join('\n');
}

export function htmlDoParabens(dados: DadosDoParabens): string {
  const nome = escapar(dados.nome);
  // Servido pela hospedagem do próprio app: URL estável, sem hash de build.
  // Se o cliente de e-mail bloquear imagem (a maioria bloqueia por padrão), o
  // nome ao lado sustenta o cabeçalho sozinho — por isso o `alt` é vazio.
  const urlDoLogo = escapar(`${dados.urlDoApp.replace(/\/$/, '')}/ipi.png`);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feliz aniversário — Prancha Kids</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COR.fundo};">

  <!-- Prévia na caixa de entrada, antes de abrir. Escondida no corpo. -->
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
    A equipe do Prancha Kids deseja um feliz aniversário para você! 🎂
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COR.fundo}; padding: 24px 12px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: ${COR.superficie}; border-radius: 20px; border: 2px solid ${COR.linha}; overflow: hidden;">

          <!-- Identidade: o mesmo logo e as mesmas duas linhas da tela de
               entrada do app. O remetente é o mesmo dos outros e-mails — o
               cabeçalho confirma que a festa vem de quem a pessoa conhece. -->
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

          <!-- A prancha, em miniatura — em versão festa -->
          <tr>
            <td style="padding: 18px 22px 4px 22px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>${faixaDeCards}
                </tr>
              </table>
            </td>
          </tr>

          <!-- O confete: filete nas seis cores, acima do título -->
          <tr>
            <td style="padding: 14px 26px 0 26px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>${fileteDeConfete}
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 22px 32px 8px 32px; text-align: center;">
              <h1 style="margin: 0; font-family: ${FONTE}; font-size: 27px; font-weight: 800; color: ${COR.texto}; line-height: 1.25;">
                Feliz aniversário,<br><span style="color: ${COR.social};">${nome}!</span> 🎉
              </h1>
              <p style="margin: 14px 0 0 0; font-family: ${FONTE}; font-size: 15px; line-height: 1.65; color: ${COR.textoSuave};">
                Hoje é o seu dia, e a equipe do <strong style="color: ${COR.texto};">Prancha Kids</strong> não ia deixar passar:
                muito obrigado pelo carinho que você dedica às crianças do ministério.
              </p>
            </td>
          </tr>

          <!-- O brinde: mesma forma da caixa do código no convite, tom de festa -->
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fbe5ef; border: 2px solid ${COR.social}; border-radius: 16px;">
                <tr>
                  <td align="center" style="padding: 18px 16px;">
                    <div style="font-family: ${FONTE}; font-size: 16px; font-weight: 700; line-height: 1.6; color: ${COR.texto};">
                      🎂 Que o seu novo ano venha cheio de alegria —<br>
                      daquela que você planta por aí todo domingo.
                    </div>
                    <div style="font-family: ${FONTE}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${COR.textoSuave}; padding-top: 10px;">
                      Equipe Prancha Kids · 2ª IPI
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 24px 32px 26px 32px; text-align: center;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 2px solid ${COR.linha};">
                <tr>
                  <td style="padding-top: 16px; font-family: ${FONTE}; font-size: 11px; line-height: 1.6; color: ${COR.textoSuave};">
                    Você recebe este e-mail porque faz parte da equipe do Prancha Kids.<br>
                    Ele é enviado no dia do aniversário que está no seu cadastro — para corrigir a
                    data, é só editar “Meus dados” no menu do voluntário.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}
