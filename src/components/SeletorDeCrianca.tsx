import { useRef, useState } from 'react';
import { apagarArquivo, chaveDaFoto, reduzirImagem, salvarArquivo } from '../dados/arquivos';
import { perfilVazio, type Perfil } from '../dados/perfis';
import { useArquivo } from '../hooks/useArquivo';

interface Props {
  perfis: Perfil[];
  perfilAtivo: string | null;
  onEscolher: (perfilId: string | null) => void;
  onSalvar: (perfil: Perfil) => void;
  onApagar: (perfil: Perfil) => void;
}

/**
 * Cadastro das crianças, no topo da ficha.
 *
 * Escolher a criança preenche nome, idade e laudo — os três campos que o
 * voluntário redigitava a cada culto. Apagar exige dois toques porque leva as
 * fichas dela junto.
 */
export function SeletorDeCrianca({
  perfis,
  perfilAtivo,
  onEscolher,
  onSalvar,
  onApagar,
}: Props) {
  const [emEdicao, setEmEdicao] = useState<Perfil | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  /** Muda a cada troca de foto para o `useArquivo` reler o mesmo endereço. */
  const [versaoDaFoto, setVersaoDaFoto] = useState(0);
  const seletorDeArquivo = useRef<HTMLInputElement>(null);

  const guardar = () => {
    if (!emEdicao) return;
    onSalvar(emEdicao);
    onEscolher(emEdicao.id);
    setEmEdicao(null);
  };

  const trocarFoto = async (arquivo: File | undefined) => {
    if (!arquivo || !emEdicao) return;
    // Reduz para 256 px antes de guardar: foto crua de celular tem alguns MB.
    const reduzida = await reduzirImagem(arquivo);
    await salvarArquivo(chaveDaFoto(emEdicao.id), reduzida);
    setVersaoDaFoto((v) => v + 1);
    setEmEdicao({ ...emEdicao, temFoto: true });
  };

  const tirarFoto = async () => {
    if (!emEdicao) return;
    await apagarArquivo(chaveDaFoto(emEdicao.id));
    setVersaoDaFoto((v) => v + 1);
    setEmEdicao({ ...emEdicao, temFoto: false });
  };

  return (
    <section
      className="rounded-3xl border-2 p-4 print:hidden"
      style={{ borderColor: 'var(--color-linha)', background: 'var(--color-superficie)' }}
    >
      <h2
        className="text-sm font-bold uppercase tracking-wide"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        Criança
      </h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {perfis.map((perfil) => {
          const ativo = perfil.id === perfilAtivo;
          return (
            <div key={perfil.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onEscolher(perfil.id)}
                aria-pressed={ativo}
                className="flex min-h-12 items-center gap-2 rounded-full border-2 py-1 pl-1 pr-4 text-base font-bold"
                style={{
                  borderColor: ativo ? 'transparent' : 'var(--color-linha)',
                  background: ativo ? 'var(--color-texto)' : 'transparent',
                  color: ativo ? 'var(--color-fundo)' : 'var(--color-texto)',
                }}
              >
                <Retrato perfil={perfil} lado="2.25rem" versao={versaoDaFoto} />
                {perfil.nome || 'Sem nome'}
                {perfil.idade && (
                  <span className="ml-2 text-sm font-normal opacity-70">{perfil.idade}</span>
                )}
              </button>
              {ativo && (
                <button
                  type="button"
                  onClick={() => setEmEdicao(perfil)}
                  aria-label={`Editar cadastro de ${perfil.nome}`}
                  className="size-11 rounded-xl border-2 text-base"
                  style={{ borderColor: 'var(--color-linha)' }}
                >
                  ✎
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setEmEdicao(perfilVazio())}
          className="min-h-12 rounded-full border-2 border-dashed px-4 text-base font-bold"
          style={{ borderColor: 'var(--color-linha)', color: 'var(--color-texto-suave)' }}
        >
          + Nova criança
        </button>

        {perfilAtivo && (
          <button
            type="button"
            onClick={() => onEscolher(null)}
            className="min-h-12 rounded-full px-3 text-base font-bold"
            style={{ color: 'var(--color-texto-suave)' }}
          >
            Sem cadastro
          </button>
        )}
      </div>

      {emEdicao && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border-2 p-3" style={{ borderColor: 'var(--color-linha)' }}>
          <div className="flex items-center gap-3">
            <Retrato perfil={emEdicao} lado="4.5rem" versao={versaoDaFoto} />
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => seletorDeArquivo.current?.click()}
                  className="min-h-11 rounded-2xl border-2 px-4 text-sm font-bold"
                  style={{ borderColor: 'var(--color-linha)' }}
                >
                  {emEdicao.temFoto ? 'Trocar foto' : 'Adicionar foto'}
                </button>
                {emEdicao.temFoto && (
                  <button
                    type="button"
                    onClick={() => void tirarFoto()}
                    className="min-h-11 rounded-2xl border-2 px-4 text-sm font-bold"
                    style={{
                      borderColor: 'var(--color-linha)',
                      color: 'var(--color-urgencia)',
                    }}
                  >
                    Tirar foto
                  </button>
                )}
              </div>
              {/* Rosto de menor junto com nome e laudo, num aparelho sem senha:
                  o aviso precisa estar onde a foto é escolhida. */}
              <p className="text-xs" style={{ color: 'var(--color-texto-suave)' }}>
                Opcional. Peça autorização dos pais. A foto fica só neste aparelho e some ao
                apagar a criança.
              </p>
            </div>
            <input
              ref={seletorDeArquivo}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void trocarFoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>

          <Campo
            rotulo="Nome"
            valor={emEdicao.nome}
            aoMudar={(v) => setEmEdicao({ ...emEdicao, nome: v })}
            dica="Como o voluntário chama"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo
              rotulo="Idade"
              valor={emEdicao.idade}
              aoMudar={(v) => setEmEdicao({ ...emEdicao, idade: v })}
              dica="7 anos"
            />
            <div className="sm:col-span-2">
              <Campo
                rotulo="Laudo"
                valor={emEdicao.laudo}
                aoMudar={(v) => setEmEdicao({ ...emEdicao, laudo: v })}
                dica="TEA nível 2, baixa visão…"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={guardar}
              className="min-h-12 rounded-2xl px-5 text-base font-extrabold"
              style={{ background: 'var(--color-acao)', color: '#ffffff' }}
            >
              Salvar cadastro
            </button>
            <button
              type="button"
              onClick={() => {
                setEmEdicao(null);
                setConfirmando(null);
              }}
              className="min-h-12 rounded-2xl border-2 px-5 text-base font-bold"
              style={{ borderColor: 'var(--color-linha)' }}
            >
              Cancelar
            </button>

            {perfis.some((p) => p.id === emEdicao.id) && (
              <button
                type="button"
                onClick={() => {
                  if (confirmando === emEdicao.id) {
                    onApagar(emEdicao);
                    setEmEdicao(null);
                    setConfirmando(null);
                    return;
                  }
                  setConfirmando(emEdicao.id);
                }}
                className="min-h-12 rounded-2xl border-2 px-5 text-base font-bold"
                style={{
                  borderColor: 'var(--color-urgencia)',
                  color: confirmando === emEdicao.id ? '#ffffff' : 'var(--color-urgencia)',
                  background:
                    confirmando === emEdicao.id ? 'var(--color-urgencia)' : 'transparent',
                }}
              >
                {confirmando === emEdicao.id
                  ? 'Confirmar: apagar criança e fichas'
                  : 'Apagar criança'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Foto da criança, ou a inicial do nome enquanto não houver foto. */
export function Retrato({
  perfil,
  lado,
  versao = 0,
}: {
  perfil: Perfil;
  lado: string;
  versao?: number;
}) {
  const url = useArquivo(perfil.temFoto ? chaveDaFoto(perfil.id) : null, versao);

  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center overflow-hidden rounded-full border-2 bg-cover bg-center text-base font-extrabold"
      style={{
        width: lado,
        height: lado,
        borderColor: 'var(--color-linha)',
        background: url ? `url(${url}) center/cover` : 'var(--color-fundo)',
        color: 'var(--color-texto-suave)',
      }}
    >
      {!url && (perfil.nome.trim()[0]?.toUpperCase() ?? '?')}
    </span>
  );
}

function Campo({
  rotulo,
  valor,
  aoMudar,
  dica,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  dica?: string;
}) {
  return (
    <label className="block">
      <span className="text-base font-bold">{rotulo}</span>
      <input
        type="text"
        value={valor}
        placeholder={dica}
        onChange={(e) => aoMudar(e.target.value)}
        className="mt-2 min-h-12 w-full rounded-2xl border-2 px-4 text-base"
        style={{ borderColor: 'var(--color-linha)', background: 'var(--color-fundo)' }}
      />
    </label>
  );
}
