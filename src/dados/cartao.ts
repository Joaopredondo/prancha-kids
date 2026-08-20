import { ROTULOS, type Ficha } from './ficha';
import { figurinhaPorId } from './figurinhas';
import type { Perfil } from './perfis';
import type { EstadoDaRotina } from './rotina';

/**
 * Cartão do culto — resumo para o responsável, gerado no aparelho.
 *
 * Só usa campo de escolha fechada e o que é claramente pensado para
 * compartilhar (`interesses`, "o que prendeu a atenção"). Fica de fora de
 * propósito: `laudo`, `manejo` (estratégias da equipe, não do pai) e
 * `descricao`/`observacoes` (texto livre sem filtro) — o cartão é para
 * informar, não é a ficha inteira exportada.
 *
 * Nunca sai do aparelho sozinho: quem gera decide se compartilha, com quem, e
 * revê o texto antes — é texto puro, para `navigator.share` ou recortar/colar,
 * nunca um link.
 */
export function gerarCartao(perfil: Perfil, ficha: Ficha | null, rotina: EstadoDaRotina): string {
  const linhas: string[] = [`🌟 Hoje no Kids — ${perfil.nome}`, dataDeHoje(), ''];

  const feitos = rotina.rotina
    .slice(0, rotina.indice + 1)
    .map((id) => figurinhaPorId(id))
    .filter((f): f is NonNullable<typeof f> => Boolean(f));
  if (feitos.length > 0) {
    linhas.push(`Passou por: ${feitos.map((f) => `${f.emoji} ${f.nome}`).join(', ')}`);
  }

  if (ficha) {
    if (ficha.estado) linhas.push(`😊 Como foi: ${ROTULOS.estado[ficha.estado].toLowerCase()}`);

    if (ficha.comunicacao.length > 0) {
      const meios = ficha.comunicacao.map((c) => ROTULOS.comunicacao[c].toLowerCase());
      linhas.push(`🗣️ Se comunicou por: ${meios.join(', ')}`);
    }

    if (ficha.alimentacao.length > 0) {
      const itens = ficha.alimentacao.map((a) => ROTULOS.alimentacao[a].toLowerCase());
      linhas.push(`🍽️ ${itens.join(', ')}`);
    }

    if (ficha.interesses.trim()) {
      linhas.push(`🎨 O que chamou atenção: ${ficha.interesses.trim()}`);
    }

    if (ficha.saida && ficha.saida !== 'nao') {
      linhas.push(`🚪 ${ROTULOS.saida[ficha.saida]}`);
    }
  }

  if (linhas.length === 3) linhas.push('Sem registro suficiente ainda para resumir o culto.');

  linhas.push('', 'Com carinho, equipe do Ministério Infantil 💛');
  return linhas.join('\n');
}

function dataDeHoje(): string {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
