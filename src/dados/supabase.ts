import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente do Supabase.
 *
 * A chave que vai aqui é a publishable (antiga anon): ela viaja no bundle do
 * navegador e é pública por natureza. Quem protege o dado é a RLS do banco —
 * ver `supabase/migracoes/0001_fundacao.sql`.
 *
 * O app **não depende** disto para funcionar: sem as variáveis configuradas,
 * `supabase` é `null` e tudo continua rodando local, como sempre rodou. Igreja
 * sem internet não pode ficar sem prancha.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && chave
    ? createClient(url, chave, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // O voluntário entra uma vez no tablet e continua entrando.
          storageKey: 'prancha-kids:sessao',
        },
      })
    : null;

export const temNuvem = () => supabase !== null;
