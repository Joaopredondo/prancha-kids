import { ROTINA_PADRAO } from './figurinhas';
import { rotinaInicial, type EstadoDaRotina } from './rotina';

/**
 * Persistência da rotina do culto, em localStorage.
 *
 * A rotina é a mesma toda semana — redigitar a cada culto inviabiliza o uso.
 * Já o passo atual é do dia: guardado junto para sobreviver a um recarregamento
 * no meio do culto, mas zerado quando a data muda.
 */

const CHAVE = 'prancha-kids:rotina';

type Salvo = { rotina: string[]; indice: number; dia: string };

const hoje = () => new Date().toISOString().slice(0, 10);

export function lerRotina(): EstadoDaRotina {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return rotinaInicial();

    const salvo = JSON.parse(bruto) as Partial<Salvo>;
    const passos = salvo.rotina?.length ? salvo.rotina : ROTINA_PADRAO;
    const indice = salvo.dia === hoje() ? (salvo.indice ?? 0) : 0;
    return rotinaInicial(passos, indice);
  } catch {
    return rotinaInicial();
  }
}

export function salvarRotina(estado: EstadoDaRotina): void {
  try {
    const salvo: Salvo = { rotina: estado.rotina, indice: estado.indice, dia: hoje() };
    localStorage.setItem(CHAVE, JSON.stringify(salvo));
  } catch {
    // Modo privado ou armazenamento cheio: a rotina da tela continua valendo.
  }
}
