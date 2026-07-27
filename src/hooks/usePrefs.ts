import { useCallback, useEffect, useState } from 'react';
import type { Prefs } from '../types';

const CHAVE = 'prancha-kids:prefs';

const PADRAO: Prefs = {
  categoria: 'essenciais',
  tamanho: 'm',
  tema: 'auto',
  som: true,
  telaAcesa: true,
};

function ler(): Prefs {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? { ...PADRAO, ...(JSON.parse(bruto) as Partial<Prefs>) } : PADRAO;
  } catch {
    return PADRAO;
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(ler);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(prefs));
    } catch {
      // modo privado / storage cheio: preferências só não persistem
    }
  }, [prefs]);

  const definir = useCallback(<K extends keyof Prefs>(chave: K, valor: Prefs[K]) => {
    setPrefs((atual) => ({ ...atual, [chave]: valor }));
  }, []);

  return { prefs, definir };
}
