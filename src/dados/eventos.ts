import { enfileirar } from './fila';

/**
 * Log de uso: quem fez o quê e quando, para a coordenação supervisionar a
 * equipe sem virar vigilância de clique. Ver `supabase/migracoes/0005_log_de_eventos.sql`.
 *
 * Diferente de fichas/perfis, o evento não é algo que a tela volta a ler —
 * é rastro de auditoria, puro fire-and-forget. Por isso some do aparelho
 * assim que confirma o envio (`removerEventosEnviados`), em vez de ficar
 * guardado local como as outras tabelas.
 */
export type TipoDeEvento = 'ficha' | 'crianca' | 'voz';

export type Evento = {
  id: string;
  tipo: TipoDeEvento;
  criancaId: string | null;
  detalhe: string;
  criadoEm: number;
};

const CHAVE = 'prancha-kids:eventos';

function ler(): Record<string, Evento> {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as Record<string, Evento>) : {};
  } catch {
    return {};
  }
}

function gravar(eventos: Record<string, Evento>) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(eventos));
  } catch {
    // Armazenamento cheio: o evento não é a ação em si, só o registro dela —
    // perder o registro não pode impedir nem avisar sobre a ação real.
  }
}

export const listarEventosPendentes = (): Evento[] => Object.values(ler());

export const eventoPorId = (id: string): Evento | undefined => ler()[id];

/**
 * Registra a ação para o log de auditoria. Nunca lança e nunca bloqueia quem
 * chamou: um erro aqui não pode impedir a ficha, o cadastro ou a gravação de
 * voz que já aconteceram de verdade.
 */
export function registrarEvento(tipo: TipoDeEvento, criancaId: string | null, detalhe: string): void {
  try {
    const eventos = ler();
    const id = `evento-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    eventos[id] = { id, tipo, criancaId, detalhe, criadoEm: Date.now() };
    gravar(eventos);
    enfileirar('eventos', id);
  } catch {
    // Idem: falha ao registrar não pode subir para quem chamou.
  }
}

/** Some do aparelho depois de confirmado no servidor — é log, não dado a reexibir. */
export function removerEventosEnviados(ids: string[]): void {
  const eventos = ler();
  ids.forEach((id) => delete eventos[id]);
  gravar(eventos);
}
