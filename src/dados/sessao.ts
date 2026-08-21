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
  usuarioId: string | null;
  email: string | null;
  vinculo: Vinculo | null;
  /**
   * Tem vínculo registrado, mas com `apagado_em` preenchido: a pessoa saiu da
   * equipe. Diferente de nunca ter tido ministério, e a tela precisa separar os
   * dois — quem saiu merece saber que saiu, em vez de ver uma sincronização que
   * não sincroniza mais nada.
   */
  saiuDaEquipe: boolean;
  /** Quando a própria pessoa tem foto de perfil — mesma coluna que a equipe enxerga dela. */
  fotoAtualizadaEm: string | null;
  /** Dados pessoais da linha de `membros` — os que a própria pessoa edita em Conta. */
  nome: string | null;
  /** Nascimento em `YYYY-MM-DD` — null é "não informou". A idade é calculada. */
  nascimento: string | null;
  profissao: string;
};

type Leitura = Pick<
  EstadoDaConta,
  'vinculo' | 'saiuDaEquipe' | 'fotoAtualizadaEm' | 'nome' | 'nascimento' | 'profissao'
>;

const SEM_VINCULO: Leitura = {
  vinculo: null,
  saiuDaEquipe: false,
  fotoAtualizadaEm: null,
  nome: null,
  nascimento: null,
  profissao: '',
};

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
    .select(
      'papel, ministerio_id, apagado_em, foto_atualizada_em, nome, nascimento, profissao, ministerios(nome)',
    )
    .eq('usuario_id', usuarioId)
    // Quem participa de mais de um ministério fica com o vínculo ativo à
    // frente; o encerrado só aparece quando não sobrou nenhum ativo.
    .order('apagado_em', { nullsFirst: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return SEM_VINCULO;
  if (data.apagado_em) {
    return {
      vinculo: null,
      saiuDaEquipe: true,
      fotoAtualizadaEm: null,
      nome: (data.nome as string) || null,
      nascimento: (data.nascimento as string | null) ?? null,
      profissao: (data.profissao as string) ?? '',
    };
  }

  const ministerios = data.ministerios as unknown as { nome: string } | { nome: string }[] | null;
  const nomeDoMinisterio = Array.isArray(ministerios)
    ? ministerios[0]?.nome
    : ministerios?.nome;

  return {
    vinculo: {
      ministerioId: data.ministerio_id as string,
      ministerio: nomeDoMinisterio ?? 'Ministério',
      papel: data.papel as Vinculo['papel'],
    },
    saiuDaEquipe: false,
    fotoAtualizadaEm: (data.foto_atualizada_em as string | null) ?? null,
    nome: (data.nome as string) || null,
    nascimento: (data.nascimento as string | null) ?? null,
    profissao: (data.profissao as string) ?? '',
  };
}

export function useConta(): EstadoDaConta & { recarregar: () => void } {
  const [estado, setEstado] = useState<EstadoDaConta>({
    carregando: Boolean(supabase),
    usuarioId: null,
    email: null,
    vinculo: null,
    saiuDaEquipe: false,
    fotoAtualizadaEm: null,
    nome: null,
    nascimento: null,
    profissao: '',
  });
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!supabase) return;

    let vivo = true;
    const atualizar = async () => {
      const { data } = await supabase!.auth.getUser();
      const leitura = data.user ? await lerVinculo(data.user.id) : SEM_VINCULO;
      if (vivo) {
        setEstado({
          carregando: false,
          usuarioId: data.user?.id ?? null,
          email: data.user?.email ?? null,
          ...leitura,
        });
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

/**
 * Manda o link de recuperação de senha.
 *
 * Link, não código: quem adivinha um código de 6 dígitos assume a conta
 * inteira, e um link com token longo é o que o Supabase Auth já resolve
 * nativamente — reinventar isso manualmente seria refazer pior uma proteção
 * contra força bruta que já existe pronta.
 *
 * Passa pela função `recuperar-senha` (em `supabase/functions/recuperar-senha/`)
 * em vez de `auth.resetPasswordForEmail` direto: o link ainda é gerado e
 * verificado pelo Auth, só o envio passa a ser nosso — mesma Brevo e mesmo
 * template do convite, em vez do mailer genérico do Supabase.
 *
 * Sempre volta `null` mesmo se o e-mail não existir — é a função evitando que
 * alguém descubra quais e-mails têm conta só tentando recuperar senha.
 */
export async function pedirRecuperacaoDeSenha(email: string): Promise<string | null> {
  if (!supabase) return 'Nuvem não configurada neste aparelho.';
  const { error } = await supabase.functions.invoke('recuperar-senha', {
    body: { email: email.trim().toLowerCase() },
  });
  return error ? 'Não deu para enviar. Tente de novo.' : null;
}

/**
 * Troca a senha depois que a pessoa voltou do link do e-mail.
 *
 * Só funciona dentro da sessão de recuperação que `aoRecuperarSenha` avisa
 * ter começado — sem essa sessão o Supabase recusa a troca sozinho.
 */
export async function redefinirSenha(senha: string): Promise<string | null> {
  if (!supabase) return 'Nuvem não configurada neste aparelho.';
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (!error) return null;
  if (error.message.toLowerCase().includes('password')) {
    return 'Senha muito curta — use pelo menos 6 caracteres.';
  }
  return `Não deu para trocar a senha: ${error.message}`;
}

/**
 * Avisa quando a pessoa volta do link do e-mail de recuperação.
 *
 * O Supabase lê o token da URL sozinho (`detectSessionInUrl`) e dispara
 * `PASSWORD_RECOVERY` — este evento é o único jeito de saber que a sessão
 * atual é uma sessão de recuperação, não um login normal, e que por isso a
 * tela deve pedir a senha nova em vez de abrir a área do voluntário direto.
 */
export function aoRecuperarSenha(aoAcontecer: () => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((evento) => {
    if (evento === 'PASSWORD_RECOVERY') aoAcontecer();
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Convida alguém e dispara o e-mail com o código.
 *
 * Passa pela função `convidar` (em `supabase/functions/convidar/`) em vez de
 * gravar direto na tabela: o código do convite é gerado pelo banco e o
 * navegador não pode lê-lo — se pudesse, qualquer membro leria o código de
 * qualquer convidado, e o segredo deixaria de ser segredo.
 *
 * O ministério não vai como parâmetro de propósito. A função descobre pelo
 * vínculo de quem chamou; mandar daqui seria dar ao cliente a chance de pedir
 * convite para um ministério que não é o dele.
 */
export async function convidar(
  email: string,
  papel: Vinculo['papel'] = 'voluntario',
): Promise<string | null> {
  if (!supabase) return 'Nuvem não configurada neste aparelho.';

  const { data, error } = await supabase.functions.invoke('convidar', {
    body: { email: email.trim().toLowerCase(), papel },
  });

  // `invoke` só devolve `error` para falha de rede ou status fora de 2xx, e
  // nesse caso o corpo com a mensagem em português fica dentro do contexto.
  if (error) {
    const doServidor = (data as { erro?: string } | null)?.erro;
    if (doServidor) return doServidor;

    const resposta = (error as { context?: Response }).context;
    if (resposta) {
      try {
        const corpo = (await resposta.clone().json()) as { erro?: string };
        if (corpo.erro) return corpo.erro;
      } catch {
        // Resposta sem JSON: cai na mensagem genérica abaixo.
      }
    }
    return 'Não deu para enviar o convite. Tente de novo.';
  }

  return null;
}

/**
 * Confere e-mail e código antes de pedir a senha.
 *
 * Serve à mensagem, não à segurança: quem tranca a porta é o trigger
 * `aplicar_convites()` no banco, que confere o código de novo na hora de
 * vincular. Sem esta conferência prévia, código errado criaria a conta e a
 * pessoa cairia numa tela de "sem ministério" sem entender o motivo.
 */
export async function conferirConvite(email: string, codigo: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('conferir_convite', {
    email_do_convite: email.trim().toLowerCase(),
    codigo_informado: codigo.trim().toUpperCase(),
  });
  return !error && data === true;
}

/**
 * Resultado de `aceitarConvite`.
 *
 * Não é `string | null` como o resto do arquivo porque um dos desfechos aqui
 * **não é erro**: "conta criada, confirme o e-mail" é a coisa certa
 * acontecendo, só que a pessoa ainda tem um passo a mais. Misturar isso com
 * `erro` fazia a tela mostrar essa frase em vermelho e tremendo, como se
 * tivesse dado errado — confundia mais do que ajudava.
 */
export type ResultadoDoAceite =
  | { sucesso: true }
  | { sucesso: false; mensagem: string; ehErro: boolean };

/**
 * Cria a conta de quem foi convidado.
 *
 * O código viaja em `options.data`, e é de lá que o trigger no banco o lê para
 * decidir se vincula ou não. Depois do cadastro, conferimos se o vínculo
 * nasceu: se não nasceu, o código não bateu, e é melhor dizer isso do que
 * deixar a pessoa numa conta órfã achando que deu certo.
 */
export async function aceitarConvite(
  email: string,
  codigo: string,
  senha: string,
  nome: string,
): Promise<ResultadoDoAceite> {
  if (!supabase) {
    return { sucesso: false, mensagem: 'Nuvem não configurada neste aparelho.', ehErro: true };
  }

  const limpo = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({
    email: limpo,
    password: senha,
    options: { data: { codigo: codigo.trim().toUpperCase(), nome: nome.trim() } },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      return {
        sucesso: false,
        mensagem: 'Já existe conta com esse e-mail. Use "Entrar" com a senha que você criou.',
        ehErro: true,
      };
    }
    if (error.message.toLowerCase().includes('password')) {
      return {
        sucesso: false,
        mensagem: 'Senha muito curta — use pelo menos 6 caracteres.',
        ehErro: true,
      };
    }
    return { sucesso: false, mensagem: `Não deu para criar a conta: ${error.message}`, ehErro: true };
  }

  // Confirmação de e-mail ligada no projeto: a sessão só existe depois que a
  // pessoa clica no link. Aí não dá para conferir o vínculo daqui, e o aviso
  // certo é sobre a caixa de entrada — não um erro.
  if (!data.session) {
    return {
      sucesso: false,
      mensagem: 'Conta criada. Confirme o e-mail que acabamos de enviar para entrar.',
      ehErro: false,
    };
  }

  const { data: membro } = await supabase
    .from('membros')
    .select('ministerio_id')
    .eq('usuario_id', data.user?.id ?? '')
    .limit(1)
    .maybeSingle();

  if (!membro) {
    await supabase.auth.signOut();
    return {
      sucesso: false,
      mensagem: 'Código incorreto ou convite vencido. Confira o código do e-mail ou peça um novo convite.',
      ehErro: true,
    };
  }

  return { sucesso: true };
}
