import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { BotaoSegurar } from './BotaoSegurar';
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

const formatarData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

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
 * errada — por isso nada de 3D ou enfeite, e remover passa por
 * `BotaoSegurar`, nunca por um clique só.
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

  const [emailConvite, setEmailConvite] = useState('');
  const [papelConvite, setPapelConvite] = useState<Papel>('voluntario');
  const [convidando, setConvidando] = useState(false);

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
      <div className="flex flex-col gap-5 px-3 pb-6 sm:px-4">
        <button
          type="button"
          onClick={aoVoltar}
          className="min-h-12 cursor-pointer self-start rounded-full px-1 text-base font-bold underline underline-offset-4"
          style={{ color: 'var(--color-texto-suave)' }}
        >
          ← Voltar
        </button>

        {carregandoEquipe && <Aviso aoVoltar={undefined}>Carregando equipe…</Aviso>}

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
              equipe={equipe}
              carregandoEquipe={carregandoEquipe}
              semMovimento={Boolean(semMovimento)}
            />

            {!souCoordenador && (
              <p
                className="rounded-2xl border-2 px-4 py-3 text-sm font-semibold"
                style={{ borderColor: 'var(--color-linha)', color: 'var(--color-texto-suave)' }}
              >
                Você está vendo em modo leitura. Só a coordenação muda papel ou remove alguém.
              </p>
            )}

            {erro && (
              <p className="text-sm font-bold" style={{ color: 'var(--color-urgencia)' }} role="alert">
                {erro}
              </p>
            )}

            <div ref={palco} className="flex flex-col gap-5">
              <GrupoDeMembros
                titulo="Coordenação"
                membros={equipe.membros.filter((m) => m.papel === 'coordenador')}
                vazio="Nenhum coordenador — não deveria acontecer, avise o suporte."
                souCoordenador={Boolean(souCoordenador)}
                emVoo={emVoo}
                confirmada={confirmada}
                semMovimento={Boolean(semMovimento)}
                aoMudarPapel={aoMudarPapel}
                aoRemover={aoRemover}
              />

              <GrupoDeMembros
                titulo="Voluntários"
                membros={equipe.membros.filter((m) => m.papel === 'voluntario')}
                vazio="Nenhum voluntário ainda."
                souCoordenador={Boolean(souCoordenador)}
                emVoo={emVoo}
                confirmada={confirmada}
                semMovimento={Boolean(semMovimento)}
                aoMudarPapel={aoMudarPapel}
                aoRemover={aoRemover}
              />
            </div>

            {equipe.convites.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3
                  className="text-sm font-bold uppercase tracking-wide"
                  style={{ color: 'var(--color-texto-suave)' }}
                >
                  Convites pendentes ({equipe.convites.length})
                </h3>
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
                        style={{ borderColor: 'var(--color-linha)' }}
                      >
                        <span className="min-w-40 flex-1 text-base font-bold">{convite.email}</span>
                        <span className="text-sm" style={{ color: 'var(--color-texto-suave)' }}>
                          {ROTULO_DO_PAPEL[convite.papel]}
                        </span>
                        {souCoordenador && (
                          <button
                            type="button"
                            onClick={() => void aoCancelarConvite(convite)}
                            className="min-h-10 cursor-pointer rounded-full border-2 px-3 text-sm font-bold"
                            style={{ borderColor: 'var(--color-linha)', color: 'var(--color-urgencia)' }}
                          >
                            Cancelar
                          </button>
                        )}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            )}

            {souCoordenador && (
              <section
                className="flex flex-col gap-2 rounded-3xl border-2 p-4"
                style={{ borderColor: 'var(--color-linha)' }}
              >
                <h3
                  className="text-sm font-bold uppercase tracking-wide"
                  style={{ color: 'var(--color-texto-suave)' }}
                >
                  Convidar
                </h3>
                <label className="block">
                  <span className="text-sm font-bold">E-mail</span>
                  <input
                    type="email"
                    value={emailConvite}
                    onChange={(e) => setEmailConvite(e.target.value)}
                    className="mt-1 min-h-12 w-full rounded-2xl border-2 px-4 text-base"
                    style={{ borderColor: 'var(--color-linha)', background: 'var(--color-fundo)' }}
                  />
                </label>
                <SeletorDePapel idBase="convite" valor={papelConvite} desativado={false} aoMudar={setPapelConvite} />
                <button
                  type="button"
                  disabled={convidando || !emailConvite.trim()}
                  onClick={() => void aoConvidar()}
                  className="min-h-12 cursor-pointer self-start rounded-2xl px-4 text-base font-extrabold disabled:opacity-50"
                  style={{ background: 'var(--color-acao)', color: '#ffffff' }}
                >
                  {convidando ? 'Convidando…' : 'Convidar'}
                </button>
                <p className="text-xs" style={{ color: 'var(--color-texto-suave)' }}>
                  A pessoa entra no ministério assim que criar a conta com esse e-mail.
                </p>
              </section>
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

function Cabecalho({
  ministerio,
  equipe,
  carregandoEquipe,
  semMovimento,
}: {
  ministerio: string;
  equipe: Equipe;
  carregandoEquipe: boolean;
  semMovimento: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (semMovimento || carregandoEquipe || !container.current) return;
    // Só na entrada: depende de `carregandoEquipe` ter virado falso, não do
    // conteúdo da equipe — mudar papel de alguém não deve reacender isto.
    // `fromTo`, não `from`: em StrictMode o efeito roda duas vezes, e um
    // `from` interrompido deixaria o cabeçalho preso em opacidade zero.
    const animacao = gsap.fromTo(
      container.current.children,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.28, stagger: 0.05, ease: 'power2.out' },
    );
    return () => {
      animacao.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semMovimento, carregandoEquipe]);

  const naCoordenacao = equipe.membros.filter((m) => m.papel === 'coordenador').length;

  return (
    <div ref={container}>
      <div>
        <h2 className="text-xl font-extrabold">Equipe · {ministerio}</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-texto-suave)' }}>
          Quem está aqui enxerga nome, idade, laudo e foto das crianças do ministério.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Contador valor={equipe.membros.length} rotulo="na equipe" />
        <Contador valor={naCoordenacao} rotulo="na coordenação" />
        <Contador valor={equipe.convites.length} rotulo="convites" />
      </div>
    </div>
  );
}

function Contador({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div
      className="flex min-w-20 flex-col items-center rounded-2xl border-2 px-4 py-2"
      style={{ borderColor: 'var(--color-linha)' }}
    >
      <span className="relative grid h-7 place-items-center overflow-hidden text-xl font-extrabold tabular-nums">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={valor}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {valor}
          </motion.span>
        </AnimatePresence>
      </span>
      <span
        className="text-xs font-bold uppercase tracking-wide"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        {rotulo}
      </span>
    </div>
  );
}

function GrupoDeMembros({
  titulo,
  membros,
  vazio,
  souCoordenador,
  emVoo,
  confirmada,
  semMovimento,
  aoMudarPapel,
  aoRemover,
}: {
  titulo: string;
  membros: Membro[];
  vazio: string;
  souCoordenador: boolean;
  emVoo: Set<string>;
  confirmada: string | null;
  semMovimento: boolean;
  aoMudarPapel: (membro: Membro, papel: Papel) => void;
  aoRemover: (membro: Membro) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3
        className="text-sm font-bold uppercase tracking-wide"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        {titulo} ({membros.length})
      </h3>

      {membros.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-texto-suave)' }}>
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
              aoMudarPapel={(papel) => aoMudarPapel(membro, papel)}
              aoRemover={() => aoRemover(membro)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function LinhaDeMembro({
  membro,
  souCoordenador,
  emVoo,
  pulsar,
  semMovimento,
  aoMudarPapel,
  aoRemover,
}: {
  membro: Membro;
  souCoordenador: boolean;
  emVoo: boolean;
  pulsar: boolean;
  semMovimento: boolean;
  aoMudarPapel: (papel: Papel) => void;
  aoRemover: () => void;
}) {
  const pulso = useRef<HTMLSpanElement>(null);
  const podeEditar = souCoordenador && !membro.souEu;

  useEffect(() => {
    if (!pulsar || semMovimento || !pulso.current) return;
    // Nunca anima o transform da própria linha aqui: quem faz a linha viajar
    // entre os grupos é o GSAP Flip lá no componente pai, e mexer no
    // transform por fora dele brigaria com essa animação e daria um salto.
    // O pulso só troca a opacidade de um véu por cima — nunca a posição.
    const animacao = gsap.fromTo(
      pulso.current,
      { opacity: 0.5 },
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
      className="relative flex flex-wrap items-center gap-3 overflow-hidden rounded-2xl border-2 px-4 py-3 transition-opacity duration-200"
      style={{ borderColor: 'var(--color-linha)', opacity: emVoo ? 0.5 : 1 }}
    >
      {/* O pulso de confirmação: só dispara quando o servidor confirma a
          mudança, não no clique — é o sinal de que a permissão mudou de
          verdade, não só na tela. */}
      <span
        ref={pulso}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: 'var(--color-acao)', opacity: 0 }}
      />

      <span
        aria-hidden="true"
        className="relative grid size-10 shrink-0 place-items-center rounded-full text-base font-extrabold"
        style={{ background: 'var(--color-fundo)' }}
      >
        {membro.nome.charAt(0).toUpperCase()}
      </span>

      <div className="relative min-w-40 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-base font-bold">
          {membro.nome}
          {membro.souEu && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold"
              style={{ background: 'var(--color-linha)' }}
            >
              você
            </span>
          )}
        </p>
        <p className="text-sm" style={{ color: 'var(--color-texto-suave)' }}>
          {membro.email} · desde {formatarData(membro.desde)}
        </p>
      </div>

      <div className="relative flex flex-col items-end gap-1">
        <SeletorDePapel
          idBase={membro.usuarioId}
          valor={membro.papel}
          desativado={!podeEditar || emVoo}
          aoMudar={aoMudarPapel}
        />
        <p className="max-w-40 text-right text-xs" style={{ color: 'var(--color-texto-suave)' }}>
          {membro.souEu ? 'você não muda o próprio vínculo' : O_QUE_O_PAPEL_FAZ[membro.papel]}
        </p>
      </div>

      {podeEditar && (
        <div className="relative flex max-w-40 flex-col items-end gap-1">
          <BotaoSegurar rotulo="Remover" emoji="🗑️" ativo={false} aoCompletar={aoRemover} />
          <p className="text-right text-xs" style={{ color: 'var(--color-texto-suave)' }}>
            Tira o acesso às fichas e às crianças; o que essa pessoa já registrou continua
            guardado.
          </p>
        </div>
      )}
    </li>
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
      className="flex gap-1 rounded-full border-2 p-1"
      style={{ borderColor: 'var(--color-linha)' }}
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
