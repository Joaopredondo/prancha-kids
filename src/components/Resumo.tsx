import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { listarUltimoAcesso } from '../dados/atividade';
import { listarEquipe, type Equipe } from '../dados/membros';
import { buscarResumo, contarAtivosNaSemana, type Resumo as DadosDoResumo } from '../dados/resumo';
import { useConta } from '../dados/sessao';
import { temNuvem } from '../dados/supabase';

interface Props {
  aoVoltar: () => void;
  aoAbrirEquipe: () => void;
}

/**
 * Visão geral do ministério — a resposta pra "como estamos" sem precisar
 * abrir a lista de crianças, contar fichas na mão ou entrar em Equipe.
 *
 * Cada número usa a cor da classe gramatical mais próxima no Código
 * Fitzgerald (crianças → pessoa, fichas → ação, equipe → descrição, convite
 * → coisa): é o mesmo idioma visual que a prancha já usa, não um dashboard
 * emprestado de outro produto.
 *
 * Só números — nenhum gráfico. A equipe é pequena o bastante pra um número
 * com contexto valer mais que uma barra querendo parecer grande coisa.
 */
export function Resumo({ aoVoltar, aoAbrirEquipe }: Props) {
  const { carregando: carregandoConta, vinculo } = useConta();
  const semMovimento = useReducedMotion();

  const [resumo, setResumo] = useState<DadosDoResumo | null>(null);
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [ativosNaSemana, setAtivosNaSemana] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const souCoordenador = vinculo?.papel === 'coordenador';

  useEffect(() => {
    if (!vinculo) return;
    let vivo = true;

    void (async () => {
      setCarregando(true);
      const [doResumo, daEquipe] = await Promise.all([
        buscarResumo(vinculo.ministerioId),
        listarEquipe(vinculo.ministerioId),
      ]);
      if (!vivo) return;

      if (doResumo.erro) setErro(doResumo.erro);
      if (doResumo.dados) setResumo(doResumo.dados);
      if (daEquipe.dados) setEquipe(daEquipe.dados);

      // Só coordenação: a RLS recusaria pro voluntário mesmo assim.
      if (vinculo.papel === 'coordenador') {
        const doAcesso = await listarUltimoAcesso(vinculo.ministerioId);
        if (vivo && doAcesso.dados) setAtivosNaSemana(contarAtivosNaSemana(doAcesso.dados));
      }

      setCarregando(false);
    })();

    return () => {
      vivo = false;
    };
  }, [vinculo]);

  if (!temNuvem()) {
    return (
      <Aviso aoVoltar={aoVoltar}>
        O resumo depende da nuvem: este aparelho não está ligado a uma conta.
      </Aviso>
    );
  }

  if (carregandoConta) return <Aviso aoVoltar={aoVoltar}>Verificando…</Aviso>;

  if (!vinculo) {
    return (
      <Aviso aoVoltar={aoVoltar}>
        Sem ministério vinculado — peça um convite à coordenação para ver o resumo.
      </Aviso>
    );
  }

  return (
    <motion.div
      initial={semMovimento ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-3 pb-10 sm:px-4"
    >
      <button
        type="button"
        onClick={aoVoltar}
        className="min-h-12 cursor-pointer self-start rounded-full px-1 text-base font-bold underline underline-offset-4"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        ← Voltar
      </button>

      <div>
        <h2 className="text-2xl font-extrabold sm:text-3xl">Resumo</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-texto-suave)' }}>
          {vinculo.ministerio} ·{' '}
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {erro && (
        <p role="alert" className="text-sm font-bold" style={{ color: 'var(--color-urgencia)' }}>
          {erro}
        </p>
      )}

      {carregando && !resumo ? (
        <Esqueleto />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <CartaoDeNumero
            numero={resumo?.criancasAtivas ?? 0}
            rotulo={resumo?.criancasAtivas === 1 ? 'criança atendida' : 'crianças atendidas'}
            cor="var(--color-pessoa)"
          />
          <CartaoDeNumero
            numero={resumo?.fichasDaSemana ?? 0}
            rotulo={resumo?.fichasDaSemana === 1 ? 'ficha esta semana' : 'fichas esta semana'}
            cor="var(--color-acao)"
          />
          <CartaoDeNumero
            numero={equipe?.membros.length ?? 0}
            rotulo={
              equipe
                ? `${equipe.membros.filter((m) => m.papel === 'coordenador').length} coordenação · ${equipe.membros.filter((m) => m.papel === 'voluntario').length} voluntário(a)s`
                : 'na equipe'
            }
            cor="var(--color-descricao)"
          />
          {equipe && equipe.convites.length > 0 && (
            <CartaoDeNumero
              numero={equipe.convites.length}
              rotulo={equipe.convites.length === 1 ? 'convite pendente' : 'convites pendentes'}
              cor="var(--color-coisa)"
            />
          )}
          {souCoordenador && ativosNaSemana !== null && (
            <CartaoDeNumero
              numero={ativosNaSemana}
              rotulo={`de ${equipe?.membros.length ?? 0} ativo${ativosNaSemana === 1 ? '' : 's'} nos últimos 7 dias`}
              cor="var(--color-social)"
            />
          )}
        </div>
      )}

      <button
        type="button"
        onClick={aoAbrirEquipe}
        className="min-h-12 cursor-pointer self-start rounded-full border-2 px-4 text-base font-bold"
        style={{ borderColor: 'var(--color-linha)' }}
      >
        Ver equipe completa →
      </button>
    </motion.div>
  );
}

function CartaoDeNumero({ numero, rotulo, cor }: { numero: number; rotulo: string; cor: string }) {
  return (
    <div
      className="rounded-2xl border-2 py-4 pl-4 pr-3"
      style={{ borderColor: 'var(--color-linha)', borderLeft: `4px solid ${cor}`, background: 'var(--color-superficie)' }}
    >
      <div className="text-3xl font-extrabold tabular-nums">{numero}</div>
      <div className="mt-0.5 text-xs font-semibold leading-tight" style={{ color: 'var(--color-texto-suave)' }}>
        {rotulo}
      </div>
    </div>
  );
}

function Esqueleto() {
  return (
    <div aria-hidden="true" className="grid animate-pulse grid-cols-2 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-24 rounded-2xl border-2" style={{ borderColor: 'var(--color-linha)' }} />
      ))}
    </div>
  );
}

function Aviso({ children, aoVoltar }: { children: React.ReactNode; aoVoltar: () => void }) {
  return (
    <div className="flex flex-col gap-3 px-3 pb-6 sm:px-4">
      <button
        type="button"
        onClick={aoVoltar}
        className="min-h-12 cursor-pointer self-start rounded-full px-1 text-base font-bold underline underline-offset-4"
        style={{ color: 'var(--color-texto-suave)' }}
      >
        ← Voltar
      </button>
      <p className="text-base" style={{ color: 'var(--color-texto-suave)' }}>
        {children}
      </p>
    </div>
  );
}
