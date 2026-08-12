/**
 * Trava de 4 dígitos para a área do voluntário.
 *
 * Segurar 3 segundos evita toque acidental da criança, mas não protege nada de
 * um adulto curioso — e ali dentro há nome, idade, laudo e foto de menores.
 *
 * O que se guarda é o SHA-256 do código, não o código. Isso não resiste a quem
 * tenha o aparelho e paciência para testar 10 mil combinações: é uma tranca de
 * porta, não um cofre. A proteção real continua sendo não deixar o tablet com
 * qualquer pessoa.
 */

const CHAVE = 'prancha-kids:pin';
const CHAVE_SESSAO = 'prancha-kids:destrancado';

async function embaralhar(codigo: string): Promise<string> {
  const bytes = new TextEncoder().encode(`prancha-kids:${codigo}`);
  const resumo = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(resumo)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const temPin = () => Boolean(localStorage.getItem(CHAVE));

export async function definirPin(codigo: string): Promise<void> {
  localStorage.setItem(CHAVE, await embaralhar(codigo));
  destrancar();
}

export function removerPin(): void {
  localStorage.removeItem(CHAVE);
  destrancar();
}

export async function conferirPin(codigo: string): Promise<boolean> {
  const guardado = localStorage.getItem(CHAVE);
  if (!guardado) return true;
  const certo = guardado === (await embaralhar(codigo));
  if (certo) destrancar();
  return certo;
}

/**
 * Destrancado vale enquanto a aba estiver aberta (`sessionStorage`): o
 * voluntário digita uma vez por culto, e fechar o app tranca de novo.
 */
export const destrancar = () => sessionStorage.setItem(CHAVE_SESSAO, '1');
export const trancar = () => sessionStorage.removeItem(CHAVE_SESSAO);
export const estaDestrancado = () => !temPin() || sessionStorage.getItem(CHAVE_SESSAO) === '1';
