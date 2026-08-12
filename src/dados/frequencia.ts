import { diaDaFicha } from './fichas';
import type { Ficha } from './ficha';
import type { Perfil } from './perfis';

/**
 * Frequência e resumo, derivados das fichas que já existem.
 *
 * Nenhum dado novo é digitado: cada ficha salva **é** uma presença. O app
 * apenas conta — quem interpreta o que os números significam é a fono ou a
 * coordenação. Não há nota, escore nem "evolução".
 */

export type ResumoDaCrianca = {
  perfil: Perfil;
  presencas: number;
  /** Dias de culto registrados no app em que essa criança não tem ficha. */
  ausencias: number;
  ultimoDia: string | null;
  /** Cultos seguidos sem vir, contados do dia mais recente para trás. */
  faltasSeguidas: number;
  crises: number;
  saidasDaSala: number;
  /** Estado emocional mais frequente, quando houver. */
  estadoMaisComum: string | null;
};

/**
 * Só devolve o estado quando ele é maioria de verdade.
 *
 * Com 1 "calmo" e 1 "crise", dizer "quase sempre crise" é afirmação inventada
 * a partir de empate — e aqui isso descreveria uma criança.
 */
const contarMaisComum = (valores: string[]): string | null => {
  if (valores.length === 0) return null;

  const contagem = new Map<string, number>();
  valores.forEach((valor) => contagem.set(valor, (contagem.get(valor) ?? 0) + 1));

  const [estado, vezes] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0];
  return vezes > valores.length / 2 ? estado : null;
};

/**
 * @param dias Dias em que houve culto registrado, do mais recente para o mais
 * antigo. É a régua da ausência: sem ficha de ninguém naquele dia, o app não
 * tem como saber que houve culto.
 */
export function resumirCrianca(perfil: Perfil, fichas: Ficha[], dias: string[]): ResumoDaCrianca {
  const dela = fichas.filter((ficha) => ficha.perfilId === perfil.id);
  const diasPresente = new Set(dela.map(diaDaFicha));

  let faltasSeguidas = 0;
  for (const dia of dias) {
    if (diasPresente.has(dia)) break;
    faltasSeguidas += 1;
  }

  return {
    perfil,
    presencas: diasPresente.size,
    ausencias: dias.filter((dia) => !diasPresente.has(dia)).length,
    ultimoDia: [...diasPresente].sort().reverse()[0] ?? null,
    faltasSeguidas,
    crises: dela.filter((ficha) => ficha.estado === 'crise').length,
    saidasDaSala: dela.filter((ficha) => ficha.saida && ficha.saida !== 'nao').length,
    estadoMaisComum: contarMaisComum(
      dela.flatMap((ficha) => (ficha.estado ? [ficha.estado] : [])),
    ),
  };
}

/** Quem veio mais aparece primeiro; empate desempata pelo nome. */
export function resumirTodas(perfis: Perfil[], fichas: Ficha[], dias: string[]) {
  return perfis
    .map((perfil) => resumirCrianca(perfil, fichas, dias))
    .sort(
      (a, b) =>
        b.presencas - a.presencas || a.perfil.nome.localeCompare(b.perfil.nome, 'pt-BR'),
    );
}

/** Fichas de um dia, para a visão "quem veio neste culto". */
export function presencasDoDia(fichas: Ficha[], dia: string): Ficha[] {
  return fichas.filter((ficha) => diaDaFicha(ficha) === dia);
}
