import { useCallback, useEffect, useState } from 'react';
import { quantasPendencias } from '../dados/fila';
import { sincronizar, type Resultado } from '../dados/sincronizacao';

const INTERVALO_MS = 3 * 60 * 1000;

/**
 * Sincroniza sozinho: ao entrar, quando a internet volta e de tempos em tempos.
 *
 * Nunca bloqueia a tela e nunca avisa erro no meio do culto — falhar é normal
 * (wifi de igreja), e a próxima tentativa resolve. O que fica visível é a
 * contagem de pendências.
 */
export function useSincronizacao(ministerioId: string | null) {
  const [pendentes, setPendentes] = useState(() => quantasPendencias());
  const [ocupado, setOcupado] = useState(false);
  const [ultimo, setUltimo] = useState<Resultado | null>(null);

  const rodar = useCallback(async () => {
    if (!ministerioId) return;
    setOcupado(true);
    const resultado = await sincronizar(ministerioId);
    setUltimo(resultado);
    setPendentes(quantasPendencias());
    setOcupado(false);
    return resultado;
  }, [ministerioId]);

  useEffect(() => {
    if (!ministerioId) return;

    void rodar();
    const relogio = window.setInterval(() => void rodar(), INTERVALO_MS);
    const aoVoltar = () => void rodar();
    window.addEventListener('online', aoVoltar);

    // A contagem também muda por gravação em outra tela.
    const contador = window.setInterval(() => setPendentes(quantasPendencias()), 2000);

    return () => {
      window.clearInterval(relogio);
      window.clearInterval(contador);
      window.removeEventListener('online', aoVoltar);
    };
  }, [ministerioId, rodar]);

  return { pendentes, ocupado, ultimo, sincronizarAgora: rodar };
}
