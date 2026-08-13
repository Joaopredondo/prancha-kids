import { chaveDaFoto, chaveDaVoz, lerArquivo, salvarArquivo } from './arquivos';
import { supabase } from './supabase';

/**
 * Fotos das crianças e vozes gravadas, no bucket privado.
 *
 * O bucket não é público e o caminho começa sempre pelo ministério — é o que a
 * regra de acesso confere. Foto de menor não pode ficar em endereço público nem
 * adivinhável, então nada aqui devolve URL: o arquivo é baixado e guardado no
 * aparelho, e a tela continua lendo do IndexedDB.
 */

const BUCKET = 'arquivos';

const caminhoDaFoto = (ministerioId: string, criancaId: string) =>
  `${ministerioId}/fotos/${criancaId}`;

const caminhoDaVoz = (ministerioId: string, cardId: string) =>
  `${ministerioId}/vozes/${cardId}`;

async function enviar(caminho: string, blob: Blob): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' });
  if (error) throw new Error(error.message);
}

async function baixar(caminho: string): Promise<Blob | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(caminho);
  return error ? null : data;
}

/** Sobe a foto de uma criança, se ela existir neste aparelho. */
export async function enviarFoto(ministerioId: string, criancaId: string): Promise<void> {
  const blob = await lerArquivo(chaveDaFoto(criancaId));
  if (!blob) return;
  await enviar(caminhoDaFoto(ministerioId, criancaId), blob);
}

/** Traz a foto quando o cadastro diz que existe uma e o aparelho não tem. */
export async function baixarFotoSeFaltar(
  ministerioId: string,
  criancaId: string,
): Promise<boolean> {
  if (await lerArquivo(chaveDaFoto(criancaId))) return false;
  const blob = await baixar(caminhoDaFoto(ministerioId, criancaId));
  if (!blob) return false;
  await salvarArquivo(chaveDaFoto(criancaId), blob);
  return true;
}

export async function enviarVoz(ministerioId: string, cardId: string): Promise<void> {
  const blob = await lerArquivo(chaveDaVoz(cardId));
  if (!blob) return;
  await enviar(caminhoDaVoz(ministerioId, cardId), blob);
}

/**
 * Traz as vozes que este aparelho ainda não tem.
 *
 * A voz é do ministério, não da criança: gravada uma vez, serve a todos os
 * aparelhos — é o que evita cada voluntário regravar as mesmas 37 palavras.
 */
export async function baixarVozesQueFaltam(ministerioId: string): Promise<string[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.storage.from(BUCKET).list(`${ministerioId}/vozes`);
  if (error || !data) return [];

  const baixadas: string[] = [];
  for (const arquivo of data) {
    const cardId = arquivo.name;
    if (await lerArquivo(chaveDaVoz(cardId))) continue;

    const blob = await baixar(caminhoDaVoz(ministerioId, cardId));
    if (!blob) continue;
    await salvarArquivo(chaveDaVoz(cardId), blob);
    baixadas.push(cardId);
  }
  return baixadas;
}
