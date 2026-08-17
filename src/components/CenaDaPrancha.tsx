import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { CARDS } from '../data/cards';
import type { CenaDaPrancha as Cena, Momento } from '../three/cenaDaPrancha';

/**
 * Palavras que o card protagonista mostra ao girar. Uma de cada classe
 * gramatical, para o painel percorrer as cores do Código Fitzgerald.
 */
const NO_GIRO = ['agua', 'oi', 'ajuda', 'eu', 'louvor', 'feliz'];

/**
 * Cards pequenos que flutuam ao redor. Lista longa de propósito: são catorze
 * na tela larga, e repetir emoji entre vizinhos entrega a repetição.
 */
const NO_CORO = [
  'comer',
  'banheiro',
  'obrigado',
  'quero',
  'parquinho',
  'dancar',
  'orar',
  'esperar',
  'voce',
  'quero-mais',
  'atividade',
  'acabou',
  'medo',
  'triste',
];

/** O emoji da palavra e a cor da sua classe gramatical. */
function palavra(id: string, cor: (nome: string) => string) {
  const card = CARDS.find((c) => c.id === id);
  if (!card) return null;
  return { emoji: card.emoji, cor: cor(`--color-${card.classe}`) || '#888888' };
}

interface Props {
  momento: Momento;
}

/**
 * Painel de identidade da tela de login. Decorativo do começo ao fim: se o
 * WebGL falhar ou o aparelho pedir menos movimento, some e o gradiente por
 * trás basta — entrar no app nunca depende disto.
 */
export function CenaDaPrancha({ momento }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cenaRef = useRef<Cena | null>(null);
  const semMovimento = useReducedMotion();
  const [quebrou, setQuebrou] = useState(false);

  useEffect(() => {
    if (semMovimento) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelado = false;

    void import('../three/cenaDaPrancha')
      .then(({ criarCenaDaPrancha }) => {
        if (cancelado) return;

        // As variáveis do CSS viram valores concretos só aqui: o three.js não
        // entende `var(--color-acao)` cru, e é este passo que faz a cena
        // acompanhar o tema claro ou escuro que a pessoa escolheu.
        const estilo = getComputedStyle(document.documentElement);
        const cor = (nome: string) => estilo.getPropertyValue(nome).trim();

        const giro = NO_GIRO.map((id) => palavra(id, cor)).filter((p) => p !== null);
        const coro = NO_CORO.map((id) => palavra(id, cor)).filter((p) => p !== null);
        const sim = palavra('sim', cor);
        const nao = palavra('nao', cor);
        if (giro.length === 0 || coro.length === 0 || !sim || !nao) return;

        cenaRef.current = criarCenaDaPrancha(
          canvas,
          { giro, coro, sim, nao },
          {
            fundo: cor('--color-fundo') || '#ffffff',
            superficie: cor('--color-superficie') || '#ffffff',
          },
        );
      })
      .catch(() => setQuebrou(true));

    return () => {
      cancelado = true;
      cenaRef.current?.encerrar();
      cenaRef.current = null;
    };
  }, [semMovimento]);

  // A cena só existe depois do `import()` resolver; até lá o momento fica
  // guardado no React e é aplicado no primeiro efeito que rodar com ela pronta.
  useEffect(() => {
    cenaRef.current?.definirMomento(momento);
  }, [momento]);

  if (semMovimento || quebrou) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {/* Véu na cor do fundo, denso onde o texto vive e transparente do outro
          lado: é ele que garante o contraste da leitura, em vez de apagar a
          cena inteira baixando a opacidade do canvas. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(68% 58% at 14% 42%, color-mix(in oklab, var(--color-fundo) 92%, transparent) 0%, color-mix(in oklab, var(--color-fundo) 55%, transparent) 46%, transparent 78%)',
        }}
      />
    </>
  );
}
