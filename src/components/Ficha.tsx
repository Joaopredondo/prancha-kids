import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import gsap from 'gsap';
import {
  ALIMENTACOES,
  COMUNICACOES,
  ESTADOS,
  HORARIOS,
  INTERACOES,
  MARCACOES,
  PERTENCES,
  RECURSOS,
  ROTULOS,
  ROTULOS_DE_MARCACAO,
  SAIDAS,
  marcacoesEmTexto,
  alternarMultiplo,
  alternarUnico,
  fichaVazia,
  type Ficha as TipoDaFicha,
  type Marcacao,
  type TipoDeMarcacao,
} from '../dados/ficha';
import {
  apagarFicha,
  apagarFichasDoPerfil,
  diasComFicha,
  filtrarFichas,
  listarFichas,
  salvarFicha,
  type Filtro,
} from '../dados/fichas';
import { apagarArquivo, chaveDaFoto } from '../dados/arquivos';
import { apagarPerfil, listarPerfis, perfilPorId, salvarPerfil, type Perfil } from '../dados/perfis';
import { Celebracao } from './Celebracao';
import { SeletorDeCrianca } from './SeletorDeCrianca';

/**
 * Ficha de acompanhamento do culto, portada do Lume.
 *
 * Espelha a folha que o ministério já usa, na mesma ordem e com os mesmos
 * grupos. O voluntário reconhece o papel na tela e preenche sem aprender nada.
 *
 * Duas decisões que vêm do uso real, não da conveniência de programar:
 * - **Escolha única desmarca ao tocar de novo.** O papel permite deixar em
 *   branco; a versão digital não pode ser mais rígida que a folha.
 * - **Salvar não valida nada.** Ficha pela metade é melhor que ficha não
 *   preenchida.
 */
export function Ficha() {
  const [ficha, setFicha] = useState<TipoDaFicha>(() => fichaVazia());
  const [modo, setModo] = useState<'edicao' | 'leitura'>('edicao');
  const [salvaEm, setSalvaEm] = useState<number | null>(null);
  const [comemorando, setComemorando] = useState(false);
  const [anteriores, setAnteriores] = useState<TipoDaFicha[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [filtro, setFiltro] = useState<Filtro>({ perfilId: null, dia: null, horario: null });

  useEffect(() => {
    setAnteriores(listarFichas());
    setPerfis(listarPerfis());
  }, []);

  const leitura = modo === 'leitura';
  const listadas = useMemo(() => filtrarFichas(anteriores, filtro), [anteriores, filtro]);
  const dias = useMemo(() => diasComFicha(anteriores), [anteriores]);

  const mudar = <C extends keyof TipoDaFicha>(campo: C, valor: TipoDaFicha[C]) =>
    setFicha((atual) => ({ ...atual, [campo]: valor }));

  const guardar = () => {
    setFicha(salvarFicha(ficha));
    setSalvaEm(Date.now());
    setAnteriores(listarFichas());
    setComemorando(true);
  };

  /** Ficha nova já identificada com o cadastro da criança escolhida. */
  const novaFicha = (perfilId: string | null = ficha.perfilId) => {
    const perfil = perfilPorId(perfilId);
    const nova = fichaVazia(Date.now(), perfil?.id ?? null);
    setFicha(
      perfil ? { ...nova, nome: perfil.nome, idade: perfil.idade, laudo: perfil.laudo } : nova,
    );
    setModo('edicao');
    setSalvaEm(null);
  };

  /**
   * Escolher a criança identifica a ficha em branco. Se a ficha aberta já foi
   * salva, começa **outra** — trocar o dono de uma ficha gravada apagaria o
   * atendimento da criança anterior.
   */
  const escolherCrianca = (perfilId: string | null) => {
    const jaSalva = anteriores.some((salva) => salva.id === ficha.id);
    if (leitura || jaSalva) {
      novaFicha(perfilId);
      return;
    }
    const perfil = perfilPorId(perfilId);
    setFicha((atual) => ({
      ...atual,
      perfilId: perfil?.id ?? null,
      nome: perfil?.nome ?? atual.nome,
      idade: perfil?.idade ?? atual.idade,
      laudo: perfil?.laudo ?? atual.laudo,
    }));
  };

  /** Abrir uma ficha salva mostra primeiro em leitura: ninguém edita sem querer. */
  const abrir = (anterior: TipoDaFicha) => {
    setFicha(anterior);
    setModo('leitura');
    setSalvaEm(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remover = (id: string) => {
    apagarFicha(id);
    setAnteriores(listarFichas());
    if (ficha.id === id) novaFicha();
  };

  return (
    <div className="flex flex-col gap-5 px-3 pb-6 sm:px-4">
      <p className="text-sm" style={{ color: 'var(--color-texto-suave)' }}>
        {leitura ? (
          <>
            Visualizando a ficha de <strong>{ficha.nome || 'sem nome'}</strong>, de{' '}
            {new Date(ficha.data).toLocaleDateString('pt-BR')}. Somente leitura — toque em
            "Editar" para mudar alguma coisa.
          </>
        ) : (
          <>
            Ficha de {new Date(ficha.data).toLocaleDateString('pt-BR')}. Nada aqui é obrigatório.
            Fica só neste aparelho. Cada "Nova ficha" é uma ficha separada — salvar não
            substitui as anteriores.
          </>
        )}
      </p>

      <SeletorDeCrianca
        perfis={perfis}
        perfilAtivo={ficha.perfilId}
        onEscolher={escolherCrianca}
        onSalvar={(perfil) => {
          salvarPerfil(perfil);
          setPerfis(listarPerfis());
        }}
        onApagar={(perfil) => {
          apagarFichasDoPerfil(perfil.id);
          void apagarArquivo(chaveDaFoto(perfil.id));
          apagarPerfil(perfil.id);
          setPerfis(listarPerfis());
          setAnteriores(listarFichas());
          if (ficha.perfilId === perfil.id) novaFicha(null);
        }}
      />

      {/* `fieldset disabled` desliga todos os campos de uma vez no modo leitura. */}
      <fieldset disabled={leitura} className="contents">
      <Secao titulo="1 · Identificação, culto e segurança">
        <Texto
          rotulo="Nome da criança"
          valor={ficha.nome}
          aoMudar={(v) => mudar('nome', v)}
          dica="Como o voluntário chama"
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Texto
            rotulo="Idade"
            valor={ficha.idade}
            aoMudar={(v) => mudar('idade', v)}
            dica="7 anos"
          />
          <div className="sm:col-span-2">
            <Texto
              rotulo="Laudo"
              valor={ficha.laudo}
              aoMudar={(v) => mudar('laudo', v)}
              dica="TEA nível 2, baixa visão…"
            />
          </div>
        </div>

        <Texto
          rotulo="Voluntário(a) responsável"
          valor={ficha.voluntario}
          aoMudar={(v) => mudar('voluntario', v)}
          dica="Nome de quem acompanhou"
        />

        <Grupo rotulo="Horário do culto">
          {HORARIOS.map((h) => (
            <Opcao
              key={h}
              rotulo={ROTULOS.horario[h]}
              marcada={ficha.horario === h}
              aoTocar={() => mudar('horario', alternarUnico(ficha.horario, h))}
            />
          ))}
        </Grupo>

        <Grupo rotulo="Pertences com a criança">
          {PERTENCES.map((p) => (
            <Opcao
              key={p}
              rotulo={ROTULOS.pertences[p]}
              marcada={ficha.pertences.includes(p)}
              aoTocar={() => mudar('pertences', alternarMultiplo(ficha.pertences, p))}
            />
          ))}
        </Grupo>

        {ficha.pertences.includes('outros') && (
          <Texto
            rotulo="Quais outros"
            valor={ficha.outrosPertences}
            aoMudar={(v) => mudar('outrosPertences', v)}
          />
        )}

        <Area
          rotulo="Observações de segurança"
          valor={ficha.observacoes}
          aoMudar={(v) => mudar('observacoes', v)}
          dica="alergias, medicação, restrições…"
        />
      </Secao>

      <Secao titulo="2 · Comportamento, comunicação e autorregulação">
        <Grupo rotulo="Estado emocional geral">
          {ESTADOS.map((e) => (
            <Opcao
              key={e}
              rotulo={ROTULOS.estado[e]}
              marcada={ficha.estado === e}
              aoTocar={() => mudar('estado', alternarUnico(ficha.estado, e))}
            />
          ))}
        </Grupo>

        <Grupo rotulo="Comunicação utilizada hoje">
          {COMUNICACOES.map((c) => (
            <Opcao
              key={c}
              rotulo={ROTULOS.comunicacao[c]}
              marcada={ficha.comunicacao.includes(c)}
              aoTocar={() => mudar('comunicacao', alternarMultiplo(ficha.comunicacao, c))}
            />
          ))}
        </Grupo>

        <Grupo rotulo="Apresentou boa interação?">
          {INTERACOES.map((i) => (
            <Opcao
              key={i}
              rotulo={ROTULOS.interacao[i]}
              marcada={ficha.interacao === i}
              aoTocar={() => mudar('interacao', alternarUnico(ficha.interacao, i))}
            />
          ))}
        </Grupo>

        <Grupo rotulo="Foi necessário sair da sala?">
          {SAIDAS.map((s) => (
            <Opcao
              key={s}
              rotulo={ROTULOS.saida[s]}
              marcada={ficha.saida === s}
              aoTocar={() => mudar('saida', alternarUnico(ficha.saida, s))}
            />
          ))}
        </Grupo>
      </Secao>

      <Secao titulo="3 · Suporte sensorial, alimentação e interesses">
        <Grupo rotulo="Recursos e sensibilidades observadas">
          {RECURSOS.map((r) => (
            <Opcao
              key={r}
              rotulo={ROTULOS.recursos[r]}
              marcada={ficha.recursos.includes(r)}
              aoTocar={() => mudar('recursos', alternarMultiplo(ficha.recursos, r))}
            />
          ))}
        </Grupo>

        <Grupo rotulo="Alimentação / lanche">
          {ALIMENTACOES.map((a) => (
            <Opcao
              key={a}
              rotulo={ROTULOS.alimentacao[a]}
              marcada={ficha.alimentacao.includes(a)}
              aoTocar={() => mudar('alimentacao', alternarMultiplo(ficha.alimentacao, a))}
            />
          ))}
        </Grupo>

        <Area
          rotulo="Interesses demonstrados"
          valor={ficha.interesses}
          aoMudar={(v) => mudar('interesses', v)}
          dica="o que prendeu a atenção hoje"
        />
      </Secao>

      <Secao titulo="Durante o culto — um toque carimba a hora">
        <p className="text-sm" style={{ color: 'var(--color-texto-suave)' }}>
          Para registrar na hora, sem digitar. No fim, "Passar para a descrição" transforma
          isso em texto.
        </p>
        <div className="flex flex-wrap gap-2">
          {MARCACOES.map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() =>
                mudar('marcacoes', [...(ficha.marcacoes ?? []), { hora: Date.now(), tipo }])
              }
              className="min-h-12 rounded-2xl border-2 px-4 text-base font-bold"
              style={{ borderColor: 'var(--color-linha)' }}
            >
              {/* O relógio separa isto do grupo "Estado emocional", que tem
                  opção com o mesmo nome logo acima. */}
              ⏱ {ROTULOS_DE_MARCACAO[tipo]}
            </button>
          ))}
        </div>

        {(ficha.marcacoes ?? []).length > 0 && (
          <>
            <LinhaDoTempo marcacoes={ficha.marcacoes ?? []} />

            <ul className="flex flex-col gap-2">
              {(ficha.marcacoes ?? []).map((marcacao, i) => (
                <li
                  key={`${marcacao.hora}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-2xl border-2 px-3 py-2"
                  style={{ borderColor: 'var(--color-linha)' }}
                >
                  <span className="text-base font-bold tabular-nums">
                    {new Date(marcacao.hora).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    <span className="font-normal">{ROTULOS_DE_MARCACAO[marcacao.tipo]}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      mudar(
                        'marcacoes',
                        (ficha.marcacoes ?? []).filter((_, indice) => indice !== i),
                      )
                    }
                    aria-label={`Tirar ${ROTULOS_DE_MARCACAO[marcacao.tipo]} das ${new Date(
                      marcacao.hora,
                    ).toLocaleTimeString('pt-BR')}`}
                    className="size-11 rounded-xl border-2 text-lg font-bold"
                    style={{ borderColor: 'var(--color-linha)', color: 'var(--color-urgencia)' }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => {
                const texto = marcacoesEmTexto(ficha.marcacoes ?? []);
                mudar('descricao', ficha.descricao ? `${ficha.descricao}\n${texto}` : texto);
              }}
              className="min-h-12 self-start rounded-2xl border-2 px-4 text-base font-bold"
              style={{ borderColor: 'var(--color-acao)', color: 'var(--color-acao)' }}
            >
              Passar para a descrição
            </button>
          </>
        )}
      </Secao>

      <Secao titulo="4 · Manejo do voluntário e descrição de comportamento">
        <Area
          rotulo="O que o voluntário fez"
          valor={ficha.manejo}
          aoMudar={(v) => mudar('manejo', v)}
          dica="estratégias que funcionaram e as que não"
        />
        <Area
          rotulo="Descrição do comportamento"
          valor={ficha.descricao}
          aoMudar={(v) => mudar('descricao', v)}
          dica="o que aconteceu, sem interpretação"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Texto
            rotulo="Assinatura do voluntário"
            valor={ficha.assinatura}
            aoMudar={(v) => mudar('assinatura', v)}
          />
          <Texto
            rotulo="Retirada por"
            valor={ficha.retiradaPor}
            aoMudar={(v) => mudar('retiradaPor', v)}
            dica="quem buscou a criança"
          />
        </div>
      </Secao>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        {leitura ? (
          <button
            type="button"
            onClick={() => setModo('edicao')}
            className="min-h-14 rounded-2xl px-6 text-base font-extrabold"
            style={{ background: 'var(--color-acao)', color: '#ffffff' }}
          >
            Editar
          </button>
        ) : (
          <button
            type="button"
            onClick={guardar}
            className="min-h-14 rounded-2xl px-6 text-base font-extrabold"
            style={{ background: 'var(--color-acao)', color: '#ffffff' }}
          >
            Salvar ficha
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-14 rounded-2xl border-2 px-6 text-base font-bold"
          style={{ borderColor: 'var(--color-linha)' }}
        >
          Imprimir / PDF
        </button>
        <button
          type="button"
          onClick={() => novaFicha()}
          className="min-h-14 rounded-2xl border-2 px-6 text-base font-bold"
          style={{ borderColor: 'var(--color-linha)' }}
        >
          {perfilPorId(ficha.perfilId)
            ? `Nova ficha para ${perfilPorId(ficha.perfilId)?.nome}`
            : 'Nova ficha'}
        </button>
        {salvaEm && (
          <span className="text-sm" style={{ color: 'var(--color-texto-suave)' }}>
            salva às {new Date(salvaEm).toLocaleTimeString('pt-BR')}
          </span>
        )}
      </div>

      {/* Não vai para o papel: imprimir uma ficha não pode listar as das outras
          crianças. */}
      {anteriores.length > 0 && (
        <div className="print:hidden">
        <Secao titulo={`Fichas salvas (${listadas.length} de ${anteriores.length})`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Selecao
              rotulo="Criança"
              valor={filtro.perfilId ?? ''}
              aoMudar={(v) => setFiltro({ ...filtro, perfilId: v || null })}
              opcoes={[
                { valor: '', label: 'Todas' },
                ...perfis.map((p) => ({ valor: p.id, label: p.nome || 'Sem nome' })),
                { valor: 'sem-perfil', label: 'Sem cadastro' },
              ]}
            />
            <Selecao
              rotulo="Dia"
              valor={filtro.dia ?? ''}
              aoMudar={(v) => setFiltro({ ...filtro, dia: v || null })}
              opcoes={[
                { valor: '', label: 'Todos' },
                ...dias.map((dia) => ({
                  valor: dia,
                  label: new Date(`${dia}T12:00`).toLocaleDateString('pt-BR'),
                })),
              ]}
            />
            <Selecao
              rotulo="Culto"
              valor={filtro.horario ?? ''}
              aoMudar={(v) => setFiltro({ ...filtro, horario: v || null })}
              opcoes={[
                { valor: '', label: 'Todos' },
                ...HORARIOS.map((h) => ({ valor: h, label: h })),
              ]}
            />
          </div>

          {listadas.length === 0 ? (
            <p className="text-base" style={{ color: 'var(--color-texto-suave)' }}>
              Nenhuma ficha com esse filtro.
            </p>
          ) : (
          <ul className="flex flex-col gap-2">
            {listadas.map((anterior) => (
              <li
                key={anterior.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3"
                style={{
                  borderColor:
                    anterior.id === ficha.id ? 'var(--color-acao)' : 'var(--color-linha)',
                }}
              >
                <button
                  type="button"
                  onClick={() => abrir(anterior)}
                  className="flex-1 text-left text-base font-bold"
                >
                  {anterior.nome || 'Sem nome'}
                  <span
                    className="ml-2 text-sm font-normal"
                    style={{ color: 'var(--color-texto-suave)' }}
                  >
                    {new Date(anterior.data).toLocaleDateString('pt-BR')}
                    {' às '}
                    {new Date(anterior.data).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {anterior.horario && ` · culto ${anterior.horario}`}
                    {anterior.estado && ` · ${ROTULOS.estado[anterior.estado]}`}
                  </span>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => abrir(anterior)}
                    className="rounded-xl border-2 px-3 py-2 text-sm font-bold"
                    style={{ borderColor: 'var(--color-linha)' }}
                  >
                    Ver
                  </button>
                  <button
                    type="button"
                    onClick={() => remover(anterior.id)}
                    aria-label={`Apagar ficha de ${anterior.nome || 'sem nome'}`}
                    className="rounded-xl border-2 px-3 py-2 text-sm font-bold"
                    style={{ borderColor: 'var(--color-linha)', color: 'var(--color-urgencia)' }}
                  >
                    Apagar
                  </button>
                </div>
              </li>
            ))}
          </ul>
          )}
        </Secao>
        </div>
      )}

      <Celebracao aberto={comemorando} aoFechar={() => setComemorando(false)} />
    </div>
  );
}

/** Cor de cada marcação: a mesma leitura de cor que os cards já usam. */
const COR_DA_MARCACAO: Record<TipoDeMarcacao, string> = {
  crise: 'var(--color-urgencia)',
  acalmou: 'var(--color-acao)',
  saiu: 'var(--color-descricao)',
  voltou: 'var(--color-acao)',
  lanche: 'var(--color-coisa)',
  banheiro: 'var(--color-descricao)',
};

/**
 * Os carimbos de hora dispostos ao longo do culto.
 *
 * A lista abaixo responde "o que aconteceu"; ela não responde **quando dentro
 * do culto** — e é essa a pergunta que muda o manejo do voluntário. "Crise
 * sempre no começo do louvor" só aparece quando as marcações são vistas
 * espaçadas no tempo, não empilhadas em linhas de altura igual.
 *
 * A régua vai da primeira à última marcação, não de um horário fixo de culto:
 * o app não sabe quando o culto começou, e inventar isso deslocaria tudo.
 */
function LinhaDoTempo({ marcacoes }: { marcacoes: Marcacao[] }) {
  const trilho = useRef<HTMLDivElement>(null);
  const semMovimento = useReducedMotion();

  const horas = marcacoes.map((m) => m.hora);
  const inicio = Math.min(...horas);
  const fim = Math.max(...horas);
  const duracao = fim - inicio;

  useEffect(() => {
    if (semMovimento || !trilho.current) return;
    // `fromTo` em vez de `from`: em desenvolvimento o efeito roda duas vezes, e
    // um `from` interrompido deixaria as marcas presas em escala zero.
    const animacao = gsap.fromTo(
      trilho.current.querySelectorAll('[data-marca]'),
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)', stagger: 0.05 },
    );
    return () => {
      animacao.revert();
    };
  }, [semMovimento, marcacoes.length]);

  const relogio = (hora: number) =>
    new Date(hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={trilho}
        className="relative h-12 rounded-full border-2"
        style={{ borderColor: 'var(--color-linha)', background: 'var(--color-fundo)' }}
      >
        {marcacoes.map((marcacao, i) => (
          <span
            key={`${marcacao.hora}-${i}`}
            data-marca
            title={`${relogio(marcacao.hora)} — ${ROTULOS_DE_MARCACAO[marcacao.tipo]}`}
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{
              // Uma marcação só, ou várias no mesmo minuto: fica no meio em vez
              // de dividir por zero e sumir na borda.
              left: duracao > 0 ? `${((marcacao.hora - inicio) / duracao) * 92 + 4}%` : '50%',
              borderColor: 'var(--color-superficie)',
              background: COR_DA_MARCACAO[marcacao.tipo],
            }}
          >
            <span className="sr-only">
              {relogio(marcacao.hora)} {ROTULOS_DE_MARCACAO[marcacao.tipo]}
            </span>
          </span>
        ))}
      </div>
      <div
        className="flex justify-between text-xs font-bold tabular-nums"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        <span>{relogio(inicio)}</span>
        {duracao > 0 && <span>{relogio(fim)}</span>}
      </div>
    </div>
  );
}

function Selecao({
  rotulo,
  valor,
  aoMudar,
  opcoes,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  opcoes: { valor: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-base font-bold">{rotulo}</span>
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="mt-2 min-h-12 w-full rounded-2xl border-2 px-3 text-base"
        style={{ borderColor: 'var(--color-linha)', background: 'var(--color-fundo)' }}
      >
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section
      className="rounded-3xl border-2 p-4 sm:p-6"
      style={{ borderColor: 'var(--color-linha)', background: 'var(--color-superficie)' }}
    >
      <h2
        className="text-sm font-bold uppercase tracking-wide"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        {titulo}
      </h2>
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Grupo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="text-base font-bold">{rotulo}</legend>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/**
 * Marca com caixa visível.
 *
 * `aria-pressed` em vez de `checkbox`/`radio` porque escolha única aqui
 * **desmarca** ao tocar de novo — comportamento que um grupo de rádio nativo
 * não tem, e forçá-lo confundiria leitor de tela.
 */
function Opcao({
  rotulo,
  marcada,
  aoTocar,
}: {
  rotulo: string;
  marcada: boolean;
  aoTocar: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={marcada}
      onClick={aoTocar}
      className="flex min-h-12 items-center gap-2 rounded-2xl border-2 px-4 text-base font-bold"
      style={{
        borderColor: marcada ? 'var(--color-acao)' : 'var(--color-linha)',
        background: marcada ? 'var(--color-acao)' : 'transparent',
        color: marcada ? '#ffffff' : 'var(--color-texto)',
      }}
    >
      <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
        <rect
          x="2"
          y="2"
          width="20"
          height="20"
          rx="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        {marcada && (
          <path d="M9.5 18 2.8 11.3l2.4-2.4L9.5 13.2 18.8 4l2.4 2.4L9.5 18Z" fill="currentColor" />
        )}
      </svg>
      {rotulo}
    </button>
  );
}

function Texto({
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

function Area({
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
      <textarea
        value={valor}
        placeholder={dica}
        rows={3}
        onChange={(e) => aoMudar(e.target.value)}
        className="mt-2 w-full rounded-2xl border-2 p-4 text-base"
        style={{ borderColor: 'var(--color-linha)', background: 'var(--color-fundo)' }}
      />
    </label>
  );
}
