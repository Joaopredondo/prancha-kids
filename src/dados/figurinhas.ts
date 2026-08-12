import type { Classe } from '../types';

/**
 * Catálogo de figurinhas da rotina do culto, portado do Lume.
 *
 * Mesmos treze itens, mesmos nomes, mesma ordem padrão. A diferença é o
 * desenho: no Lume são silhuetas sobre fundo preto (a usuária lá tem risco
 * convulsivo); aqui seguem a linguagem da prancha — emoji provisório, cor por
 * classe gramatical e, quando o item também é card, a mesma foto que a criança
 * já conhece.
 */
export type Figurinha = {
  id: string;
  nome: string;
  emoji: string;
  classe: Classe;
  /** Card equivalente em `data/cards.ts`, para reaproveitar foto e áudio. */
  cardId?: string;
};

export const FIGURINHAS: Figurinha[] = [
  { id: 'louvor', nome: 'Louvor', emoji: '🎶', classe: 'coisa', cardId: 'louvor' },
  { id: 'oracao', nome: 'Oração', emoji: '🙏', classe: 'acao', cardId: 'orar' },
  { id: 'historia', nome: 'História bíblica', emoji: '📖', classe: 'coisa' },
  { id: 'atividade', nome: 'Atividade', emoji: '✏️', classe: 'coisa', cardId: 'atividade' },
  { id: 'desenhar', nome: 'Desenhar', emoji: '🖍️', classe: 'acao' },
  { id: 'lanche', nome: 'Lanche', emoji: '🍎', classe: 'coisa', cardId: 'comer' },
  { id: 'agua', nome: 'Água', emoji: '💧', classe: 'coisa', cardId: 'agua' },
  { id: 'brincar', nome: 'Brincar', emoji: '⚽', classe: 'acao' },
  { id: 'banheiro', nome: 'Banheiro', emoji: '🚽', classe: 'coisa', cardId: 'banheiro' },
  { id: 'calmo', nome: 'Cantinho calmo', emoji: '🌙', classe: 'descricao' },
  { id: 'abafador', nome: 'Abafador', emoji: '🎧', classe: 'coisa' },
  { id: 'esperar', nome: 'Esperar', emoji: '⏳', classe: 'acao', cardId: 'esperar' },
  { id: 'casa', nome: 'Ir pra casa', emoji: '🏠', classe: 'pessoa' },
];

/** A ordem típica do culto. Ponto de partida, não regra. */
export const ROTINA_PADRAO = [
  'louvor',
  'oracao',
  'historia',
  'atividade',
  'lanche',
  'brincar',
  'casa',
];

export function figurinhaPorId(id: string): Figurinha | undefined {
  return FIGURINHAS.find((figurinha) => figurinha.id === id);
}
