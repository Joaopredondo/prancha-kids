import { useState } from 'react';
import { perfilVazio, type Perfil } from '../dados/perfis';

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

  const guardar = () => {
    if (!emEdicao) return;
    onSalvar(emEdicao);
    onEscolher(emEdicao.id);
    setEmEdicao(null);
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
                className="min-h-12 rounded-full border-2 px-4 text-base font-bold"
                style={{
                  borderColor: ativo ? 'transparent' : 'var(--color-linha)',
                  background: ativo ? 'var(--color-texto)' : 'transparent',
                  color: ativo ? 'var(--color-fundo)' : 'var(--color-texto)',
                }}
              >
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
