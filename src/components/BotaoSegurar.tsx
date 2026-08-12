import { useCallback, useEffect, useRef, useState } from 'react';

/** Regra herdada do Lume: a ficha abre só depois de segurar por 3 segundos. */
export const TEMPO_DE_ESPERA_MS = 3000;

interface Props {
  rotulo: string;
  ativo: boolean;
  aoCompletar: () => void;
  emoji?: string;
}

/**
 * Botão que só age depois de mantido pressionado.
 *
 * Existe para a criança não cair na ficha — que tem nome, idade e laudo —
 * enquanto mexe no tablet. O progresso é mostrado porque um botão que "não
 * funciona" ao toque simples é indistinguível de um botão quebrado.
 */
export function BotaoSegurar({ rotulo, ativo, aoCompletar, emoji = '📋' }: Props) {
  const [progresso, setProgresso] = useState(0);
  const inicio = useRef<number | null>(null);
  const quadro = useRef<number | null>(null);

  const soltar = useCallback(() => {
    inicio.current = null;
    if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    quadro.current = null;
    setProgresso(0);
  }, []);

  const segurar = useCallback(() => {
    if (inicio.current !== null) return;
    inicio.current = Date.now();

    const passo = () => {
      if (inicio.current === null) return;
      const fracao = Math.min(1, (Date.now() - inicio.current) / TEMPO_DE_ESPERA_MS);
      setProgresso(fracao);

      if (fracao >= 1) {
        soltar();
        aoCompletar();
        return;
      }
      quadro.current = requestAnimationFrame(passo);
    };

    quadro.current = requestAnimationFrame(passo);
  }, [aoCompletar, soltar]);

  useEffect(() => soltar, [soltar]);

  return (
    <button
      type="button"
      onPointerDown={segurar}
      onPointerUp={soltar}
      onPointerLeave={soltar}
      onPointerCancel={soltar}
      // Teclado e acionador não conseguem "segurar": para eles, Enter/Espaço
      // abre direto. A trava é contra toque acidental, não contra o voluntário.
      onKeyDown={(evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          aoCompletar();
        }
      }}
      aria-current={ativo ? 'page' : undefined}
      className="relative flex shrink-0 snap-start items-center gap-2 overflow-hidden rounded-full border-2 px-4 py-2.5 text-base font-bold"
      style={{
        borderColor: ativo ? 'transparent' : 'var(--color-linha)',
        background: ativo ? 'var(--color-texto)' : 'var(--color-superficie)',
        color: ativo ? 'var(--color-fundo)' : 'var(--color-texto-suave)',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0"
        style={{ width: `${progresso * 100}%`, background: 'var(--color-acao)', opacity: 0.35 }}
      />
      <span className="relative flex items-center gap-2">
        <span aria-hidden="true" className="text-lg">
          {emoji}
        </span>
        {rotulo}
        {progresso > 0 && ' — segure'}
      </span>
    </button>
  );
}
