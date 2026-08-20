import { supabase } from './supabase';

/**
 * Números do ministério, para a tela de Resumo.
 *
 * Lê direto do Supabase, como `membros.ts` e `atividade.ts` — não é sobre o
 * que este aparelho já sincronizou, é o estado real do ministério inteiro.
 */
export type Resumo = {
  criancasAtivas: number;
  fichasDaSemana: number;
};

export type Resultado<T> = { dados: T | null; erro: string | null };

const SEM_NUVEM = 'Nuvem não configurada neste aparelho.';

function traduzirErro(mensagem: string): string {
  return `Não deu para completar: ${mensagem}`;
}

/** Segunda-feira desta semana, começo do dia — é quando o culto da semana começa a contar. */
function inicioDaSemana(): string {
  const agora = new Date();
  const diaDaSemana = agora.getDay(); // 0 = domingo
  const voltarAteSegunda = diaDaSemana === 0 ? 6 : diaDaSemana - 1;
  const segunda = new Date(agora);
  segunda.setDate(agora.getDate() - voltarAteSegunda);
  segunda.setHours(0, 0, 0, 0);
  return segunda.toISOString();
}

export async function buscarResumo(ministerioId: string): Promise<Resultado<Resumo>> {
  if (!supabase) return { dados: null, erro: SEM_NUVEM };

  const [criancas, fichas] = await Promise.all([
    supabase
      .from('criancas')
      .select('id', { count: 'exact', head: true })
      .eq('ministerio_id', ministerioId)
      .is('apagado_em', null),
    supabase
      .from('fichas')
      .select('id', { count: 'exact', head: true })
      .eq('ministerio_id', ministerioId)
      .is('apagado_em', null)
      .gte('data', inicioDaSemana()),
  ]);

  if (criancas.error) return { dados: null, erro: traduzirErro(criancas.error.message) };
  if (fichas.error) return { dados: null, erro: traduzirErro(fichas.error.message) };

  return {
    dados: {
      criancasAtivas: criancas.count ?? 0,
      fichasDaSemana: fichas.count ?? 0,
    },
    erro: null,
  };
}

/** Quantos membros ativos tiveram algum acesso nos últimos 7 dias. Só coordenação enxerga isso. */
export function contarAtivosNaSemana(
  ultimoAcesso: Map<string, string | null>,
): number {
  const ha7Dias = Date.now() - 7 * 86400000;
  let ativos = 0;
  for (const iso of ultimoAcesso.values()) {
    if (iso && new Date(iso).getTime() >= ha7Dias) ativos += 1;
  }
  return ativos;
}
