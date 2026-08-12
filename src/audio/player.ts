import { Howl, Howler } from 'howler';
import type { Card } from '../types';
import { falaDoCard } from '../data/cards';
import { temAudio } from '../assets/disponibilidade';

const BASE = import.meta.env.BASE_URL;

const sons = new Map<string, Howl>();
/** Cards cujo MP3 não existe/falhou: vão direto para a voz do navegador. */
const semArquivo = new Set<string>();
/** Card cujo toque ainda espera o áudio carregar. */
let pendente: string | null = null;

let vozPt: SpeechSynthesisVoice | null = null;

function escolherVoz() {
  if (!('speechSynthesis' in window)) return;
  const vozes = speechSynthesis.getVoices();
  vozPt =
    vozes.find((v) => v.lang === 'pt-BR' || v.lang === 'pt_BR') ??
    vozes.find((v) => v.lang.startsWith('pt')) ??
    null;
}

if ('speechSynthesis' in window) {
  escolherVoz();
  speechSynthesis.addEventListener('voiceschanged', escolherVoz);
}

/**
 * iOS/Android só liberam áudio dentro de um gesto do usuário.
 * Chamado no primeiro toque da página.
 */
export function desbloquearAudio() {
  if (Howler.ctx?.state === 'suspended') void Howler.ctx.resume();
}

function falar(texto: string) {
  if (!('speechSynthesis' in window)) return;
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = 'pt-BR';
  fala.rate = 0.9;
  if (vozPt) fala.voice = vozPt;
  speechSynthesis.speak(fala);
}

/**
 * Fala um texto avulso — usado pelo quadro "Agora e depois", que anuncia a
 * troca de atividade e não tem card correspondente para cada figurinha.
 */
export function falarTexto(texto: string) {
  Howler.stop();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  falar(texto);
}

function semSomDisponivel(card: Card) {
  semArquivo.add(card.id);
  sons.delete(card.id);
  if (pendente === card.id) {
    pendente = null;
    falar(falaDoCard(card));
  }
}

function obterSom(card: Card): Howl {
  const existente = sons.get(card.id);
  if (existente) return existente;

  const som = new Howl({
    src: [`${BASE}audio/${card.id}.mp3`],
    preload: true,
    html5: false,
    onplay: () => {
      if (pendente === card.id) pendente = null;
    },
    onloaderror: () => semSomDisponivel(card),
    onplayerror: () => semSomDisponivel(card),
  });

  sons.set(card.id, som);
  return som;
}

/**
 * Toca o nome do card. Usa o MP3 gravado quando existe e cai para a voz
 * do navegador quando não existe — a prancha nunca fica muda.
 */
export function tocarCard(card: Card) {
  // Corta o que estava tocando: toques rápidos não podem sobrepor.
  Howler.stop();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  pendente = null;

  if (!temAudio(card.id) || semArquivo.has(card.id)) {
    falar(falaDoCard(card));
    return;
  }

  pendente = card.id;
  obterSom(card).play();
}

/** Pré-carrega só os cards que já têm gravação, para o toque sair sem atraso. */
export function prepararSons(cards: Card[]) {
  cards.filter((card) => temAudio(card.id)).forEach(obterSom);
}
