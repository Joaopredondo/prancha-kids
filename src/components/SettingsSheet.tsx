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
import type { Classe, Prefs, TamanhoCard, Tema } from '../types';

interface Props {
  aberto: boolean;
  prefs: Prefs;
  onDefinir: <K extends keyof Prefs>(chave: K, valor: Prefs[K]) => void;
  onFechar: () => void;
  onGravarVozes: () => void;
}

const TAMANHOS: { id: TamanhoCard; label: string }[] = [
  { id: 'p', label: 'Pequeno' },
  { id: 'm', label: 'Médio' },
  { id: 'g', label: 'Grande' },
];

const TEMAS: { id: Tema; label: string }[] = [
  { id: 'claro', label: '☀️ Claro' },
  { id: 'escuro', label: '🌙 Escuro' },
  { id: 'auto', label: '⚙️ Automático' },
];

const LEGENDA: { classe: Classe; label: string }[] = [
  { classe: 'acao', label: 'Ações' },
  { classe: 'coisa', label: 'Coisas' },
  { classe: 'descricao', label: 'Como estou' },
  { classe: 'social', label: 'Social' },
  { classe: 'pessoa', label: 'Pessoas' },
  { classe: 'urgencia', label: 'Parar / não' },
];

export function SettingsSheet({ aberto, prefs, onDefinir, onFechar, onGravarVozes }: Props) {
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto, onFechar]);

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Fechar configurações"
            onClick={onFechar}
            className="absolute inset-0 bg-black/40"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Configurações"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
            style={{ background: 'var(--color-superficie)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-extrabold">Configurações</h2>
              <button
                type="button"
                onClick={onFechar}
                className="rounded-full px-4 py-2 text-base font-bold"
                style={{ background: 'var(--color-fundo)' }}
              >
                Fechar
              </button>
            </div>

            <Escolha
              titulo="Tamanho dos cards"
              opcoes={TAMANHOS}
              valor={prefs.tamanho}
              onMudar={(valor) => onDefinir('tamanho', valor)}
            />

            <Escolha
              titulo="Cores da tela"
              opcoes={TEMAS}
              valor={prefs.tema}
              onMudar={(valor) => onDefinir('tema', valor)}
            />

            <section className="mb-5 space-y-2">
              <Interruptor
                label="Som ligado"
                ativo={prefs.som}
                onMudar={(v) => onDefinir('som', v)}
              />
              <Interruptor
                label="Manter a tela acesa"
                ativo={prefs.telaAcesa}
                onMudar={(v) => onDefinir('telaAcesa', v)}
              />
            </section>

            <section className="mb-5">
              <h3
                className="mb-2 text-sm font-bold uppercase tracking-wide"
                style={{ color: 'var(--color-texto-suave)' }}
              >
                Vozes dos cards
              </h3>
              <BotaoDeAcao
                rotulo="Gravar vozes dos cards"
                aoTocar={() => {
                  onGravarVozes();
                  onFechar();
                }}
              />
              <p className="mt-2 text-xs" style={{ color: 'var(--color-texto-suave)' }}>
                Grave cada palavra com a voz de quem a criança conhece. Vale mais que o áudio
                do app e fica só neste aparelho.
              </p>
            </section>

            <TravaDeAcesso />

            <CopiaDeSeguranca />

            <section>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--color-texto-suave)' }}>
                O que as cores significam
              </h3>
              <ul className="grid grid-cols-2 gap-2">
                {LEGENDA.map((item) => (
                  <li key={item.classe} data-classe={item.classe} className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      className="h-5 w-5 shrink-0 rounded-md border-[3px]"
                      style={{ borderColor: 'var(--borda)', background: 'var(--tinta)' }}
                    />
                    {item.label}
                  </li>
                ))}
              </ul>
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
   * as Configurações estão abertas a qualquer um, e bastaria remover o código
   * ali para entrar na ficha.
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
    <section className="mb-5">
      <h3
        className="mb-2 text-sm font-bold uppercase tracking-wide"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        Código do voluntário
      </h3>

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
        <div className="flex flex-wrap gap-2">
          <BotaoDeAcao
            rotulo={configurado ? 'Trocar código' : 'Criar código'}
            aoTocar={() => setEtapa('trocar')}
          />
          {configurado && (
            <BotaoDeAcao rotulo="Remover código" aoTocar={() => setEtapa('remover')} />
          )}
        </div>
      )}

      <p className="mt-2 text-xs" style={{ color: 'var(--color-texto-suave)' }}>
        {configurado
          ? 'A ficha e a frequência pedem o código uma vez por sessão. Fechar o app tranca de novo.'
          : 'Sem código, a ficha abre só segurando 3 segundos — o que barra a criança, mas não um adulto.'}
      </p>
    </section>
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
  // O backup carrega nome, idade, laudo e foto das crianças: exportar sem
  // passar pelo código seria a porta dos fundos da trava.
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
    <section className="mb-5">
      <h3
        className="mb-2 text-sm font-bold uppercase tracking-wide"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        Cópia de segurança
      </h3>

      {liberado ? (
        <div className="flex flex-wrap gap-2">
          <BotaoDeAcao rotulo="Exportar tudo (JSON)" aoTocar={() => void exportarTudo()} />
          <BotaoDeAcao rotulo="Exportar fichas (CSV)" aoTocar={exportarCsv} />
          <BotaoDeAcao rotulo="Restaurar backup" aoTocar={() => arquivo.current?.click()} />
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
            O backup leva nome, idade, laudo e foto das crianças.
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
      <p className="mt-2 text-xs" style={{ color: 'var(--color-texto-suave)' }}>
        Tudo fica só neste aparelho. Limpar os dados do navegador apaga fichas, cadastros e
        fotos — exporte antes de trocar de tablet. Restaurar junta com o que já existe, não
        apaga nada.
      </p>
      {aviso && (
        <p className="mt-2 text-sm font-bold" style={{ color: 'var(--color-acao)' }}>
          {aviso}
        </p>
      )}
    </section>
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
      className="min-h-12 rounded-2xl border-2 px-4 text-base font-bold"
      style={{ borderColor: 'var(--color-linha)' }}
    >
      {rotulo}
    </button>
  );
}

function Escolha<T extends string>({
  titulo,
  opcoes,
  valor,
  onMudar,
}: {
  titulo: string;
  opcoes: { id: T; label: string }[];
  valor: T;
  onMudar: (valor: T) => void;
}) {
  return (
    <section className="mb-5">
      <h3
        className="mb-2 text-sm font-bold uppercase tracking-wide"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        {titulo}
      </h3>
      <div className="flex gap-2">
        {opcoes.map((opcao) => {
          const ativa = opcao.id === valor;
          return (
            <button
              key={opcao.id}
              type="button"
              onClick={() => onMudar(opcao.id)}
              aria-pressed={ativa}
              className="flex-1 rounded-2xl border-2 px-2 py-3 font-bold"
              style={{
                borderColor: ativa ? 'var(--color-texto)' : 'var(--color-linha)',
                background: ativa ? 'var(--color-texto)' : 'transparent',
                color: ativa ? 'var(--color-fundo)' : 'var(--color-texto)',
              }}
            >
              {opcao.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Interruptor({
  label,
  ativo,
  onMudar,
}: {
  label: string;
  ativo: boolean;
  onMudar: (valor: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      onClick={() => onMudar(!ativo)}
      className="flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 font-bold"
      style={{ borderColor: 'var(--color-linha)' }}
    >
      {label}
      <span
        aria-hidden="true"
        className="relative h-7 w-12 rounded-full transition-colors"
        style={{ background: ativo ? 'var(--color-acao)' : 'var(--color-linha)' }}
      >
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
          style={{ left: ativo ? '1.5rem' : '0.25rem' }}
        />
      </span>
    </button>
  );
}
