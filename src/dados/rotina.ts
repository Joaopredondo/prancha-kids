import { ROTINA_PADRAO } from './figurinhas';

/**
 * Estado da rotina do culto — portado do Lume.
 *
 * Puro e sem React, para o comportamento ser testável sem montar tela: o que
 * importa aqui é a regra, não o desenho.
 */
export type EstadoDaRotina = {
  rotina: string[];
  indice: number;
};

export function rotinaInicial(passos: string[] = ROTINA_PADRAO, indice = 0): EstadoDaRotina {
  return { rotina: [...passos], indice: Math.min(indice, Math.max(0, passos.length - 1)) };
}

export function agora(estado: EstadoDaRotina): string | undefined {
  return estado.rotina[estado.indice];
}

export function depois(estado: EstadoDaRotina): string | undefined {
  return estado.rotina[estado.indice + 1];
}

export function estaNoFim(estado: EstadoDaRotina): boolean {
  return estado.indice >= estado.rotina.length - 1;
}

/**
 * Avança um passo. **Não passa do último** — a rotina termina, não dá a volta.
 * Voltar ao início sozinho faria a criança achar que o culto recomeçou.
 */
export function avancar(estado: EstadoDaRotina): EstadoDaRotina {
  if (estaNoFim(estado)) return estado;
  return { ...estado, indice: estado.indice + 1 };
}

export function voltar(estado: EstadoDaRotina): EstadoDaRotina {
  return { ...estado, indice: Math.max(0, estado.indice - 1) };
}

/** Troca a figurinha de um dos dois espaços do quadro. */
export function colocar(
  estado: EstadoDaRotina,
  id: string,
  espaco: 'agora' | 'depois',
): EstadoDaRotina {
  const alvo = espaco === 'agora' ? estado.indice : estado.indice + 1;
  const rotina = [...estado.rotina];

  // Soltar em "depois" quando não existe próximo passo estende a fila, em vez
  // de perder o gesto: é como o voluntário monta a rotina no quadro físico.
  if (alvo >= rotina.length) rotina.push(id);
  else rotina[alvo] = id;

  return { ...estado, rotina };
}

/** Remove um passo da fila. Não deixa a rotina ficar vazia. */
export function remover(estado: EstadoDaRotina, posicao: number): EstadoDaRotina {
  if (estado.rotina.length <= 1) return estado;
  const rotina = estado.rotina.filter((_, i) => i !== posicao);
  return { rotina, indice: Math.min(estado.indice, rotina.length - 1) };
}

/** Quantos passos já foram cumpridos, sobre o total. */
export function progresso(estado: EstadoDaRotina): [number, number] {
  return [estado.indice, estado.rotina.length];
}
