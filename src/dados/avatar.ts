/**
 * Avatar de pessoa, compartilhado entre `PainelDoMinisterio` (lista da
 * equipe) e o cartão de perfil do `MenuLateral`.
 *
 * A cor é estável por pessoa (deriva do id ou e-mail), então o mesmo rosto
 * tem sempre a mesma cor entre telas, sessões e aparelhos — é o que deixa
 * claro que "você" no menu é a mesma pessoa que aparece na lista da equipe.
 */
const CORES_DE_AVATAR = [
  'var(--color-acao)',
  'var(--color-coisa)',
  'var(--color-descricao)',
  'var(--color-social)',
  'var(--color-pessoa)',
];

export function corDoAvatar(chave: string): string {
  let soma = 0;
  for (let i = 0; i < chave.length; i += 1) soma = (soma + chave.charCodeAt(i) * (i + 1)) % 9973;
  return CORES_DE_AVATAR[soma % CORES_DE_AVATAR.length];
}

/** Iniciais de até duas palavras — "Maria Silva" vira MS, "joao" vira J. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}
