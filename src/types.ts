/** Classe gramatical — define a cor do card (código Fitzgerald, padrão em CAA). */
export type Classe =
  | 'acao'
  | 'coisa'
  | 'descricao'
  | 'social'
  | 'pessoa'
  | 'urgencia';

/** Aba temática onde o card aparece. */
export type Categoria =
  | 'essenciais'
  | 'corpo'
  | 'sentimentos'
  | 'acoes'
  | 'igreja';

export interface Card {
  /** Deriva os assets: /audio/{id}.mp3 e /img/{id}.webp */
  id: string;
  label: string;
  /** Texto falado, quando diferente do label. */
  fala?: string;
  /** Exibido enquanto não existe imagem própria em /img. */
  emoji: string;
  categoria: Categoria;
  classe: Classe;
}

export interface CategoriaInfo {
  id: Categoria;
  label: string;
  emoji: string;
}

export type TamanhoCard = 'p' | 'm' | 'g';

export interface Prefs {
  categoria: Categoria | 'tudo';
  tamanho: TamanhoCard;
  som: boolean;
  telaAcesa: boolean;
}
