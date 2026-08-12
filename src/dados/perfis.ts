/**
 * Cadastro das crianças atendidas.
 *
 * **Contém dado de saúde de menor** (nome, idade, laudo). Fica só no aparelho,
 * em localStorage, sem servidor.
 *
 * O perfil é o cadastro atual; a ficha guarda uma **cópia** de nome, idade e
 * laudo do dia em que foi preenchida. Corrigir o perfil depois não reescreve o
 * que já foi registrado — histórico de acompanhamento não pode mudar sozinho.
 */
export type Perfil = {
  id: string;
  nome: string;
  idade: string;
  laudo: string;
  criadoEm: number;
};

const CHAVE = 'prancha-kids:perfis';

function ler(): Record<string, Perfil> {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as Record<string, Perfil>) : {};
  } catch {
    return {};
  }
}

function gravar(perfis: Record<string, Perfil>) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(perfis));
  } catch {
    // Modo privado ou armazenamento cheio: o cadastro da tela continua válido.
  }
}

export function perfilVazio(): Perfil {
  return {
    id: `perfil-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    nome: '',
    idade: '',
    laudo: '',
    criadoEm: Date.now(),
  };
}

/** Em ordem alfabética: é como o voluntário procura a criança. */
export function listarPerfis(): Perfil[] {
  return Object.values(ler()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function perfilPorId(id: string | null): Perfil | undefined {
  return id ? ler()[id] : undefined;
}

export function salvarPerfil(perfil: Perfil): Perfil {
  const perfis = ler();
  perfis[perfil.id] = perfil;
  gravar(perfis);
  return perfil;
}

export function apagarPerfil(id: string): void {
  const perfis = ler();
  delete perfis[id];
  gravar(perfis);
}
