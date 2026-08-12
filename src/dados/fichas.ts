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
  return Object.values(ler()).sort((a, b) => b.data - a.data);
}

export function salvarFicha(ficha: Ficha): Ficha {
  const fichas = ler();
  fichas[ficha.id] = ficha;
  gravar(fichas);
  return ficha;
}

export function apagarFicha(id: string): void {
  const fichas = ler();
  delete fichas[id];
  gravar(fichas);
}
