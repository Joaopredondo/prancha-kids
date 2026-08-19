import { supabase } from './supabase';

/**
 * Leitura da tabela `eventos` (migração 0005) e do último acesso da equipe.
 *
 * Segue o mesmo padrão de `membros.ts`: lê direto do Supabase, não passa pela
 * camada local-first — quem olha este painel quer o estado real do servidor,
 * não o que este aparelho específico já sincronizou.
 */
export type EventoDaEquipe = {
  id: string;
  usuarioId: string;
  tipo: 'ficha' | 'crianca' | 'voz';
  detalhe: string;
  criadoEm: string;
};

export type Resultado<T> = { dados: T | null; erro: string | null };

const SEM_NUVEM = 'Nuvem não configurada neste aparelho.';

function traduzirErro(mensagem: string): string {
  return `Não deu para completar: ${mensagem}`;
}

/** Os eventos mais recentes do ministério, do mais novo para o mais antigo. */
export async function listarAtividade(
  ministerioId: string,
  limite = 30,
): Promise<Resultado<EventoDaEquipe[]>> {
  if (!supabase) return { dados: null, erro: SEM_NUVEM };

  const { data, error } = await supabase
    .from('eventos')
    .select('id, usuario_id, tipo, detalhe, criado_em')
    .eq('ministerio_id', ministerioId)
    .order('criado_em', { ascending: false })
    .limit(limite);

  if (error) return { dados: null, erro: traduzirErro(error.message) };

  const eventos: EventoDaEquipe[] = (data ?? []).map((linha) => ({
    id: linha.id as string,
    usuarioId: linha.usuario_id as string,
    tipo: linha.tipo as EventoDaEquipe['tipo'],
    detalhe: linha.detalhe as string,
    criadoEm: linha.criado_em as string,
  }));

  return { dados: eventos, erro: null };
}

/** Último acesso de cada membro, por `usuarioId`. `null` = nunca entrou. */
export async function listarUltimoAcesso(
  ministerioId: string,
): Promise<Resultado<Map<string, string | null>>> {
  if (!supabase) return { dados: null, erro: SEM_NUVEM };

  const { data, error } = await supabase.rpc('ultimo_acesso_da_equipe', {
    ministerio: ministerioId,
  });

  if (error) return { dados: null, erro: traduzirErro(error.message) };

  const porUsuario = new Map<string, string | null>(
    (data ?? []).map((linha: { usuario_id: string; ultimo_acesso: string | null }) => [
      linha.usuario_id,
      linha.ultimo_acesso,
    ]),
  );

  return { dados: porUsuario, erro: null };
}
