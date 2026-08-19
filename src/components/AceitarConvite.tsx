import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CampoDeTexto } from './CampoDeTexto';
import { aceitarConvite, conferirConvite } from '../dados/sessao';

/** Alfabeto do código, o mesmo de `gerar_codigo_de_convite()` na migração 0006. */
const LETRAS_DO_CODIGO = /[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g;
const TAMANHO_DO_CODIGO = 6;
const SENHA_MINIMA = 6;

type Etapa = 'codigo' | 'senha';

interface Props {
  /** Vem de `?convite=` no link do e-mail. Vazio quando a pessoa abriu na mão. */
  emailDoLink: string;
  aoEntrar: () => void;
  aoDesistir: () => void;
  aoFocarCampo: (campo: 'email' | 'senha' | null) => void;
  aoErrar: () => void;
  semMovimento: boolean;
}

/**
 * Aceitar o convite: conferir o código e criar a senha.
 *
 * Duas etapas, e não um formulário só, porque os dois erros possíveis pedem
 * respostas diferentes. Código errado é problema do e-mail — a pessoa volta lá
 * e confere. Senha curta é problema do que ela acabou de digitar. Juntos num
 * único "não deu", ela não sabe qual dos dois consertar, e a tentativa
 * seguinte é chute.
 *
 * Conferir o código antes também evita criar conta à toa: um `signUp` com
 * código errado deixaria um usuário órfão no Auth a cada tentativa.
 */
export function AceitarConvite({
  emailDoLink,
  aoEntrar,
  aoDesistir,
  aoFocarCampo,
  aoErrar,
  semMovimento,
}: Props) {
  const [etapa, setEtapa] = useState<Etapa>('codigo');
  const [email, setEmail] = useState(emailDoLink);
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recusar = (mensagem: string) => {
    setErro(mensagem);
    aoErrar();
  };

  const conferir = async () => {
    if (!email.includes('@')) {
      recusar('Confira o e-mail — falta o @.');
      return;
    }
    if (codigo.length < TAMANHO_DO_CODIGO) {
      recusar(`O código tem ${TAMANHO_DO_CODIGO} caracteres.`);
      return;
    }

    setOcupado(true);
    const vale = await conferirConvite(email, codigo);
    setOcupado(false);

    if (!vale) {
      recusar('Código incorreto, vencido, ou o e-mail não é o do convite.');
      return;
    }
    setErro(null);
    setEtapa('senha');
  };

  const criarConta = async () => {
    if (senha.length < SENHA_MINIMA) {
      recusar(`A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`);
      return;
    }

    setOcupado(true);
    const falha = await aceitarConvite(email, codigo, senha, nome);
    setOcupado(false);

    if (falha) {
      recusar(falha);
      return;
    }
    aoEntrar();
  };

  return (
    <motion.div
      key="convite"
      initial={semMovimento ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={semMovimento ? undefined : { opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-4"
    >
      <div
        className="rounded-2xl border-2 px-4 py-3"
        style={{
          borderColor: 'var(--color-acao)',
          background: 'color-mix(in oklab, var(--color-acao) 8%, transparent)',
        }}
      >
        <p className="text-sm font-bold">
          {etapa === 'codigo' ? 'Você tem um convite' : 'Convite conferido ✓'}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--color-texto-suave)' }}>
          {etapa === 'codigo'
            ? 'Informe o código de 6 caracteres que chegou no seu e-mail.'
            : 'Agora escolha a senha que você vai usar para entrar.'}
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {etapa === 'codigo' ? (
          <motion.form
            key="etapa-codigo"
            initial={semMovimento ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={semMovimento ? undefined : { opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void conferir();
            }}
          >
            <CampoDeTexto
              rotulo="E-mail do convite"
              tipo="email"
              autoCompletar="email"
              valor={email}
              auxilio={
                emailDoLink ? 'Veio do link do e-mail. Corrija se não for este.' : undefined
              }
              aoMudar={(v) => {
                setEmail(v);
                setErro(null);
              }}
              aoFocar={() => aoFocarCampo('email')}
              aoSair={() => aoFocarCampo(null)}
            />

            <label className="block">
              <span className="text-sm font-bold">Código do convite</span>
              <input
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={TAMANHO_DO_CODIGO}
                value={codigo}
                onFocus={() => aoFocarCampo('senha')}
                onBlur={() => aoFocarCampo(null)}
                // Filtra o que o alfabeto do código não tem. Quem copia do
                // e-mail traz espaço junto, e quem digita erra minúscula.
                onChange={(e) => {
                  setCodigo(e.target.value.toUpperCase().replace(LETRAS_DO_CODIGO, ''));
                  setErro(null);
                }}
                className="mt-1 min-h-16 w-full rounded-2xl border-2 text-center text-2xl font-extrabold tracking-[0.35em] uppercase focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  borderColor: erro ? 'var(--color-urgencia)' : 'var(--color-linha)',
                  background: 'var(--color-superficie)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                }}
              />
            </label>

            <Botao ocupado={ocupado} rotuloOcupado="Conferindo…">
              Conferir código
            </Botao>
          </motion.form>
        ) : (
          <motion.form
            key="etapa-senha"
            initial={semMovimento ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={semMovimento ? undefined : { opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void criarConta();
            }}
          >
            <CampoDeTexto
              rotulo="Seu nome"
              tipo="text"
              autoCompletar="name"
              valor={nome}
              auxilio="É o nome que a coordenação vê na lista da equipe."
              aoMudar={(v) => {
                setNome(v);
                setErro(null);
              }}
              aoFocar={() => aoFocarCampo('email')}
              aoSair={() => aoFocarCampo(null)}
            />

            <CampoDeTexto
              rotulo="Criar senha"
              tipo="password"
              autoCompletar="new-password"
              valor={senha}
              auxilio={`Pelo menos ${SENHA_MINIMA} caracteres.`}
              aoMudar={(v) => {
                setSenha(v);
                setErro(null);
              }}
              aoFocar={() => aoFocarCampo('senha')}
              aoSair={() => aoFocarCampo(null)}
            />

            <Botao ocupado={ocupado} rotuloOcupado="Criando…">
              Criar conta e entrar
            </Botao>

            <button
              type="button"
              onClick={() => {
                setEtapa('codigo');
                setErro(null);
              }}
              className="cursor-pointer text-sm font-bold underline underline-offset-2"
              style={{ color: 'var(--color-texto-suave)' }}
            >
              ← Voltar para o código
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {erro && (
        <p role="alert" className="text-sm font-bold" style={{ color: 'var(--color-urgencia)' }}>
          {erro}
        </p>
      )}

      <button
        type="button"
        onClick={aoDesistir}
        className="min-h-12 cursor-pointer self-start rounded-full px-1 text-sm font-bold underline underline-offset-4"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        Já tenho conta — entrar
      </button>
    </motion.div>
  );
}

function Botao({
  ocupado,
  rotuloOcupado,
  children,
}: {
  ocupado: boolean;
  rotuloOcupado: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={ocupado}
      className="min-h-14 cursor-pointer rounded-2xl text-lg font-extrabold transition-opacity duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      style={{ background: 'var(--color-acao)', color: '#ffffff' }}
    >
      {ocupado ? rotuloOcupado : children}
    </button>
  );
}
