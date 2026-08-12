import { useState } from 'react';
import { convidar, entrar, sair, useConta } from '../dados/sessao';
import { temNuvem } from '../dados/supabase';

/**
 * Conta do voluntário, dentro das Configurações.
 *
 * Entrar é opcional e não muda nada do que já funciona: o app continua
 * gravando no aparelho. A conta serve para, na fase seguinte, sincronizar as
 * fichas entre os voluntários.
 */
export function Conta() {
  const { carregando, email, vinculo, recarregar } = useConta();
  const [entrando, setEntrando] = useState(false);
  const [dados, setDados] = useState({ email: '', senha: '' });
  const [convite, setConvite] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  if (!temNuvem()) {
    return (
      <Bloco>
        <p className="text-sm" style={{ color: 'var(--color-texto-suave)' }}>
          Este aparelho não está ligado à nuvem. Tudo funciona normalmente, só não sincroniza
          com os outros voluntários.
        </p>
      </Bloco>
    );
  }

  if (carregando) {
    return (
      <Bloco>
        <p className="text-sm" style={{ color: 'var(--color-texto-suave)' }}>
          Verificando…
        </p>
      </Bloco>
    );
  }

  if (!email) {
    return (
      <Bloco>
        {entrando ? (
          <div className="flex flex-col gap-2">
            <Campo
              rotulo="E-mail"
              tipo="email"
              valor={dados.email}
              aoMudar={(v) => setDados({ ...dados, email: v })}
            />
            <Campo
              rotulo="Senha"
              tipo="password"
              valor={dados.senha}
              aoMudar={(v) => setDados({ ...dados, senha: v })}
            />
            <div className="flex flex-wrap gap-2">
              <Botao
                rotulo="Entrar"
                destacado
                aoTocar={async () => {
                  const erro = await entrar(dados.email, dados.senha);
                  setAviso(erro);
                  if (!erro) {
                    setEntrando(false);
                    setDados({ email: '', senha: '' });
                    recarregar();
                  }
                }}
              />
              <Botao rotulo="Cancelar" aoTocar={() => setEntrando(false)} />
            </div>
          </div>
        ) : (
          <>
            <Botao rotulo="Entrar com minha conta" aoTocar={() => setEntrando(true)} />
            <p className="mt-2 text-xs" style={{ color: 'var(--color-texto-suave)' }}>
              Entrar é opcional. Sem conta, o app grava só neste aparelho — que é como ele
              funciona hoje.
            </p>
          </>
        )}
        {aviso && (
          <p className="mt-2 text-sm font-bold" style={{ color: 'var(--color-urgencia)' }}>
            {aviso}
          </p>
        )}
      </Bloco>
    );
  }

  return (
    <Bloco>
      <p className="text-base font-bold">{email}</p>
      <p className="text-sm" style={{ color: 'var(--color-texto-suave)' }}>
        {vinculo
          ? `${vinculo.ministerio} · ${vinculo.papel === 'coordenador' ? 'coordenação' : 'voluntário(a)'}`
          : 'Sem ministério vinculado — peça um convite à coordenação.'}
      </p>

      {vinculo?.papel === 'coordenador' && (
        <div className="mt-3 flex flex-col gap-2">
          <Campo
            rotulo="Convidar voluntário (e-mail)"
            tipo="email"
            valor={convite}
            aoMudar={setConvite}
          />
          <Botao
            rotulo="Convidar"
            aoTocar={async () => {
              const erro = await convidar(convite, vinculo.ministerioId);
              setAviso(erro ?? `Convite guardado para ${convite}.`);
              if (!erro) setConvite('');
            }}
          />
          <p className="text-xs" style={{ color: 'var(--color-texto-suave)' }}>
            A pessoa entra no ministério assim que criar a conta com esse e-mail.
          </p>
        </div>
      )}

      <div className="mt-3">
        <Botao
          rotulo="Sair"
          aoTocar={async () => {
            await sair();
            setAviso(null);
            recarregar();
          }}
        />
      </div>

      {aviso && (
        <p className="mt-2 text-sm font-bold" style={{ color: 'var(--color-acao)' }}>
          {aviso}
        </p>
      )}
    </Bloco>
  );
}

function Bloco({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3
        className="mb-2 text-sm font-bold uppercase tracking-wide"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        Conta
      </h3>
      {children}
    </section>
  );
}

function Campo({
  rotulo,
  tipo,
  valor,
  aoMudar,
}: {
  rotulo: string;
  tipo: string;
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{rotulo}</span>
      <input
        type={tipo}
        value={valor}
        autoComplete={tipo === 'password' ? 'current-password' : 'email'}
        onChange={(e) => aoMudar(e.target.value)}
        className="mt-1 min-h-12 w-full rounded-2xl border-2 px-4 text-base"
        style={{ borderColor: 'var(--color-linha)', background: 'var(--color-fundo)' }}
      />
    </label>
  );
}

function Botao({
  rotulo,
  aoTocar,
  destacado,
}: {
  rotulo: string;
  aoTocar: () => void | Promise<void>;
  destacado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => void aoTocar()}
      className="min-h-12 rounded-2xl border-2 px-4 text-base font-bold"
      style={{
        borderColor: destacado ? 'transparent' : 'var(--color-linha)',
        background: destacado ? 'var(--color-acao)' : 'transparent',
        color: destacado ? '#ffffff' : 'var(--color-texto)',
      }}
    >
      {rotulo}
    </button>
  );
}
