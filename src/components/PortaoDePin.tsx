import { useState } from 'react';
import { conferirPin } from '../dados/seguranca';

/**
 * Tela que aparece no lugar da ficha e da frequência enquanto o código não for
 * digitado. Fica destrancado até fechar o app.
 */
export function PortaoDePin({ aoAbrir }: { aoAbrir: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState(false);

  const tentar = async (valor: string) => {
    if (valor.length < 4) return;
    if (await conferirPin(valor)) {
      aoAbrir();
      return;
    }
    setErro(true);
    setCodigo('');
  };

  return (
    <div className="flex flex-col items-center gap-4 px-4 pb-10 pt-8">
      <p className="text-center text-base font-bold">Área do voluntário</p>
      <p className="max-w-sm text-center text-sm" style={{ color: 'var(--color-texto-suave)' }}>
        Digite o código de 4 dígitos. Aqui ficam nome, idade e laudo das crianças.
      </p>

      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={codigo}
        aria-label="Código de 4 dígitos"
        onChange={(e) => {
          const limpo = e.target.value.replace(/\D/g, '').slice(0, 4);
          setCodigo(limpo);
          setErro(false);
          void tentar(limpo);
        }}
        className="min-h-16 w-40 rounded-2xl border-2 text-center text-3xl font-extrabold tracking-[0.4em]"
        style={{
          borderColor: erro ? 'var(--color-urgencia)' : 'var(--color-linha)',
          background: 'var(--color-superficie)',
        }}
      />

      {erro && (
        <p className="text-sm font-bold" style={{ color: 'var(--color-urgencia)' }}>
          Código errado.
        </p>
      )}
    </div>
  );
}
