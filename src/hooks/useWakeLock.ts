import { useEffect } from 'react';

/**
 * Mantém a tela acesa enquanto a prancha está aberta. O bloqueio cai quando
 * a aba perde o foco, então é refeito no `visibilitychange`.
 */
export function useWakeLock(ativo: boolean) {
  useEffect(() => {
    if (!ativo || !('wakeLock' in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let cancelado = false;

    const pedir = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const novo = await navigator.wakeLock.request('screen');
        if (cancelado) {
          void novo.release();
          return;
        }
        lock = novo;
      } catch {
        // bateria fraca ou permissão negada: segue sem manter a tela acesa
      }
    };

    void pedir();
    document.addEventListener('visibilitychange', pedir);

    return () => {
      cancelado = true;
      document.removeEventListener('visibilitychange', pedir);
      void lock?.release();
    };
  }, [ativo]);
}
