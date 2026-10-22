import React, { createContext, useContext, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { billingRepository } from './billing.repository';
import { useAuth } from '@/modules/auth/AuthContext';
import { isPremiumSubscription } from './subscription.logic';
import { PREMIUM_ENFORCED } from './premium-config';

interface SubscriptionRow {
  id: string;
  plan: 'free' | 'premium';
  status: 'active' | 'cancelled' | 'expired';
  current_period_end: string | null;
  // Camelcase alias for backward compatibility
  currentPeriodEnd?: string | null;
}

interface BillingStats {
  isPremium: boolean;
  plan: 'free' | 'premium';
}

interface BillingContextType {
  stats: BillingStats;
  isLoading: boolean;
  refreshBillingStatus: () => Promise<void>;
  isPremium: () => boolean;
  subscription: SubscriptionRow | null;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

const billingKeys = { subscription: ['billing', 'subscription'] as const };

function mapRow(row: Record<string, unknown>): SubscriptionRow {
  return {
    ...(row as unknown as SubscriptionRow),
    // Camelcase alias
    currentPeriodEnd: row.current_period_end as string | null,
  };
}

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isDemo } = useAuth();
  const queryClient = useQueryClient();

  const { data: subscription, isLoading } = useQuery({
    queryKey: billingKeys.subscription,
    queryFn: async (): Promise<SubscriptionRow | null> => {
      // La requête vit dans le repository (invariant : aucun `supabase.from()`
      // hors repository). Le choix `getSession()` plutôt que `getUser()`, et le
      // `null` plutôt qu'une exception, y sont documentés — les deux comptent.
      const row = await billingRepository.fetchOwnSubscriptionRow();
      return row ? mapRow(row) : null;
    },
    enabled: isAuthenticated && !isDemo,
    staleTime: 1000 * 60 * 5,
  });

  // Logique extraite dans subscription.logic.ts (pure, testée) — ne pas
  // ré-inliner ici (audit 2026-06-10, couverture des chemins critiques).
  // Premium désactivé (PREMIUM_ENFORCED=false) → true pour tous : débloque
  // automatiquement TOUT gate `isPremium()` (stats, TaskTable…) présent ou
  // futur, sans en oublier un. Code premium conservé, simplement dormant.
  const isPremium = useCallback(
    (): boolean => !PREMIUM_ENFORCED || isPremiumSubscription(subscription, { isDemo }),
    [subscription, isDemo],
  );

  const stats: BillingStats = {
    isPremium: isPremium(),
    plan: subscription?.plan ?? 'free',
  };

  const refreshBillingStatus = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: billingKeys.subscription });
  }, [queryClient]);

  return (
    <BillingContext.Provider value={{
      stats,
      isLoading,
      refreshBillingStatus,
      isPremium,
      subscription: subscription ?? null,
    }}>
      {children}
    </BillingContext.Provider>
  );
};

export const useBilling = () => {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error('useBilling must be used within a BillingProvider');
  return ctx;
};
