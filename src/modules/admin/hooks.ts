import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/modules/auth/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { adminKeys } from './constants';
import { fetchAdminStats, fetchIsAdmin } from './repository';
import type { AdminStats } from './types';

/**
 * Stats globales du dashboard admin. La RPC rejette (42501 →
 * AdminForbiddenError) tout compte hors allowlist admin_users : `retry`
 * DOIT rester false pour ne pas re-frapper la RPC après un refus.
 */
export function useAdminStats() {
  const { isAuthenticated, isDemo } = useAuth();
  return useQuery<AdminStats, Error>({
    queryKey: adminKeys.stats(),
    queryFn: fetchAdminStats,
    enabled: isAuthenticated && !isDemo && isSupabaseConfigured,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/**
 * true si le compte courant est dans l'allowlist admin_users. Sert
 * uniquement à afficher/masquer le lien « Stats COSMO » dans Settings —
 * la vraie frontière reste la RPC get_admin_stats côté serveur.
 */
export function useIsAdmin(): boolean {
  const { isAuthenticated, isDemo } = useAuth();
  const { data } = useQuery<boolean>({
    queryKey: adminKeys.isAdmin(),
    queryFn: fetchIsAdmin,
    enabled: isAuthenticated && !isDemo && isSupabaseConfigured,
    staleTime: Infinity, // le statut admin ne change pas en cours de session
    retry: false,
  });
  return data === true;
}
