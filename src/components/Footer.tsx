/**
 * Fica depois do grid, em texto pequeno e apagado: o adulto rola até aqui,
 * a criança não.
 */
export function Footer() {
  return (
    <footer
      className="mt-4 border-t px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-xs leading-relaxed"
      style={{ borderColor: 'var(--color-linha)', color: 'var(--color-texto-suave)' }}
    >
      <p className="font-bold">Prancha Kids</p>
      <p className="mt-1">Desenvolvido por João Pedro Redondo</p>
    </footer>
  );
}
