import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CampoDeTexto } from './CampoDeTexto';
import { pedirRecuperacaoDeSenha, redefinirSenha } from '../dados/sessao';

const SENHA_MINIMA = 6;

interface Props {
  /**
   * `true` quando a pessoa já voltou do link do e-mail e a sessão de
   * recuperação está pronta — aí a tela pula direto pra "nova senha". `false`
   * é quem acabou de clicar "Esqueci minha senha" e ainda vai pedir o link.
   */
  pronto: boolean;
  aoVoltar: () => void;
  aoEntrar: () => void;
  aoFocarCampo: (campo: 'email' | 'senha' | null) => void;
  aoErrar: () => void;
  semMovimento: boolean;
}

/**
 * Recuperação de senha em duas etapas que nunca acontecem na mesma visita:
 * pedir o link (aqui, no aparelho de sempre) e trocar a senha (depois de
 * abrir o link, possivelmente em outro aparelho). `pronto` decide qual das
 * duas está em jogo — ver `aoRecuperarSenha` em `dados/sessao.ts`.
 */
export function RecuperarSenha({
  pronto,
  aoVoltar,
  aoEntrar,
  aoFocarCampo,
  aoErrar,
  semMovimento,
}: Props) {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recusar = (mensagem: string) => {
    setErro(mensagem);
    aoErrar();
  };

  const enviarLink = async () => {
    if (!email.includes('@')) {
      recusar('Confira o e-mail — falta o @.');
      return;
    }
    setOcupado(true);
    const falha = await pedirRecuperacaoDeSenha(email);
    setOcupado(false);
    if (falha) {
      recusar(falha);
      return;
    }
    setErro(null);
    setEnviado(true);
  };

  const salvarSenha = async () => {
    if (senha.length < SENHA_MINIMA) {
      recusar(`A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`);
      return;
    }
    if (senha !== confirmar) {
      recusar('As duas senhas precisam ser iguais.');
      return;
    }
    setOcupado(true);
    const falha = await redefinirSenha(senha);
    setOcupado(false);
    if (falha) {
      recusar(falha);
      return;
    }
    aoEntrar();
  };

  if (pronto) {
    return (
      <motion.form
        key="recuperar-nova-senha"
        initial={semMovimento ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={semMovimento ? undefined : { opacity: 0, y: -6 }}
        transition={{ duration: 0.18 }}
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void salvarSenha();
        }}
      >
        <div
          className="rounded-2xl border-2 px-4 py-3"
          style={{
            borderColor: 'var(--color-acao)',
            background: 'color-mix(in oklab, var(--color-acao) 8%, transparent)',
          }}
        >
          <p className="text-sm font-bold">Link conferido ✓</p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-texto-suave)' }}>
            Escolha a senha nova.
          </p>
        </div>

        <CampoDeTexto
          rotulo="Nova senha"
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

        <CampoDeTexto
          rotulo="Confirmar senha"
          tipo="password"
          autoCompletar="new-password"
          valor={confirmar}
          aoMudar={(v) => {
            setConfirmar(v);
            setErro(null);
          }}
          aoFocar={() => aoFocarCampo('senha')}
          aoSair={() => aoFocarCampo(null)}
        />

        <Botao ocupado={ocupado} rotuloOcupado="Salvando…">
          Salvar nova senha
        </Botao>

        {erro && (
          <p role="alert" className="text-sm font-bold" style={{ color: 'var(--color-urgencia)' }}>
            {erro}
          </p>
        )}
      </motion.form>
    );
  }

  return (
    <motion.div
      key="recuperar-pedir-link"
      initial={semMovimento ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={semMovimento ? undefined : { opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-4"
    >
      {!enviado && (
        <div
          className="rounded-2xl border-2 px-4 py-3"
          style={{ borderColor: 'var(--color-linha)' }}
        >
          <p className="text-sm font-bold">Esqueceu a senha?</p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-texto-suave)' }}>
            Informe o e-mail da conta — mandamos um link pra escolher uma senha nova.
          </p>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {enviado ? (
          <motion.div
            key="enviado"
            initial={semMovimento ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border-2 px-4 py-3"
            style={{
              borderColor: 'var(--color-acao)',
              background: 'color-mix(in oklab, var(--color-acao) 8%, transparent)',
            }}
          >
            <p className="text-sm font-bold">Link enviado ✓</p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--color-texto-suave)' }}>
              Confira {email} e abra o link para escolher a senha nova.
            </p>
          </motion.div>
        ) : (
          <motion.form
            key="pedir"
            initial={semMovimento ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={semMovimento ? undefined : { opacity: 0 }}
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void enviarLink();
            }}
          >
            <CampoDeTexto
              rotulo="Seu e-mail"
              tipo="email"
              autoCompletar="email"
              valor={email}
              aoMudar={(v) => {
                setEmail(v);
                setErro(null);
              }}
              aoFocar={() => aoFocarCampo('email')}
              aoSair={() => aoFocarCampo(null)}
            />
            <Botao ocupado={ocupado} rotuloOcupado="Enviando…">
              Enviar link de recuperação
            </Botao>
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
        onClick={aoVoltar}
        className="min-h-12 cursor-pointer self-start rounded-full px-1 text-sm font-bold underline underline-offset-4"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        ← Voltar para entrar
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
