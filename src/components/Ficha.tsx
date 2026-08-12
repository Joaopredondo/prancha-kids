import { useEffect, useState, type ReactNode } from 'react';
import {
  ALIMENTACOES,
  COMUNICACOES,
  ESTADOS,
  HORARIOS,
  INTERACOES,
  PERTENCES,
  RECURSOS,
  ROTULOS,
  SAIDAS,
  alternarMultiplo,
  alternarUnico,
  fichaVazia,
  type Ficha as TipoDaFicha,
} from '../dados/ficha';
import { apagarFicha, fichaDeHoje, listarFichas, salvarFicha } from '../dados/fichas';

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
  const [salvaEm, setSalvaEm] = useState<number | null>(null);
  const [anteriores, setAnteriores] = useState<TipoDaFicha[]>([]);

  useEffect(() => {
    setFicha(fichaDeHoje());
    setAnteriores(listarFichas());
  }, []);

  const mudar = <C extends keyof TipoDaFicha>(campo: C, valor: TipoDaFicha[C]) =>
    setFicha((atual) => ({ ...atual, [campo]: valor }));

  const guardar = () => {
    setFicha(salvarFicha(ficha));
    setSalvaEm(Date.now());
    setAnteriores(listarFichas());
  };

  const novaFicha = () => {
    setFicha(fichaVazia());
    setSalvaEm(null);
  };

  const abrir = (anterior: TipoDaFicha) => {
    setFicha(anterior);
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
        Ficha de {new Date(ficha.data).toLocaleDateString('pt-BR')}. Uma por criança por dia —
        reabrir continua de onde parou. Nada aqui é obrigatório. Fica só neste aparelho.
      </p>

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

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={guardar}
          className="min-h-14 rounded-2xl px-6 text-base font-extrabold"
          style={{ background: 'var(--color-acao)', color: '#ffffff' }}
        >
          Salvar ficha
        </button>
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
          onClick={novaFicha}
          className="min-h-14 rounded-2xl border-2 px-6 text-base font-bold"
          style={{ borderColor: 'var(--color-linha)' }}
        >
          Nova ficha
        </button>
        {salvaEm && (
          <span className="text-sm" style={{ color: 'var(--color-texto-suave)' }}>
            salva às {new Date(salvaEm).toLocaleTimeString('pt-BR')}
          </span>
        )}
      </div>

      {anteriores.length > 0 && (
        <Secao titulo="Fichas salvas">
          <ul className="flex flex-col gap-2">
            {anteriores.slice(0, 20).map((anterior) => (
              <li
                key={anterior.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3"
                style={{ borderColor: 'var(--color-linha)' }}
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
                    {anterior.horario && ` · ${anterior.horario}`}
                    {anterior.estado && ` · ${ROTULOS.estado[anterior.estado]}`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => remover(anterior.id)}
                  aria-label={`Apagar ficha de ${anterior.nome || 'sem nome'}`}
                  className="rounded-xl border-2 px-3 py-2 text-sm font-bold print:hidden"
                  style={{ borderColor: 'var(--color-linha)', color: 'var(--color-urgencia)' }}
                >
                  Apagar
                </button>
              </li>
            ))}
          </ul>
        </Secao>
      )}
    </div>
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
