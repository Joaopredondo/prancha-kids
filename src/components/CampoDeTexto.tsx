/**
 * Campo de texto do portão.
 *
 * Vive fora do `PortaoDoVoluntario` porque o formulário de convite usa os
 * mesmos campos e importar de lá fecharia um ciclo — o portão já importa o
 * convite.
 *
 * A altura mínima de 56px não é estética: quem preenche isto muitas vezes está
 * de pé, segurando o tablet com uma mão, no meio do culto.
 */
export function CampoDeTexto({
  rotulo,
  tipo,
  valor,
  aoMudar,
  aoFocar,
  aoSair,
  autoCompletar,
  invalido,
  dica,
  auxilio,
  desativado,
}: {
  rotulo: string;
  tipo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  aoFocar?: () => void;
  aoSair?: () => void;
  autoCompletar: string;
  invalido?: boolean;
  /** Mensagem de erro, em vermelho. */
  dica?: string;
  /** Explicação neutra, sempre visível — não é erro. */
  auxilio?: string;
  desativado?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{rotulo}</span>
      <input
        type={tipo}
        value={valor}
        autoComplete={autoCompletar}
        aria-invalid={invalido || undefined}
        disabled={desativado}
        onChange={(e) => aoMudar(e.target.value)}
        onFocus={aoFocar}
        onBlur={aoSair}
        className="mt-1 min-h-14 w-full rounded-2xl border-2 px-4 text-base focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        style={{
          borderColor: invalido ? 'var(--color-urgencia)' : 'var(--color-linha)',
          background: 'var(--color-superficie)',
        }}
      />
      {dica && (
        <span
          role="alert"
          className="mt-1 block text-xs font-bold"
          style={{ color: 'var(--color-urgencia)' }}
        >
          {dica}
        </span>
      )}
      {!dica && auxilio && (
        <span className="mt-1 block text-xs" style={{ color: 'var(--color-texto-suave)' }}>
          {auxilio}
        </span>
      )}
    </label>
  );
}
