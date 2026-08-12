import { useEffect, useState } from 'react';
import { lerArquivo } from '../dados/arquivos';

/**
 * Devolve uma URL utilizável em `<img>` ou `<audio>` para um arquivo do
 * IndexedDB, e revoga a URL ao trocar — senão o navegador segura o blob na
 * memória até recarregar a página.
 *
 * `versao` força reler depois de gravar por cima da mesma chave.
 */
export function useArquivo(chave: string | null, versao: number = 0): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!chave) {
      setUrl(null);
      return;
    }

    let vivo = true;
    let atual: string | null = null;

    void lerArquivo(chave).then((blob) => {
      if (!vivo || !blob) return;
      atual = URL.createObjectURL(blob);
      setUrl(atual);
    });

    return () => {
      vivo = false;
      if (atual) URL.revokeObjectURL(atual);
      setUrl(null);
    };
  }, [chave, versao]);

  return url;
}
