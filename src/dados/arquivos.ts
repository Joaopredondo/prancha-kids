/**
 * Guarda binários (fotos das crianças, vozes gravadas) em IndexedDB.
 *
 * `localStorage` não serve para isso: o limite gira em torno de 5 MB no total
 * e guarda só texto, então uma foto de celular estoura tudo na primeira
 * criança. Aqui vai o Blob já reduzido.
 *
 * Continua sendo **só neste aparelho** — não há servidor nem envio.
 */

const BANCO = 'prancha-kids';
const LOJA = 'arquivos';

let conexao: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  conexao ??= new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains(LOJA)) pedido.result.createObjectStore(LOJA);
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
  return conexao;
}

function transacao<T>(
  modo: IDBTransactionMode,
  acao: (loja: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return abrir().then(
    (banco) =>
      new Promise<T>((resolve, reject) => {
        const pedido = acao(banco.transaction(LOJA, modo).objectStore(LOJA));
        pedido.onsuccess = () => resolve(pedido.result);
        pedido.onerror = () => reject(pedido.error);
      }),
  );
}

export const salvarArquivo = (chave: string, dado: Blob) =>
  transacao('readwrite', (loja) => loja.put(dado, chave));

export const lerArquivo = (chave: string) =>
  transacao<Blob | undefined>('readonly', (loja) => loja.get(chave));

export const apagarArquivo = (chave: string) =>
  transacao('readwrite', (loja) => loja.delete(chave));

export const listarChaves = () =>
  transacao<IDBValidKey[]>('readonly', (loja) => loja.getAllKeys()).then((chaves) =>
    chaves.map(String),
  );

/**
 * Reduz a foto antes de guardar: 256 px no lado maior, WebP.
 *
 * Foto crua de celular tem alguns MB e é exibida num círculo de 3 cm — guardar
 * o original só ocupa espaço e deixa o app lento.
 */
export async function reduzirImagem(arquivo: File, lado = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const tela = document.createElement('canvas');
  tela.width = largura;
  tela.height = altura;
  tela.getContext('2d')?.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  return new Promise((resolve, reject) => {
    tela.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('não foi possível reduzir a imagem'))),
      'image/webp',
      0.85,
    );
  });
}

/** Chave da foto de um perfil. */
export const chaveDaFoto = (perfilId: string) => `foto:${perfilId}`;

/** Chave da gravação de um card da prancha. */
export const chaveDaVoz = (cardId: string) => `voz:${cardId}`;
