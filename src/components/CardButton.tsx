import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { temImagem as cardTemImagem } from '../assets/disponibilidade';
import type { Card } from '../types';

const BASE = import.meta.env.BASE_URL;

interface Props {
  card: Card;
  ativo: boolean;
  /** Este card é o que está falando agora. */
  falando: boolean;
  onTocar: (card: Card) => void;
}

export function CardButton({ card, ativo, falando, onTocar }: Props) {
  const semMovimento = useReducedMotion();
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
      className="relative flex aspect-[5/6] min-h-[5.5rem] cursor-pointer flex-col rounded-[1.6rem] border-[5px] p-2 pb-1.5 outline-none focus-visible:ring-4 focus-visible:ring-offset-2"
      style={{
        borderColor: 'var(--borda)',
        background: 'var(--color-superficie)',
        boxShadow: ativo
          ? '0 0 0 4px var(--borda), var(--sombra-card)'
          : 'var(--sombra-card)',
      }}
    >
      {/* Enquanto a palavra sai, o card pulsa.
          O volume do tablet vive baixo no meio do culto e há criança com perda
          auditiva parcial: sem este sinal, card que falou e card mudo ficam
          idênticos na tela, e a criança repete o toque achando que não pegou.
          Fica na cor da classe gramatical porque é a cor que ela já associa a
          este card — não introduz um código novo. */}
      <AnimatePresence>
        {falando && !semMovimento && (
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.55, 0, 0.55], scale: [1, 1.09, 1] }}
            // A saída precisa da própria transição: herdar a de baixo traria
            // junto o `repeat: Infinity`, e uma saída que nunca termina deixa o
            // anel montado para sempre depois que a fala acaba.
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
            className="pointer-events-none absolute -inset-1 rounded-[1.9rem]"
            style={{ border: '4px solid var(--borda)' }}
          />
        )}
      </AnimatePresence>

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
