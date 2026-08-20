import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Classe, Prefs, TamanhoCard, Tema } from '../types';

interface Props {
  aberto: boolean;
  prefs: Prefs;
  onDefinir: <K extends keyof Prefs>(chave: K, valor: Prefs[K]) => void;
  onFechar: () => void;
}

const TAMANHOS: { id: TamanhoCard; label: string }[] = [
  { id: 'p', label: 'Pequeno' },
  { id: 'm', label: 'Médio' },
  { id: 'g', label: 'Grande' },
];

const TEMAS: { id: Tema; label: string }[] = [
  { id: 'claro', label: '☀️ Claro' },
  { id: 'escuro', label: '🌙 Escuro' },
  { id: 'auto', label: '⚙️ Automático' },
];

const LEGENDA: { classe: Classe; label: string }[] = [
  { classe: 'acao', label: 'Ações' },
  { classe: 'coisa', label: 'Coisas' },
  { classe: 'descricao', label: 'Como estou' },
  { classe: 'social', label: 'Social' },
  { classe: 'pessoa', label: 'Pessoas' },
  { classe: 'urgencia', label: 'Parar / não' },
];

/**
 * Configurações da prancha em si — tamanho, cores, som.
 *
 * Fica sem trava de propósito: é o adulto ajustando junto com a criança, ao
 * vivo, não administração. O que é de adulto (ficha, equipe, conta, backup)
 * mora no `MenuLateral`, atrás do portão.
 */
export function SettingsSheet({ aberto, prefs, onDefinir, onFechar }: Props) {
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto, onFechar]);

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
            aria-label="Fechar configurações"
            onClick={onFechar}
            className="absolute inset-0 bg-black/40"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Configurações"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
            style={{ background: 'var(--color-superficie)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-extrabold">Configurações</h2>
              <button
                type="button"
                onClick={onFechar}
                className="rounded-full px-4 py-2 text-base font-bold"
                style={{ background: 'var(--color-fundo)' }}
              >
                Fechar
              </button>
            </div>

            <Escolha
              titulo="Tamanho dos cards"
              opcoes={TAMANHOS}
              valor={prefs.tamanho}
              onMudar={(valor) => onDefinir('tamanho', valor)}
            />

            <Escolha
              titulo="Cores da tela"
              opcoes={TEMAS}
              valor={prefs.tema}
              onMudar={(valor) => onDefinir('tema', valor)}
            />

            <section className="mb-5 space-y-2">
              <Interruptor
                label="Som ligado"
                ativo={prefs.som}
                onMudar={(v) => onDefinir('som', v)}
              />
              <Interruptor
                label="Manter a tela acesa"
                ativo={prefs.telaAcesa}
                onMudar={(v) => onDefinir('telaAcesa', v)}
              />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--color-texto-suave)' }}>
                O que as cores significam
              </h3>
              <ul className="grid grid-cols-2 gap-2">
                {LEGENDA.map((item) => (
                  <li key={item.classe} data-classe={item.classe} className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      className="h-5 w-5 shrink-0 rounded-md border-[3px]"
                      style={{ borderColor: 'var(--borda)', background: 'var(--tinta)' }}
                    />
                    {item.label}
                  </li>
                ))}
              </ul>
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Escolha<T extends string>({
  titulo,
  opcoes,
  valor,
  onMudar,
}: {
  titulo: string;
  opcoes: { id: T; label: string }[];
  valor: T;
  onMudar: (valor: T) => void;
}) {
  return (
    <section className="mb-5">
      <h3
        className="mb-2 text-sm font-bold uppercase tracking-wide"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        {titulo}
      </h3>
      <div className="flex gap-2">
        {opcoes.map((opcao) => {
          const ativa = opcao.id === valor;
          return (
            <button
              key={opcao.id}
              type="button"
              onClick={() => onMudar(opcao.id)}
              aria-pressed={ativa}
              className="flex-1 rounded-2xl border-2 px-2 py-3 font-bold"
              style={{
                borderColor: ativa ? 'var(--color-texto)' : 'var(--color-linha)',
                background: ativa ? 'var(--color-texto)' : 'transparent',
                color: ativa ? 'var(--color-fundo)' : 'var(--color-texto)',
              }}
            >
              {opcao.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Interruptor({
  label,
  ativo,
  onMudar,
}: {
  label: string;
  ativo: boolean;
  onMudar: (valor: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      onClick={() => onMudar(!ativo)}
      className="flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 font-bold"
      style={{ borderColor: 'var(--color-linha)' }}
    >
      {label}
      <span
        aria-hidden="true"
        className="relative h-7 w-12 rounded-full transition-colors"
        style={{ background: ativo ? 'var(--color-acao)' : 'var(--color-linha)' }}
      >
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
          style={{ left: ativo ? '1.5rem' : '0.25rem' }}
        />
      </span>
    </button>
  );
}
