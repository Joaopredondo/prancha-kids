import { registrarEvento } from './eventos';
import { enfileirar } from './fila';
import type { Ficha } from './ficha';

/**
 * Persistência da ficha do culto.
 *
 * Fica só no aparelho, em localStorage — não há servidor, conta nem envio para
 * lugar nenhum. Limpar os dados do navegador apaga tudo.
 *
 * Salvar **nunca valida campo obrigatório** e **nunca sobrescreve outra ficha**:
 * a gravação é por `id`, que é sorteado na criação e não muda. Ficha pela
 * metade é melhor que ficha não preenchida, e o culto acaba antes do formulário.
 */

const CHAVE = 'prancha-kids:fichas';

function ler(): Record<string, Ficha> {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as Record<string, Ficha>) : {};
  } catch {
    return {};
  }
}

function gravar(fichas: Record<string, Ficha>) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(fichas));
  } catch {
    // Modo privado ou armazenamento cheio: a ficha da tela continua válida.
  }
}

/** Fichas salvas, da mais recente para a mais antiga. */
export function listarFichas(): Ficha[] {
  return Object.values(ler())
    .filter((ficha) => !ficha.apagadoEm)
    .sort((a, b) => b.data - a.data);
}

/** Inclui as apagadas: a sincronização precisa propagar a exclusão. */
export const listarFichasComApagadas = (): Ficha[] => Object.values(ler());

export const fichaPorId = (id: string): Ficha | undefined => ler()[id];

/** Grava vindo da nuvem, sem reenfileirar: senão os dois lados se empurram. */
export function guardarFichaDaNuvem(ficha: Ficha): void {
  const fichas = ler();
  fichas[ficha.id] = ficha;
  gravar(fichas);
}

export const diaDaFicha = (ficha: Ficha) => new Date(ficha.data).toISOString().slice(0, 10);

export type Filtro = {
  /** `null` = todas as crianças; `'sem-perfil'` = fichas sem cadastro. */
  perfilId: string | null;
  /** `null` = todos os dias; senão `YYYY-MM-DD`. */
  dia: string | null;
  /** `null` = todos os cultos; senão o horário. */
  horario: string | null;
};

export function filtrarFichas(fichas: Ficha[], filtro: Filtro): Ficha[] {
  return fichas.filter((ficha) => {
    if (filtro.perfilId === 'sem-perfil' && ficha.perfilId) return false;
    if (filtro.perfilId && filtro.perfilId !== 'sem-perfil' && ficha.perfilId !== filtro.perfilId)
      return false;
    if (filtro.dia && diaDaFicha(ficha) !== filtro.dia) return false;
    if (filtro.horario && ficha.horario !== filtro.horario) return false;
    return true;
  });
}

/** Dias que têm ficha, do mais recente para o mais antigo. */
export function diasComFicha(fichas: Ficha[]): string[] {
  return [...new Set(fichas.map(diaDaFicha))].sort().reverse();
}

/** Apaga o cadastro junto com as fichas dele — o botão não pode mentir. */
export function apagarFichasDoPerfil(perfilId: string): number {
  const fichas = ler();
  const alvos = Object.values(fichas).filter(
    (ficha) => ficha.perfilId === perfilId && !ficha.apagadoEm,
  );
  alvos.forEach((ficha) => {
    fichas[ficha.id] = { ...ficha, apagadoEm: Date.now(), atualizadoEm: Date.now() };
    enfileirar('fichas', ficha.id);
  });
  gravar(fichas);
  return alvos.length;
}

export function salvarFicha(ficha: Ficha): Ficha {
  const fichas = ler();
  const salva = { ...ficha, atualizadoEm: Date.now() };
  fichas[ficha.id] = salva;
  gravar(fichas);
  enfileirar('fichas', ficha.id);
  registrarEvento('ficha', ficha.perfilId, `Ficha de ${ficha.nome || 'criança sem nome'}`);
  return salva;
}

export function apagarFicha(id: string): void {
  const fichas = ler();
  const ficha = fichas[id];
  if (!ficha) return;
  fichas[id] = { ...ficha, apagadoEm: Date.now(), atualizadoEm: Date.now() };
  gravar(fichas);
  enfileirar('fichas', id);
}
