import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { falarTexto } from '../audio/player';
import { temImagem } from '../assets/disponibilidade';
import { FIGURINHAS, figurinhaPorId, type Figurinha } from '../dados/figurinhas';
import { lerRotina, salvarRotina } from '../dados/rotinas';
import {
  adicionar,
  agora as passoAtual,
  avancar,
  depois as passoSeguinte,
  estaNoFim,
  irPara,
  mover,
  progresso,
  remover,
  rotinaInicial,
  voltar,
  type EstadoDaRotina,
} from '../dados/rotina';
import { BotaoSegurar } from './BotaoSegurar';

const BASE = import.meta.env.BASE_URL;

type Modo = 'crianca' | 'voluntario';

/**
 * Agora e depois — apoio de transição entre atividades, portado do Lume.
 *
 * A prancha diz o que a criança quer; este quadro diz o que vem agora e o que
 * vem depois. A troca de atividade é onde a crise costuma acontecer.
 *
 * Diferenças em relação ao Lume:
 * - **Empilha no celular** e só vira duas colunas a partir de `sm`. Lá o quadro
 *   é `absolute inset-0` com largura calculada e metade ficava fora da tela.
 * - **A rotina é editada como lista**, não arrastando figurinha para dentro dos
 *   espaços. Tocar num passo da faixa **pula para ele** — que é o que se
 *   espera do gesto; antes apagava. Montar a rotina fica atrás do botão
 *   "Montar rotina", para não desmontar nada sem querer no meio do culto.
 * - AGORA e DEPOIS viram só a janela da lista: tocar neles fala o nome.
 */
export function AgoraEDepois({ som }: { som: boolean }) {
  const [estado, setEstado] = useState<EstadoDaRotina>(() => rotinaInicial());
  const [modo, setModo] = useState<Modo>('voluntario');
  const [montando, setMontando] = useState(false);

  // A rotina do culto é a mesma toda semana; redigitar a cada vez inviabiliza.
  useEffect(() => setEstado(lerRotina()), []);

  const anunciar = useCallback(
    (texto: string) => {
      if (som) falarTexto(texto);
    },
    [som],
  );

  const guardar = useCallback((proximo: EstadoDaRotina) => {
    setEstado(proximo);
    salvarRotina(proximo);
  }, []);

  const concluirPasso = () => {
    if (estaNoFim(estado)) {
      anunciar('Terminou. Muito bem!');
      return;
    }
    const proximo = avancar(estado);
    guardar(proximo);
    const nome = figurinhaPorId(passoAtual(proximo) ?? '')?.nome;
    if (nome) anunciar(`Agora: ${nome}`);
  };

  const [cumpridos, total] = progresso(estado);
  const noVoluntario = modo === 'voluntario';

  return (
    <div className="flex flex-col gap-4 px-3 pb-6 sm:px-4">
      <FaixaDaRotina
        estado={estado}
        aoEscolher={(posicao) => {
          guardar(irPara(estado, posicao));
          const nome = figurinhaPorId(estado.rotina[posicao] ?? '')?.nome;
          if (nome) anunciar(`Agora: ${nome}`);
        }}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Espaco
          titulo="AGORA"
          cor="var(--color-acao)"
          figurinha={figurinhaPorId(passoAtual(estado) ?? '')}
          aoTocar={(nome) => anunciar(`Agora: ${nome}`)}
        />
        <Espaco
          titulo="DEPOIS"
          cor="var(--color-urgencia)"
          figurinha={figurinhaPorId(passoSeguinte(estado) ?? '')}
          aoTocar={(nome) => anunciar(`Depois: ${nome}`)}
        />
      </div>

      <button
        type="button"
        onClick={concluirPasso}
        className="min-h-16 w-full rounded-3xl text-xl font-extrabold sm:text-2xl"
        style={{ background: 'var(--color-acao)', color: '#ffffff' }}
      >
        {estaNoFim(estado) ? 'TERMINOU!' : 'TERMINEI · PRÓXIMO'}
      </button>

      <p
        className="text-center text-base font-bold tabular-nums"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        {cumpridos} de {total}
      </p>

      {/* Montar a rotina não existe no modo criança: figurinha ao alcance vira
          brinquedo e a rotina se desmonta sozinha. */}
      {noVoluntario && montando && (
        <MontarRotina
          estado={estado}
          aoMover={(posicao, direcao) => guardar(mover(estado, posicao, direcao))}
          aoRemover={(posicao) => guardar(remover(estado, posicao))}
          aoAdicionar={(id) => {
            guardar(adicionar(estado, id));
            anunciar(figurinhaPorId(id)?.nome ?? '');
          }}
        />
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {noVoluntario ? (
          <>
            <BotaoSecundario rotulo="Passo anterior" aoTocar={() => guardar(voltar(estado))} />
            <BotaoSecundario
              rotulo="Recomeçar rotina"
              aoTocar={() => guardar(irPara(estado, 0))}
            />
            <BotaoSecundario
              rotulo={montando ? 'Concluir montagem' : 'Montar rotina'}
              destacado={montando}
              aoTocar={() => setMontando((estava) => !estava)}
            />
            <BotaoSecundario
              rotulo="Modo criança"
              aoTocar={() => {
                setMontando(false);
                setModo('crianca');
              }}
            />
          </>
        ) : (
          // Sair do modo criança exige segurar: a criança não pode voltar
          // sozinha para a tela que desmonta a rotina no meio do culto.
          <BotaoSegurar
            rotulo="Modo voluntário"
            ativo={false}
            aoCompletar={() => setModo('voluntario')}
          />
        )}
      </div>
    </div>
  );
}

/** Faixa dos passos. Tocar num passo pula para ele — não apaga. */
function FaixaDaRotina({
  estado,
  aoEscolher,
}: {
  estado: EstadoDaRotina;
  aoEscolher: (posicao: number) => void;
}) {
  return (
    <ol className="flex flex-wrap gap-1.5">
      {estado.rotina.map((id, i) => {
        const atual = i === estado.indice;
        const cumprido = i < estado.indice;
        return (
          <li key={`${id}-${i}`}>
            <button
              type="button"
              onClick={() => aoEscolher(i)}
              aria-current={atual ? 'step' : undefined}
              aria-label={`Ir para ${figurinhaPorId(id)?.nome}`}
              className="rounded-full border-2 px-3 py-1 text-sm font-bold"
              style={{
                borderColor: atual ? 'transparent' : 'var(--color-linha)',
                background: atual ? 'var(--color-texto)' : 'transparent',
                color: atual ? 'var(--color-fundo)' : 'var(--color-texto-suave)',
                textDecoration: cumprido ? 'line-through' : undefined,
              }}
            >
              {figurinhaPorId(id)?.nome ?? id}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Três faixas de altura fixa — rótulo, figura e nome — para que os dois
 * quadros fiquem alinhados entre si, independente do tamanho da figura.
 */
function Espaco({
  titulo,
  cor,
  figurinha,
  aoTocar,
}: {
  titulo: string;
  cor: string;
  figurinha: Figurinha | undefined;
  aoTocar: (nome: string) => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => figurinha && aoTocar(figurinha.nome)}
      whileTap={{ scale: 0.97 }}
      aria-label={`${titulo}${figurinha ? `: ${figurinha.nome}` : ', vazio'}`}
      className="grid grid-rows-[auto_1fr_auto] justify-items-center gap-3 rounded-[1.75rem] border-[6px] p-4"
      style={{
        borderColor: cor,
        background: 'var(--color-superficie)',
        boxShadow: 'var(--sombra-card)',
      }}
    >
      <span
        className="rounded-full px-4 py-1 text-sm font-extrabold tracking-widest"
        style={{ background: cor, color: '#ffffff' }}
      >
        {titulo}
      </span>

      <span className="grid h-28 place-items-center sm:h-44">
        {figurinha ? (
          <FiguraGrande figurinha={figurinha} />
        ) : (
          <span className="text-base font-bold" style={{ color: 'var(--color-texto-suave)' }}>
            vazio
          </span>
        )}
      </span>

      <span className="flex h-9 items-center text-center text-xl font-extrabold sm:h-11 sm:text-2xl">
        {figurinha?.nome ?? ''}
      </span>
    </motion.button>
  );
}

/** Usa a foto do card equivalente quando ela existe; senão, o emoji. */
function FiguraGrande({ figurinha }: { figurinha: Figurinha }) {
  if (figurinha.cardId && temImagem(figurinha.cardId)) {
    return (
      <img
        src={`${BASE}img/${figurinha.cardId}.webp`}
        alt=""
        aria-hidden="true"
        className="max-h-28 w-auto object-contain sm:max-h-44"
      />
    );
  }

  return (
    <span aria-hidden="true" className="text-[5rem] leading-none sm:text-[8rem]">
      {figurinha.emoji}
    </span>
  );
}

function MontarRotina({
  estado,
  aoMover,
  aoRemover,
  aoAdicionar,
}: {
  estado: EstadoDaRotina;
  aoMover: (posicao: number, direcao: -1 | 1) => void;
  aoRemover: (posicao: number) => void;
  aoAdicionar: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-col gap-4 rounded-3xl border-2 p-4"
      style={{ borderColor: 'var(--color-linha)', background: 'var(--color-superficie)' }}
    >
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--color-texto-suave)' }}>
          Rotina de hoje
        </h2>
        <ol className="mt-3 flex flex-col gap-2">
          {estado.rotina.map((id, i) => {
            const figurinha = figurinhaPorId(id);
            return (
              <li
                key={`${id}-${i}`}
                className="flex items-center gap-2 rounded-2xl border-2 px-3 py-2"
                style={{
                  borderColor: i === estado.indice ? 'var(--color-acao)' : 'var(--color-linha)',
                }}
              >
                <span aria-hidden="true" className="text-2xl leading-none">
                  {figurinha?.emoji}
                </span>
                <span className="flex-1 text-base font-bold">{figurinha?.nome ?? id}</span>

                <BotaoDeLinha
                  rotulo="↑"
                  descricao={`Subir ${figurinha?.nome}`}
                  desativado={i === 0}
                  aoTocar={() => aoMover(i, -1)}
                />
                <BotaoDeLinha
                  rotulo="↓"
                  descricao={`Descer ${figurinha?.nome}`}
                  desativado={i === estado.rotina.length - 1}
                  aoTocar={() => aoMover(i, 1)}
                />
                <BotaoDeLinha
                  rotulo="✕"
                  descricao={`Tirar ${figurinha?.nome} da rotina`}
                  cor="var(--color-urgencia)"
                  desativado={estado.rotina.length <= 1}
                  aoTocar={() => aoRemover(i)}
                />
              </li>
            );
          })}
        </ol>
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--color-texto-suave)' }}>
          Tocar acrescenta no fim
        </h2>
        <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FIGURINHAS.map((figurinha) => (
            <button
              key={figurinha.id}
              type="button"
              data-classe={figurinha.classe}
              onClick={() => aoAdicionar(figurinha.id)}
              aria-label={`Acrescentar ${figurinha.nome} à rotina`}
              className="grid w-24 shrink-0 snap-start grid-rows-[2.25rem_2.5rem] justify-items-center gap-1 rounded-2xl border-[3px] p-2"
              style={{ borderColor: 'var(--borda)', background: 'var(--tinta)' }}
            >
              <span aria-hidden="true" className="text-3xl leading-none">
                {figurinha.emoji}
              </span>
              <span className="text-center text-xs font-bold leading-tight">{figurinha.nome}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BotaoDeLinha({
  rotulo,
  descricao,
  aoTocar,
  desativado,
  cor,
}: {
  rotulo: string;
  descricao: string;
  aoTocar: () => void;
  desativado?: boolean;
  cor?: string;
}) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      disabled={desativado}
      aria-label={descricao}
      className="size-11 rounded-xl border-2 text-lg font-bold disabled:opacity-30"
      style={{ borderColor: 'var(--color-linha)', color: cor ?? 'var(--color-texto)' }}
    >
      {rotulo}
    </button>
  );
}

function BotaoSecundario({
  rotulo,
  aoTocar,
  destacado,
}: {
  rotulo: string;
  aoTocar: () => void;
  destacado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      className="min-h-12 rounded-full border-2 px-4 text-base font-bold"
      style={{
        borderColor: destacado ? 'transparent' : 'var(--color-linha)',
        background: destacado ? 'var(--color-texto)' : 'transparent',
        color: destacado ? 'var(--color-fundo)' : 'var(--color-texto)',
      }}
    >
      {rotulo}
    </button>
  );
}
