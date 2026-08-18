import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Celebracao as Cena } from '../three/celebracao';

const DURACAO_MS = 2600;

interface Props {
  aberto: boolean;
  aoFechar: () => void;
}

/**
 * Comemoração de "ficha salva" — troféu e balões por alguns segundos.
 *
 * É reconhecimento do registro em si, para o voluntário: a ficha não tem nota
 * nem escore de criança (ver `dados/frequencia.ts`), e isto não é um placar.
 *
 * Decorativo do começo ao fim, como o painel de login: se o WebGL falhar ou o
 * aparelho pedir menos movimento, cai para um aviso de texto simples — a ficha
 * já foi salva de qualquer forma antes desta tela aparecer.
 */
export function Celebracao({ aberto, aoFechar }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cenaRef = useRef<Cena | null>(null);
  const semMovimento = useReducedMotion();
  const [quebrou, setQuebrou] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const id = window.setTimeout(aoFechar, DURACAO_MS);
    return () => window.clearTimeout(id);
  }, [aberto, aoFechar]);

  useEffect(() => {
    if (!aberto || semMovimento) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelado = false;
    void import('../three/celebracao')
      .then(({ criarCelebracao }) => criarCelebracao(canvas))
      .then((cena) => {
        if (cancelado) {
          cena.encerrar();
          return;
        }
        cenaRef.current = cena;
      })
      .catch(() => setQuebrou(true));

    return () => {
      cancelado = true;
      cenaRef.current?.encerrar();
      cenaRef.current = null;
    };
  }, [aberto, semMovimento]);

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={aoFechar}
          className="fixed inset-0 z-50 grid cursor-pointer place-items-center"
          style={{ background: 'color-mix(in oklab, var(--color-fundo) 80%, transparent)' }}
        >
          {!semMovimento && !quebrou && (
            <canvas
              ref={canvasRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          )}
          <motion.p
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="relative z-10 rounded-full px-6 py-3 text-lg font-extrabold"
            style={{
              background: 'var(--color-superficie)',
              color: 'var(--color-texto)',
              boxShadow: 'var(--sombra-card)',
            }}
          >
            Ficha salva! 🎉
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
