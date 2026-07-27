import { AUDIOS, IMAGENS } from 'virtual:assets';

const imagens = new Set(IMAGENS);
const audios = new Set(AUDIOS);

/** Tem foto própria em public/img? Se não, o card mostra o emoji. */
export const temImagem = (id: string) => imagens.has(id);

/** Tem gravação em public/audio? Se não, usa a voz do navegador. */
export const temAudio = (id: string) => audios.has(id);
