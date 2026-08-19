import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Sessão do voluntário e o ministério a que ele pertence.
 *
 * Tudo aqui é opcional: sem nuvem configurada, ou sem ninguém logado, o app
 * funciona exatamente como antes, só no aparelho.
 */
export type Vinculo = {
  ministerioId: string;
  ministerio: string;
  papel: 'voluntario' | 'coordenador';
};

export type EstadoDaConta = {
  carregando: boolean;
  email: string | null;
  vinculo: Vinculo | null;
  /**
   * Tem vínculo registrado, mas com `apagado_em` preenchido: a pessoa saiu da
   * equipe. Diferente de nunca ter tido ministério, e a tela precisa separar os
   * dois — quem saiu merece saber que saiu, em vez de ver uma sincronização que
   * não sincroniza mais nada.
   */
  saiuDaEquipe: boolean;
};

type Leitura = Pick<EstadoDaConta, 'vinculo' | 'saiuDaEquipe'>;

const SEM_VINCULO: Leitura = { vinculo: null, saiuDaEquipe: false };

/**
 * O vínculo desta pessoa — e só dela.
 *
 * O filtro por `usuario_id` **não** é redundante com a RLS. A partir da
 * migração 0004 a policy de `membros` deixa cada membro enxergar a equipe
 * inteira do ministério, que é o que sustenta o painel de administração. Sem o
 * filtro, este `limit(1)` sem ordem devolveria uma linha qualquer da equipe —
 * possivelmente a de um coordenador — e a tela passaria a oferecer ações que a
 * RLS recusaria em silêncio depois. Antes da 0004 o filtro era desnecessário
 * porque a policy só revelava a própria linha; é uma daquelas consultas que
 * funcionavam por acidente da permissão, não por estarem certas.
 */
async function lerVinculo(usuarioId: string): Promise<Leitura> {
  if (!supabase) return SEM_VINCULO;

  const { data, error } = await supabase
    .from('membros')
    .select('papel, ministerio_id, apagado_em, ministerios(nome)')
    .eq('usuario_id', usuarioId)
    // Quem participa de mais de um ministério fica com o vínculo ativo à
    // frente; o encerrado só aparece quando não sobrou nenhum ativo.
    .order('apagado_em', { nullsFirst: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return SEM_VINCULO;
  if (data.apagado_em) return { vinculo: null, saiuDaEquipe: true };

  const ministerios = data.ministerios as unknown as { nome: string } | { nome: string }[] | null;
  const nome = Array.isArray(ministerios) ? ministerios[0]?.nome : ministerios?.nome;

  return {
    vinculo: {
      ministerioId: data.ministerio_id as string,
      ministerio: nome ?? 'Ministério',
      papel: data.papel as Vinculo['papel'],
    },
    saiuDaEquipe: false,
  };
}

export function useConta(): EstadoDaConta & { recarregar: () => void } {
  const [estado, setEstado] = useState<EstadoDaConta>({
    carregando: Boolean(supabase),
    email: null,
    vinculo: null,
    saiuDaEquipe: false,
  });
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!supabase) return;

    let vivo = true;
    const atualizar = async () => {
      const { data } = await supabase!.auth.getUser();
      const leitura = data.user ? await lerVinculo(data.user.id) : SEM_VINCULO;
      if (vivo) {
        setEstado({ carregando: false, email: data.user?.email ?? null, ...leitura });
      }
    };

    void atualizar();
    const { data: assinatura } = supabase.auth.onAuthStateChange(() => void atualizar());

    return () => {
      vivo = false;
      assinatura.subscription.unsubscribe();
    };
  }, [versao]);

  return { ...estado, recarregar: () => setVersao((v) => v + 1) };
}

export async function entrar(email: string, senha: string): Promise<string | null> {
  if (!supabase) return 'Nuvem não configurada neste aparelho.';
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (!error) return null;
  return error.message.includes('Invalid login')
    ? 'E-mail ou senha errados.'
    : `Não deu para entrar: ${error.message}`;
}

export async function sair(): Promise<void> {
  await supabase?.auth.signOut();
}

/** Convida alguém para o ministério. Só coordenador consegue — a RLS confere. */
export async function convidar(
  email: string,
  ministerioId: string,
  papel: Vinculo['papel'] = 'voluntario',
): Promise<string | null> {
  if (!supabase) return 'Nuvem não configurada neste aparelho.';
  const { error } = await supabase
    .from('convites')
    .insert({ email: email.trim().toLowerCase(), ministerio_id: ministerioId, papel });
  return error ? `Não deu para convidar: ${error.message}` : null;
}
