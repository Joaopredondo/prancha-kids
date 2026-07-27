import type { Card } from '../types';
import { CardButton } from './CardButton';

interface Props {
  cards: Card[];
  cardAtivo: string | null;
  onTocar: (card: Card) => void;
}

export function Board({ cards, cardAtivo, onTocar }: Props) {
  return (
    <div
      className="grid gap-3 px-3 pb-6 sm:gap-4 sm:px-4"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(var(--card-min, 8.5rem), 1fr))',
      }}
    >
      {cards.map((card) => (
        <CardButton
          key={card.id}
          card={card}
          ativo={cardAtivo === card.id}
          onTocar={onTocar}
        />
      ))}
    </div>
  );
}
