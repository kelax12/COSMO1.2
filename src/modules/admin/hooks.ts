import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/modules/auth/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { adminKeys } from './constants';
import { fetchAdminStats } from './repository';
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
