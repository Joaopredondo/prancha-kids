import { supabase } from './supabase';
import type { Vinculo } from './sessao';

export type Papel = Vinculo['papel'];

export type Membro = {
  usuarioId: string;
  /** Nome quando existe; senão a parte antes do @ do e-mail. */
  nome: string;
  email: string;
  papel: Papel;
  desde: string;
  /** Trava as ações da própria linha: ninguém muda o próprio papel nem se remove — nem a RLS deixa. */
  souEu: boolean;
  /** Quando a pessoa tem foto de perfil — null é "sem foto". */
  fotoAtualizadaEm: string | null;
  /** Nascimento em `YYYY-MM-DD` — null é "não informou". A idade é calculada. */
  nascimento: string | null;
  profissao: string;
};

export type Convite = { email: string; papel: Papel; criadoEm: string };

export type Equipe = { membros: Membro[]; convites: Convite[] };

export type Resultado<T> = { dados: T | null; erro: string | null };

const SEM_NUVEM = 'Nuvem não configurada neste aparelho.';

/**
 * Traduz erro do banco para frase que um coordenador entende.
 *
 * As mensagens do gatilho `revisar_mudanca_de_membro` (migração 0004) já vêm
 * prontas em português — "Você não pode mudar o seu próprio papel…", "Este é
 * o último coordenador…" — e passam direto. O resto é erro de infraestrutura
 * (rede, coluna, etc.) e ganha um prefixo em vez de vazar inglês técnico.
 */
function traduzirErro(mensagem: string): string {
  if (/^(Você|Este|Não dá)/.test(mensagem)) return mensagem;
  return `Não deu para completar: ${mensagem}`;
}

/**
 * A equipe de um ministério: quem está e quem foi convidado e ainda não entrou.
 *
 * Falha ao carregar convites não derruba a lista de membros — convite é
 * acessório, e a tela precisa continuar útil sem ele.
 */
export async function listarEquipe(ministerioId: string): Promise<Resultado<Equipe>> {
  if (!supabase) return { dados: null, erro: SEM_NUVEM };

  const { data: usuario } = await supabase.auth.getUser();
  const meuId = usuario.user?.id ?? null;

  const { data: linhas, error } = await supabase
    .from('membros')
    .select(
      'usuario_id, nome, email, papel, criado_em, foto_atualizada_em, nascimento, profissao',
    )
    .eq('ministerio_id', ministerioId)
    .is('apagado_em', null);

  if (error) return { dados: null, erro: traduzirErro(error.message) };

  const membros: Membro[] = (linhas ?? [])
    .map((linha) => {
      const email = linha.email as string;
      const nome = (linha.nome as string) || '';
      return {
        usuarioId: linha.usuario_id as string,
        nome: nome || email.split('@')[0],
        email,
        papel: linha.papel as Papel,
        desde: linha.criado_em as string,
        souEu: linha.usuario_id === meuId,
        fotoAtualizadaEm: (linha.foto_atualizada_em as string | null) ?? null,
        nascimento: (linha.nascimento as string | null) ?? null,
        profissao: (linha.profissao as string) ?? '',
      };
    })
    // Coordenação primeiro; dentro do mesmo papel, alfabética pelo nome exibido.
    .sort((a, b) => {
      if (a.papel !== b.papel) return a.papel === 'coordenador' ? -1 : 1;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

  const { data: linhasDeConvite } = await supabase
    .from('convites')
    .select('email, papel, criado_em')
    .eq('ministerio_id', ministerioId);

  const convites: Convite[] = (linhasDeConvite ?? []).map((linha) => ({
    email: linha.email as string,
    papel: linha.papel as Papel,
    criadoEm: linha.criado_em as string,
  }));

  return { dados: { membros, convites }, erro: null };
}

/**
 * Promove ou rebaixa um membro.
 *
 * Termina em `.select()` de propósito: um `update` que a RLS recusa (mexer no
 * próprio papel, por exemplo) volta com sucesso e **zero linhas**, sem erro.
 * Sem checar o array, a tela diria "papel alterado" para uma mudança que
 * nunca aconteceu — o gatilho cobre o caso comum com mensagem própria, mas
 * qualquer outra recusa da RLS ainda passaria batido sem esta checagem.
 */
export async function mudarPapel(
  usuarioId: string,
  ministerioId: string,
  papel: Papel,
): Promise<string | null> {
  if (!supabase) return SEM_NUVEM;

  const { data, error } = await supabase
    .from('membros')
    .update({ papel })
    .eq('usuario_id', usuarioId)
    .eq('ministerio_id', ministerioId)
    .select('usuario_id');

  if (error) return traduzirErro(error.message);
  if (!data || data.length === 0) {
    return 'Não foi possível mudar o papel — você não tem permissão para isso.';
  }
  return null;
}

/** Remove alguém da equipe. É `apagado_em`, nunca `delete`: o histórico de quem atendeu a criança continua. */
export async function removerMembro(
  usuarioId: string,
  ministerioId: string,
): Promise<string | null> {
  if (!supabase) return SEM_NUVEM;

  const { data, error } = await supabase
    .from('membros')
    .update({ apagado_em: new Date().toISOString() })
    .eq('usuario_id', usuarioId)
    .eq('ministerio_id', ministerioId)
    .select('usuario_id');

  if (error) return traduzirErro(error.message);
  if (!data || data.length === 0) {
    return 'Não foi possível remover — você não tem permissão para isso.';
  }
  return null;
}

/**
 * Cancela um convite ainda não aceito.
 *
 * É o único `delete` do projeto — convite não é histórico de ninguém, o
 * próprio `aplicar_convites()` já apaga a linha quando a pessoa entra. Mesmo
 * risco de recusa silenciosa dos outros dois: quem não é coordenador não
 * consegue cancelar, e a RLS não avisa, só devolve zero linhas apagadas.
 */
export async function cancelarConvite(
  email: string,
  ministerioId: string,
): Promise<string | null> {
  if (!supabase) return SEM_NUVEM;

  const { data, error } = await supabase
    .from('convites')
    .delete()
    .eq('email', email.toLowerCase())
    .eq('ministerio_id', ministerioId)
    .select('email');

  if (error) return traduzirErro(error.message);
  if (!data || data.length === 0) {
    return 'Não foi possível cancelar — você não tem permissão para isso.';
  }
  return null;
}

/**
 * Avisa que a própria foto de perfil mudou (ou foi removida).
 *
 * Passa por uma função do banco (`definir_foto_do_membro`, migração 0008),
 * não por um `update` direto: a policy de update de `membros` é só para
 * coordenador administrar a equipe, e explicitamente barra a própria linha —
 * a função é o único jeito de a pessoa gravar algo na própria linha sem abrir
 * uma brecha para ela mudar o próprio papel também.
 */
export async function definirFotoDoMembro(tenhoFoto: boolean): Promise<string | null> {
  if (!supabase) return SEM_NUVEM;
  const { error } = await supabase.rpc('definir_foto_do_membro', { tenho_foto: tenhoFoto });
  return error ? traduzirErro(error.message) : null;
}

/**
 * Grava os dados pessoais da própria pessoa: nome, nascimento e profissão.
 *
 * Mesma função do banco que a foto (`definir_dados_do_membro`, migração 0009),
 * pelo mesmo motivo: a policy de update de `membros` barra a própria linha, e
 * a função é o único jeito de gravar nela sem abrir brecha para mudar papel.
 * Como é dado da pessoa, não do vínculo, a função atualiza a linha dela em
 * todos os ministérios de uma vez.
 *
 * `nascimento` vira `null` quando vem vazio: é o "não informou" da coluna.
 */
export async function definirDadosDoMembro(
  nome: string,
  nascimento: string,
  profissao: string,
): Promise<string | null> {
  if (!supabase) return SEM_NUVEM;
  const { error } = await supabase.rpc('definir_dados_do_membro', {
    novo_nome: nome,
    novo_nascimento: nascimento || null,
    nova_profissao: profissao,
  });
  return error ? traduzirErro(error.message) : null;
}

/**
 * Idade da pessoa hoje, calculada do nascimento — nunca guardada, para não
 * desatualizar a cada aniversário. Vazio quando a data não foi informada (ou
 * não veio em `YYYY-MM-DD`, que é o que o `<input type="date">` entrega).
 */
export function idadeDoMembro(nascimento: string | null): string {
  if (!nascimento) return '';
  const [ano, mes, dia] = nascimento.split('-').map(Number);
  if (!ano || !mes || !dia) return '';
  const hoje = new Date();
  let anos = hoje.getFullYear() - ano;
  // Aniversário deste ano ainda não chegou: mês maior, ou mesmo mês com dia
  // maior. Mês do Date é 0-based, daí o +1.
  if (hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)) {
    anos -= 1;
  }
  if (anos < 0) return '';
  return anos === 1 ? '1 ano' : `${anos} anos`;
}
