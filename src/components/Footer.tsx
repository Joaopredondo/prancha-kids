const LINKEDIN = 'https://www.linkedin.com/in/joaopedroredondo/';

/**
 * Fica depois do grid, em texto pequeno e apagado: o adulto rola até aqui,
 * a criança não.
 */
export function Footer() {
  return (
    <footer
      className="mt-4 flex items-center justify-between gap-4 border-t px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-xs leading-relaxed"
      style={{ borderColor: 'var(--color-linha)', color: 'var(--color-texto-suave)' }}
    >
      <div>
        <p className="font-bold">Prancha Kids</p>
        <p className="mt-1">Desenvolvido por João Pedro Redondo</p>
      </div>

      <a
        href={LINKEDIN}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="LinkedIn de João Pedro Redondo"
        className="grid size-10 shrink-0 place-items-center rounded-xl border-2 transition-colors"
        style={{ borderColor: 'var(--color-linha)', background: 'var(--color-superficie)' }}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="currentColor"
          className="size-5"
        >
          <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
        </svg>
      </a>
    </footer>
  );
}
