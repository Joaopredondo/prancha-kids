import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { BotaoSegurar } from './BotaoSegurar';
import { listarAtividade, listarUltimoAcesso, type EventoDaEquipe } from '../dados/atividade';
import {
  cancelarConvite,
  listarEquipe,
  mudarPapel,
  removerMembro,
  type Convite,
  type Equipe,
  type Membro,
  type Papel,
} from '../dados/membros';
import { convidar, useConta } from '../dados/sessao';
import { temNuvem } from '../dados/supabase';

gsap.registerPlugin(Flip);

const ROTULO_DO_PAPEL: Record<Papel, string> = {
  voluntario: 'Voluntário',
  coordenador: 'Coordenação',
};

/** O que cada papel passa a poder fazer — sem jargão, sem a palavra "RLS". */
const O_QUE_O_PAPEL_FAZ: Record<Papel, string> = {
  voluntario: 'Vê e preenche a ficha do culto, a frequência e as crianças.',
  coordenador: 'Tudo do voluntário, mais convidar, mudar papel e remover.',
};

/**
 * Cor do grupo. Coordenação usa o verde de ação porque é quem age sobre a
 * equipe; voluntário fica neutro. Vermelho não entra em nenhum dos dois — no
 * resto do app ele significa "pare", e um grupo de pessoas não é um alerta.
 */
const COR_DO_PAPEL: Record<Papel, string> = {
  coordenador: 'var(--color-acao)',
  voluntario: 'var(--color-descricao)',
};

/**
 * Paleta dos avatares: as cores do Código Fitzgerald que o app já usa nos
 * cards, menos a de urgência. A escolha é estável por pessoa (deriva do id),
 * então o mesmo rosto tem sempre a mesma cor entre sessões e aparelhos.
 */
const CORES_DE_AVATAR = [
  'var(--color-acao)',
  'var(--color-coisa)',
  'var(--color-descricao)',
  'var(--color-social)',
  'var(--color-pessoa)',
];

function corDoAvatar(chave: string): string {
  let soma = 0;
  for (let i = 0; i < chave.length; i += 1) soma = (soma + chave.charCodeAt(i) * (i + 1)) % 9973;
  return CORES_DE_AVATAR[soma % CORES_DE_AVATAR.length];
}

/** Iniciais de até duas palavras — "Maria Silva" vira MS, "joao" vira J. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

const formatarData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

/** "há 2 min", "há 3h", "ontem", "há 5 dias" — depois disso vira data mesmo. */
function tempoRelativo(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  return formatarData(iso);
}

/**
 * Ícones desta tela, em SVG — não emoji. É a única tela de adulto do app: o
 * emoji muda de desenho entre Android, iPhone e desktop (mesmo motivo do
 * README para não usar emoji nos cards), e aqui não há criança para quem
 * essa familiaridade importe.
 */
function IconeEnvelope({ tamanho = 18 }: { tamanho?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function IconeLixeira({ tamanho = 18 }: { tamanho?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function IconeMais({ tamanho = 18 }: { tamanho?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

interface Props {
  aoVoltar: () => void;
}

/**
 * Administração da equipe — quem tem acesso, com qual papel, quem foi
 * convidado e quem sai.
 *
 * Entra só pelas Configurações → Conta, nunca pelo `MainNav`: ele fica na
 * frente da criança durante o culto, e esta tela é do voluntário adulto.
 * Errar um toque aqui dá acesso a laudo médico de criança para a pessoa
 * errada — por isso nada de 3D nem enfeite que dispute a atenção, e remover
 * passa por `BotaoSegurar`, nunca por um clique só.
 *
 * O movimento que existe aqui é todo informativo: a linha viaja entre os
 * grupos quando o papel muda, o contador rola quando o número muda, e o
 * pulso verde só acende quando o servidor confirmou. Nada anima por enfeite.
 */
export function PainelDoMinisterio({ aoVoltar }: Props) {
  const { carregando: carregandoConta, vinculo, saiuDaEquipe } = useConta();
  const semMovimento = useReducedMotion();

  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [carregandoEquipe, setCarregandoEquipe] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  /** Linhas em voo: sem ação, meio apagadas, até o servidor confirmar. */
  const [emVoo, setEmVoo] = useState<Set<string>>(new Set());
  /** Linha que o servidor acabou de confirmar — dispara o pulso do GSAP. */
  const [confirmada, setConfirmada] = useState<string | null>(null);

  /** Só a coordenação carrega isto — a RLS recusaria pro voluntário mesmo assim. */
  const [atividade, setAtividade] = useState<EventoDaEquipe[] | null>(null);
  const [ultimoAcesso, setUltimoAcesso] = useState<Map<string, string | null> | null>(null);

  const [emailConvite, setEmailConvite] = useState('');
  const [papelConvite, setPapelConvite] = useState<Papel>('voluntario');
  const [convidando, setConvidando] = useState(false);
  /** O formulário de convite nasce fechado: é ação ocasional, não o assunto da tela. */
  const [convitAberto, setConviteAberto] = useState(false);

  /**
   * Palco dos dois grupos (Coordenação e Voluntários) e a técnica de
   * travessia entre eles.
   *
   * Mesma técnica do "Agora e Depois" (`src/components/AgoraEDepois.tsx`):
   * GSAP Flip, não `layoutId` do Motion. Um `layoutId` compartilhado entre
   * dois `<ul>` diferentes exigiria os dois listarem o mesmo elemento na
   * borda de duas `AnimatePresence` distintas ao mesmo tempo — frágil, e sem
   * necessidade quando o Flip já resolve isso lendo o DOM antes e depois.
   */
  const palco = useRef<HTMLDivElement>(null);
  const posicoesAntes = useRef<Flip.FlipState | null>(null);

  const capturarAntesDeMudar = () => {
    if (!semMovimento && palco.current) {
      posicoesAntes.current = Flip.getState(palco.current.querySelectorAll('[data-flip-id]'));
    }
  };

  useLayoutEffect(() => {
    const antes = posicoesAntes.current;
    if (!antes) return;
    posicoesAntes.current = null;

    Flip.from(antes, {
      duration: 0.45,
      ease: 'power2.inOut',
      // Sem isto a linha não sai do grupo em que está: ela é filha da lista
      // e ficaria recortada no caminho até o outro grupo.
      absolute: true,
      onEnter: (alvos) =>
        gsap.fromTo(alvos, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.3 }),
      onLeave: (alvos) => gsap.to(alvos, { opacity: 0, scale: 0.9, duration: 0.25 }),
    });
  }, [equipe]);

  const carregar = useCallback(async () => {
    if (!vinculo) return;
    setCarregandoEquipe(true);
    setErro(null);
    const { dados, erro: erroDaLeitura } = await listarEquipe(vinculo.ministerioId);
    setCarregandoEquipe(false);
    if (erroDaLeitura) {
      setErro(erroDaLeitura);
      return;
    }
    setEquipe(dados);
  }, [vinculo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!vinculo || vinculo.papel !== 'coordenador') return;
    let vivo = true;
    void (async () => {
      const [dosEventos, doAcesso] = await Promise.all([
        listarAtividade(vinculo.ministerioId),
        listarUltimoAcesso(vinculo.ministerioId),
      ]);
      if (!vivo) return;
      if (dosEventos.dados) setAtividade(dosEventos.dados);
      if (doAcesso.dados) setUltimoAcesso(doAcesso.dados);
    })();
    return () => {
      vivo = false;
    };
  }, [vinculo]);

  const souCoordenador = vinculo?.papel === 'coordenador';

  const aoMudarPapel = async (membro: Membro, papel: Papel) => {
    if (!equipe || !vinculo || papel === membro.papel) return;
    const anterior = equipe;
    capturarAntesDeMudar();
    setEmVoo((atual) => new Set(atual).add(membro.usuarioId));
    setEquipe({
      ...equipe,
      membros: equipe.membros.map((m) => (m.usuarioId === membro.usuarioId ? { ...m, papel } : m)),
    });

    const erroDaEscrita = await mudarPapel(membro.usuarioId, vinculo.ministerioId, papel);

    setEmVoo((atual) => {
      const proximo = new Set(atual);
      proximo.delete(membro.usuarioId);
      return proximo;
    });

    if (erroDaEscrita) {
      capturarAntesDeMudar();
      setEquipe(anterior);
      setErro(erroDaEscrita);
      return;
    }
    setConfirmada(membro.usuarioId);
  };

  const aoRemover = async (membro: Membro) => {
    if (!equipe || !vinculo) return;
    const anterior = equipe;
    capturarAntesDeMudar();
    setEmVoo((atual) => new Set(atual).add(membro.usuarioId));
    setEquipe({ ...equipe, membros: equipe.membros.filter((m) => m.usuarioId !== membro.usuarioId) });

    const erroDaEscrita = await removerMembro(membro.usuarioId, vinculo.ministerioId);

    setEmVoo((atual) => {
      const proximo = new Set(atual);
      proximo.delete(membro.usuarioId);
      return proximo;
    });

    if (erroDaEscrita) {
      capturarAntesDeMudar();
      setEquipe(anterior);
      setErro(erroDaEscrita);
    }
  };

  const aoCancelarConvite = async (convite: Convite) => {
    if (!equipe || !vinculo) return;
    const anterior = equipe;
    setEquipe({ ...equipe, convites: equipe.convites.filter((c) => c.email !== convite.email) });

    const erroDaEscrita = await cancelarConvite(convite.email, vinculo.ministerioId);
    if (erroDaEscrita) {
      setEquipe(anterior);
      setErro(erroDaEscrita);
    }
  };

  const aoConvidar = async () => {
    if (!vinculo || !emailConvite.trim()) return;
    setConvidando(true);
    const erroDoConvite = await convidar(emailConvite.trim(), vinculo.ministerioId, papelConvite);
    setConvidando(false);
    if (erroDoConvite) {
      setErro(erroDoConvite);
      return;
    }
    setEmailConvite('');
    setConviteAberto(false);
    void carregar();
  };

  // --- estados que impedem a tela de mostrar equipe --------------------

  if (!temNuvem()) {
    return (
      <Aviso aoVoltar={aoVoltar}>
        Este painel precisa de conta na nuvem. Este aparelho não está ligado a ela — entre com
        uma conta nas Configurações primeiro.
      </Aviso>
    );
  }

  if (carregandoConta) {
    return <Aviso aoVoltar={aoVoltar}>Verificando…</Aviso>;
  }

  if (saiuDaEquipe) {
    return (
      <Aviso aoVoltar={aoVoltar}>
        Você não está mais na equipe deste ministério, então não há equipe para administrar
        aqui.
      </Aviso>
    );
  }

  if (!vinculo) {
    return (
      <Aviso aoVoltar={aoVoltar}>
        Sem ministério vinculado — peça um convite à coordenação para ver a equipe.
      </Aviso>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      {/* Largura contida: a tela é uma lista de pessoas, e linha longa demais
          faz o olho perder a associação entre o nome e as ações da direita. */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-3 pb-10 sm:px-4">
        <button
          type="button"
          onClick={aoVoltar}
          className="min-h-12 cursor-pointer self-start rounded-full px-1 text-base font-bold underline underline-offset-4"
          style={{ color: 'var(--color-texto-suave)' }}
        >
          ← Voltar
        </button>

        {/* Só na primeira carga: numa recarga a equipe já está na tela, e
            trocá-la pelo esqueleto faria o conteúdo piscar sem motivo. */}
        {carregandoEquipe && !equipe && <Esqueleto />}

        {!carregandoEquipe && erro && !equipe && (
          <Aviso aoVoltar={undefined}>
            {erro}
            <button
              type="button"
              onClick={() => void carregar()}
              className="mt-3 block min-h-12 cursor-pointer rounded-full border-2 px-4 text-base font-bold"
              style={{ borderColor: 'var(--color-linha)' }}
            >
              Tentar de novo
            </button>
          </Aviso>
        )}

        {equipe && (
          <>
            <Cabecalho
              ministerio={vinculo.ministerio}
              souCoordenador={Boolean(souCoordenador)}
              aoAbrirConvite={() => setConviteAberto(true)}
              semMovimento={Boolean(semMovimento)}
            />

            {souCoordenador && (
              <FormularioDeConvite
                aberto={convitAberto}
                aoFechar={() => setConviteAberto(false)}
                email={emailConvite}
                aoMudarEmail={setEmailConvite}
                papel={papelConvite}
                aoMudarPapel={setPapelConvite}
                convidando={convidando}
                aoEnviar={() => void aoConvidar()}
                semMovimento={Boolean(semMovimento)}
              />
            )}

            {!souCoordenador && (
              <p
                className="rounded-2xl border-2 px-4 py-3 text-sm font-semibold"
                style={{ borderColor: 'var(--color-linha)', color: 'var(--color-texto-suave)' }}
              >
                Você está vendo em modo leitura. Só a coordenação muda papel ou remove alguém.
              </p>
            )}

            <AnimatePresence>
              {erro && (
                <motion.p
                  role="alert"
                  initial={semMovimento ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border-2 px-4 py-3 text-sm font-bold"
                  style={{
                    borderColor: 'var(--color-urgencia)',
                    color: 'var(--color-urgencia)',
                    background: 'color-mix(in oklab, var(--color-urgencia) 8%, transparent)',
                  }}
                >
                  {erro}
                </motion.p>
              )}
            </AnimatePresence>

            <div ref={palco} className="flex flex-col gap-5">
              <GrupoDeMembros
                papel="coordenador"
                membros={equipe.membros.filter((m) => m.papel === 'coordenador')}
                vazio="Nenhum coordenador — não deveria acontecer, avise o suporte."
                souCoordenador={Boolean(souCoordenador)}
                emVoo={emVoo}
                confirmada={confirmada}
                semMovimento={Boolean(semMovimento)}
                ultimoAcesso={ultimoAcesso}
                aoMudarPapel={aoMudarPapel}
                aoRemover={aoRemover}
              />

              <GrupoDeMembros
                papel="voluntario"
                membros={equipe.membros.filter((m) => m.papel === 'voluntario')}
                vazio="Nenhum voluntário ainda."
                souCoordenador={Boolean(souCoordenador)}
                emVoo={emVoo}
                confirmada={confirmada}
                semMovimento={Boolean(semMovimento)}
                ultimoAcesso={ultimoAcesso}
                aoMudarPapel={aoMudarPapel}
                aoRemover={aoRemover}
              />
            </div>

            {/* Uma vez para as duas seções, não por pessoa nem repetida em
                cada uma: a mesma frase duas vezes na tela virava papel de
                parede, e o toque seguro do botão já avisa que é sério. */}
            {souCoordenador && equipe.membros.length > 0 && (
              <p className="text-xs" style={{ color: 'var(--color-texto-suave)' }}>
                Remover tira o acesso às fichas e às crianças. O que a pessoa já registrou
                continua guardado.
              </p>
            )}

            {equipe.convites.length > 0 && (
              <Secao
                titulo="Convites pendentes"
                quantidade={equipe.convites.length}
                cor="var(--color-coisa)"
                descricao="Cada pessoa entra sozinha assim que criar a conta com o e-mail convidado."
              >
                <ul className="flex flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {equipe.convites.map((convite) => (
                      <motion.li
                        key={convite.email}
                        layout
                        initial={semMovimento ? false : { opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={semMovimento ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
                        className="flex flex-wrap items-center gap-3 rounded-2xl border-2 px-4 py-3"
                        style={{
                          borderColor: 'var(--color-linha)',
                          background: 'var(--color-superficie)',
                        }}
                      >
                        <span
                          aria-hidden="true"
                          className="grid size-10 shrink-0 place-items-center rounded-full"
                          style={{
                            background: 'color-mix(in oklab, var(--color-coisa) 14%, transparent)',
                            color: 'var(--color-coisa)',
                          }}
                        >
                          <IconeEnvelope />
                        </span>
                        <span className="min-w-40 flex-1">
                          <span className="block text-base font-bold break-all">{convite.email}</span>
                          <span className="text-xs" style={{ color: 'var(--color-texto-suave)' }}>
                            entra como {ROTULO_DO_PAPEL[convite.papel]} · convidado em{' '}
                            {formatarData(convite.criadoEm)}
                          </span>
                        </span>
                        {souCoordenador && (
                          <button
                            type="button"
                            onClick={() => void aoCancelarConvite(convite)}
                            className="min-h-10 cursor-pointer rounded-full border-2 px-3 text-sm font-bold transition-colors"
                            style={{
                              borderColor: 'var(--color-linha)',
                              color: 'var(--color-urgencia)',
                            }}
                          >
                            Cancelar
                          </button>
                        )}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </Secao>
            )}

            {souCoordenador && (
              <AtividadeRecente
                eventos={atividade}
                nomePorUsuario={new Map(equipe.membros.map((m) => [m.usuarioId, m.nome]))}
              />
            )}
          </>
        )}
      </div>
    </MotionConfig>
  );
}

function Aviso({ children, aoVoltar }: { children: React.ReactNode; aoVoltar?: () => void }) {
  return (
    <div className="flex flex-col gap-3 px-3 pb-6 sm:px-4">
      {aoVoltar && (
        <button
          type="button"
          onClick={aoVoltar}
          className="min-h-12 cursor-pointer self-start rounded-full px-1 text-base font-bold underline underline-offset-4"
          style={{ color: 'var(--color-texto-suave)' }}
        >
          ← Voltar
        </button>
      )}
      <p className="text-base" style={{ color: 'var(--color-texto-suave)' }}>
        {children}
      </p>
    </div>
  );
}

/**
 * Silhueta da tela enquanto a equipe carrega. Repete a forma real (resumo em
 * cima, duas listas embaixo) para o conteúdo não saltar quando chegar.
 */
function Esqueleto() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="h-7 w-56 rounded-full" style={{ background: 'var(--color-linha)' }} />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl border-2"
              style={{ borderColor: 'var(--color-linha)' }}
            />
          ))}
        </div>
      </div>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-32 rounded-3xl border-2"
          style={{ borderColor: 'var(--color-linha)' }}
        />
      ))}
    </div>
  );
}

/**
 * Título, subtítulo e — só para coordenação — o botão que abre o convite.
 *
 * Os contadores por seção (o "· N" ao lado de "Coordenação" e "Voluntário")
 * já dizem quantos tem cada grupo; repetir isso aqui em cards de resumo era
 * dashboard para uma equipe de poucas pessoas — número que o olho já conta
 * olhando a lista não precisa de destaque próprio.
 */
function Cabecalho({
  ministerio,
  souCoordenador,
  aoAbrirConvite,
  semMovimento,
}: {
  ministerio: string;
  souCoordenador: boolean;
  aoAbrirConvite: () => void;
  semMovimento: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (semMovimento || !container.current) return;
    // `fromTo`, não `from`: em StrictMode o efeito roda duas vezes, e um
    // `from` interrompido deixaria o cabeçalho preso em opacidade zero.
    const animacao = gsap.fromTo(
      container.current.querySelectorAll('[data-entra]'),
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.3, stagger: 0.06, ease: 'power2.out' },
    );
    return () => {
      animacao.revert();
    };
  }, [semMovimento]);

  return (
    <div ref={container} className="flex flex-wrap items-start justify-between gap-3">
      <div data-entra>
        <h2 className="text-2xl font-extrabold sm:text-3xl">Equipe</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-texto-suave)' }}>
          {ministerio} · quem está aqui enxerga nome, idade, laudo e foto das crianças.
        </p>
      </div>

      {/* A ação principal da tela mora no cabeçalho, não no rodapé: com
          muitos voluntários, "Convidar" no fim da página só aparecia depois
          de rolar a lista inteira. */}
      {souCoordenador && (
        <button
          type="button"
          data-entra
          onClick={aoAbrirConvite}
          className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-extrabold"
          style={{ background: 'var(--color-acao)', color: '#ffffff' }}
        >
          <IconeMais tamanho={16} />
          Convidar
        </button>
      )}
    </div>
  );
}

/** Caixa de seção: filete de cor no topo, título, contagem e uma linha de contexto. */
function Secao({
  titulo,
  quantidade,
  cor,
  descricao,
  children,
}: {
  titulo: string;
  quantidade: number;
  cor: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="relative flex flex-col gap-3 overflow-hidden rounded-3xl border-2 p-4"
      style={{ borderColor: 'var(--color-linha)', background: 'var(--color-superficie)' }}
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5" style={{ background: cor }} />

      <div className="flex flex-col gap-1 pt-1">
        <h3 className="flex items-center gap-2 text-base font-extrabold">
          {titulo}
          <span
            className="rounded-full px-2 py-0.5 text-xs font-bold tabular-nums"
            style={{
              background: `color-mix(in oklab, ${cor} 16%, transparent)`,
              color: 'var(--color-texto)',
            }}
          >
            {quantidade}
          </span>
        </h3>
        {/* O que o grupo pode fazer aparece uma vez aqui, não repetido em cada
            linha: repetido, virava ruído e empurrava as ações para fora da tela. */}
        <p className="text-xs" style={{ color: 'var(--color-texto-suave)' }}>
          {descricao}
        </p>
      </div>

      {children}
    </section>
  );
}

function GrupoDeMembros({
  papel,
  membros,
  vazio,
  souCoordenador,
  emVoo,
  confirmada,
  semMovimento,
  ultimoAcesso,
  aoMudarPapel,
  aoRemover,
}: {
  papel: Papel;
  membros: Membro[];
  vazio: string;
  souCoordenador: boolean;
  emVoo: Set<string>;
  confirmada: string | null;
  semMovimento: boolean;
  ultimoAcesso: Map<string, string | null> | null;
  aoMudarPapel: (membro: Membro, papel: Papel) => void;
  aoRemover: (membro: Membro) => void;
}) {
  return (
    <Secao
      titulo={ROTULO_DO_PAPEL[papel]}
      quantidade={membros.length}
      cor={COR_DO_PAPEL[papel]}
      descricao={O_QUE_O_PAPEL_FAZ[papel]}
    >
      {membros.length === 0 ? (
        <p
          className="rounded-2xl border-2 border-dashed px-4 py-6 text-center text-sm"
          style={{ borderColor: 'var(--color-linha)', color: 'var(--color-texto-suave)' }}
        >
          {vazio}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {membros.map((membro) => (
            <LinhaDeMembro
              key={membro.usuarioId}
              membro={membro}
              souCoordenador={souCoordenador}
              emVoo={emVoo.has(membro.usuarioId)}
              pulsar={confirmada === membro.usuarioId}
              semMovimento={semMovimento}
              ultimoAcesso={ultimoAcesso ? (ultimoAcesso.get(membro.usuarioId) ?? null) : undefined}
              aoMudarPapel={(proximo) => aoMudarPapel(membro, proximo)}
              aoRemover={() => aoRemover(membro)}
            />
          ))}
        </ul>
      )}
    </Secao>
  );
}

function LinhaDeMembro({
  membro,
  souCoordenador,
  emVoo,
  pulsar,
  semMovimento,
  ultimoAcesso,
  aoMudarPapel,
  aoRemover,
}: {
  membro: Membro;
  souCoordenador: boolean;
  emVoo: boolean;
  pulsar: boolean;
  semMovimento: boolean;
  /** `undefined` = ainda não carregou; `null` = carregou e a pessoa nunca entrou. */
  ultimoAcesso?: string | null;
  aoMudarPapel: (papel: Papel) => void;
  aoRemover: () => void;
}) {
  const pulso = useRef<HTMLSpanElement>(null);
  const podeEditar = souCoordenador && !membro.souEu;
  const cor = corDoAvatar(membro.usuarioId);

  useEffect(() => {
    if (!pulsar || semMovimento || !pulso.current) return;
    // Nunca anima o transform da própria linha aqui: quem faz a linha viajar
    // entre os grupos é o GSAP Flip lá no componente pai, e mexer no
    // transform por fora dele brigaria com essa animação e daria um salto.
    // O pulso só troca a opacidade de um véu por cima — nunca a posição.
    const animacao = gsap.fromTo(
      pulso.current,
      { opacity: 0.45 },
      { opacity: 0, duration: 0.7, ease: 'power2.out' },
    );
    return () => {
      animacao.revert();
    };
  }, [pulsar, semMovimento]);

  return (
    // Elemento simples, não `motion.li`: quem move esta linha é o Flip do pai,
    // lendo `data-flip-id` do DOM antes e depois da mudança. Uma animação do
    // Motion por cima do mesmo elemento brigaria pelo `transform`.
    <li
      data-flip-id={membro.usuarioId}
      className="relative overflow-hidden rounded-2xl border-2 transition-opacity duration-200"
      style={{
        borderColor: membro.souEu ? cor : 'var(--color-linha)',
        background: 'var(--color-fundo)',
        opacity: emVoo ? 0.5 : 1,
      }}
    >
      {/* O pulso de confirmação: só dispara quando o servidor confirma a
          mudança, não no clique — é o sinal de que a permissão mudou de
          verdade, não só na tela. */}
      <span
        ref={pulso}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'var(--color-acao)', opacity: 0 }}
      />

      <div className="relative flex flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap">
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-extrabold"
          style={{
            background: `color-mix(in oklab, ${cor} 18%, var(--color-superficie))`,
            color: cor,
            border: `2px solid color-mix(in oklab, ${cor} 45%, transparent)`,
          }}
        >
          {iniciais(membro.nome)}
        </span>

        <div className="min-w-40 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-base font-bold">
            {membro.nome}
            {membro.souEu && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold"
                style={{
                  background: `color-mix(in oklab, ${cor} 18%, transparent)`,
                  color: 'var(--color-texto)',
                }}
              >
                você
              </span>
            )}
          </p>
          {/* A quebra agressiva vale só para o e-mail, que pode ser longo e
              sem espaço. Aplicada na linha inteira, ela partia a data ao meio
              ("desd e 04/02/2026") em tela estreita. */}
          <p className="text-xs" style={{ color: 'var(--color-texto-suave)' }}>
            <span className="break-all">{membro.email}</span>
            <span className="whitespace-nowrap"> · desde {formatarData(membro.desde)}</span>
            {ultimoAcesso !== undefined && (
              <span className="whitespace-nowrap">
                {' '}
                · {ultimoAcesso ? `visto ${tempoRelativo(ultimoAcesso)}` : 'nunca entrou'}
              </span>
            )}
          </p>
        </div>

        <SeletorDePapel
          idBase={membro.usuarioId}
          valor={membro.papel}
          desativado={!podeEditar || emVoo}
          aoMudar={aoMudarPapel}
        />

        {/* Remover fica na mesma linha, mas por último e depois de um espaço:
            já é `BotaoSegurar`, que exige 3 segundos de toque — a proteção
            contra o engano está no gesto, não em esconder o botão longe. */}
        {podeEditar && (
          <BotaoSegurar
            rotulo="Remover"
            emoji={<IconeLixeira tamanho={16} />}
            ativo={false}
            discreto
            aoCompletar={aoRemover}
          />
        )}
      </div>

      {membro.souEu && (
        <div
          className="relative border-t-2 px-3 py-2 text-xs"
          style={{ borderColor: 'var(--color-linha)', color: 'var(--color-texto-suave)' }}
        >
          Você não muda o próprio vínculo nem se remove — nem o banco deixa.
        </div>
      )}
    </li>
  );
}

/**
 * Formulário de convite. Quem abre é o botão "Convidar" do cabeçalho — este
 * componente só cuida do painel em si, e some por completo quando fechado.
 */
function FormularioDeConvite({
  aberto,
  aoFechar,
  email,
  aoMudarEmail,
  papel,
  aoMudarPapel,
  convidando,
  aoEnviar,
  semMovimento,
}: {
  aberto: boolean;
  aoFechar: () => void;
  email: string;
  aoMudarEmail: (valor: string) => void;
  papel: Papel;
  aoMudarPapel: (papel: Papel) => void;
  convidando: boolean;
  aoEnviar: () => void;
  semMovimento: boolean;
}) {
  return (
    <AnimatePresence initial={false}>
      {aberto && (
        <motion.section
          initial={semMovimento ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={semMovimento ? undefined : { opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          style={{ overflow: 'hidden' }}
        >
          <div
            className="relative flex flex-col gap-3 overflow-hidden rounded-3xl border-2 p-4"
            style={{ borderColor: 'var(--color-acao)', background: 'var(--color-superficie)' }}
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ background: 'var(--color-acao)' }}
            />

            <div className="flex items-center justify-between gap-2 pt-1">
              <h3 className="text-base font-extrabold">Convidar alguém</h3>
              <button
                type="button"
                onClick={aoFechar}
                className="min-h-10 cursor-pointer rounded-full px-3 text-sm font-bold"
                style={{ color: 'var(--color-texto-suave)' }}
              >
                Cancelar
              </button>
            </div>

            <label className="block">
              <span className="text-sm font-bold">E-mail</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => aoMudarEmail(e.target.value)}
                placeholder="pessoa@exemplo.com"
                className="mt-1 min-h-12 w-full rounded-2xl border-2 px-4 text-base"
                style={{ borderColor: 'var(--color-linha)', background: 'var(--color-fundo)' }}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">Entra como</span>
              <SeletorDePapel idBase="convite" valor={papel} desativado={false} aoMudar={aoMudarPapel} />
            </div>

            <button
              type="button"
              disabled={convidando || !email.trim()}
              onClick={aoEnviar}
              className="min-h-12 cursor-pointer rounded-2xl px-4 text-base font-extrabold transition-opacity disabled:opacity-50"
              style={{ background: 'var(--color-acao)', color: '#ffffff' }}
            >
              {convidando ? 'Convidando…' : 'Enviar convite'}
            </button>

            <p className="text-xs" style={{ color: 'var(--color-texto-suave)' }}>
              A pessoa entra no ministério assim que criar a conta com esse e-mail.
            </p>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/**
 * Ficha salva, criança cadastrada, voz gravada — os marcos que já significam
 * algo no culto, com quem e quando ao lado. Não é telemetria de navegação.
 */
function AtividadeRecente({
  eventos,
  nomePorUsuario,
}: {
  eventos: EventoDaEquipe[] | null;
  nomePorUsuario: Map<string, string>;
}) {
  return (
    <Secao
      titulo="Atividade recente"
      quantidade={eventos?.length ?? 0}
      cor="var(--color-pessoa)"
      descricao="Ficha salva, criança cadastrada, voz gravada. Só os marcos que já significam algo."
    >
      {eventos === null ? (
        <p className="text-sm" style={{ color: 'var(--color-texto-suave)' }}>
          Carregando…
        </p>
      ) : eventos.length === 0 ? (
        <p
          className="rounded-2xl border-2 border-dashed px-4 py-6 text-center text-sm"
          style={{ borderColor: 'var(--color-linha)', color: 'var(--color-texto-suave)' }}
        >
          Nenhuma atividade registrada ainda.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {eventos.map((evento) => {
            const nome = nomePorUsuario.get(evento.usuarioId) ?? 'alguém que já saiu da equipe';
            const cor = corDoAvatar(evento.usuarioId);
            return (
              <li
                key={evento.id}
                className="flex items-center gap-3 rounded-2xl border-2 px-4 py-3"
                style={{ borderColor: 'var(--color-linha)', background: 'var(--color-fundo)' }}
              >
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-extrabold"
                  style={{
                    background: `color-mix(in oklab, ${cor} 18%, var(--color-superficie))`,
                    color: cor,
                    border: `2px solid color-mix(in oklab, ${cor} 45%, transparent)`,
                  }}
                >
                  {iniciais(nome)}
                </span>
                <span className="min-w-40 flex-1">
                  <span className="block text-sm font-bold">{evento.detalhe}</span>
                  <span className="text-xs" style={{ color: 'var(--color-texto-suave)' }}>
                    {nome} · {tempoRelativo(evento.criadoEm)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Secao>
  );
}

function SeletorDePapel({
  idBase,
  valor,
  desativado,
  aoMudar,
}: {
  idBase: string;
  valor: Papel;
  desativado: boolean;
  aoMudar: (papel: Papel) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Papel"
      className="flex shrink-0 gap-1 rounded-full border-2 p-1"
      style={{ borderColor: 'var(--color-linha)', background: 'var(--color-superficie)' }}
    >
      {(['voluntario', 'coordenador'] as const).map((papel) => {
        const ativo = papel === valor;
        return (
          <button
            key={papel}
            type="button"
            role="radio"
            aria-checked={ativo}
            disabled={desativado}
            onClick={() => aoMudar(papel)}
            className="relative min-h-9 cursor-pointer rounded-full px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            style={{ color: ativo ? 'var(--color-fundo)' : 'var(--color-texto-suave)' }}
          >
            {/* `layoutId` por instância (`idBase`): sem isso, a pílula de
                todas as linhas compartilharia o mesmo id e saltaria de uma
                linha para outra em vez de deslizar dentro da sua própria.
                Este `layoutId` não conflita com o Flip da linha porque vive
                num elemento próprio, de dimensão fixa, dentro dela. */}
            {ativo && (
              <motion.span
                layoutId={`pilula-${idBase}`}
                className="absolute inset-0 rounded-full"
                style={{ background: 'var(--color-texto)' }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">{ROTULO_DO_PAPEL[papel]}</span>
          </button>
        );
      })}
    </div>
  );
}
