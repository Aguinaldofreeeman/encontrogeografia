import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  // Keep a clear runtime error in dev; production should have env vars configured.
  console.warn('Supabase env vars missing: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

export const ADMIN_EMAILS = [
  'aguinaldofreeman@gmail.com',
  'aguinaldo71@gmail.com',
  'aguinaldoj@prof.educacao.sp.gov.br',
] as const;

export function isBootstrappedAdminEmail(email?: string | null): boolean {
  const normalized = (email || '').trim().toLowerCase();
  return ADMIN_EMAILS.includes(normalized as (typeof ADMIN_EMAILS)[number]);
}

export function emailToInviteId(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 128);
}
