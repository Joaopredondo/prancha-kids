import { useEffect, useMemo, useRef, useState } from 'react';
import logo from './assets/ipi.png';
import { AgoraEDepois } from './components/AgoraEDepois';
import { Board } from './components/Board';
import { Ficha } from './components/Ficha';
import { Footer } from './components/Footer';
import { Frequencia } from './components/Frequencia';
import { GravarVozes } from './components/GravarVozes';
import { MainNav, type Vista } from './components/MainNav';
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

export default function App() {
  const { prefs, definir } = usePrefs();
  const [cardAtivo, setCardAtivo] = useState<string | null>(null);
  const [configAberta, setConfigAberta] = useState(false);
  // A vista não é salva: quem abre o app cai sempre na prancha, não na ficha.
  const [vista, setVista] = useState<Vista>('prancha');
  const [destrancado, setDestrancado] = useState(() => estaDestrancado());
  const { email: emailDaConta } = useConta();
  // Entrar com conta já é autenticação forte: pedir o código depois seria
  // barreira dupla para o mesmo adulto.
  const liberado = destrancado || Boolean(emailDaConta);
  const timerRef = useRef<number | undefined>(undefined);

  useTema(prefs.tema);
  useWakeLock(prefs.telaAcesa);

  useEffect(() => {
    const liberar = () => desbloquearAudio();
    document.addEventListener('pointerdown', liberar, { once: true });
    prepararSons(CARDS);
    void carregarVozes(CARDS);
    return () => document.removeEventListener('pointerdown', liberar);
  }, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

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
    if (prefs.som) tocarCard(card);
  };

  return (
    <div
      data-tamanho={prefs.tamanho}
      className="mx-auto flex min-h-full max-w-6xl flex-col"
    >
      <header className="flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <h1 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
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
        onFrequencia={() => setVista('frequencia')}
      />

      <main className="flex-1">
        {vista === 'prancha' && (
          <Board cards={cards} cardAtivo={cardAtivo} onTocar={aoTocar} />
        )}
        {vista === 'agora' && <AgoraEDepois som={prefs.som} />}
        {vista === 'vozes' &&
          (liberado ? <GravarVozes /> : <PortaoDoVoluntario aoLiberar={() => setDestrancado(true)} />)}
        {/* Ficha e frequência têm dado de saúde de menor: passam pelo código,
            quando houver um configurado. */}
        {(vista === 'ficha' || vista === 'frequencia') &&
          (liberado ? (
            vista === 'ficha' ? <Ficha /> : <Frequencia />
          ) : (
            <PortaoDoVoluntario aoLiberar={() => setDestrancado(true)} />
          ))}
        {vista === 'login' && (
          <PortaoDoVoluntario
            aoLiberar={() => {
              setDestrancado(true);
              setVista('prancha');
            }}
            aoFechar={() => setVista('prancha')}
          />
        )}
      </main>

      <Footer />

      <SettingsSheet
        aberto={configAberta}
        prefs={prefs}
        onDefinir={definir}
        onFechar={() => setConfigAberta(false)}
        onGravarVozes={() => setVista('vozes')}
        onEntrar={() => setVista('login')}
      />
    </div>
  );
}
