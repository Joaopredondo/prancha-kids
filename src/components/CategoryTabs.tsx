import { CATEGORIAS } from '../data/cards';
import type { Categoria } from '../types';

type Aba = Categoria | 'tudo';

interface Props {
  atual: Aba;
  onMudar: (aba: Aba) => void;
}

const ABAS: { id: Aba; label: string; emoji: string }[] = [
  ...CATEGORIAS,
  { id: 'tudo', label: 'Tudo', emoji: '🔎' },
];

export function CategoryTabs({ atual, onMudar }: Props) {
  return (
    <nav
      aria-label="Categorias"
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-3 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {ABAS.map((aba) => {
        const ativa = aba.id === atual;
        return (
          <button
            key={aba.id}
            type="button"
            onClick={() => onMudar(aba.id)}
            aria-current={ativa ? 'page' : undefined}
            className="flex shrink-0 snap-start items-center gap-2 rounded-full border-2 px-4 py-2.5 text-base font-bold transition-colors"
            style={{
              borderColor: ativa ? 'transparent' : 'var(--color-linha)',
              background: ativa ? 'var(--color-texto)' : 'var(--color-superficie)',
              color: ativa ? 'var(--color-fundo)' : 'var(--color-texto-suave)',
            }}
          >
            <span aria-hidden="true" className="text-lg">
              {aba.emoji}
            </span>
            {aba.label}
          </button>
        );
      })}
    </nav>
  );
}
