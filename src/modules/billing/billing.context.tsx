import React, { createContext, useContext, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingRepository, Subscription } from './billing.repository';
import { BillingContextType } from './billing.types';
import { useAuth } from '@/modules/auth/AuthContext';

const BillingContext = createContext<BillingContextType | undefined>(undefined);

const billingKeys = {
  subscription: ['billing', 'subscription'] as const,
};

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isDemo } = useAuth();
  const queryClient = useQueryClient();

  // Fetch subscription depuis Supabase (uniquement si connecté et pas en démo)
  const { data: subscription, isLoading } = useQuery({
    queryKey: billingKeys.subscription,
    queryFn: () => billingRepository.getSubscription(),
    enabled: isAuthenticated && !isDemo,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const addTokensMutation = useMutation({
    mutationFn: ({ amount, activatePremium }: { amount: number; activatePremium?: boolean }) =>
      billingRepository.addTokens(amount, activatePremium),
    onSuccess: (updated: Subscription) => {
      queryClient.setQueryData(billingKeys.subscription, updated);
    },
  });

  const consumeTokenMutation = useMutation({
    mutationFn: () => billingRepository.consumeToken(),
    onSuccess: (updated: Subscription) => {
      queryClient.setQueryData(billingKeys.subscription, updated);
    },
  });

  const isPremium = useCallback((): boolean => {
    // En démo → toujours premium pour la démo
    if (isDemo) return true;
    if (!subscription) return false;
    if (subscription.plan !== 'premium') return false;
    if (subscription.status !== 'active') return false;
    if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) < new Date()) return false;
    if (subscription.premiumTokens <= 0) return false;
    return true;
  }, [subscription, isDemo]);

  const refreshBillingStatus = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: billingKeys.subscription });
  }, [queryClient]);

  // Stats pour rétrocompat avec BillingContextType
  const stats = {
    tokenUsage: 0,
    tokenLimit: subscription?.premiumTokens ?? 0,
    isPremium: isPremium(),
    plan: (subscription?.plan ?? 'free') as 'free' | 'premium',
  };

  return (
    <BillingContext.Provider value={{
      ...stats,
      isLoading,
      refreshBillingStatus,
      incrementTokenUsage: (_amount: number) => consumeTokenMutation.mutate(),
      isPremium,
      subscription: subscription ?? null,
      addTokens: (amount: number, activatePremium?: boolean) =>
        addTokensMutation.mutate({ amount, activatePremium }),
    } as any}>
      {children}
    </BillingContext.Provider>
  );
};

export const useBilling = () => {
  const context = useContext(BillingContext);
  if (context === undefined) throw new Error('useBilling must be used within a BillingProvider');
  return context;
};
