import { useMemo, useState } from 'react';
import { ROTULOS } from '../dados/ficha';
import { diasComFicha, listarFichas } from '../dados/fichas';
import { presencasDoDia, resumirTodas } from '../dados/frequencia';
import { listarPerfis } from '../dados/perfis';
import { Retrato } from './SeletorDeCrianca';

const formatarDia = (dia: string) => new Date(`${dia}T12:00`).toLocaleDateString('pt-BR');

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
