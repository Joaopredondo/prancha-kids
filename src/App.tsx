import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import logo from './assets/ipi.png';
import { Board } from './components/Board';
import { Footer } from './components/Footer';
import { MainNav, type Vista } from './components/MainNav';
import { MenuLateral } from './components/MenuLateral';
import { PortaoDoVoluntario } from './components/PortaoDoVoluntario';
import { SettingsSheet } from './components/SettingsSheet';
import { CARDS } from './data/cards';
import { carregarVozes, desbloquearAudio, prepararSons, tocarCard } from './audio/player';
import { estaDestrancado } from './dados/seguranca';
import { useConta } from './dados/sessao';
import { usePrefs } from './hooks/usePrefs';
import { useTema } from './hooks/useTema';
import { useWakeLock } from './hooks/useWakeLock';
import type { Card } from './types';

/**
 * As telas além da prancha entram sob demanda.
 *
 * Elas carregam GSAP e desenham gráfico; a prancha não usa nada disso e é a
 * única tela que a criança abre. Deixar tudo no mesmo pacote fazia a tela que
 * dá voz a ela esperar por animação de tela que ela nunca vê.
 *
 * Diferente da cena 3D do login, estes pedaços **entram** no cache offline
 * (`vite.config.ts`): a ficha é preenchida durante o culto, com ou sem wifi.
 */
const AgoraEDepois = lazy(() =>
  import('./components/AgoraEDepois').then((m) => ({ default: m.AgoraEDepois })),
);
const Ficha = lazy(() => import('./components/Ficha').then((m) => ({ default: m.Ficha })));
const Frequencia = lazy(() =>
  import('./components/Frequencia').then((m) => ({ default: m.Frequencia })),
);
const GravarVozes = lazy(() =>
  import('./components/GravarVozes').then((m) => ({ default: m.GravarVozes })),
);
const PainelDoMinisterio = lazy(() =>
  import('./components/PainelDoMinisterio').then((m) => ({ default: m.PainelDoMinisterio })),
);

export default function App() {
  const { prefs, definir } = usePrefs();
  const [cardAtivo, setCardAtivo] = useState<string | null>(null);
  /** Card cuja palavra está saindo agora — só o mais recente. */
  const [cardFalando, setCardFalando] = useState<string | null>(null);
  const semMovimento = useReducedMotion();
  const [configAberta, setConfigAberta] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  // A vista não é salva: quem abre o app cai sempre na prancha, não na ficha.
  // Duas exceções, ambas precisam do portão aberto de cara ou a prancha
  // nunca chegaria a ler a URL: link de convite (`?convite=` na query) e
  // link de recuperação de senha (o Supabase devolve `type=recovery` no
  // hash — `PortaoDoVoluntario` escuta o evento real via `aoRecuperarSenha`,
  // isto aqui só garante que ele já esteja montado quando o evento chegar).
  const [vista, setVista] = useState<Vista>(() => {
    if (new URLSearchParams(window.location.search).has('convite')) return 'login';
    if (window.location.hash.includes('type=recovery')) return 'login';
    return 'prancha';
  });
  /** Para onde voltar quando o login é aberto pelas Configurações. */
  const [depoisDeEntrar, setDepoisDeEntrar] = useState<Vista>('prancha');
  const [destrancado, setDestrancado] = useState(() => estaDestrancado());
  const { email: emailDaConta } = useConta();
  // Entrar com conta já é autenticação forte: pedir o código depois seria
  // barreira dupla para o mesmo adulto.
  const liberado = destrancado || Boolean(emailDaConta);
  const timerRef = useRef<number | undefined>(undefined);
  /** Rede de segurança: fala que nunca avisa que acabou não deixa o anel aceso. */
  const timerDaFalaRef = useRef<number | undefined>(undefined);

  useTema(prefs.tema);
  useWakeLock(prefs.telaAcesa);

  useEffect(() => {
    const liberar = () => desbloquearAudio();
    document.addEventListener('pointerdown', liberar, { once: true });
    prepararSons(CARDS);
    void carregarVozes(CARDS);
    return () => document.removeEventListener('pointerdown', liberar);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      window.clearTimeout(timerDaFalaRef.current);
    },
    [],
  );

  const cards = useMemo(
    () =>
      prefs.categoria === 'tudo'
        ? CARDS
        : CARDS.filter((c) => c.categoria === prefs.categoria),
    [prefs.categoria],
  );

  const aoTocar = (card: Card) => {
    setCardAtivo(card.id);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCardAtivo(null), 700);

    if (!prefs.som) return;

    setCardFalando(card.id);
    window.clearTimeout(timerDaFalaRef.current);
    // 8 segundos é folgado para qualquer palavra da prancha; só existe para o
    // caso de a voz do navegador engasgar e nunca avisar que terminou.
    timerDaFalaRef.current = window.setTimeout(() => setCardFalando(null), 8000);

    tocarCard(card, () => {
      window.clearTimeout(timerDaFalaRef.current);
      setCardFalando(null);
    });
  };

  const areaProtegida =
    vista === 'ficha' || vista === 'frequencia' || vista === 'vozes' || vista === 'ministerio';

  /**
   * Tela cheia, sem cabeçalho nem menu: é uma barreira, e barreira com o menu
   * do app por trás confunde — dá a impressão de que a tela está atrás de um
   * pop-up, e deixa clicável o que ainda não foi liberado.
   */
  if (vista === 'login' || (areaProtegida && !liberado)) {
    return (
      <PortaoDoVoluntario
        aoLiberar={() => {
          setDestrancado(true);
          if (vista === 'login') setVista(depoisDeEntrar);
        }}
        aoFechar={() => setVista(vista === 'login' ? depoisDeEntrar : 'prancha')}
      />
    );
  }

  return (
    <div
      data-tamanho={prefs.tamanho}
      className="mx-auto flex min-h-full max-w-6xl flex-col"
    >
      <header className="flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <button
          type="button"
          onClick={() => {
            if (!liberado) {
              setDepoisDeEntrar(vista);
              setVista('login');
              return;
            }
            setMenuAberto(true);
          }}
          aria-label="Abrir menu do voluntário"
          className="rounded-full border-2 px-3 py-2 text-lg"
          style={{ borderColor: 'var(--color-linha)', background: 'var(--color-superficie)' }}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <h1 className="flex flex-1 items-center gap-2 text-xl font-extrabold sm:text-2xl">
          <img
            src={logo}
            alt=""
            aria-hidden="true"
            className="size-9 shrink-0 rounded-xl sm:size-10"
          />
          Prancha Kids
        </h1>

        <button
          type="button"
          onClick={() => setConfigAberta(true)}
          aria-label="Abrir configurações"
          className="rounded-full border-2 px-3 py-2 text-lg"
          style={{ borderColor: 'var(--color-linha)', background: 'var(--color-superficie)' }}
        >
          <span aria-hidden="true">⚙️</span>
        </button>
      </header>

      <MainNav
        vista={vista}
        aba={prefs.categoria}
        onAba={(aba) => {
          definir('categoria', aba);
          setVista('prancha');
        }}
        onAgora={() => setVista('agora')}
        onFicha={() => setVista('ficha')}
      />

      <main className="flex-1">
        {/* A prancha fica fora da troca animada e fora do Suspense: voltar para
            ela precisa ser instantâneo. Quando a criança quer falar, não há
            transição que justifique um quadro de espera. */}
        {vista === 'prancha' ? (
          <Board
            cards={cards}
            cardAtivo={cardAtivo}
            cardFalando={cardFalando}
            onTocar={aoTocar}
          />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={vista}
              initial={semMovimento ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              // Sair mais rápido do que entrar: é o que faz a navegação
              // continuar parecendo instantânea mesmo com transição.
              exit={semMovimento ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
            >
              <Suspense fallback={<Carregando />}>
                {vista === 'agora' && <AgoraEDepois som={prefs.som} />}
                {/* Ficha, frequência e vozes só chegam aqui já liberadas: o
                    portão acontece antes, em tela cheia. */}
                {vista === 'ficha' && <Ficha />}
                {vista === 'frequencia' && <Frequencia />}
                {vista === 'vozes' && <GravarVozes />}
                {vista === 'ministerio' && <PainelDoMinisterio aoVoltar={() => setVista('prancha')} />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <Footer />

      <SettingsSheet
        aberto={configAberta}
        prefs={prefs}
        onDefinir={definir}
        onFechar={() => setConfigAberta(false)}
      />

      <MenuLateral
        aberto={menuAberto}
        vista={vista}
        aoFechar={() => setMenuAberto(false)}
        onFrequencia={() => setVista('frequencia')}
        onEquipe={() => setVista('ministerio')}
        onGravarVozes={() => setVista('vozes')}
        onEntrar={() => {
          setDepoisDeEntrar(vista);
          setVista('login');
        }}
      />
    </div>
  );
}

/**
 * Espera enquanto a tela chega.
 *
 * Reserva a mesma altura que o conteúdo vai ocupar: sem isso o rodapé pula
 * para o meio da tela e volta, e o salto chama mais atenção que a espera.
 */
function Carregando() {
  return (
    <p
      role="status"
      className="px-4 py-16 text-center text-base"
      style={{ color: 'var(--color-texto-suave)' }}
    >
      Abrindo…
    </p>
  );
}
