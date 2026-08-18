import { useEffect, useRef, useState } from 'react';
import { apagarArquivo, chaveDaVoz, listarChaves, salvarArquivo } from '../dados/arquivos';
import { enfileirar } from '../dados/fila';
import { CARDS, falaDoCard } from '../data/cards';
import { esquecerVoz, tocarCard } from '../audio/player';
import type { Card } from '../types';

/**
 * Grava a voz de cada card com o microfone do aparelho.
 *
 * Resolve o gargalo real do projeto: os 42 áudios. A voz da mãe ou da
 * professora funciona melhor que qualquer TTS com a criança, e aqui sai sem
 * ferramenta externa, sem conta e sem custo.
 *
 * O que grava vale mais que o MP3 do repositório — é a voz que a criança
 * conhece. A ordem no `player.ts` é: gravação, depois MP3, depois voz do
 * navegador.
 */
export function GravarVozes() {
  const [comVoz, setComVoz] = useState<Set<string>>(new Set());
  const [gravando, setGravando] = useState<string | null>(null);
  /** Enquanto o navegador pergunta pelo microfone, o botão precisa dizer isso. */
  const [pedindo, setPedindo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const limite = useRef<number | undefined>(undefined);
  /** Microfone aberto agora — o que a onda desenha. */
  const [entradaAtiva, setEntradaAtiva] = useState<MediaStream | null>(null);

  useEffect(() => {
    void listarChaves().then((chaves) =>
      setComVoz(
        new Set(
          chaves.filter((c) => c.startsWith('voz:')).map((c) => c.slice('voz:'.length)),
        ),
      ),
    );
  }, []);

  /** Formato que o aparelho aceita. iOS grava em mp4; Android, em webm. */
  const formatoSuportado = () =>
    ['audio/webm', 'audio/mp4', 'audio/ogg'].find(
      (tipo) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(tipo),
    );

  const encerrarTudo = () => {
    window.clearTimeout(limite.current);
    setGravando(null);
    setPedindo(null);
    setEntradaAtiva(null);
  };

  const comecar = async (card: Card) => {
    setErro(null);

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErro('Este navegador não grava áudio. Tente pelo Chrome ou Safari atualizados.');
      return;
    }

    // Sobra de uma gravação anterior mantém o microfone ligado e confunde o
    // botão: encerra antes de abrir outra.
    if (gravador.current?.state === 'recording') gravador.current.stop();

    setPedindo(card.id);
    // `const` em vez de `let` atribuído dentro do try: as funções abaixo usam
    // `entrada`, e o TypeScript não consegue provar a atribuição dentro delas.
    const entrada = await navigator.mediaDevices
      .getUserMedia({ audio: true })
      .catch(() => null);

    if (!entrada) {
      setPedindo(null);
      setErro('Sem acesso ao microfone. Autorize nas permissões do navegador e tente de novo.');
      return;
    }

    const pedacos: Blob[] = [];
    const tipo = formatoSuportado();
    const recorder = new MediaRecorder(entrada, tipo ? { mimeType: tipo } : undefined);

    const soltarMicrofone = () => {
      entrada.getTracks().forEach((faixa) => faixa.stop());
      setEntradaAtiva(null);
    };

    recorder.ondataavailable = (evento) => {
      if (evento.data.size > 0) pedacos.push(evento.data);
    };

    // Sem isto, uma falha ao gravar deixava o botão preso em "Parar" para
    // sempre, e tocar nele não fazia nada.
    recorder.onerror = () => {
      soltarMicrofone();
      encerrarTudo();
      setErro('A gravação falhou no meio. Tente de novo.');
    };

    recorder.onstop = () => {
      soltarMicrofone();
      window.clearTimeout(limite.current);
      setGravando(null);
      setSalvando(card.id);

      void (async () => {
        try {
          if (pedacos.length === 0) throw new Error('nada foi gravado');
          await salvarArquivo(
            chaveDaVoz(card.id),
            new Blob(pedacos, { type: recorder.mimeType || tipo || 'audio/webm' }),
          );
          esquecerVoz(card.id);
          // A voz é do ministério: sobe para os outros aparelhos não
          // precisarem regravar as mesmas palavras.
          enfileirar('vozes', card.id);
          setComVoz((atual) => new Set(atual).add(card.id));
        } catch {
          // Armazenamento cheio ou navegação privada: precisa aparecer, senão
          // o voluntário acha que gravou.
          setErro('Não deu para salvar a gravação neste aparelho.');
        } finally {
          setSalvando(null);
        }
      })();
    };

    gravador.current = recorder;
    recorder.start();
    setPedindo(null);
    setGravando(card.id);
    setEntradaAtiva(entrada);

    // Trava de segurança: ninguém grava uma palavra por 30 segundos, e
    // gravação esquecida mantém o microfone aberto.
    limite.current = window.setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, 30_000);
  };

  /**
   * Parar tem que funcionar mesmo com o gravador em estado estranho — é o que
   * estava travando no celular: `stop()` num gravador já inativo lança erro,
   * o botão continuava escrito "Parar" e o toque não fazia nada.
   */
  const parar = () => {
    const recorder = gravador.current;
    try {
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
        return;
      }
      recorder?.stream.getTracks().forEach((faixa) => faixa.stop());
      encerrarTudo();
    } catch {
      encerrarTudo();
      setErro('A gravação foi interrompida pelo aparelho. Tente de novo.');
    }
  };

  const apagar = async (card: Card) => {
    await apagarArquivo(chaveDaVoz(card.id));
    esquecerVoz(card.id);
    setComVoz((atual) => {
      const proximo = new Set(atual);
      proximo.delete(card.id);
      return proximo;
    });
  };

  return (
    <div className="flex flex-col gap-4 px-3 pb-6 sm:px-4">
      <p className="text-sm" style={{ color: 'var(--color-texto-suave)' }}>
        Grave a palavra com a voz de quem a criança conhece. A gravação vale mais que o áudio
        do app e fica só neste aparelho — {comVoz.size} de {CARDS.length} já têm voz.
      </p>

      {erro && (
        <p className="text-base font-bold" style={{ color: 'var(--color-urgencia)' }}>
          {erro}
        </p>
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {CARDS.map((card) => {
          const temVoz = comVoz.has(card.id);
          const estaGravando = gravando === card.id;
          const estaPedindo = pedindo === card.id;
          const estaSalvando = salvando === card.id;
          return (
            <li
              key={card.id}
              data-classe={card.classe}
              className="flex flex-wrap items-center gap-2 rounded-2xl border-2 px-3 py-2"
              style={{ borderColor: temVoz ? 'var(--color-acao)' : 'var(--color-linha)' }}
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                {card.emoji}
              </span>
              <span className="flex-1">
                <span className="block text-base font-bold">{card.label}</span>
                <span className="text-xs" style={{ color: 'var(--color-texto-suave)' }}>
                  {temVoz ? 'com gravação' : `fala "${falaDoCard(card)}"`}
                </span>
              </span>

              <button
                type="button"
                onClick={() => tocarCard(card)}
                aria-label={`Ouvir ${card.label}`}
                className="size-11 rounded-xl border-2 text-lg"
                style={{ borderColor: 'var(--color-linha)' }}
              >
                ▶
              </button>

              <button
                type="button"
                disabled={estaSalvando || Boolean(pedindo)}
                onClick={() => (estaGravando ? parar() : void comecar(card))}
                aria-label={`${estaGravando ? 'Parar gravação de' : 'Gravar'} ${card.label}`}
                className="min-h-11 min-w-24 rounded-xl border-2 px-3 text-sm font-bold disabled:opacity-40"
                style={{
                  borderColor: estaGravando ? 'transparent' : 'var(--color-linha)',
                  background: estaGravando ? 'var(--color-urgencia)' : 'transparent',
                  color: estaGravando ? '#ffffff' : 'var(--color-texto)',
                }}
              >
                {estaSalvando
                  ? 'Salvando…'
                  : estaGravando
                    ? '■ Parar'
                    : estaPedindo
                      ? 'Permita…'
                      : '● Gravar'}
              </button>

              {temVoz && (
                <button
                  type="button"
                  onClick={() => void apagar(card)}
                  aria-label={`Apagar gravação de ${card.label}`}
                  className="size-11 rounded-xl border-2 text-lg font-bold"
                  style={{ borderColor: 'var(--color-linha)', color: 'var(--color-urgencia)' }}
                >
                  ✕
                </button>
              )}

              {estaGravando && <Onda entrada={entradaAtiva} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * A voz desenhada enquanto entra.
 *
 * Gravar sem ver nada acontecendo não distingue "microfone mudo" de "estou
 * falando baixo" — e a pessoa só descobre depois de gravar, ouvir e ter que
 * regravar. A onda responde isso durante, que é quando ainda dá para corrigir.
 *
 * Desenha o próprio sinal do microfone: não é animação em cima do áudio, é o
 * áudio. Por isso não passa por `prefers-reduced-motion` — parar de mexer aqui
 * seria apagar a informação, não acalmar a tela.
 */
function Onda({ entrada }: { entrada: MediaStream | null }) {
  const tela = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = tela.current;
    if (!entrada || !canvas) return;

    const contexto = canvas.getContext('2d');
    const audio = new AudioContext();
    const analisador = audio.createAnalyser();
    analisador.fftSize = 1024;
    audio.createMediaStreamSource(entrada).connect(analisador);

    const amostras = new Uint8Array(analisador.frequencyBinCount);
    let quadro = 0;

    const desenhar = () => {
      quadro = requestAnimationFrame(desenhar);
      if (!contexto) return;

      // O canvas acompanha o tamanho real na tela; sem isto a onda estica em
      // telas de densidade diferente.
      const largura = (canvas.width = canvas.clientWidth * devicePixelRatio);
      const altura = (canvas.height = canvas.clientHeight * devicePixelRatio);

      analisador.getByteTimeDomainData(amostras);
      contexto.clearRect(0, 0, largura, altura);
      contexto.lineWidth = 2 * devicePixelRatio;
      contexto.strokeStyle =
        getComputedStyle(canvas).getPropertyValue('--borda').trim() || '#dc2626';
      contexto.beginPath();

      for (let i = 0; i < amostras.length; i += 1) {
        // 128 é o silêncio no domínio do tempo; o desvio dele é a voz.
        const y = (amostras[i] / 128) * (altura / 2);
        const x = (i / amostras.length) * largura;
        if (i === 0) contexto.moveTo(x, y);
        else contexto.lineTo(x, y);
      }

      contexto.stroke();
    };

    desenhar();

    return () => {
      cancelAnimationFrame(quadro);
      void audio.close();
    };
  }, [entrada]);

  return (
    <canvas
      ref={tela}
      aria-hidden="true"
      className="h-10 w-full rounded-lg"
      style={{ background: 'var(--color-fundo)' }}
    />
  );
}
