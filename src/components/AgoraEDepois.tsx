import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { falarTexto } from '../audio/player';
import { temImagem } from '../assets/disponibilidade';
import { FIGURINHAS, figurinhaPorId, type Figurinha } from '../dados/figurinhas';
import { lerRotina, salvarRotina } from '../dados/rotinas';
import {
  agora as passoAtual,
  avancar,
  colocar,
  depois as passoSeguinte,
  estaNoFim,
  progresso,
  remover,
  voltar,
  rotinaInicial,
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
 * Diferenças em relação ao Lume, todas de interface:
 * - **Empilha no celular** e só vira duas colunas a partir de `sm`. No Lume o
 *   quadro é `absolute inset-0` com largura calculada, e no celular metade
 *   ficava fora da tela.
 * - **Sem arrastar.** Só tocar a figurinha e tocar o espaço — o caminho que já
 *   existia no Lume por acessibilidade, e o único que não quebra no toque.
 * - Cores e formas seguem a prancha, não as silhuetas do fundo preto.
 */
export function AgoraEDepois({ som }: { som: boolean }) {
  const [estado, setEstado] = useState<EstadoDaRotina>(() => rotinaInicial());
  const [modo, setModo] = useState<Modo>('voluntario');
  const [selecionada, setSelecionada] = useState<string | null>(null);

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

  const encaixar = (id: string, espaco: 'agora' | 'depois') => {
    guardar(colocar(estado, id, espaco));
    setSelecionada(null);
    const nome = figurinhaPorId(id)?.nome;
    if (nome) anunciar(`${espaco === 'agora' ? 'Agora' : 'Depois'}: ${nome}`);
  };

  // Tocar-e-tocar: toca a figurinha, toca o espaço. Precisa existir — arrastar
  // é difícil para parte das crianças e é o que quebra no celular.
  const tocarEspaco = (espaco: 'agora' | 'depois') => {
    const figurinha = espaco === 'agora' ? passoAtual(estado) : passoSeguinte(estado);
    if (selecionada) {
      encaixar(selecionada, espaco);
      return;
    }
    const nome = figurinhaPorId(figurinha ?? '')?.nome;
    if (nome) anunciar(nome);
  };

  const [cumpridos, total] = progresso(estado);
  const noVoluntario = modo === 'voluntario';

  return (
    <div className="flex flex-col gap-4 px-3 pb-6 sm:px-4">
      <FaixaDaRotina
        estado={estado}
        editavel={noVoluntario}
        onRemover={(posicao) => guardar(remover(estado, posicao))}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Espaco
          titulo="AGORA"
          cor="var(--color-acao)"
          figurinha={figurinhaPorId(passoAtual(estado) ?? '')}
          aguardando={noVoluntario && selecionada !== null}
          aoTocar={() => tocarEspaco('agora')}
        />
        <Espaco
          titulo="DEPOIS"
          cor="var(--color-urgencia)"
          figurinha={figurinhaPorId(passoSeguinte(estado) ?? '')}
          aguardando={noVoluntario && selecionada !== null}
          aoTocar={() => tocarEspaco('depois')}
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

      {/* A bandeja não existe no modo criança: figurinha ao alcance vira
          brinquedo e a rotina se desmonta sozinha. */}
      {noVoluntario && (
        <Bandeja
          selecionada={selecionada}
          aoSelecionar={(id) => {
            const nova = id === selecionada ? null : id;
            setSelecionada(nova);
            if (nova) anunciar(figurinhaPorId(nova)?.nome ?? '');
          }}
        />
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {noVoluntario ? (
          <>
            <BotaoSecundario rotulo="Passo anterior" aoTocar={() => guardar(voltar(estado))} />
            <BotaoSecundario
              rotulo="Recomeçar rotina"
              aoTocar={() => guardar({ ...estado, indice: 0 })}
            />
            <BotaoSecundario rotulo="Modo criança" aoTocar={() => setModo('crianca')} />
          </>
        ) : (
          // Sair do modo criança exige segurar: a criança não pode devolver a
          // bandeja sozinha e desmontar a rotina no meio do culto.
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

function FaixaDaRotina({
  estado,
  editavel,
  onRemover,
}: {
  estado: EstadoDaRotina;
  editavel: boolean;
  onRemover: (posicao: number) => void;
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
              disabled={!editavel}
              onClick={() => onRemover(i)}
              aria-label={editavel ? `Tirar ${figurinhaPorId(id)?.nome} da rotina` : undefined}
              className="rounded-full border-2 px-3 py-1 text-sm font-bold disabled:cursor-default"
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

function Espaco({
  titulo,
  cor,
  figurinha,
  aguardando,
  aoTocar,
}: {
  titulo: string;
  cor: string;
  figurinha: Figurinha | undefined;
  aguardando: boolean;
  aoTocar: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={aoTocar}
      whileTap={{ scale: 0.97 }}
      aria-label={`${titulo}${figurinha ? `: ${figurinha.nome}` : ', vazio'}`}
      className="flex min-h-[15rem] flex-col items-center justify-center gap-3 rounded-[1.75rem] border-[6px] p-4 sm:min-h-[22rem]"
      style={{
        borderColor: cor,
        background: 'var(--color-superficie)',
        boxShadow: aguardando ? `0 0 0 5px ${cor}` : 'var(--sombra-card)',
      }}
    >
      <span
        className="rounded-full px-4 py-1 text-sm font-extrabold tracking-widest"
        style={{ background: cor, color: '#ffffff' }}
      >
        {titulo}
      </span>

      {figurinha ? (
        <>
          <FiguraGrande figurinha={figurinha} />
          <span className="text-center text-xl font-extrabold sm:text-2xl">{figurinha.nome}</span>
        </>
      ) : (
        <span className="text-base font-bold" style={{ color: 'var(--color-texto-suave)' }}>
          {aguardando ? 'toque para colocar aqui' : 'vazio'}
        </span>
      )}
    </motion.button>
  );
}

/** Usa a foto do card equivalente quando ela existe; senão, o emoji. */
function FiguraGrande({ figurinha }: { figurinha: Figurinha }) {
  const comFoto = figurinha.cardId && temImagem(figurinha.cardId);

  if (comFoto) {
    return (
      <img
        src={`${BASE}img/${figurinha.cardId}.webp`}
        alt=""
        aria-hidden="true"
        className="max-h-[7rem] w-auto object-contain sm:max-h-[11rem]"
      />
    );
  }

  return (
    <span aria-hidden="true" className="text-[4.5rem] leading-none sm:text-[7rem]">
      {figurinha.emoji}
    </span>
  );
}

function Bandeja({
  selecionada,
  aoSelecionar,
}: {
  selecionada: string | null;
  aoSelecionar: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold" style={{ color: 'var(--color-texto-suave)' }}>
        Toque numa figurinha e depois no espaço onde ela entra.
      </p>
      <div className="flex snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FIGURINHAS.map((figurinha) => {
          const marcada = selecionada === figurinha.id;
          return (
            <button
              key={figurinha.id}
              type="button"
              data-classe={figurinha.classe}
              onClick={() => aoSelecionar(figurinha.id)}
              aria-pressed={marcada}
              className="flex w-24 shrink-0 snap-start flex-col items-center gap-1 rounded-2xl border-[3px] p-2"
              style={{
                borderColor: marcada ? 'var(--color-texto)' : 'var(--borda)',
                background: marcada ? 'var(--color-texto)' : 'var(--tinta)',
                color: marcada ? 'var(--color-fundo)' : 'var(--color-texto)',
              }}
            >
              <span aria-hidden="true" className="text-3xl leading-none">
                {figurinha.emoji}
              </span>
              <span className="text-center text-xs font-bold leading-tight">{figurinha.nome}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BotaoSecundario({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      className="min-h-12 rounded-full border-2 px-4 text-base font-bold"
      style={{ borderColor: 'var(--color-linha)', color: 'var(--color-texto)' }}
    >
      {rotulo}
    </button>
  );
}
