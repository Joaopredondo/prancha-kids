import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { falarTexto } from '../audio/player';
import { temImagem } from '../assets/disponibilidade';
import { FIGURINHAS, figurinhaPorId, type Figurinha } from '../dados/figurinhas';
import { listarPerfis, type Perfil } from '../dados/perfis';
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

gsap.registerPlugin(Flip);

const BASE = import.meta.env.BASE_URL;

type Modo = 'crianca' | 'voluntario';

/** Última criança escolhida aqui; sobrevive ao recarregamento no meio do culto. */
const CHAVE_DA_CRIANCA = 'prancha-kids:crianca-da-rotina';

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
  const semMovimento = useReducedMotion();
  const [montando, setMontando] = useState(false);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [perfilId, setPerfilId] = useState<string | null>(() =>
    localStorage.getItem(CHAVE_DA_CRIANCA),
  );

  useEffect(() => setPerfis(listarPerfis()), []);

  // Cada criança tem a sua rotina; sem criança escolhida, vale a geral.
  useEffect(() => setEstado(lerRotina(perfilId)), [perfilId]);

  const anunciar = useCallback(
    (texto: string) => {
      if (som) falarTexto(texto);
    },
    [som],
  );

  const guardar = useCallback(
    (proximo: EstadoDaRotina) => {
      setEstado(proximo);
      salvarRotina(proximo, perfilId);
    },
    [perfilId],
  );

  /**
   * Troca de passo com a figurinha viajando de DEPOIS para AGORA.
   *
   * O quadro existe para a criança entender que uma atividade terminou e outra
   * começou — e é justamente na troca que a crise costuma acontecer. Ver a
   * figurinha **atravessar** para o lugar do AGORA mostra isso acontecendo;
   * trocar o conteúdo num piscar deixa a relação entre os dois quadros
   * invisível, que é como estava antes.
   *
   * A posição na rotina é o que identifica a figurinha para o Flip, e não o id
   * dela: rotina com a mesma atividade repetida (dois lanches, por exemplo)
   * daria dois elementos com a mesma identidade e o Flip animaria o par errado.
   */
  const palco = useRef<HTMLDivElement>(null);
  const posicoesAntes = useRef<Flip.FlipState | null>(null);

  const guardarComTravessia = useCallback(
    (proximo: EstadoDaRotina) => {
      if (!semMovimento && palco.current) {
        posicoesAntes.current = Flip.getState(palco.current.querySelectorAll('[data-flip-id]'));
      }
      guardar(proximo);
    },
    [guardar, semMovimento],
  );

  useLayoutEffect(() => {
    const antes = posicoesAntes.current;
    if (!antes) return;
    posicoesAntes.current = null;

    Flip.from(antes, {
      duration: 0.55,
      ease: 'power2.inOut',
      // Sem isto a figurinha não consegue sair do quadro em que está: ela é
      // filha do botão AGORA/DEPOIS e ficaria recortada no caminho.
      absolute: true,
      // A que chega ao DEPOIS não vinha de lugar nenhum; a que sai do AGORA
      // acabou. Aparecer e sumir no lugar é mais honesto que fazê-las deslizar
      // de fora da tela.
      onEnter: (alvos) =>
        gsap.fromTo(
          alvos,
          { opacity: 0, scale: 0.86 },
          { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' },
        ),
      onLeave: (alvos) =>
        gsap.to(alvos, { opacity: 0, scale: 0.86, duration: 0.3, ease: 'power2.in' }),
    });
  }, [estado.indice, estado.rotina]);

  const escolherCrianca = (id: string | null) => {
    setPerfilId(id);
    if (id) localStorage.setItem(CHAVE_DA_CRIANCA, id);
    else localStorage.removeItem(CHAVE_DA_CRIANCA);
  };

  const concluirPasso = () => {
    if (estaNoFim(estado)) {
      anunciar('Terminou. Muito bem!');
      return;
    }
    const proximo = avancar(estado);
    guardarComTravessia(proximo);
    const nome = figurinhaPorId(passoAtual(proximo) ?? '')?.nome;
    if (nome) anunciar(`Agora: ${nome}`);
  };

  const [cumpridos, total] = progresso(estado);
  const noVoluntario = modo === 'voluntario';

  return (
    <div className="flex flex-col gap-4 px-3 pb-6 sm:px-4">
      {noVoluntario && perfis.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold" style={{ color: 'var(--color-texto-suave)' }}>
            Rotina de
          </span>
          <ChipDeCrianca
            rotulo="Geral"
            ativo={perfilId === null}
            aoTocar={() => escolherCrianca(null)}
          />
          {perfis.map((perfil) => (
            <ChipDeCrianca
              key={perfil.id}
              rotulo={perfil.nome || 'Sem nome'}
              ativo={perfilId === perfil.id}
              aoTocar={() => escolherCrianca(perfil.id)}
            />
          ))}
        </div>
      )}

      <FaixaDaRotina
        estado={estado}
        aoEscolher={(posicao) => {
          guardarComTravessia(irPara(estado, posicao));
          const nome = figurinhaPorId(estado.rotina[posicao] ?? '')?.nome;
          if (nome) anunciar(`Agora: ${nome}`);
        }}
      />

      <div ref={palco} className="grid gap-3 sm:grid-cols-2">
        <Espaco
          titulo="AGORA"
          cor="var(--color-acao)"
          posicao={estado.indice}
          figurinha={figurinhaPorId(passoAtual(estado) ?? '')}
          aoTocar={(nome) => anunciar(`Agora: ${nome}`)}
        />
        <Espaco
          titulo="DEPOIS"
          cor="var(--color-urgencia)"
          posicao={estado.indice + 1}
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
            <BotaoSecundario
              rotulo="Passo anterior"
              aoTocar={() => guardarComTravessia(voltar(estado))}
            />
            <BotaoSecundario
              rotulo="Recomeçar rotina"
              aoTocar={() => guardarComTravessia(irPara(estado, 0))}
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
              className="relative rounded-full border-2 px-3 py-1 text-sm font-bold"
              style={{
                borderColor: atual ? 'transparent' : 'var(--color-linha)',
                color: atual ? 'var(--color-fundo)' : 'var(--color-texto-suave)',
                textDecoration: cumprido ? 'line-through' : undefined,
              }}
            >
              {/* `layoutId` compartilhado: a marca do passo atual desliza até o
                  próximo em vez de apagar aqui e acender lá — o avanço da
                  rotina fica visível na faixa, e não só nos dois quadros. */}
              {atual && (
                <motion.span
                  layoutId="passo-atual"
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'var(--color-texto)' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                />
              )}
              <span className="relative z-10">{figurinhaPorId(id)?.nome ?? id}</span>
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
  posicao,
  figurinha,
  aoTocar,
}: {
  titulo: string;
  cor: string;
  /** Passo da rotina que este quadro mostra — a identidade que o Flip segue. */
  posicao: number;
  figurinha: Figurinha | undefined;
  aoTocar: (nome: string) => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => figurinha && aoTocar(figurinha.nome)}
      whileTap={{ scale: 0.97 }}
      aria-label={`${titulo}${figurinha ? `: ${figurinha.nome}` : ', vazio'}`}
      className="grid grid-rows-[auto_1fr] justify-items-center gap-3 rounded-[1.75rem] border-[6px] p-4"
      style={{
        borderColor: cor,
        background: 'var(--color-superficie)',
        boxShadow: 'var(--sombra-card)',
      }}
    >
      {/* O rótulo é do quadro, não da atividade: fica parado enquanto a
          figurinha atravessa. */}
      <span
        className="rounded-full px-4 py-1 text-sm font-extrabold tracking-widest"
        style={{ background: cor, color: '#ffffff' }}
      >
        {titulo}
      </span>

      {/* Figura e nome viajam juntos: o nome pertence à atividade, e vê-lo
          trocar sozinho enquanto a figura ainda está a caminho desmancharia a
          ideia de que é a mesma coisa mudando de lugar. */}
      {/* `data-flip-id` é como o Flip reconhece que a figurinha do quadro DEPOIS
          e a do quadro AGORA são a mesma coisa. Sem ele, o Flip compara os
          elementos pela posição no DOM — e como cada quadro mantém o seu nó e
          só troca o conteúdo, ele concluiria que nada se moveu. */}
      <span
        data-flip-id={figurinha ? posicao : undefined}
        className="grid grid-rows-[1fr_auto] justify-items-center gap-3"
      >
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
        {/* Grade que quebra linha em vez de fileira rolável: com a barra de
            rolagem escondida, nada avisava que havia figurinha fora da tela. */}
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2">
          {FIGURINHAS.map((figurinha) => (
            <button
              key={figurinha.id}
              type="button"
              data-classe={figurinha.classe}
              onClick={() => aoAdicionar(figurinha.id)}
              aria-label={`Acrescentar ${figurinha.nome} à rotina`}
              className="grid grid-rows-[2.25rem_2.5rem] place-items-center gap-1 rounded-2xl border-[3px] p-2"
              style={{ borderColor: 'var(--borda)', background: 'var(--tinta)' }}
            >
              <span aria-hidden="true" className="grid place-items-center text-3xl leading-none">
                {figurinha.emoji}
              </span>
              <span className="flex items-center text-center text-xs font-bold leading-tight">
                {figurinha.nome}
              </span>
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

function ChipDeCrianca({
  rotulo,
  ativo,
  aoTocar,
}: {
  rotulo: string;
  ativo: boolean;
  aoTocar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={ativo}
      className="min-h-11 rounded-full border-2 px-3 text-sm font-bold"
      style={{
        borderColor: ativo ? 'transparent' : 'var(--color-linha)',
        background: ativo ? 'var(--color-texto)' : 'transparent',
        color: ativo ? 'var(--color-fundo)' : 'var(--color-texto)',
      }}
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
