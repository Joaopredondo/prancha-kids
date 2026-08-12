import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CATEGORIAS } from '../data/cards';
import type { Categoria } from '../types';
import { BotaoSegurar } from './BotaoSegurar';

export type Aba = Categoria | 'tudo';
export type Vista = 'prancha' | 'agora' | 'ficha';

interface Props {
  vista: Vista;
  aba: Aba;
  onAba: (aba: Aba) => void;
  onAgora: () => void;
  onFicha: () => void;
}

const ABAS: { id: Aba; label: string; emoji: string }[] = [
  ...CATEGORIAS,
  { id: 'tudo', label: 'Tudo', emoji: '🔎' },
];

/**
 * Menu principal: "Prancha" abre a lista de categorias; a ficha do culto fica
 * ao lado, como irmã, e não dentro da prancha — são dois usos diferentes, um da
 * criança e outro do voluntário.
 */
export function MainNav({ vista, aba, onAba, onAgora, onFicha }: Props) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    const aoTocarFora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };

    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('pointerdown', aoTocarFora);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('pointerdown', aoTocarFora);
    };
  }, [aberto]);

  const atual = ABAS.find((item) => item.id === aba) ?? ABAS[0];
  const naPrancha = vista === 'prancha';

  return (
    // Quebra de linha em vez de rolagem horizontal: com barra rolável o botão
    // da ficha ficava cortado no celular, e ele precisa ser segurado por 3s.
    <nav aria-label="Menu principal" className="flex flex-wrap gap-2 px-3 pb-3 sm:px-4">
      <div ref={caixa} className="relative">
        <button
          type="button"
          // Estando fora da prancha, o primeiro toque volta para ela — abrir o
          // submenu e deixar a tela como estava parece que o botão não funciona.
          // Já na prancha, o toque abre e fecha a lista de categorias.
          onClick={() => {
            if (!naPrancha) {
              onAba(aba);
              setAberto(false);
              return;
            }
            setAberto((estava) => !estava);
          }}
          aria-expanded={naPrancha ? aberto : false}
          aria-haspopup="menu"
          aria-current={naPrancha ? 'page' : undefined}
          className="flex items-center gap-2 whitespace-nowrap rounded-full border-2 px-4 py-2.5 text-base font-bold"
          style={{
            borderColor: naPrancha ? 'transparent' : 'var(--color-linha)',
            background: naPrancha ? 'var(--color-texto)' : 'var(--color-superficie)',
            color: naPrancha ? 'var(--color-fundo)' : 'var(--color-texto-suave)',
          }}
        >
          <span aria-hidden="true" className="text-lg">
            {naPrancha ? atual.emoji : '🗂️'}
          </span>
          Prancha
          {naPrancha && (
            <span className="hidden font-normal opacity-70 sm:inline">· {atual.label}</span>
          )}
          <span aria-hidden="true" className="text-xs">
            ▾
          </span>
        </button>

        <AnimatePresence>
          {aberto && (
            <motion.ul
              role="menu"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full z-40 mt-2 flex w-56 flex-col gap-1 rounded-3xl border-2 p-2"
              style={{
                borderColor: 'var(--color-linha)',
                background: 'var(--color-superficie)',
                boxShadow: 'var(--sombra-card)',
              }}
            >
              {ABAS.map((item) => {
                const ativa = naPrancha && item.id === aba;
                return (
                  <li key={item.id} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onAba(item.id);
                        setAberto(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-left text-base font-bold"
                      style={{
                        background: ativa ? 'var(--color-texto)' : 'transparent',
                        color: ativa ? 'var(--color-fundo)' : 'var(--color-texto)',
                      }}
                    >
                      <span aria-hidden="true" className="text-lg">
                        {item.emoji}
                      </span>
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={onAgora}
        aria-current={vista === 'agora' ? 'page' : undefined}
        className="flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-full border-2 px-4 py-2.5 text-base font-bold"
        style={{
          borderColor: vista === 'agora' ? 'transparent' : 'var(--color-linha)',
          background: vista === 'agora' ? 'var(--color-texto)' : 'var(--color-superficie)',
          color: vista === 'agora' ? 'var(--color-fundo)' : 'var(--color-texto-suave)',
        }}
      >
        <span aria-hidden="true" className="text-lg">
          ⏭️
        </span>
        Agora e depois
      </button>

      <BotaoSegurar rotulo="Ficha do culto" ativo={vista === 'ficha'} aoCompletar={onFicha} />
    </nav>
  );
}
