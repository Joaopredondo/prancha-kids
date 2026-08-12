import { enfileirar } from './fila';

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
  /** Foto opcional; o arquivo em si mora no IndexedDB (`arquivos.ts`). */
  temFoto?: boolean;
  criadoEm: number;
  /** Carimbo da última mudança. É o que decide conflito na sincronização. */
  atualizadoEm?: number;
  /** Exclusão é lógica: apagar de verdade impediria propagar a exclusão. */
  apagadoEm?: number | null;
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
    atualizadoEm: Date.now(),
    apagadoEm: null,
  };
}

/** Em ordem alfabética: é como o voluntário procura a criança. */
export function listarPerfis(): Perfil[] {
  return Object.values(ler())
    .filter((perfil) => !perfil.apagadoEm)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Inclui os apagados: a sincronização precisa propagar a exclusão. */
export const listarPerfisComApagados = (): Perfil[] => Object.values(ler());

/** Grava vindo da nuvem, sem reenfileirar: senão os dois lados ficam se
 * empurrando para sempre. */
export function guardarPerfilDaNuvem(perfil: Perfil): void {
  const perfis = ler();
  perfis[perfil.id] = perfil;
  gravar(perfis);
}

export function perfilPorId(id: string | null): Perfil | undefined {
  return id ? ler()[id] : undefined;
}

export function salvarPerfil(perfil: Perfil): Perfil {
  const perfis = ler();
  const salvo = { ...perfil, atualizadoEm: Date.now() };
  perfis[perfil.id] = salvo;
  gravar(perfis);
  enfileirar('criancas', perfil.id);
  return salvo;
}

export function apagarPerfil(id: string): void {
  const perfis = ler();
  const perfil = perfis[id];
  if (!perfil) return;
  perfis[id] = { ...perfil, apagadoEm: Date.now(), atualizadoEm: Date.now() };
  gravar(perfis);
  enfileirar('criancas', id);
}
