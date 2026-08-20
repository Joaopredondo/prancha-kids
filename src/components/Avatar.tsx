import { iniciais } from '../dados/avatar';
import { useArquivo } from '../hooks/useArquivo';

interface Props {
  /** Identidade de quem é o avatar — decide a cor da bolinha (ver `corDoAvatar` em cada tela). */
  cor: string;
  nome: string;
  /** `chaveDaFoto(id)` de quem o avatar representa, ou `null` quando a pessoa não tem foto. */
  fotoChave: string | null;
  /** Força reler o IndexedDB depois de gravar por cima da mesma chave. */
  versao?: number;
  tamanho?: 'md' | 'sm';
}

/**
 * Avatar de pessoa: foto quando existe, iniciais coloridas quando não.
 *
 * Compartilhado entre `Conta` (perfil de quem está logado) e
 * `PainelDoMinisterio` (equipe e atividade recente) — os três já mostravam a
 * mesma bolinha de iniciais, cada um com sua cópia. Adicionar foto num lugar
 * só fazia sentido depois de juntar as três.
 */
export function Avatar({ cor, nome, fotoChave, versao, tamanho = 'md' }: Props) {
  const url = useArquivo(fotoChave, versao);
  const classeTamanho = tamanho === 'sm' ? 'size-9 text-xs' : 'size-11 text-sm';

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`${classeTamanho} shrink-0 rounded-full object-cover`}
        style={{ border: `2px solid color-mix(in oklab, ${cor} 45%, transparent)` }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`grid ${classeTamanho} shrink-0 place-items-center rounded-full font-extrabold`}
      style={{
        background: `color-mix(in oklab, ${cor} 18%, var(--color-superficie))`,
        color: cor,
        border: `2px solid color-mix(in oklab, ${cor} 45%, transparent)`,
      }}
    >
      {iniciais(nome)}
    </span>
  );
}
