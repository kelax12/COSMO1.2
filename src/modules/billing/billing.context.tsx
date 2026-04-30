import React, { createContext, useContext, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/modules/auth/AuthContext';

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
    ...(row as SubscriptionRow),
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) return null;
      if (!data) {
        const { data: created } = await supabase
          .from('subscriptions')
          .insert([{ user_id: user.id, plan: 'free', status: 'active', premium_tokens: 0, win_streak: 0 }])
          .select()
          .single();
        return created ? mapRow(created as Record<string, unknown>) : null;
      }
      return mapRow(data as Record<string, unknown>);
    },
    enabled: isAuthenticated && !isDemo,
    staleTime: 1000 * 60 * 5,
  });

  const addTokensMutation = useMutation({
    mutationFn: async ({ amount, activatePremium }: { amount: number; activatePremium?: boolean }) => {
      if (!subscription) return;
      const updates: Partial<Record<string, unknown>> = { premium_tokens: (subscription.premium_tokens ?? 0) + amount };
      if (activatePremium) {
        updates.plan = 'premium';
        updates.status = 'active';
        const end = new Date();
        end.setDate(end.getDate() + 30);
        updates.current_period_end = end.toISOString();
        updates.win_streak = (subscription.win_streak ?? 0) + 1;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('subscriptions').update(updates).eq('id', subscription.id).eq('user_id', user.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: billingKeys.subscription }),
  });

  const isPremium = useCallback((): boolean => {
    if (isDemo) return true;
    if (!subscription) return false;
    if (subscription.plan !== 'premium' || subscription.status !== 'active') return false;
    if (subscription.current_period_end && new Date(subscription.current_period_end) < new Date()) return false;
    return (subscription.premium_tokens ?? 0) > 0;
  }, [subscription, isDemo]);

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
