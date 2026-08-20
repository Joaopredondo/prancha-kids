import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface Props {
  aberto: boolean;
  nomeDaCrianca: string;
  texto: string;
  onFechar: () => void;
}

/**
 * Folha com o cartão do culto pronto, para o voluntário revisar antes de
 * mandar — nunca sai sozinho.
 *
 * `navigator.share` (quando existe) entrega o texto pronto pro WhatsApp/SMS
 * do próprio aparelho; sem isso, "Copiar" bota na área de transferência.
 * Nenhum dos dois caminhos passa por servidor — o cartão nunca vira link.
 */
export function CartaoDoCulto({ aberto, nomeDaCrianca, texto, onFechar }: Props) {
  const [copiado, setCopiado] = useState(false);
  const podeCompartilhar = typeof navigator !== 'undefined' && Boolean(navigator.share);

  useEffect(() => {
    if (!aberto) return;
    setCopiado(false);
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto, onFechar]);

  const compartilhar = async () => {
    try {
      await navigator.share({ text: texto, title: `Hoje no Kids — ${nomeDaCrianca}` });
    } catch {
      // Cancelou o compartilhamento ou o navegador recusou — nada a fazer,
      // o texto continua na tela para copiar manualmente.
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Fechar cartão do culto"
            onClick={onFechar}
            className="absolute inset-0 bg-black/40"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Cartão do culto"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
            style={{ background: 'var(--color-superficie)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-extrabold">📤 Cartão do culto</h2>
              <button
                type="button"
                onClick={onFechar}
                className="rounded-full px-4 py-2 text-base font-bold"
                style={{ background: 'var(--color-fundo)' }}
              >
                Fechar
              </button>
            </div>

            <p className="mb-3 text-xs" style={{ color: 'var(--color-texto-suave)' }}>
              Confira antes de enviar — nada aqui sai sozinho.
            </p>

            <pre
              className="mb-4 whitespace-pre-wrap rounded-2xl border-2 p-4 font-sans text-sm"
              style={{ borderColor: 'var(--color-linha)', background: 'var(--color-fundo)' }}
            >
              {texto}
            </pre>

            <div className="flex gap-2">
              {podeCompartilhar && (
                <button
                  type="button"
                  onClick={() => void compartilhar()}
                  className="min-h-11 flex-1 cursor-pointer rounded-full px-4 text-sm font-bold text-white"
                  style={{ background: 'var(--color-acao)' }}
                >
                  Compartilhar
                </button>
              )}
              <button
                type="button"
                onClick={() => void copiar()}
                className="min-h-11 flex-1 cursor-pointer rounded-full border-2 px-4 text-sm font-bold"
                style={{ borderColor: 'var(--color-linha)' }}
              >
                {copiado ? 'Copiado ✓' : 'Copiar texto'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
