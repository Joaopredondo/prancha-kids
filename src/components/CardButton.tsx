import { useState } from 'react';
import { motion } from 'motion/react';
import { temImagem as cardTemImagem } from '../assets/disponibilidade';
import type { Card } from '../types';

const BASE = import.meta.env.BASE_URL;

interface Props {
  card: Card;
  ativo: boolean;
  onTocar: (card: Card) => void;
}

export function CardButton({ card, ativo, onTocar }: Props) {
  // Sem foto própria em /img, o card mostra o emoji. `imagemFalhou` cobre o
  // caso raro de arquivo presente mas corrompido.
  const [imagemFalhou, setImagemFalhou] = useState(false);
  const temImagem = cardTemImagem(card.id) && !imagemFalhou;

  return (
    <motion.button
      type="button"
      data-classe={card.classe}
      onClick={() => onTocar(card)}
      whileTap={{ scale: 0.94 }}
      animate={ativo ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: 0.28 }}
      aria-label={card.label}
      className="flex aspect-[5/6] min-h-[5.5rem] cursor-pointer flex-col rounded-[1.6rem] border-[5px] p-2 pb-1.5 outline-none focus-visible:ring-4 focus-visible:ring-offset-2"
      style={{
        borderColor: 'var(--borda)',
        background: 'var(--color-superficie)',
        boxShadow: ativo
          ? '0 0 0 4px var(--borda), var(--sombra-card)'
          : 'var(--sombra-card)',
      }}
    >
      <span
        className="grid flex-1 place-items-center overflow-hidden rounded-[1.1rem]"
        style={{ background: 'var(--tinta)' }}
      >
        {temImagem ? (
          <img
            src={`${BASE}img/${card.id}.webp`}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            onError={() => setImagemFalhou(true)}
            className="h-full w-full object-contain p-1"
          />
        ) : (
          <span
            aria-hidden="true"
            style={{ fontSize: 'calc(var(--card-min, 8.5rem) * 0.42)', lineHeight: 1 }}
          >
            {card.emoji}
          </span>
        )}
      </span>

      <span
        className="mt-1.5 block text-center font-extrabold leading-tight text-balance"
        style={{
          fontSize: 'clamp(0.9rem, calc(var(--card-min, 8.5rem) * 0.145), 1.5rem)',
        }}
      >
        {card.label}
      </span>
    </motion.button>
  );
}
