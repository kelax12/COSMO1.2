export interface BillingStats {
  tokenUsage: number;
  tokenLimit: number;
  isPremium: boolean;
  plan: 'free' | 'premium';
}

export interface BillingContextType {
  stats: BillingStats;
  incrementTokenUsage: (amount: number) => void;
  refreshBillingStatus: () => Promise<void>;
  isLoading: boolean;
}
