import { useEffect, useRef, useState } from 'react';
import { apagarArquivo, chaveDaVoz, listarChaves, salvarArquivo } from '../dados/arquivos';
import { CARDS, falaDoCard } from '../data/cards';
import { esquecerVoz, tocarCard } from '../audio/player';
import type { Card } from '../types';

/**
 * Grava a voz de cada card com o microfone do aparelho.
 *
 * Resolve o gargalo real do projeto: os 37 áudios. A voz da mãe ou da
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
  const [erro, setErro] = useState<string | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    void listarChaves().then((chaves) =>
      setComVoz(
        new Set(
          chaves.filter((c) => c.startsWith('voz:')).map((c) => c.slice('voz:'.length)),
        ),
      ),
    );
  }, []);

  const comecar = async (card: Card) => {
    setErro(null);
    try {
      const entrada = await navigator.mediaDevices.getUserMedia({ audio: true });
      const pedacos: Blob[] = [];
      const recorder = new MediaRecorder(entrada);

      recorder.ondataavailable = (evento) => pedacos.push(evento.data);
      recorder.onstop = async () => {
        entrada.getTracks().forEach((faixa) => faixa.stop());
        await salvarArquivo(chaveDaVoz(card.id), new Blob(pedacos, { type: recorder.mimeType }));
        esquecerVoz(card.id);
        setComVoz((atual) => new Set(atual).add(card.id));
        setGravando(null);
      };

      gravador.current = recorder;
      recorder.start();
      setGravando(card.id);
    } catch {
      setErro('Sem acesso ao microfone. Autorize nas permissões do navegador.');
      setGravando(null);
    }
  };

  const parar = () => gravador.current?.stop();

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
          return (
            <li
              key={card.id}
              data-classe={card.classe}
              className="flex items-center gap-2 rounded-2xl border-2 px-3 py-2"
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
                onClick={() => (estaGravando ? parar() : void comecar(card))}
                aria-label={`${estaGravando ? 'Parar gravação de' : 'Gravar'} ${card.label}`}
                className="min-h-11 rounded-xl border-2 px-3 text-sm font-bold"
                style={{
                  borderColor: estaGravando ? 'transparent' : 'var(--color-linha)',
                  background: estaGravando ? 'var(--color-urgencia)' : 'transparent',
                  color: estaGravando ? '#ffffff' : 'var(--color-texto)',
                }}
              >
                {estaGravando ? 'Parar' : '● Gravar'}
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
