import React, { createContext, useContext, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { billingRepository } from './billing.repository';
import { useAuth } from '@/modules/auth/AuthContext';
import { isPremiumSubscription } from './subscription.logic';
import { PREMIUM_ENFORCED } from './premium-config';

interface SubscriptionRow {
  id: string;
  plan: 'free' | 'premium';
  status: 'active' | 'cancelled' | 'expired';
  current_period_end: string | null;
  premium_tokens: number;
  win_streak: number;
  // Camelcase aliases for backward compatibility
  premiumTokens?: number;
  winStreak?: number;
  currentPeriodEnd?: string | null;
}

interface BillingStats {
  tokenUsage: number;
  tokenLimit: number;
  isPremium: boolean;
  plan: 'free' | 'premium';
}

interface BillingContextType {
  stats: BillingStats;
  isLoading: boolean;
  refreshBillingStatus: () => Promise<void>;
  incrementTokenUsage: () => void;
  isPremium: () => boolean;
  addTokens: (amount: number, activatePremium?: boolean) => Promise<void>;
  subscription: SubscriptionRow | null;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

const billingKeys = { subscription: ['billing', 'subscription'] as const };

function mapRow(row: Record<string, unknown>): SubscriptionRow {
  return {
    ...(row as unknown as SubscriptionRow),
    premium_tokens: row.premium_tokens as number,
    win_streak: row.win_streak as number,
    // Camelcase aliases
    premiumTokens: row.premium_tokens as number,
    winStreak: row.win_streak as number,
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

  const addTokensMutation = useMutation({
    mutationFn: async ({ amount }: { amount: number; activatePremium?: boolean }) => {
      // L'activation Premium ne peut se faire qu'via Stripe webhook (service_role).
      // Ici on autorise uniquement +1 (vidéo regardée) via la RPC SECURITY DEFINER.
      if (amount !== 1) {
        throw new Error('Client-side token credit is limited to +1 per call (use Stripe Checkout)');
      }
      const { error } = await supabase.rpc('credit_premium_token_from_ad');
      // `throw error` relançait l'objet PostgREST brut : ni une `Error`, donc
      // invisible pour Sentry et pour la garde de retry, ni un message
      // traduit. Toute erreur d'API du produit passe par `normalizeApiError`.
      if (error) throw normalizeApiError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: billingKeys.subscription }),
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
    tokenUsage: 0,
    tokenLimit: subscription?.premium_tokens ?? 0,
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
      incrementTokenUsage: () => {},
      isPremium,
      addTokens: (amount, activatePremium) => addTokensMutation.mutateAsync({ amount, activatePremium }),
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
