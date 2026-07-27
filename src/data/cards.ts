import type { Card, CategoriaInfo } from '../types';

export const CATEGORIAS: CategoriaInfo[] = [
  { id: 'essenciais', label: 'Essenciais', emoji: '⭐' },
  { id: 'corpo', label: 'Corpo', emoji: '🫀' },
  { id: 'sentimentos', label: 'Sentimentos', emoji: '😀' },
  { id: 'acoes', label: 'Brincar', emoji: '🛝' },
  { id: 'igreja', label: 'Igreja', emoji: '⛪' },
];

/**
 * A ordem deste array é a posição do card na prancha e NÃO deve mudar:
 * a criança memoriza onde cada figura fica. Cards novos entram no fim
 * da sua categoria.
 */
export const CARDS: Card[] = [
  // Essenciais
  { id: 'sim', label: 'Sim', emoji: '👍', categoria: 'essenciais', classe: 'social' },
  { id: 'nao', label: 'Não', emoji: '👎', categoria: 'essenciais', classe: 'urgencia' },
  { id: 'oi', label: 'Oi', emoji: '👋', categoria: 'essenciais', classe: 'social' },
  { id: 'obrigado', label: 'Obrigado', emoji: '😊', categoria: 'essenciais', classe: 'social' },
  { id: 'eu', label: 'Eu', emoji: '🧒', categoria: 'essenciais', classe: 'pessoa' },
  { id: 'voce', label: 'Você', emoji: '👉', categoria: 'essenciais', classe: 'pessoa' },
  { id: 'quero', label: 'Quero', emoji: '🤲', categoria: 'essenciais', classe: 'acao' },
  { id: 'eu-quero', label: 'Eu quero', emoji: '🙋', categoria: 'essenciais', classe: 'acao' },
  { id: 'quero-mais', label: 'Quero mais', emoji: '➕', categoria: 'essenciais', classe: 'acao' },
  { id: 'ajuda', label: 'Ajuda', emoji: '🤝', categoria: 'essenciais', classe: 'acao' },
  { id: 'acabou', label: 'Acabou', emoji: '🏁', categoria: 'essenciais', classe: 'urgencia' },
  { id: 'parar', label: 'Parar', emoji: '🛑', categoria: 'essenciais', classe: 'urgencia' },
  { id: 'esperar', label: 'Esperar', emoji: '⏳', categoria: 'essenciais', classe: 'acao' },

  // Corpo & Sensações
  { id: 'agua', label: 'Água', emoji: '💧', categoria: 'corpo', classe: 'coisa' },
  { id: 'fome', label: 'Fome', fala: 'Estou com fome', emoji: '🍽️', categoria: 'corpo', classe: 'descricao' },
  { id: 'banheiro', label: 'Banheiro', emoji: '🚽', categoria: 'corpo', classe: 'coisa' },
  { id: 'doendo', label: 'Doendo', fala: 'Está doendo', emoji: '🤕', categoria: 'corpo', classe: 'descricao' },
  { id: 'frio', label: 'Frio', fala: 'Estou com frio', emoji: '🥶', categoria: 'corpo', classe: 'descricao' },
  { id: 'quente', label: 'Quente', fala: 'Está quente', emoji: '🔥', categoria: 'corpo', classe: 'descricao' },
  { id: 'calor', label: 'Calor', fala: 'Estou com calor', emoji: '🥵', categoria: 'corpo', classe: 'descricao' },
  { id: 'barulho', label: 'Barulho', emoji: '🔊', categoria: 'corpo', classe: 'coisa' },

  // Sentimentos
  { id: 'feliz', label: 'Feliz', fala: 'Estou feliz', emoji: '😀', categoria: 'sentimentos', classe: 'descricao' },
  { id: 'triste', label: 'Triste', fala: 'Estou triste', emoji: '😢', categoria: 'sentimentos', classe: 'descricao' },
  { id: 'bravo', label: 'Bravo', fala: 'Estou bravo', emoji: '😠', categoria: 'sentimentos', classe: 'descricao' },
  { id: 'nervoso', label: 'Nervoso', fala: 'Estou nervoso', emoji: '😰', categoria: 'sentimentos', classe: 'descricao' },
  { id: 'medo', label: 'Medo', fala: 'Estou com medo', emoji: '😨', categoria: 'sentimentos', classe: 'descricao' },

  // Ações & Brincar
  { id: 'comer', label: 'Comer', emoji: '🍴', categoria: 'acoes', classe: 'acao' },
  { id: 'pegar', label: 'Pegar', emoji: '🫴', categoria: 'acoes', classe: 'acao' },
  { id: 'subir', label: 'Subir', emoji: '🪜', categoria: 'acoes', classe: 'acao' },
  { id: 'dancar', label: 'Dançar', emoji: '💃', categoria: 'acoes', classe: 'acao' },
  { id: 'sair', label: 'Sair', emoji: '🚪', categoria: 'acoes', classe: 'acao' },
  { id: 'parquinho', label: 'Parquinho', emoji: '🛝', categoria: 'acoes', classe: 'coisa' },
  { id: 'atividade', label: 'Atividade', emoji: '✏️', categoria: 'acoes', classe: 'coisa' },

  // Igreja & Família
  { id: 'orar', label: 'Orar', emoji: '🙏', categoria: 'igreja', classe: 'acao' },
  { id: 'louvor', label: 'Louvor', emoji: '🎶', categoria: 'igreja', classe: 'coisa' },
  { id: 'ir-com-a-mamae', label: 'Ir com a mamãe', emoji: '👩', categoria: 'igreja', classe: 'pessoa' },
  { id: 'ir-com-o-papai', label: 'Ir com o papai', emoji: '👨', categoria: 'igreja', classe: 'pessoa' },
];

export const falaDoCard = (card: Card) => card.fala ?? card.label;
