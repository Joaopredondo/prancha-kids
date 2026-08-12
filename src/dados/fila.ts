/**
 * Fila do que ainda não subiu para a nuvem.
 *
 * Gravar no aparelho nunca espera rede: a ficha é preenchida durante o culto,
 * e o wifi da igreja cai. Cada gravação só anota "este registro mudou", e o
 * envio acontece quando houver rede.
 */

export type Tabela = 'criancas' | 'fichas' | 'rotinas';

const CHAVE = 'prancha-kids:pendentes';

type Pendencia = { tabela: Tabela; id: string };

function ler(): Pendencia[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? '[]') as Pendencia[];
  } catch {
    return [];
  }
}

function gravar(pendencias: Pendencia[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(pendencias));
  } catch {
    // Armazenamento cheio: o dado local continua salvo, só não sincroniza agora.
  }
}

/** Anota que um registro mudou. Repetir o mesmo id não duplica. */
export function enfileirar(tabela: Tabela, id: string): void {
  const pendencias = ler();
  if (pendencias.some((p) => p.tabela === tabela && p.id === id)) return;
  gravar([...pendencias, { tabela, id }]);
}

export const listarPendencias = (): Pendencia[] => ler();
export const quantasPendencias = (): number => ler().length;

/** Some só com o que subiu; o que falhou fica para a próxima tentativa. */
export function baixarDaFila(enviados: Pendencia[]): void {
  const chaves = new Set(enviados.map((p) => `${p.tabela}:${p.id}`));
  gravar(ler().filter((p) => !chaves.has(`${p.tabela}:${p.id}`)));
}

const CHAVE_SYNC = 'prancha-kids:ultimo-sync';

/** Marca d'água do recebimento: só puxa o que mudou depois disto. */
export const ultimoSync = (): string =>
  localStorage.getItem(CHAVE_SYNC) ?? '1970-01-01T00:00:00.000Z';

export const registrarSync = (quando: string) => localStorage.setItem(CHAVE_SYNC, quando);
