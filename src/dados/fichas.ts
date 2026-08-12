import { chaveDaFicha, fichaVazia, type Ficha } from './ficha';

/**
 * Persistência da ficha do culto.
 *
 * Fica só no aparelho, em localStorage — não há servidor, conta nem envio para
 * lugar nenhum. Limpar os dados do navegador apaga tudo.
 *
 * Salvar **nunca valida campo obrigatório**. Ficha pela metade é melhor que
 * ficha não preenchida, e o culto acaba antes do formulário.
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

const mesmoDia = (a: number, b: number) =>
  new Date(a).toDateString() === new Date(b).toDateString();

/** Fichas salvas, da mais recente para a mais antiga. */
export function listarFichas(): Ficha[] {
  return Object.values(ler()).sort((a, b) => b.data - a.data);
}

/**
 * A ficha aberta ao entrar na tela: a mais recente de hoje, se houver, senão
 * uma em branco. Assim o voluntário continua de onde parou durante o culto.
 */
export function fichaDeHoje(data = Date.now()): Ficha {
  const dehoje = listarFichas().filter((ficha) => mesmoDia(ficha.data, data));
  return dehoje[0] ?? fichaVazia(data);
}

/**
 * Grava sob a chave nome+dia. Se o nome mudou depois de salvo, a chave antiga
 * é removida — senão a mesma ficha apareceria duas vezes na lista.
 */
export function salvarFicha(ficha: Ficha): Ficha {
  const fichas = ler();
  const id = chaveDaFicha(ficha.nome, ficha.data);
  if (ficha.id !== id) delete fichas[ficha.id];
  const salva = { ...ficha, id };
  fichas[id] = salva;
  gravar(fichas);
  return salva;
}

export function apagarFicha(id: string): void {
  const fichas = ler();
  delete fichas[id];
  gravar(fichas);
}
