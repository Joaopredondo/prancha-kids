import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import logo from '../assets/ipi.png';
import { conferirPin, temPin } from '../dados/seguranca';
import { aoRecuperarSenha, entrar } from '../dados/sessao';
import { temNuvem } from '../dados/supabase';
import { AceitarConvite } from './AceitarConvite';
import { CampoDeTexto } from './CampoDeTexto';
import { CenaDaPrancha } from './CenaDaPrancha';
import { RecuperarSenha } from './RecuperarSenha';
import type { Momento } from '../three/cenaDaPrancha';

type Caminho = 'conta' | 'codigo' | 'convite' | 'recuperar';
type Campo = 'email' | 'senha';

/**
 * O e-mail que veio no link do convite.
 *
 * Query string, e não `/convite`: o app não tem roteador, e um caminho novo
 * dependeria de o servidor devolver o `index.html` para uma rota que não é
 * arquivo. Com `?convite=`, o link funciona em qualquer hospedagem, sem
 * configuração nenhuma.
 *
 * Some da barra de endereço depois de lido — o e-mail de alguém não precisa
 * ficar no histórico do navegador nem viajar no cabeçalho de referência.
 */
function lerConviteDaUrl(): string {
  try {
    const url = new URL(window.location.href);
    const email = url.searchParams.get('convite');
    if (!email) return '';

    url.searchParams.delete('convite');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    return email.trim().toLowerCase();
  } catch {
    return '';
  }
}

interface Props {
  /** Chamado quando a pessoa provou que pode entrar. */
  aoLiberar: () => void;
  /** Presente quando a tela é aberta pelas Configurações, e não como barreira. */
  aoFechar?: () => void;
}

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

  // Lido uma vez, na montagem: a leitura limpa a query string, e repetir em
  // cada render devolveria string vazia a partir da segunda vez.
  const [emailDoConvite] = useState(lerConviteDaUrl);

  const [caminho, setCaminho] = useState<Caminho>(
    emailDoConvite && comConta ? 'convite' : comConta ? 'conta' : 'codigo',
  );
  const [dados, setDados] = useState({ email: '', senha: '' });
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [tentativasErradas, setTentativasErradas] = useState(0);
  const [emailInvalido, setEmailInvalido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  /** Segura a tela por um instante com o gesto de "liberado" antes de sair. */
  const [liberando, setLiberando] = useState(false);
  const [campoFocado, setCampoFocado] = useState<Campo | null>(null);
  /** Recusa é reação de um instante, não estado: some sozinha. */
  const [recusando, setRecusando] = useState(false);
  /** Verdadeiro só depois que o Supabase confirma a sessão de recuperação vinda do e-mail. */
  const [sessaoDeRecuperacao, setSessaoDeRecuperacao] = useState(false);

  useEffect(() => {
    if (tentativasErradas === 0) return;
    setRecusando(true);
    const id = window.setTimeout(() => setRecusando(false), 1400);
    return () => window.clearTimeout(id);
  }, [tentativasErradas]);

  // O link do e-mail pode cair aqui a qualquer momento, mesmo com a tela já
  // aberta noutra aba: o Supabase lê o token da URL sozinho e dispara o
  // evento — não dá pra saber isso na hora de montar o componente.
  useEffect(() => aoRecuperarSenha(() => {
    setSessaoDeRecuperacao(true);
    setCaminho('recuperar');
  }), []);

  // A cena do painel responde ao formulário. A ordem importa: a comemoração
  // ganha da recusa, e a recusa ganha do campo em foco — senão a reação ao
  // erro nunca apareceria, porque o campo continua focado depois de falhar.
  const momento: Momento = liberando
    ? 'sucesso'
    : recusando
      ? 'erro'
      : campoFocado === 'senha'
        ? 'senha'
        : campoFocado
          ? 'digitando'
          : 'repouso';

  const abrirAPorta = () => {
    if (semMovimento) {
      aoLiberar();
      return;
    }
    setLiberando(true);
    // Tempo do card virar e mostrar o "Sim": a volta leva 0,85s e a face
    // aparece na metade dela. Com os 420ms de antes a tela saía antes de o
    // card sequer terminar de girar.
    window.setTimeout(aoLiberar, 1150);
  };

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
      setTentativasErradas((n) => n + 1);
      return;
    }
    abrirAPorta();
  };

  const tentarCodigo = async (valor: string) => {
    setCodigo(valor);
    setErro(null);
    if (valor.length < 4) return;

    if (await conferirPin(valor)) {
      abrirAPorta();
      return;
    }
    setErro('Código errado.');
    setTentativasErradas((n) => n + 1);
    setCodigo('');
  };

  return (
    <MotionConfig reducedMotion="user">
    {/* Ocupa a janela inteira: aqui não existe cabeçalho nem menu do app. */}
    <div className="grid min-h-dvh gap-0 lg:grid-cols-2">
      {/* Painel de identidade. No celular vira uma faixa curta no topo. */}
      <aside
        className="relative overflow-hidden"
        style={{
          background:
            'linear-gradient(160deg, color-mix(in oklab, var(--color-coisa) 14%, var(--color-fundo)), var(--color-fundo))',
        }}
      >
        <CenaDaPrancha momento={momento} />

        {/* O conteúdo sobe para o alto: a metade de baixo é palco do card que
            gira, e texto por cima dele não se lê. */}
        <div className="relative z-10 flex h-full flex-col justify-center gap-6 px-6 pb-8 pt-[max(2rem,env(safe-area-inset-top))] lg:justify-start lg:px-10 lg:pt-24">
          {/* Véu atrás do texto, não à frente da cena: os cards continuam
              passando por aqui: prender o voo deles ao texto tiraria o que a
              cena tem de vivo. O que muda é o contraste embaixo da letra —
              um degradê que morre antes da borda, para não virar uma caixa. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-full max-w-xl"
            style={{
              background:
                'radial-gradient(120% 60% at 0% 38%, color-mix(in oklab, var(--color-fundo) 86%, transparent) 0%, color-mix(in oklab, var(--color-fundo) 62%, transparent) 45%, transparent 78%)',
            }}
          />

          <motion.div
            initial={semMovimento ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="relative flex items-center gap-3"
          >
            <img src={logo} alt="" aria-hidden="true" className="size-14 rounded-2xl sm:size-16" />
            <div>
              <p className="text-2xl font-extrabold leading-tight sm:text-3xl">Prancha Kids</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-texto)' }}>
                2ª IPI · Ministério Infantil
              </p>
            </div>
          </motion.div>

          <motion.p
            initial={semMovimento ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="relative max-w-sm text-base font-semibold leading-relaxed"
            style={{ color: 'var(--color-texto)' }}
          >
            A prancha é da criança e nunca pede senha. Esta parte é do voluntário: ficha do
            culto, frequência e cadastro.
          </motion.p>
        </div>
      </aside>

      {/* Formulário. */}
      <main className="relative flex items-center justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 lg:px-10">
        <motion.div
          initial={semMovimento ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex w-full max-w-sm flex-col gap-5"
        >
          <div>
            <h2 className="text-2xl font-extrabold">Área do voluntário</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-texto-suave)' }}>
              Aqui ficam nome, idade, laudo, alergias, necessidades de acessibilidade e foto das
              crianças.
            </p>
          </div>

          {/* As abas somem durante o convite e a recuperação: ali a pessoa
              está num fluxo de etapas, e uma aba ao lado convida a sair dele
              no meio. A saída existe, mas como link discreto no formulário. */}
          {comConta && caminho !== 'convite' && caminho !== 'recuperar' && (
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

          <AnimatePresence mode="wait" initial={false}>
          {caminho === 'convite' && comConta ? (
            <AceitarConvite
              key="convite"
              emailDoLink={emailDoConvite}
              semMovimento={Boolean(semMovimento)}
              aoFocarCampo={setCampoFocado}
              aoErrar={() => setTentativasErradas((n) => n + 1)}
              aoEntrar={abrirAPorta}
              aoDesistir={() => {
                setCaminho('conta');
                setErro(null);
              }}
            />
          ) : caminho === 'recuperar' && comConta ? (
            <RecuperarSenha
              key="recuperar"
              pronto={sessaoDeRecuperacao}
              semMovimento={Boolean(semMovimento)}
              aoFocarCampo={setCampoFocado}
              aoErrar={() => setTentativasErradas((n) => n + 1)}
              aoEntrar={abrirAPorta}
              aoVoltar={() => {
                setCaminho('conta');
                setErro(null);
              }}
            />
          ) : caminho === 'conta' && comConta ? (
            <motion.form
              key="conta"
              initial={semMovimento ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={semMovimento ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void tentarConta();
              }}
            >
              <CampoDeTexto
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
                aoFocar={() => setCampoFocado('email')}
                aoSair={() => {
                  setCampoFocado(null);
                  setEmailInvalido(dados.email.length > 0 && !dados.email.includes('@'));
                }}
              />
              <div>
                <CampoDeTexto
                  rotulo="Senha"
                  tipo="password"
                  autoCompletar="current-password"
                  valor={dados.senha}
                  aoFocar={() => setCampoFocado('senha')}
                  aoSair={() => setCampoFocado(null)}
                  aoMudar={(v) => {
                    setDados({ ...dados, senha: v });
                    setErro(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setCaminho('recuperar');
                    setErro(null);
                  }}
                  className="mt-1.5 cursor-pointer text-xs font-bold underline underline-offset-2"
                  style={{ color: 'var(--color-texto-suave)' }}
                >
                  Esqueci minha senha
                </button>
              </div>

              <button
                type="submit"
                disabled={ocupado}
                className="min-h-14 cursor-pointer rounded-2xl text-lg font-extrabold transition-opacity duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                style={{ background: 'var(--color-acao)', color: '#ffffff' }}
              >
                {ocupado ? 'Entrando…' : 'Entrar'}
              </button>

              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-texto-suave)' }}>
                Não há cadastro aberto: a coordenação convida por e-mail.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setCaminho('convite');
                    setErro(null);
                  }}
                  className="cursor-pointer font-bold underline underline-offset-2"
                >
                  Recebi um convite
                </button>
                . Sem conta, use o{' '}
                <button
                  type="button"
                  onClick={() => setCaminho('codigo')}
                  className="cursor-pointer font-bold underline underline-offset-2"
                >
                  código do tablet
                </button>{' '}
                — o app funciona igual, só sem sincronizar.
              </p>
            </motion.form>
          ) : (
            <motion.div
              key="codigo"
              initial={semMovimento ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={semMovimento ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col items-center gap-3"
            >
              <label className="w-full text-center">
                <span className="text-sm font-bold">Código de 4 dígitos</span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={codigo}
                  onFocus={() => setCampoFocado('senha')}
                  onBlur={() => setCampoFocado(null)}
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
            </motion.div>
          )}
          </AnimatePresence>

          {erro && (
            <motion.p
              key={tentativasErradas}
              role="alert"
              initial={semMovimento ? false : { x: 0 }}
              animate={semMovimento ? undefined : { x: [0, -6, 6, -4, 4, 0] }}
              transition={{ duration: 0.4 }}
              className="text-sm font-bold"
              style={{ color: 'var(--color-urgencia)' }}
            >
              {erro}
            </motion.p>
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

        {/* Confirmação de "liberado". Cobre só a coluna do formulário, e não a
            janela inteira: do outro lado o card da prancha está comemorando, e
            era justamente isso que o véu de tela cheia escondia. */}
        <AnimatePresence>
          {liberando && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 z-40 grid place-items-center"
              style={{
                background: 'color-mix(in oklab, var(--color-fundo) 88%, transparent)',
              }}
            >
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                // Entra depois do card começar a virar: primeiro a comemoração,
                // depois o carimbo.
                transition={{ type: 'spring', stiffness: 320, damping: 20, delay: 0.3 }}
                aria-hidden="true"
                className="grid size-20 place-items-center rounded-full text-4xl font-black"
                style={{ background: 'var(--color-acao)', color: '#ffffff' }}
              >
                ✓
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
    </MotionConfig>
  );
}

function Aba({ rotulo, ativa, aoTocar }: { rotulo: string; ativa: boolean; aoTocar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={ativa}
      className="relative min-h-11 flex-1 cursor-pointer rounded-full text-sm font-bold"
      style={{ color: ativa ? 'var(--color-fundo)' : 'var(--color-texto-suave)' }}
    >
      {/* `layoutId` compartilhado: a pílula desliza de uma aba para a outra
          em vez de sumir numa e reaparecer na outra. */}
      {ativa && (
        <motion.span
          layoutId="aba-ativa"
          className="absolute inset-0 rounded-full"
          style={{ background: 'var(--color-texto)' }}
          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
        />
      )}
      <span className="relative z-10">{rotulo}</span>
    </button>
  );
}
