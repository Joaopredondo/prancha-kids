import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Avatar } from './Avatar';
import { apagarArquivo, chaveDaFoto, reduzirImagem, salvarArquivo } from '../dados/arquivos';
import { enviarFotoDoMembro, removerFotoDoMembro } from '../dados/arquivosNuvem';
import { corDoAvatar } from '../dados/avatar';
import { definirFotoDoMembro } from '../dados/membros';
import { convidar, sair, useConta } from '../dados/sessao';
import { temNuvem } from '../dados/supabase';
import { useSincronizacao } from '../hooks/useSincronizacao';

/**
 * Cartão de perfil no topo do menu do voluntário.
 *
 * É o mesmo lugar onde a referência visual põe o avatar de quem está
 * logado — e aqui isso resolve dois pedidos de uma vez: identidade sempre à
 * vista (não precisa caçar "Entrar" lá embaixo) e a mesma cor de avatar da
 * lista de Equipe (`corDoAvatar`), pra ficar claro que é a mesma pessoa em
 * telas diferentes.
 */
export function Conta({ onEntrar }: { onEntrar: () => void }) {
  const { carregando, usuarioId, email, vinculo, saiuDaEquipe, fotoAtualizadaEm, recarregar } =
    useConta();
  const { pendentes, ocupado, ultimo, sincronizarAgora, enviarTudo } = useSincronizacao(
    vinculo?.ministerioId ?? null,
  );
  const [conviteAberto, setConviteAberto] = useState(false);
  const [convite, setConvite] = useState('');
  const [convidando, setConvidando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Sobrepõe o que o servidor diz, até `recarregar()` confirmar — sem isso a
      foto nova só aparece depois de um round-trip inteiro. */
  const [fotoLocal, setFotoLocal] = useState<{ tem: boolean; versao: number } | null>(null);
  const seletorDeArquivo = useRef<HTMLInputElement>(null);

  const temFoto = fotoLocal?.tem ?? Boolean(fotoAtualizadaEm);
  const versaoDaFoto = fotoLocal?.versao ?? 0;

  const trocarFoto = async (arquivo: File | undefined) => {
    if (!arquivo || !usuarioId || !vinculo) return;
    // Reduz para 256 px antes de guardar: foto crua de celular tem alguns MB.
    const reduzida = await reduzirImagem(arquivo);
    await salvarArquivo(chaveDaFoto(usuarioId), reduzida);
    setFotoLocal((atual) => ({ tem: true, versao: (atual?.versao ?? 0) + 1 }));
    try {
      await enviarFotoDoMembro(vinculo.ministerioId, usuarioId);
      setAviso(await definirFotoDoMembro(true));
    } catch {
      setAviso('Não deu para enviar a foto. Ela fica só neste aparelho por enquanto.');
    }
  };

  const removerFoto = async () => {
    if (!usuarioId) return;
    await apagarArquivo(chaveDaFoto(usuarioId));
    setFotoLocal((atual) => ({ tem: false, versao: (atual?.versao ?? 0) + 1 }));
    if (vinculo) await removerFotoDoMembro(vinculo.ministerioId, usuarioId);
    setAviso(await definirFotoDoMembro(false));
  };

  if (!temNuvem()) {
    return (
      <Cartao>
        <LinhaDeIdentidade avatar="📴" rotulo="Este aparelho" legenda="Sem conta na nuvem" />
        <p className="mt-2 text-xs" style={{ color: 'var(--color-texto-suave)' }}>
          Tudo funciona normalmente, só não sincroniza com os outros voluntários.
        </p>
      </Cartao>
    );
  }

  if (carregando) {
    return <Cartao><LinhaDeIdentidade avatar="…" rotulo="Verificando" legenda="" /></Cartao>;
  }

  if (!email) {
    return (
      <Cartao>
        <button
          type="button"
          onClick={onEntrar}
          className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-1 py-1 text-left"
        >
          <Avatar cor="var(--color-texto-suave)" nome="?" fotoChave={null} />
          <span className="min-w-0 flex-1">
            <span className="block text-base font-extrabold">Entrar com minha conta</span>
            <span className="block text-xs" style={{ color: 'var(--color-texto-suave)' }}>
              Sincroniza as fichas entre os voluntários
            </span>
          </span>
        </button>
      </Cartao>
    );
  }

  // Removida da equipe. A RLS já não devolve ficha nem criança deste
  // ministério, então sincronizar/convidar descreveria algo que não
  // acontece mais. Melhor uma frase honesta do que botões que falham em
  // silêncio.
  if (saiuDaEquipe) {
    return (
      <Cartao>
        <LinhaDeIdentidade
          avatar={<Avatar cor="var(--color-urgencia)" nome={email.split('@')[0]} fotoChave={null} />}
          rotulo={email}
          legenda="Não está mais na equipe"
          corDaLegenda="var(--color-urgencia)"
        />
        <p className="mt-2 text-xs" style={{ color: 'var(--color-texto-suave)' }}>
          A sincronização parou: o que for preenchido agora fica só neste aparelho.
        </p>
        <BotaoTexto rotulo="Sair" aoTocar={async () => { await sair(); recarregar(); }} />
      </Cartao>
    );
  }

  const cor = corDoAvatar(email);
  const souCoordenador = vinculo?.papel === 'coordenador';

  return (
    <Cartao>
      <LinhaDeIdentidade
        avatar={
          usuarioId && vinculo ? (
            <button
              type="button"
              onClick={() => seletorDeArquivo.current?.click()}
              aria-label="Trocar foto de perfil"
              className="relative shrink-0 cursor-pointer rounded-full"
            >
              <Avatar
                cor={cor}
                nome={email.split('@')[0]}
                fotoChave={chaveDaFoto(usuarioId)}
                versao={versaoDaFoto}
              />
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -bottom-0.5 grid size-4.5 place-items-center rounded-full border-2 text-[9px]"
                style={{ borderColor: 'var(--color-fundo)', background: 'var(--color-superficie)' }}
              >
                📷
              </span>
            </button>
          ) : (
            <Avatar cor={cor} nome={email.split('@')[0]} fotoChave={null} />
          )
        }
        rotulo={email}
        legenda={
          vinculo
            ? `${vinculo.ministerio} · ${vinculo.papel === 'coordenador' ? 'coordenação' : 'voluntário(a)'}`
            : 'Sem ministério vinculado'
        }
      />

      {usuarioId && vinculo && (
        <>
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
          {temFoto && (
            <BotaoTexto rotulo="Remover foto" aoTocar={removerFoto} />
          )}
        </>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void sincronizarAgora()}
          disabled={ocupado}
          className="min-h-10 flex-1 cursor-pointer rounded-full px-4 text-sm font-bold text-white transition-opacity disabled:opacity-60"
          style={{ background: 'var(--color-acao)' }}
        >
          {ocupado ? 'Sincronizando…' : 'Sincronizar agora'}
        </button>
        <span className="shrink-0 text-xs" style={{ color: 'var(--color-texto-suave)' }}>
          {pendentes > 0 ? `${pendentes} pendente${pendentes === 1 ? '' : 's'}` : 'em dia'}
        </span>
      </div>

      {ultimo?.erro && (
        <p className="mt-1 text-xs" style={{ color: 'var(--color-texto-suave)' }}>
          Última tentativa: {ultimo.erro}
        </p>
      )}

      {souCoordenador && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setConviteAberto((v) => !v)}
            className="flex min-h-10 w-full cursor-pointer items-center justify-between text-sm font-bold"
            style={{ color: 'var(--color-texto-suave)' }}
          >
            + Convidar alguém
            <span
              aria-hidden="true"
              className="transition-transform"
              style={{ transform: conviteAberto ? 'rotate(180deg)' : 'none' }}
            >
              ▾
            </span>
          </button>

          <AnimatePresence initial={false}>
            {conviteAberto && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div className="flex flex-col gap-2 pt-1">
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    value={convite}
                    onChange={(e) => setConvite(e.target.value)}
                    placeholder="e-mail do voluntário"
                    className="min-h-11 w-full rounded-2xl border-2 px-3 text-sm"
                    style={{ borderColor: 'var(--color-linha)', background: 'var(--color-fundo)' }}
                  />
                  <button
                    type="button"
                    disabled={convidando || !convite.trim()}
                    onClick={async () => {
                      setConvidando(true);
                      const erro = await convidar(convite);
                      setConvidando(false);
                      setAviso(erro ?? `Convite enviado para ${convite}.`);
                      if (!erro) {
                        setConvite('');
                        setConviteAberto(false);
                      }
                    }}
                    className="min-h-10 cursor-pointer rounded-full border-2 text-sm font-bold transition-opacity disabled:opacity-50"
                    style={{ borderColor: 'var(--color-linha)' }}
                  >
                    {convidando ? 'Convidando…' : 'Enviar convite'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <BotaoTexto rotulo="Enviar tudo deste aparelho" aoTocar={() => void enviarTudo()} />
        <BotaoTexto
          rotulo="Sair"
          aoTocar={async () => {
            await sair();
            setAviso(null);
            recarregar();
          }}
        />
      </div>

      {aviso && (
        <p className="mt-2 text-xs font-bold" style={{ color: 'var(--color-acao)' }}>
          {aviso}
        </p>
      )}
    </Cartao>
  );
}

function Cartao({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-5 rounded-3xl border-2 p-4"
      style={{ borderColor: 'var(--color-linha)', background: 'var(--color-fundo)' }}
    >
      {children}
    </div>
  );
}

function LinhaDeIdentidade({
  avatar,
  rotulo,
  legenda,
  corDaLegenda,
}: {
  avatar: React.ReactNode;
  rotulo: string;
  legenda: string;
  corDaLegenda?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {typeof avatar === 'string' ? (
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-full text-lg"
          style={{ background: 'var(--color-superficie)' }}
        >
          {avatar}
        </span>
      ) : (
        avatar
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-extrabold">{rotulo}</span>
        {legenda && (
          <span
            className="block text-xs font-bold"
            style={{ color: corDaLegenda ?? 'var(--color-texto-suave)' }}
          >
            {legenda}
          </span>
        )}
      </span>
    </div>
  );
}

function BotaoTexto({
  rotulo,
  aoTocar,
}: {
  rotulo: string;
  aoTocar: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={() => void aoTocar()}
      className="min-h-8 cursor-pointer text-xs font-bold underline underline-offset-2"
      style={{ color: 'var(--color-texto-suave)' }}
    >
      {rotulo}
    </button>
  );
}
