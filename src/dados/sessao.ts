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
};

async function lerVinculo(): Promise<Vinculo | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('membros')
    .select('papel, ministerio_id, ministerios(nome)')
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const ministerios = data.ministerios as unknown as { nome: string } | { nome: string }[] | null;
  const nome = Array.isArray(ministerios) ? ministerios[0]?.nome : ministerios?.nome;

  return {
    ministerioId: data.ministerio_id as string,
    ministerio: nome ?? 'Ministério',
    papel: data.papel as Vinculo['papel'],
  };
}

export function useConta(): EstadoDaConta & { recarregar: () => void } {
  const [estado, setEstado] = useState<EstadoDaConta>({
    carregando: Boolean(supabase),
    email: null,
    vinculo: null,
  });
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!supabase) return;

    let vivo = true;
    const atualizar = async () => {
      const { data } = await supabase!.auth.getUser();
      const vinculo = data.user ? await lerVinculo() : null;
      if (vivo) setEstado({ carregando: false, email: data.user?.email ?? null, vinculo });
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
