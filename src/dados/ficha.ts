/**
 * Ficha de acompanhamento do culto.
 *
 * Portada do projeto Lume, com os mesmos campos e a mesma ordem da folha
 * impressa que o ministério já usa. Nenhum campo foi inventado nem cortado.
 *
 * Duas diferenças em relação ao Lume, porque aqui não existe perfil nem sessão:
 * - o nome da criança é digitado na própria ficha;
 * - não há o bloco "Preenchido pelo app" (o Prancha não registra sessão).
 *
 * **Contém dado de saúde de menor** (nome, idade, laudo). Fica só no aparelho.
 */

export const HORARIOS = ['09:00', '10:45', '17:00', '19:00'] as const;
export type Horario = (typeof HORARIOS)[number];

export const PERTENCES = ['mochila', 'abafador', 'lanche', 'nenhum', 'outros'] as const;
export type Pertence = (typeof PERTENCES)[number];

export const ESTADOS = ['calmo', 'agitado', 'inadequado', 'crise', 'sonolento'] as const;
export type EstadoEmocional = (typeof ESTADOS)[number];

export const COMUNICACOES = ['fala', 'pecs', 'gestos', 'choro'] as const;
export type Comunicacao = (typeof COMUNICACOES)[number];

export const INTERACOES = ['todos', 'responsavel', 'isolado'] as const;
export type Interacao = (typeof INTERACOES)[number];

export const SAIDAS = ['nao', 'autorregulacao', 'pais'] as const;
export type Saida = (typeof SAIDAS)[number];

export const RECURSOS = ['abafador', 'som', 'calmo', 'pecs'] as const;
export type Recurso = (typeof RECURSOS)[number];

export const ALIMENTACOES = ['aceitou', 'agua', 'recusou'] as const;
export type Alimentacao = (typeof ALIMENTACOES)[number];

/** Carimbo de hora feito com um toque durante o culto. */
export type Marcacao = { hora: number; tipo: TipoDeMarcacao };

export const MARCACOES = ['crise', 'acalmou', 'saiu', 'voltou', 'lanche', 'banheiro'] as const;
export type TipoDeMarcacao = (typeof MARCACOES)[number];

export const ROTULOS_DE_MARCACAO: Record<TipoDeMarcacao, string> = {
  crise: 'Crise',
  acalmou: 'Acalmou',
  saiu: 'Saiu da sala',
  voltou: 'Voltou',
  lanche: 'Lanche',
  banheiro: 'Banheiro',
};

export type Ficha = {
  id: string;
  data: number;
  /** Criança cadastrada em `perfis.ts`. `null` nas fichas soltas, sem cadastro. */
  perfilId: string | null;

  nome: string;
  idade: string;
  laudo: string;
  voluntario: string;
  horario: Horario | null;
  pertences: Pertence[];
  outrosPertences: string;
  observacoes: string;

  estado: EstadoEmocional | null;
  comunicacao: Comunicacao[];
  interacao: Interacao | null;
  saida: Saida | null;
  recursos: Recurso[];
  alimentacao: Alimentacao[];

  interesses: string;
  manejo: string;
  descricao: string;

  assinatura: string;
  retiradaPor: string;

  /** Linha do tempo do culto, carimbada com um toque. */
  marcacoes: Marcacao[];
};

export const ROTULOS = {
  horario: { '09:00': '09:00', '10:45': '10:45', '17:00': '17:00', '19:00': '19:00' },
  pertences: {
    mochila: 'Mochila',
    abafador: 'Abafador',
    lanche: 'Lanche',
    nenhum: 'Nenhum',
    outros: 'Outros',
  },
  estado: {
    calmo: 'Calmo',
    agitado: 'Agitado',
    inadequado: 'Comportamento inadequado',
    crise: 'Crise',
    sonolento: 'Sonolento',
  },
  comunicacao: {
    fala: 'Fala',
    pecs: 'Cartões visuais / PECS',
    gestos: 'Gestos',
    choro: 'Choro',
  },
  interacao: {
    todos: 'Com todos',
    responsavel: 'Só com o responsável',
    isolado: 'Isolado',
  },
  saida: {
    nao: 'Não saiu',
    autorregulacao: 'Saiu para autorregulação',
    pais: 'Foi entregue aos pais',
  },
  recursos: {
    abafador: 'Abafador',
    som: 'Redução de som',
    calmo: 'Cantinho calmo',
    pecs: 'Cartões visuais / PECS',
  },
  alimentacao: {
    aceitou: 'Aceitou o lanche',
    agua: 'Bebeu água',
    recusou: 'Recusou',
  },
} as const;

/** Zero da ficha: tudo em branco, nada pré-marcado. */
export function fichaVazia(data = Date.now(), perfilId: string | null = null): Ficha {
  return {
    id: novoId(data),
    data,
    perfilId,
    nome: '',
    idade: '',
    laudo: '',
    voluntario: '',
    horario: null,
    pertences: [],
    outrosPertences: '',
    observacoes: '',
    estado: null,
    comunicacao: [],
    interacao: null,
    saida: null,
    recursos: [],
    alimentacao: [],
    interesses: '',
    manejo: '',
    descricao: '',
    assinatura: '',
    retiradaPor: '',
    marcacoes: [],
  };
}

/**
 * Identificador próprio, sorteado na criação e **nunca recalculado**.
 *
 * Antes a chave era `nome:dia`, e isso destruía dado: trocar o nome para
 * atender a próxima criança movia a ficha de chave e apagava a anterior, e
 * duas crianças de mesmo nome no mesmo dia colidiam. Nome é conteúdo, não
 * chave.
 */
export function novoId(data = Date.now()): string {
  const dia = new Date(data).toISOString().slice(0, 10);
  return `${dia}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Alterna item de escolha única.
 *
 * Tocar de novo **desmarca**. O papel permite deixar em branco, e a versão
 * digital não pode ser mais rígida que a folha — voluntário que marcou errado
 * no meio do culto precisa conseguir desfazer.
 */
export function alternarUnico<T>(atual: T | null, escolha: T): T | null {
  return atual === escolha ? null : escolha;
}

/** Alterna item de escolha múltipla. */
export function alternarMultiplo<T>(atuais: T[], escolha: T): T[] {
  return atuais.includes(escolha)
    ? atuais.filter((item) => item !== escolha)
    : [...atuais, escolha];
}

/**
 * Transforma a linha do tempo em texto corrido, para o voluntário colar na
 * descrição do comportamento em vez de escrever de memória depois do culto.
 */
export function marcacoesEmTexto(marcacoes: Marcacao[]): string {
  return marcacoes
    .map(
      (marcacao) =>
        `${new Date(marcacao.hora).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })} ${ROTULOS_DE_MARCACAO[marcacao.tipo].toLowerCase()}`,
    )
    .join('; ');
}
