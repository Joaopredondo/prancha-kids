import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  baixar,
  fichasParaCsv,
  montarBackup,
  nomeComData,
  restaurarBackup,
  type Backup,
} from '../dados/backup';
import { listarFichas } from '../dados/fichas';
import { conferirPin, definirPin, estaDestrancado, removerPin, temPin } from '../dados/seguranca';
import { Conta } from './Conta';
import type { Vista } from './MainNav';

interface Props {
  aberto: boolean;
  vista: Vista;
  aoFechar: () => void;
  onFrequencia: () => void;
  onResumo: () => void;
  onEquipe: () => void;
  onGravarVozes: () => void;
  onEntrar: () => void;
}

/**
 * Menu do voluntário: tudo que é do adulto, num lugar só.
 *
 * Antes disso, "Ficha do culto" e "Frequência" viviam na barra de baixo
 * (`MainNav`), disputando espaço com o seletor de categoria da criança, e
 * "Equipe" ficava a três toques de distância dentro de Configurações → Conta.
 * A trava é o próprio menu: abrir com `☰` já passa pelo `PortaoDoVoluntario`
 * quando não está liberado (ver `App.tsx`), então os itens aqui dentro não
 * precisam de `BotaoSegurar` — quem chegou até aqui já provou quem é.
 *
 * O cartão de perfil (`Conta`) mora no topo, fora da lista rolável: é a
 * resposta a "onde entro com minha conta" sem precisar de um terceiro ícone
 * no cabeçalho do app — abre o menu, a identidade já está ali.
 */
export function MenuLateral({
  aberto,
  vista,
  aoFechar,
  onFrequencia,
  onResumo,
  onEquipe,
  onGravarVozes,
  onEntrar,
}: Props) {
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto, aoFechar]);

  const irPara = (aoIr: () => void) => () => {
    aoIr();
    aoFechar();
  };

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          className="fixed inset-0 z-50 flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={aoFechar}
            className="absolute inset-0 bg-black/40"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Área do voluntário"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="relative flex h-full w-full max-w-xs flex-col overflow-hidden rounded-r-3xl sm:max-w-sm"
            style={{ background: 'var(--color-superficie)' }}
          >
            {/* Fecha fora do bloco rolável, de propósito: numa lista comprida
                (equipe, conta, backup...), o botão não pode desaparecer
                rolando junto — vira uma tela sem saída visível. */}
            <div
              className="flex shrink-0 items-center justify-between px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]"
              style={{ background: 'var(--color-superficie)' }}
            >
              <h2 className="text-lg font-extrabold">Área do voluntário</h2>
              <button
                type="button"
                onClick={aoFechar}
                aria-label="Fechar menu"
                className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border-2 text-lg"
                style={{ borderColor: 'var(--color-linha)' }}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <Conta onEntrar={irPara(onEntrar)} />

              <GrupoDoMenu titulo="No culto">
                <ItemDoMenu
                  emoji="📊"
                  rotulo="Frequência"
                  ativo={vista === 'frequencia'}
                  aoTocar={irPara(onFrequencia)}
                />
              </GrupoDoMenu>

              <GrupoDoMenu titulo="Ministério">
                <ItemDoMenu
                  emoji="🧭"
                  rotulo="Resumo"
                  ativo={vista === 'resumo'}
                  aoTocar={irPara(onResumo)}
                />
                <ItemDoMenu
                  emoji="👥"
                  rotulo="Equipe"
                  ativo={vista === 'ministerio'}
                  aoTocar={irPara(onEquipe)}
                />
                <ItemDoMenu
                  emoji="🎙️"
                  rotulo="Gravar vozes"
                  ativo={vista === 'vozes'}
                  aoTocar={irPara(onGravarVozes)}
                />
              </GrupoDoMenu>

              <GrupoDoMenu titulo="Aparelho">
                <TravaDeAcesso />
                <CopiaDeSeguranca />
              </GrupoDoMenu>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function GrupoDoMenu({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3
        className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wide"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        {titulo}
      </h3>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

/**
 * Ícone dentro de um chip quadrado — não o emoji sozinho na frente do texto.
 * É essa moldura, junto com a pílula do item ativo, que faz a lista ler como
 * navegação de menu, não como um parágrafo de botões de configuração.
 */
function IconeDoItem({ emoji, ativo }: { emoji: string; ativo?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-xl text-base"
      style={{
        background: ativo ? 'color-mix(in oklab, white 25%, transparent)' : 'var(--color-fundo)',
      }}
    >
      {emoji}
    </span>
  );
}

function ItemDoMenu({
  emoji,
  rotulo,
  ativo,
  aoTocar,
}: {
  emoji: string;
  rotulo: string;
  ativo?: boolean;
  aoTocar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-current={ativo ? 'page' : undefined}
      className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl py-1.5 pl-1.5 pr-3 text-base font-bold transition-colors active:opacity-70"
      style={{
        background: ativo ? 'var(--color-acao)' : 'transparent',
        color: ativo ? '#ffffff' : 'var(--color-texto)',
      }}
    >
      <IconeDoItem emoji={emoji} ativo={ativo} />
      {rotulo}
    </button>
  );
}

/**
 * Mesma casca visual do `ItemDoMenu` (chip + rótulo), mas em vez de navegar
 * abre um painel logo abaixo. Código do voluntário e Cópia de segurança são
 * formulário, não navegação — deixar os dois sempre abertos, com parágrafo de
 * explicação embaixo de cada campo, era o que fazia o menu parecer uma tela
 * de configurações emendada de lado. Fechado é o estado de repouso; abre só
 * quem precisa mexer.
 */
function ItemAcordeao({
  emoji,
  rotulo,
  children,
}: {
  emoji: string;
  rotulo: string;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl py-1.5 pl-1.5 pr-3 text-base font-bold"
      >
        <IconeDoItem emoji={emoji} />
        <span className="flex-1 text-left">{rotulo}</span>
        <span
          aria-hidden="true"
          className="text-xs transition-transform"
          style={{ color: 'var(--color-texto-suave)', transform: aberto ? 'rotate(180deg)' : 'none' }}
        >
          ▾
        </span>
      </button>

      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-1.5 pb-3 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Código de 4 dígitos para a ficha e a frequência.
 *
 * Sem código, essas telas abrem segurando 3 segundos — o que barra a criança,
 * não um adulto. Com código, barra também quem pega o tablet emprestado.
 */
function TravaDeAcesso() {
  const [configurado, setConfigurado] = useState(() => temPin());
  const [etapa, setEtapa] = useState<'parado' | 'trocar' | 'remover'>('parado');
  const [atual, setAtual] = useState('');
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const parar = () => {
    setEtapa('parado');
    setAtual('');
    setNovo('');
    setErro(null);
  };

  /**
   * Trocar ou remover exige o código atual. Sem isso a trava não vale nada:
   * o menu está aberto para quem já entrou, e bastaria remover o código
   * ali para tirar a barreira de quem pega o tablet emprestado.
   */
  const conferirAtual = async () => {
    if (!configurado) return true;
    if (await conferirPin(atual)) return true;
    setErro('Código atual errado.');
    setAtual('');
    return false;
  };

  const trocar = async () => {
    if (novo.length !== 4) {
      setErro('O novo código precisa ter 4 dígitos.');
      return;
    }
    if (!(await conferirAtual())) return;
    await definirPin(novo);
    setConfigurado(true);
    parar();
  };

  const remover = async () => {
    if (!(await conferirAtual())) return;
    removerPin();
    setConfigurado(false);
    parar();
  };

  return (
    <ItemAcordeao emoji="🔒" rotulo="Código do voluntário">
      {etapa !== 'parado' ? (
        <div className="flex flex-col gap-2">
          {configurado && (
            <CampoDeCodigo
              rotulo="Código atual"
              valor={atual}
              aoMudar={(v) => {
                setAtual(v);
                setErro(null);
              }}
              erro={Boolean(erro)}
            />
          )}
          {etapa === 'trocar' && (
            <CampoDeCodigo
              rotulo={configurado ? 'Novo código' : 'Código de 4 dígitos'}
              valor={novo}
              aoMudar={(v) => {
                setNovo(v);
                setErro(null);
              }}
              erro={false}
            />
          )}

          <div className="flex flex-wrap gap-2">
            <BotaoDeAcao
              rotulo={etapa === 'trocar' ? 'Guardar código' : 'Confirmar remoção'}
              aoTocar={() => void (etapa === 'trocar' ? trocar() : remover())}
            />
            <BotaoDeAcao rotulo="Cancelar" aoTocar={parar} />
          </div>

          {erro && (
            <p className="text-sm font-bold" style={{ color: 'var(--color-urgencia)' }}>
              {erro}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <BotaoDeAcao
              rotulo={configurado ? 'Trocar código' : 'Criar código'}
              aoTocar={() => setEtapa('trocar')}
            />
            {configurado && (
              <BotaoDeAcao rotulo="Remover código" aoTocar={() => setEtapa('remover')} />
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--color-texto-suave)' }}>
            {configurado
              ? 'Pedido uma vez por sessão. Fechar o app tranca de novo.'
              : 'Sem código, a ficha abre segurando 3 segundos.'}
          </p>
        </div>
      )}
    </ItemAcordeao>
  );
}

/**
 * Cópia de segurança das fichas, cadastros e fotos.
 *
 * Sem isso, limpar os dados do navegador ou trocar de aparelho apaga tudo sem
 * recuperação — não há servidor onde buscar de volta.
 */
function CopiaDeSeguranca() {
  const arquivo = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // O backup carrega nome, idade, laudo, alergias, necessidades e foto das
  // crianças: exportar sem passar pelo código seria a porta dos fundos da trava.
  const [liberado, setLiberado] = useState(() => estaDestrancado());
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState(false);

  const destravar = async (valor: string) => {
    setCodigo(valor);
    setErro(false);
    if (valor.length < 4) return;
    if (await conferirPin(valor)) {
      setLiberado(true);
      setCodigo('');
      return;
    }
    setErro(true);
    setCodigo('');
  };

  const exportarTudo = async () => {
    const backup = await montarBackup();
    baixar(nomeComData('prancha-kids-backup', 'json'), JSON.stringify(backup), 'application/json');
    setAviso(`Exportadas ${backup.fichas.length} fichas e ${backup.perfis.length} cadastros.`);
  };

  const exportarCsv = () => {
    const fichas = listarFichas();
    baixar(nomeComData('fichas', 'csv'), fichasParaCsv(fichas), 'text/csv;charset=utf-8');
    setAviso(`${fichas.length} fichas no CSV.`);
  };

  const importar = async (entrada: File | undefined) => {
    if (!entrada) return;
    try {
      const backup = JSON.parse(await entrada.text()) as Backup;
      const { perfis, fichas } = await restaurarBackup(backup);
      setAviso(`Restaurados ${fichas} fichas e ${perfis} cadastros. Recarregando…`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (erro) {
      setAviso(`Não deu para restaurar: ${(erro as Error).message}`);
    }
  };

  return (
    <ItemAcordeao emoji="💾" rotulo="Cópia de segurança">
      {liberado ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <BotaoDeAcao rotulo="Exportar tudo (JSON)" aoTocar={() => void exportarTudo()} />
            <BotaoDeAcao rotulo="Exportar fichas (CSV)" aoTocar={exportarCsv} />
            <BotaoDeAcao rotulo="Restaurar backup" aoTocar={() => arquivo.current?.click()} />
          </div>
          <p className="text-xs" style={{ color: 'var(--color-texto-suave)' }}>
            Exporte antes de trocar de tablet. Restaurar junta com o que já existe.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <CampoDeCodigo
            rotulo="Código do voluntário"
            valor={codigo}
            aoMudar={(v) => void destravar(v)}
            erro={erro}
          />
          <p className="text-xs" style={{ color: 'var(--color-texto-suave)' }}>
            O backup leva nome, idade, laudo, alergias, necessidades e foto das crianças.
          </p>
          {erro && (
            <p className="text-sm font-bold" style={{ color: 'var(--color-urgencia)' }}>
              Código errado.
            </p>
          )}
        </div>
      )}
      <input
        ref={arquivo}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          void importar(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {aviso && (
        <p className="mt-2 text-sm font-bold" style={{ color: 'var(--color-acao)' }}>
          {aviso}
        </p>
      )}
    </ItemAcordeao>
  );
}

function CampoDeCodigo({
  rotulo,
  valor,
  aoMudar,
  erro,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  erro: boolean;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="text-base font-bold">{rotulo}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={valor}
        onChange={(e) => aoMudar(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="min-h-12 w-28 rounded-2xl border-2 text-center text-xl font-extrabold tracking-[0.3em]"
        style={{
          borderColor: erro ? 'var(--color-urgencia)' : 'var(--color-linha)',
          background: 'var(--color-fundo)',
        }}
      />
    </label>
  );
}

function BotaoDeAcao({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      className="min-h-12 cursor-pointer rounded-2xl border-2 px-4 text-base font-bold"
      style={{ borderColor: 'var(--color-linha)' }}
    >
      {rotulo}
    </button>
  );
}
