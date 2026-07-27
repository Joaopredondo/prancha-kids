import { useEffect } from 'react';
import type { Tema } from '../types';

/** Mesmas cores de fundo definidas em index.css. */
const COR_DA_BARRA = { claro: '#fbf7f0', escuro: '#16150f' };

/**
 * Marca o tema escolhido na raiz do documento (o CSS faz o resto) e mantém a
 * cor da barra do navegador combinando com a tela.
 */
export function useTema(tema: Tema) {
  useEffect(() => {
    document.documentElement.dataset.tema = tema;

    const sistema = window.matchMedia('(prefers-color-scheme: dark)');
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

    const aplicar = () => {
      if (!meta) return;
      const escuro = tema === 'escuro' || (tema === 'auto' && sistema.matches);
      meta.content = escuro ? COR_DA_BARRA.escuro : COR_DA_BARRA.claro;
    };

    aplicar();
    if (tema !== 'auto') return;

    sistema.addEventListener('change', aplicar);
    return () => sistema.removeEventListener('change', aplicar);
  }, [tema]);
}
