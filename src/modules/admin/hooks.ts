import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '@/modules/auth/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  countVerifiedTotp,
  deriveAdminGateState,
  getAssuranceLevel,
  listFactors,
  type AdminGateState,
  type AssuranceLevel,
} from '@/modules/auth/mfa';
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

/**
 * État de la garde `/admin` : allowlist, niveau d'assurance de la session, et
 * nombre de facteurs TOTP vérifiés. Les trois viennent du serveur.
 *
 * Ce hook ne protège rien — il choisit un écran. La garde est `is_admin()`
 * (mig. 131), qui exige `aal2` avant que `get_admin_stats()` ne rende une
 * ligne. `refresh` est appelé après une vérification réussie : le jeton porte
 * alors `aal2`, et il faut relire le niveau pour laisser passer.
 */
export function useAdminGate(): { state: AdminGateState; refresh: () => void } {
  const { isAuthenticated, isDemo } = useAuth();
  const queryClient = useQueryClient();
  const enabled = isAuthenticated && !isDemo && isSupabaseConfigured;

  // Même clé que `useIsAdmin` : les deux requêtes se dédupliquent. On lit
  // `isPending` ici, parce que `false` doit vouloir dire « pas admin » et
  // jamais « pas encore répondu » — sinon un non-admin resterait sur un
  // écran d'attente au lieu d'être renvoyé.
  const allowlist = useQuery<boolean>({
    queryKey: adminKeys.isAdmin(),
    queryFn: fetchIsAdmin,
    enabled,
    staleTime: Infinity,
    retry: false,
  });

  const { data } = useQuery<{ aal: AssuranceLevel; factors: number }>({
    queryKey: adminKeys.mfa(),
    queryFn: async () => {
      const [aal, factors] = await Promise.all([getAssuranceLevel(), listFactors()]);
      return { aal, factors: countVerifiedTotp(factors) };
    },
    // Inutile d'interroger GoTrue pour un compte qui n'est pas dans
    // l'allowlist : la garde répond déjà « pas admin » sans ces deux appels.
    enabled: enabled && allowlist.data === true,
    staleTime: 30 * 1000,
    retry: false,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: adminKeys.mfa() });
    void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
  }, [queryClient]);

  // Hors production (démo, Supabase non configuré), il n'y a ni allowlist ni
  // facteur : la page se comporte comme avant cette migration.
  if (!enabled) return { state: 'not-admin', refresh };

  return {
    state: deriveAdminGateState({
      allowlisted: allowlist.isPending ? undefined : allowlist.data === true,
      aal: data?.aal,
      factors: data?.factors,
    }),
    refresh,
  };
}
