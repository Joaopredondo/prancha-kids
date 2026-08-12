import { Howl, Howler } from 'howler';
import type { Card } from '../types';
import { falaDoCard } from '../data/cards';
import { temAudio } from '../assets/disponibilidade';
import { chaveDaVoz, lerArquivo } from '../dados/arquivos';

const BASE = import.meta.env.BASE_URL;

const sons = new Map<string, Howl>();
/** Gravações feitas no próprio aparelho, por id de card. */
const vozes = new Map<string, string>();
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
 * Toca o nome do card, na ordem: gravação feita no aparelho, MP3 do app, voz do
 * navegador. A gravação vem primeiro porque é a voz que a criança conhece.
 */
export function tocarCard(card: Card) {
  // Corta o que estava tocando: toques rápidos não podem sobrepor.
  Howler.stop();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  pendente = null;

  const gravada = vozes.get(card.id);
  if (gravada) {
    new Audio(gravada).play().catch(() => falar(falaDoCard(card)));
    return;
  }

  if (!temAudio(card.id) || semArquivo.has(card.id)) {
    falar(falaDoCard(card));
    return;
  }

  pendente = card.id;
  obterSom(card).play();
}

/** Carrega as gravações do aparelho para o toque sair sem espera. */
export async function carregarVozes(cards: Card[]) {
  for (const card of cards) {
    const blob = await lerArquivo(chaveDaVoz(card.id));
    if (blob) vozes.set(card.id, URL.createObjectURL(blob));
  }
}

/** Chamado ao gravar ou apagar: recarrega aquela voz na próxima vez. */
export function esquecerVoz(cardId: string) {
  const url = vozes.get(cardId);
  if (url) URL.revokeObjectURL(url);
  vozes.delete(cardId);
  void lerArquivo(chaveDaVoz(cardId)).then((blob) => {
    if (blob) vozes.set(cardId, URL.createObjectURL(blob));
  });
}

/** Pré-carrega só os cards que já têm gravação, para o toque sair sem atraso. */
export function prepararSons(cards: Card[]) {
  cards.filter((card) => temAudio(card.id)).forEach(obterSom);
}
