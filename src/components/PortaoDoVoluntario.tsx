import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import logo from '../assets/ipi.png';
import { CARDS } from '../data/cards';
import { conferirPin, temPin } from '../dados/seguranca';
import { entrar } from '../dados/sessao';
import { temNuvem } from '../dados/supabase';

type Caminho = 'conta' | 'codigo';

interface Props {
  /** Chamado quando a pessoa provou que pode entrar. */
  aoLiberar: () => void;
  /** Presente quando a tela é aberta pelas Configurações, e não como barreira. */
  aoFechar?: () => void;
}

/** Cards que a criança já conhece, como identidade visual da tela. */
const VITRINE = ['sim', 'oi', 'agua', 'louvor'].flatMap((id) => {
  const card = CARDS.find((c) => c.id === id);
  return card ? [card] : [];
});

/**
 * Porta da área do voluntário — ficha, frequência e gravação de vozes.
 *
 * Duas chaves, nunca as duas ao mesmo tempo:
 * - **conta**, que também sincroniza entre os aparelhos;
 * - **código de 4 dígitos**, que funciona sem internet.
 *
 * Entrar com conta já é autenticação forte; pedir o código depois seria
 * barreira dupla para o mesmo adulto. Quem não tem conta, ou está sem rede,
 * continua entrando pelo código — por isso ele não sai de cena.
 *
 * A prancha e o "Agora e depois" **nunca** passam por aqui: criança sem
 * internet não pode ficar sem voz.
 */
export function PortaoDoVoluntario({ aoLiberar, aoFechar }: Props) {
  const comConta = temNuvem();
  const comCodigo = temPin();
  const semMovimento = useReducedMotion();

  const [caminho, setCaminho] = useState<Caminho>(comConta ? 'conta' : 'codigo');
  const [dados, setDados] = useState({ email: '', senha: '' });
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [emailInvalido, setEmailInvalido] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const tentarConta = async () => {
    if (!dados.email.includes('@')) {
      setEmailInvalido(true);
      return;
    }
    setOcupado(true);
    const falha = await entrar(dados.email.trim(), dados.senha);
    setOcupado(false);
    if (falha) {
      setErro(falha);
      return;
    }
    aoLiberar();
  };

  const tentarCodigo = async (valor: string) => {
    setCodigo(valor);
    setErro(null);
    if (valor.length < 4) return;

    if (await conferirPin(valor)) {
      aoLiberar();
      return;
    }
    setErro('Código errado.');
    setCodigo('');
  };

  return (
    // Ocupa a janela inteira: aqui não existe cabeçalho nem menu do app.
    <div className="grid min-h-dvh gap-0 lg:grid-cols-2">
      {/* Painel de identidade. No celular vira uma faixa curta no topo. */}
      <aside
        className="flex flex-col justify-center gap-6 px-6 pb-8 pt-[max(2rem,env(safe-area-inset-top))] lg:px-10 lg:py-14"
        style={{
          background:
            'linear-gradient(160deg, color-mix(in oklab, var(--color-coisa) 14%, var(--color-fundo)), var(--color-fundo))',
        }}
      >
        <div className="flex items-center gap-3">
          <img src={logo} alt="" aria-hidden="true" className="size-14 rounded-2xl sm:size-16" />
          <div>
            <p className="text-2xl font-extrabold leading-tight sm:text-3xl">Prancha Kids</p>
            <p className="text-sm" style={{ color: 'var(--color-texto-suave)' }}>
              2ª IPI · Ministério Infantil
            </p>
          </div>
        </div>

        <p className="max-w-sm text-base leading-relaxed" style={{ color: 'var(--color-texto-suave)' }}>
          A prancha é da criança e nunca pede senha. Esta parte é do voluntário: ficha do
          culto, frequência e cadastro.
        </p>

        {/* Amostra dos cards: diz o que é o app antes de qualquer texto. */}
        <ul aria-hidden="true" className="hidden grid-cols-4 gap-2 sm:grid lg:max-w-sm">
          {VITRINE.map((card, i) => (
            <motion.li
              key={card.id}
              data-classe={card.classe}
              initial={semMovimento ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.25 }}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-[3px]"
              style={{ borderColor: 'var(--borda)', background: 'var(--color-superficie)' }}
            >
              <span className="text-2xl leading-none">{card.emoji}</span>
              <span className="text-[0.65rem] font-bold">{card.label}</span>
            </motion.li>
          ))}
        </ul>
      </aside>

      {/* Formulário. */}
      <main className="flex items-center justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 lg:px-10">
        <motion.div
          initial={semMovimento ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex w-full max-w-sm flex-col gap-5"
        >
          <div>
            <h2 className="text-2xl font-extrabold">Área do voluntário</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-texto-suave)' }}>
              Aqui ficam nome, idade, laudo e foto das crianças.
            </p>
          </div>

          {comConta && (
            <div
              className="flex gap-1 rounded-full border-2 p-1"
              style={{ borderColor: 'var(--color-linha)' }}
            >
              <Aba
                rotulo="Minha conta"
                ativa={caminho === 'conta'}
                aoTocar={() => {
                  setCaminho('conta');
                  setErro(null);
                }}
              />
              <Aba
                rotulo="Código do tablet"
                ativa={caminho === 'codigo'}
                aoTocar={() => {
                  setCaminho('codigo');
                  setErro(null);
                }}
              />
            </div>
          )}

          {caminho === 'conta' && comConta ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void tentarConta();
              }}
            >
              <Campo
                rotulo="E-mail"
                tipo="email"
                autoCompletar="email"
                valor={dados.email}
                invalido={emailInvalido}
                dica={emailInvalido ? 'Falta o @ no e-mail.' : undefined}
                aoMudar={(v) => {
                  setDados({ ...dados, email: v });
                  setEmailInvalido(false);
                  setErro(null);
                }}
                aoSair={() => setEmailInvalido(dados.email.length > 0 && !dados.email.includes('@'))}
              />
              <Campo
                rotulo="Senha"
                tipo="password"
                autoCompletar="current-password"
                valor={dados.senha}
                aoMudar={(v) => {
                  setDados({ ...dados, senha: v });
                  setErro(null);
                }}
              />

              <button
                type="submit"
                disabled={ocupado}
                className="min-h-14 cursor-pointer rounded-2xl text-lg font-extrabold transition-opacity duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                style={{ background: 'var(--color-acao)', color: '#ffffff' }}
              >
                {ocupado ? 'Entrando…' : 'Entrar'}
              </button>

              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-texto-suave)' }}>
                Não há cadastro aberto: a coordenação convida por e-mail. Sem conta, use o{' '}
                <button
                  type="button"
                  onClick={() => setCaminho('codigo')}
                  className="cursor-pointer font-bold underline underline-offset-2"
                >
                  código do tablet
                </button>{' '}
                — o app funciona igual, só sem sincronizar.
              </p>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <label className="w-full text-center">
                <span className="text-sm font-bold">Código de 4 dígitos</span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={codigo}
                  onChange={(e) => void tentarCodigo(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="mt-2 min-h-16 w-full rounded-2xl border-2 text-center text-3xl font-extrabold tracking-[0.4em] focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    borderColor: erro ? 'var(--color-urgencia)' : 'var(--color-linha)',
                    background: 'var(--color-superficie)',
                  }}
                />
              </label>
              {!comCodigo && (
                <p className="text-center text-sm" style={{ color: 'var(--color-texto-suave)' }}>
                  Nenhum código configurado neste aparelho — qualquer número entra. Crie um em
                  Configurações → Código do voluntário.
                </p>
              )}
            </div>
          )}

          {erro && (
            <p
              role="alert"
              className="text-sm font-bold"
              style={{ color: 'var(--color-urgencia)' }}
            >
              {erro}
            </p>
          )}

          {aoFechar && (
            <button
              type="button"
              onClick={aoFechar}
              className="min-h-12 cursor-pointer self-start rounded-full px-1 text-base font-bold underline underline-offset-4"
              style={{ color: 'var(--color-texto-suave)' }}
            >
              ← Voltar para a prancha
            </button>
          )}
        </motion.div>
      </main>
    </div>
  );
}

function Aba({ rotulo, ativa, aoTocar }: { rotulo: string; ativa: boolean; aoTocar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={ativa}
      className="min-h-11 flex-1 cursor-pointer rounded-full text-sm font-bold transition-colors duration-200"
      style={{
        background: ativa ? 'var(--color-texto)' : 'transparent',
        color: ativa ? 'var(--color-fundo)' : 'var(--color-texto-suave)',
      }}
    >
      {rotulo}
    </button>
  );
}

function Campo({
  rotulo,
  tipo,
  valor,
  aoMudar,
  aoSair,
  autoCompletar,
  invalido,
  dica,
}: {
  rotulo: string;
  tipo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  aoSair?: () => void;
  autoCompletar: string;
  invalido?: boolean;
  dica?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{rotulo}</span>
      <input
        type={tipo}
        value={valor}
        autoComplete={autoCompletar}
        aria-invalid={invalido || undefined}
        onChange={(e) => aoMudar(e.target.value)}
        onBlur={aoSair}
        className="mt-1 min-h-14 w-full rounded-2xl border-2 px-4 text-base focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          borderColor: invalido ? 'var(--color-urgencia)' : 'var(--color-linha)',
          background: 'var(--color-superficie)',
        }}
      />
      {dica && (
        <span role="alert" className="mt-1 block text-xs font-bold" style={{ color: 'var(--color-urgencia)' }}>
          {dica}
        </span>
      )}
    </label>
  );
}
