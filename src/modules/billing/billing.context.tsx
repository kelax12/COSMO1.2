import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BillingContextType, BillingStats } from './billing.types';

const BillingContext = createContext<BillingContextType | undefined>(undefined);

const DEFAULT_STATS: BillingStats = {
  tokenUsage: 0,
  tokenLimit: 1000,
  isPremium: false,
  plan: 'free',
};

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stats, setStats] = useState<BillingStats>(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(false);

  const refreshBillingStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      // In the future, fetch from Supabase or Stripe
    } finally {
      setIsLoading(false);
    }
  }, []);

  const incrementTokenUsage = useCallback((amount: number) => {
    setStats((prev) => ({
      ...prev,
      tokenUsage: prev.tokenUsage + amount,
    }));
  }, []);

  useEffect(() => {
    refreshBillingStatus();
  }, [refreshBillingStatus]);

  return (
    <BillingContext.Provider
      value={{
        stats,
        incrementTokenUsage,
        refreshBillingStatus,
        isLoading,
      }}
    >
      {children}
    </BillingContext.Provider>
  );
};

export const useBilling = () => {
  const context = useContext(BillingContext);
  if (context === undefined) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return context;
};
