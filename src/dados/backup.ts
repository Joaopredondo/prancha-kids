import { chaveDaFoto, lerArquivo, salvarArquivo } from './arquivos';
import { ROTULOS, type Ficha } from './ficha';
import { listarFichas } from './fichas';
import { listarPerfis, salvarPerfil, type Perfil } from './perfis';

/**
 * Cópia de segurança.
 *
 * Tudo do app vive no aparelho: limpar os dados do navegador, trocar de tablet
 * ou o sistema reciclar o armazenamento do PWA apaga fichas e cadastros **sem
 * aviso e sem recuperação**. Exportar é a única rede de proteção que existe.
 */

const VERSAO = 1;

export type Backup = {
  versao: number;
  exportadoEm: number;
  perfis: Perfil[];
  fichas: Ficha[];
  rotina: unknown;
  /** `perfilId` → foto em data URL. Vão junto para o backup ser completo. */
  fotos: Record<string, string>;
};

const paraDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });

const deDataUrl = (dataUrl: string) => fetch(dataUrl).then((r) => r.blob());

export async function montarBackup(): Promise<Backup> {
  const perfis = listarPerfis();
  const fotos: Record<string, string> = {};

  for (const perfil of perfis) {
    if (!perfil.temFoto) continue;
    const blob = await lerArquivo(chaveDaFoto(perfil.id));
    if (blob) fotos[perfil.id] = await paraDataUrl(blob);
  }

  let rotina: unknown = null;
  try {
    rotina = JSON.parse(localStorage.getItem('prancha-kids:rotina') ?? 'null');
  } catch {
    rotina = null;
  }

  return { versao: VERSAO, exportadoEm: Date.now(), perfis, fichas: listarFichas(), rotina, fotos };
}

/**
 * Restaura um backup **juntando** com o que já existe: id igual é substituído,
 * id novo entra. Nunca apaga o que o backup não conhece — restaurar num tablet
 * em uso não pode sumir com o atendimento de hoje.
 */
export async function restaurarBackup(backup: Backup): Promise<{ perfis: number; fichas: number }> {
  if (backup.versao !== VERSAO) {
    throw new Error(`Backup da versão ${backup.versao}; este app lê a versão ${VERSAO}.`);
  }

  backup.perfis.forEach(salvarPerfil);

  const fichas = JSON.parse(localStorage.getItem('prancha-kids:fichas') ?? '{}') as Record<
    string,
    Ficha
  >;
  backup.fichas.forEach((ficha) => {
    fichas[ficha.id] = ficha;
  });
  localStorage.setItem('prancha-kids:fichas', JSON.stringify(fichas));

  if (backup.rotina) {
    localStorage.setItem('prancha-kids:rotina', JSON.stringify(backup.rotina));
  }

  for (const [perfilId, dataUrl] of Object.entries(backup.fotos ?? {})) {
    await salvarArquivo(chaveDaFoto(perfilId), await deDataUrl(dataUrl));
  }

  return { perfis: backup.perfis.length, fichas: backup.fichas.length };
}

const COLUNAS = [
  'data',
  'hora',
  'crianca',
  'idade',
  'laudo',
  'voluntario',
  'culto',
  'estado',
  'comunicacao',
  'interacao',
  'saida',
  'recursos',
  'alimentacao',
  'pertences',
  'observacoes',
  'interesses',
  'manejo',
  'descricao',
  'assinatura',
  'retirada_por',
] as const;

const escapar = (valor: string) => `"${valor.replace(/"/g, '""')}"`;

/** CSV com ponto e vírgula: é o que o Excel em português abre sem perguntar. */
export function fichasParaCsv(fichas: Ficha[]): string {
  const linhas = fichas.map((ficha) => {
    const data = new Date(ficha.data);
    const valores: string[] = [
      data.toLocaleDateString('pt-BR'),
      data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      ficha.nome,
      ficha.idade,
      ficha.laudo,
      ficha.voluntario,
      ficha.horario ?? '',
      ficha.estado ? ROTULOS.estado[ficha.estado] : '',
      ficha.comunicacao.map((c) => ROTULOS.comunicacao[c]).join(', '),
      ficha.interacao ? ROTULOS.interacao[ficha.interacao] : '',
      ficha.saida ? ROTULOS.saida[ficha.saida] : '',
      ficha.recursos.map((r) => ROTULOS.recursos[r]).join(', '),
      ficha.alimentacao.map((a) => ROTULOS.alimentacao[a]).join(', '),
      ficha.pertences.map((p) => ROTULOS.pertences[p]).join(', '),
      ficha.observacoes,
      ficha.interesses,
      ficha.manejo,
      ficha.descricao,
      ficha.assinatura,
      ficha.retiradaPor,
    ];
    return valores.map(escapar).join(';');
  });

  // BOM para o Excel reconhecer os acentos.
  return `﻿${COLUNAS.join(';')}\n${linhas.join('\n')}`;
}

export function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

export const nomeComData = (prefixo: string, extensao: string) =>
  `${prefixo}-${new Date().toISOString().slice(0, 10)}.${extensao}`;
