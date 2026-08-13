import { enfileirar, ROTINA_GERAL } from './fila';
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

/**
 * Cada criança tem a sua rotina; sem criança escolhida, vale a rotina geral do
 * aparelho. A chave antiga (sem sufixo) continua sendo a geral, então nada do
 * que já estava salvo se perde.
 */
const chaveDe = (perfilId: string | null) => (perfilId ? `${CHAVE}:${perfilId}` : CHAVE);

type Salvo = { rotina: string[]; indice: number; dia: string };

const hoje = () => new Date().toISOString().slice(0, 10);

/** Lista de passos guardada para uma criança (ou para o aparelho). */
export function passosSalvos(perfilId: string | null = null): string[] {
  return lerRotina(perfilId === ROTINA_GERAL ? null : perfilId).rotina;
}

/** Grava vindo da nuvem, sem reenfileirar. */
export function guardarRotinaDaNuvem(perfilId: string, passos: string[]): void {
  if (passos.length === 0) return;
  const alvo = perfilId === ROTINA_GERAL ? null : perfilId;
  try {
    const atual = lerRotina(alvo);
    const salvo: Salvo = { rotina: passos, indice: atual.indice, dia: hoje() };
    localStorage.setItem(chaveDe(alvo), JSON.stringify(salvo));
  } catch {
    // Sem espaço: a rotina da tela continua valendo.
  }
}

export function lerRotina(perfilId: string | null = null): EstadoDaRotina {
  try {
    const bruto = localStorage.getItem(chaveDe(perfilId));
    if (!bruto) return rotinaInicial();

    const salvo = JSON.parse(bruto) as Partial<Salvo>;
    const passos = salvo.rotina?.length ? salvo.rotina : ROTINA_PADRAO;
    const indice = salvo.dia === hoje() ? (salvo.indice ?? 0) : 0;
    return rotinaInicial(passos, indice);
  } catch {
    return rotinaInicial();
  }
}

export function salvarRotina(estado: EstadoDaRotina, perfilId: string | null = null): void {
  try {
    const salvo: Salvo = { rotina: estado.rotina, indice: estado.indice, dia: hoje() };
    localStorage.setItem(chaveDe(perfilId), JSON.stringify(salvo));
    // O passo atual é do dia e não interessa aos outros aparelhos; a fila
    // carrega a lista de passos, que é o que se repete toda semana.
    enfileirar('rotinas', perfilId ?? ROTINA_GERAL);
  } catch {
    // Modo privado ou armazenamento cheio: a rotina da tela continua valendo.
  }
}
