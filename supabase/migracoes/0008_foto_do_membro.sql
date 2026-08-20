-- Foto de perfil do voluntário/coordenador — não da criança, essa já existe.
--
-- Reaproveita o bucket 'arquivos' e as policies de storage do 0004
-- (leitura/escrita por qualquer membro do mesmo ministério, caminho sempre
-- {ministerio_id}/...): o caminho novo é {ministerio_id}/perfis/{usuario_id},
-- mesma regra, nenhuma policy de storage nova.
--
-- O que falta é a própria pessoa poder avisar "tenho/não tenho foto" na sua
-- linha de `membros`. A policy de update que já existe ("coordenador
-- administra a equipe", no 0004) libera qualquer coluna, mas só para
-- coordenador, e barra explicitamente a própria linha — não dá para abrir
-- mais uma policy de self-update genérica por cima dela, porque isso também
-- abriria a porta para a pessoa mudar o próprio papel ou se readmitir depois
-- de removida. Por isso aqui é uma função `security definer`, do mesmo jeito
-- que `criar_ministerio` e `conferir_convite` (0001/0006): grava só
-- `foto_atualizada_em`, só na própria linha, e nada mais.
--
-- Rode depois do 0007.

alter table membros add column if not exists foto_atualizada_em timestamptz;

comment on column membros.foto_atualizada_em is
  'Quando a pessoa tem foto de perfil, e desde quando — null é "sem foto". '
  'Serve também de carimbo para os outros aparelhos saberem que a foto '
  'daquela pessoa mudou e precisa ser baixada de novo.';

-- Sem filtro de ministério de propósito: a foto é da pessoa, não do vínculo.
-- Quem participa de mais de um ministério aparece com a mesma foto nos dois.
create or replace function definir_foto_do_membro(tenho_foto boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'precisa estar autenticado';
  end if;

  update membros
  set foto_atualizada_em = case when tenho_foto then now() else null end
  where usuario_id = auth.uid();
end;
$$;

grant execute on function definir_foto_do_membro(boolean) to authenticated;
