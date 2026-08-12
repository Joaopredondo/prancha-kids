import type { Ficha, Marcacao } from './ficha';
import { fichaPorId, guardarFichaDaNuvem, listarFichasComApagadas } from './fichas';
import { baixarDaFila, listarPendencias, registrarSync, ultimoSync } from './fila';
import { guardarPerfilDaNuvem, listarPerfisComApagados, type Perfil } from './perfis';
import { supabase } from './supabase';

/**
 * Sincronização entre aparelhos.
 *
 * Regras que vêm do uso, não da conveniência:
 *
 * - **O aparelho é a fonte.** A tela lê sempre do armazenamento local; a nuvem
 *   é destino. Falha de rede não pode tirar a ficha do voluntário nem a prancha
 *   da criança.
 * - **Vence quem gravou por último**, comparando `atualizadoEm`.
 * - **Marcações são unidas, nunca substituídas.** Dois voluntários carimbando
 *   em aparelhos diferentes precisam terminar com os dois carimbos: descartar
 *   um apagaria registro de comportamento, que é a razão da ficha existir.
 * - **Exclusão é lógica.** Some da lista, continua recuperável.
 */

export type Resultado = { enviados: number; recebidos: number; erro?: string };

const paraIso = (ms: number | undefined) => new Date(ms ?? 0).toISOString();
const paraMs = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

/** Os campos da ficha que viajam em `conteudo`, sem o que já é coluna. */
function conteudoDaFicha(ficha: Ficha) {
  const { id, data, perfilId, marcacoes, atualizadoEm, apagadoEm, ...resto } = ficha;
  void id;
  void data;
  void perfilId;
  void marcacoes;
  void atualizadoEm;
  void apagadoEm;
  return resto;
}

function unirMarcacoes(a: Marcacao[] = [], b: Marcacao[] = []): Marcacao[] {
  const porChave = new Map<string, Marcacao>();
  [...a, ...b].forEach((m) => porChave.set(`${m.hora}|${m.tipo}`, m));
  return [...porChave.values()].sort((x, y) => x.hora - y.hora);
}

async function enviar(ministerioId: string): Promise<number> {
  if (!supabase) return 0;

  const pendencias = listarPendencias();
  if (pendencias.length === 0) return 0;

  const perfis = new Map(listarPerfisComApagados().map((p) => [p.id, p]));
  const enviados: typeof pendencias = [];

  const criancas = pendencias
    .filter((p) => p.tabela === 'criancas')
    .flatMap((p) => {
      const perfil = perfis.get(p.id);
      if (!perfil) return [];
      enviados.push(p);
      return [
        {
          id: perfil.id,
          ministerio_id: ministerioId,
          nome: perfil.nome,
          idade: perfil.idade,
          laudo: perfil.laudo,
          tem_foto: Boolean(perfil.temFoto),
          atualizado_em: paraIso(perfil.atualizadoEm),
          apagado_em: perfil.apagadoEm ? paraIso(perfil.apagadoEm) : null,
        },
      ];
    });

  const fichas = pendencias
    .filter((p) => p.tabela === 'fichas')
    .flatMap((p) => {
      const ficha = fichaPorId(p.id);
      if (!ficha) return [];
      enviados.push(p);
      return [
        {
          id: ficha.id,
          ministerio_id: ministerioId,
          crianca_id: ficha.perfilId,
          data: new Date(ficha.data).toISOString(),
          conteudo: conteudoDaFicha(ficha),
          marcacoes: ficha.marcacoes ?? [],
          atualizado_em: paraIso(ficha.atualizadoEm),
          apagado_em: ficha.apagadoEm ? paraIso(ficha.apagadoEm) : null,
        },
      ];
    });

  // Crianças primeiro: a ficha aponta para elas.
  if (criancas.length > 0) {
    const { error } = await supabase.from('criancas').upsert(criancas);
    if (error) throw new Error(error.message);
  }
  if (fichas.length > 0) {
    const { error } = await supabase.from('fichas').upsert(fichas);
    if (error) throw new Error(error.message);
  }

  baixarDaFila(enviados);
  return criancas.length + fichas.length;
}

async function receber(ministerioId: string): Promise<number> {
  if (!supabase) return 0;

  const desde = ultimoSync();
  const agora = new Date().toISOString();

  const { data: criancas, error: erroCriancas } = await supabase
    .from('criancas')
    .select('*')
    .eq('ministerio_id', ministerioId)
    .gt('atualizado_em', desde);
  if (erroCriancas) throw new Error(erroCriancas.message);

  const locais = new Map(listarPerfisComApagados().map((p) => [p.id, p]));
  let recebidos = 0;

  for (const linha of criancas ?? []) {
    const remotoEm = paraMs(linha.atualizado_em);
    const local = locais.get(linha.id);
    if (local && (local.atualizadoEm ?? 0) >= remotoEm) continue;

    const perfil: Perfil = {
      id: linha.id,
      nome: linha.nome ?? '',
      idade: linha.idade ?? '',
      laudo: linha.laudo ?? '',
      temFoto: Boolean(linha.tem_foto),
      criadoEm: local?.criadoEm ?? paraMs(linha.criado_em) ?? remotoEm,
      atualizadoEm: remotoEm,
      apagadoEm: linha.apagado_em ? paraMs(linha.apagado_em) : null,
    };
    guardarPerfilDaNuvem(perfil);
    recebidos += 1;
  }

  const { data: fichas, error: erroFichas } = await supabase
    .from('fichas')
    .select('*')
    .eq('ministerio_id', ministerioId)
    .gt('atualizado_em', desde);
  if (erroFichas) throw new Error(erroFichas.message);

  const fichasLocais = new Map(listarFichasComApagadas().map((f) => [f.id, f]));

  for (const linha of fichas ?? []) {
    const remotoEm = paraMs(linha.atualizado_em);
    const local = fichasLocais.get(linha.id);

    // Marcações se juntam mesmo quando a versão local é a mais nova.
    const marcacoes = unirMarcacoes(local?.marcacoes, linha.marcacoes ?? []);

    if (local && (local.atualizadoEm ?? 0) >= remotoEm) {
      if (marcacoes.length !== (local.marcacoes ?? []).length) {
        guardarFichaDaNuvem({ ...local, marcacoes });
        recebidos += 1;
      }
      continue;
    }

    guardarFichaDaNuvem({
      ...(local ?? {}),
      ...(linha.conteudo as object),
      id: linha.id,
      perfilId: linha.crianca_id,
      data: paraMs(linha.data),
      marcacoes,
      atualizadoEm: remotoEm,
      apagadoEm: linha.apagado_em ? paraMs(linha.apagado_em) : null,
    } as Ficha);
    recebidos += 1;
  }

  registrarSync(agora);
  return recebidos;
}

/** Envia o que está pendente e traz o que mudou. Nunca lança para a interface. */
export async function sincronizar(ministerioId: string): Promise<Resultado> {
  if (!supabase) return { enviados: 0, recebidos: 0, erro: 'Nuvem não configurada.' };
  if (!navigator.onLine) return { enviados: 0, recebidos: 0, erro: 'Sem internet agora.' };

  try {
    const enviados = await enviar(ministerioId);
    const recebidos = await receber(ministerioId);
    return { enviados, recebidos };
  } catch (erro) {
    return { enviados: 0, recebidos: 0, erro: (erro as Error).message };
  }
}
