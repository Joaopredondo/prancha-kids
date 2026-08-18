import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import gsap from 'gsap';
import { ROTULOS } from '../dados/ficha';
import { diaDaFicha, diasComFicha, listarFichas } from '../dados/fichas';
import { presencasDoDia, resumirTodas } from '../dados/frequencia';
import { listarPerfis } from '../dados/perfis';
import { Retrato } from './SeletorDeCrianca';

const formatarDia = (dia: string) => new Date(`${dia}T12:00`).toLocaleDateString('pt-BR');

/** Rótulo curto do dia, para caber embaixo do quadradinho da faixa. */
const diaCurto = (dia: string) =>
  new Date(`${dia}T12:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/**
 * Frequência do ministério, montada a partir das fichas salvas.
 *
 * Só conta o que foi registrado. O app não sabe que houve culto se ninguém
 * preencheu ficha naquele dia — por isso "ausências" é sempre sobre os dias
 * que aparecem aqui, e está escrito na tela.
 */
export function Frequencia() {
  const fichas = useMemo(() => listarFichas(), []);
  const perfis = useMemo(() => listarPerfis(), []);
  const dias = useMemo(() => diasComFicha(fichas), [fichas]);
  const resumos = useMemo(() => resumirTodas(perfis, fichas, dias), [perfis, fichas, dias]);

  const [dia, setDia] = useState<string>('');
  const doDia = useMemo(() => (dia ? presencasDoDia(fichas, dia) : []), [fichas, dia]);

  /**
   * Em que dias cada criança tem ficha.
   *
   * A faixa é lida da esquerda (culto mais antigo) para a direita (mais
   * recente), ao contrário de `dias`, que vem do mais recente. Sequência de
   * falta só faz sentido lida no sentido do tempo.
   */
  const diasEmOrdem = useMemo(() => [...dias].reverse(), [dias]);
  const presencaPorPerfil = useMemo(() => {
    const mapa = new Map<string, Set<string>>();
    for (const ficha of fichas) {
      if (!ficha.perfilId) continue;
      const dela = mapa.get(ficha.perfilId) ?? new Set<string>();
      dela.add(diaDaFicha(ficha));
      mapa.set(ficha.perfilId, dela);
    }
    return mapa;
  }, [fichas]);

  if (fichas.length === 0) {
    return (
      <p className="px-4 pb-6 text-base" style={{ color: 'var(--color-texto-suave)' }}>
        Ainda não há ficha salva. A frequência é montada a partir delas.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-3 pb-6 sm:px-4">
      <p className="text-sm" style={{ color: 'var(--color-texto-suave)' }}>
        {dias.length} {dias.length === 1 ? 'dia registrado' : 'dias registrados'} ·{' '}
        {fichas.length} {fichas.length === 1 ? 'ficha' : 'fichas'}. Contagem do que foi
        preenchido, não avaliação da criança.
      </p>

      <Bloco titulo="Por criança">
        <ul className="flex flex-col gap-2">
          {resumos.map((resumo) => (
            <li
              key={resumo.perfil.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border-2 px-4 py-3"
              style={{
                borderColor:
                  resumo.faltasSeguidas >= 3 ? 'var(--color-urgencia)' : 'var(--color-linha)',
              }}
            >
              <Retrato perfil={resumo.perfil} lado="2.75rem" />
              <div className="min-w-40 flex-1">
                <p className="text-base font-extrabold">{resumo.perfil.nome || 'Sem nome'}</p>
                <p className="text-sm" style={{ color: 'var(--color-texto-suave)' }}>
                  {resumo.presencas} de {dias.length} · último dia{' '}
                  {resumo.ultimoDia ? formatarDia(resumo.ultimoDia) : '—'}
                  {resumo.estadoMaisComum &&
                    ` · quase sempre ${ROTULOS.estado[
                      resumo.estadoMaisComum as keyof typeof ROTULOS.estado
                    ].toLowerCase()}`}
                </p>
                <FaixaDePresenca
                  dias={diasEmOrdem}
                  presentes={presencaPorPerfil.get(resumo.perfil.id) ?? new Set()}
                  nome={resumo.perfil.nome || 'Sem nome'}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {resumo.faltasSeguidas >= 3 && (
                  <Etiqueta cor="var(--color-urgencia)">
                    {resumo.faltasSeguidas} cultos sem vir
                  </Etiqueta>
                )}
                {resumo.crises > 0 && (
                  <Etiqueta cor="var(--color-coisa)">
                    {resumo.crises} {resumo.crises === 1 ? 'crise' : 'crises'}
                  </Etiqueta>
                )}
                {resumo.saidasDaSala > 0 && (
                  <Etiqueta cor="var(--color-descricao)">
                    saiu {resumo.saidasDaSala}×
                  </Etiqueta>
                )}
              </div>
            </li>
          ))}
          {resumos.length === 0 && (
            <p className="text-base" style={{ color: 'var(--color-texto-suave)' }}>
              Nenhuma criança cadastrada. Cadastre na aba Ficha do culto para acompanhar a
              frequência.
            </p>
          )}
        </ul>
      </Bloco>

      <Bloco titulo="Quem veio em cada dia">
        <label className="block">
          <span className="text-base font-bold">Dia</span>
          <select
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            className="mt-2 min-h-12 w-full rounded-2xl border-2 px-3 text-base sm:w-64"
            style={{ borderColor: 'var(--color-linha)', background: 'var(--color-fundo)' }}
          >
            <option value="">Escolha um dia</option>
            {dias.map((item) => (
              <option key={item} value={item}>
                {formatarDia(item)}
              </option>
            ))}
          </select>
        </label>

        {dia && (
          <ul className="mt-3 flex flex-col gap-2">
            {doDia.map((ficha) => (
              <li
                key={ficha.id}
                className="rounded-2xl border-2 px-4 py-3"
                style={{ borderColor: 'var(--color-linha)' }}
              >
                <span className="text-base font-bold">{ficha.nome || 'Sem nome'}</span>
                <span className="ml-2 text-sm" style={{ color: 'var(--color-texto-suave)' }}>
                  {ficha.horario ? `culto ${ficha.horario}` : 'sem horário'}
                  {ficha.voluntario && ` · com ${ficha.voluntario}`}
                  {ficha.estado && ` · ${ROTULOS.estado[ficha.estado]}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>
    </div>
  );
}

/**
 * Um quadradinho por culto: cheio quando veio, vazio quando faltou.
 *
 * A mesma informação já estava escrita ("3 de 7"), mas em prosa ela não mostra
 * o que a coordenação precisa ver — **onde** estão as faltas. Três faltas
 * espalhadas em três meses e três faltas seguidas dão o mesmo número e
 * significam coisas diferentes.
 *
 * Não é gráfico de desempenho da criança: é registro de quem esteve presente,
 * como o resto da tela. Ver `dados/frequencia.ts`.
 */
function FaixaDePresenca({
  dias,
  presentes,
  nome,
}: {
  dias: string[];
  presentes: Set<string>;
  nome: string;
}) {
  const faixa = useRef<HTMLUListElement>(null);
  const semMovimento = useReducedMotion();

  useEffect(() => {
    if (semMovimento || !faixa.current) return;
    const marcas = faixa.current.querySelectorAll('[data-culto]');
    // Entram na ordem do tempo, uma atrás da outra: a faixa se escreve da
    // esquerda para a direita, que é o sentido em que ela é lida.
    //
    // `fromTo`, e não `from`: o efeito roda duas vezes em desenvolvimento
    // (StrictMode) e um `from` interrompido deixa o quadradinho parado no
    // estado inicial — a segunda passada então anima de invisível para
    // invisível, e a faixa inteira some.
    const animacao = gsap.fromTo(
      marcas,
      { scaleY: 0.2, opacity: 0 },
      { scaleY: 1, opacity: 1, duration: 0.3, ease: 'power2.out', stagger: 0.025 },
    );
    return () => {
      animacao.revert();
    };
  }, [semMovimento, dias.length]);

  if (dias.length === 0) return null;

  return (
    <ul
      ref={faixa}
      className="mt-2 flex flex-wrap gap-1"
      aria-label={`Presença de ${nome} por culto, do mais antigo ao mais recente`}
    >
      {dias.map((dia) => {
        const veio = presentes.has(dia);
        return (
          <li
            key={dia}
            data-culto
            title={`${formatarDia(dia)} — ${veio ? 'veio' : 'faltou'}`}
            className="h-5 w-3 rounded-[3px] border-2 origin-bottom"
            style={{
              borderColor: veio ? 'var(--color-acao)' : 'var(--color-linha)',
              background: veio ? 'var(--color-acao)' : 'transparent',
            }}
          >
            <span className="sr-only">
              {diaCurto(dia)}: {veio ? 'veio' : 'faltou'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-3xl border-2 p-4 sm:p-6"
      style={{ borderColor: 'var(--color-linha)', background: 'var(--color-superficie)' }}
    >
      <h2
        className="mb-3 text-sm font-bold uppercase tracking-wide"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Etiqueta({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span
      className="rounded-full border-2 px-3 py-1 text-sm font-bold"
      style={{ borderColor: cor, color: cor }}
    >
      {children}
    </span>
  );
}
