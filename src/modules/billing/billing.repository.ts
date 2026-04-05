// ═══════════════════════════════════════════════════════════════════
// BILLING MODULE — Repository Supabase
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';

export interface Subscription {
  id: string;
  userId: string;
  plan: 'free' | 'premium';
  status: 'active' | 'cancelled' | 'expired';
  currentPeriodEnd: string | null;
  premiumTokens: number;
  winStreak: number;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: 'free' | 'premium';
  status: 'active' | 'cancelled' | 'expired';
  current_period_end: string | null;
  premium_tokens: number;
  win_streak: number;
}

export class BillingRepository {
  /**
   * Récupère l'abonnement de l'utilisateur courant
   * Crée une ligne free par défaut si elle n'existe pas encore
   */
  async getSubscription(): Promise<Subscription> {
    if (!supabase) throw new Error('Supabase not configured');

    const { data: existing, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw normalizeApiError(fetchError);
    }

    // Crée la ligne si elle n'existe pas
    if (!existing) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: created, error: createError } = await supabase
        .from('subscriptions')
        .insert([{ user_id: user.id, plan: 'free', status: 'active', premium_tokens: 0, win_streak: 0 }])
        .select()
        .single();

      if (createError) throw normalizeApiError(createError);
      return this.mapFromDb(created as SubscriptionRow);
    }

    return this.mapFromDb(existing as SubscriptionRow);
  }

  /**
   * Vérifie si l'utilisateur est premium (vérification serveur)
   */
  async isPremium(): Promise<boolean> {
    const sub = await this.getSubscription();
    if (sub.plan !== 'premium') return false;
    if (sub.status !== 'active') return false;
    if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date()) return false;
    if (sub.premiumTokens <= 0) return false;
    return true;
  }

  /**
   * Consomme 1 token premium (appelé quotidiennement)
   */
  async consumeToken(): Promise<Subscription> {
    if (!supabase) throw new Error('Supabase not configured');

    const sub = await this.getSubscription();
    const newTokens = Math.max(0, sub.premiumTokens - 1);
    const newStatus = newTokens === 0 ? 'expired' : sub.status;

    const { data, error } = await supabase
      .from('subscriptions')
      .update({ premium_tokens: newTokens, status: newStatus })
      .eq('id', sub.id)
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return this.mapFromDb(data as SubscriptionRow);
  }

  /**
   * Ajoute des tokens (après paiement ou pub regardée)
   */
  async addTokens(amount: number, activatePremium = false): Promise<Subscription> {
    if (!supabase) throw new Error('Supabase not configured');

    const sub = await this.getSubscription();
    const updates: Partial<SubscriptionRow> = {
      premium_tokens: sub.premiumTokens + amount,
    };

    if (activatePremium) {
      updates.plan = 'premium';
      updates.status = 'active';
      // Expire dans 30 jours
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      updates.current_period_end = endDate.toISOString();
      updates.win_streak = sub.winStreak + 1;
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', sub.id)
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return this.mapFromDb(data as SubscriptionRow);
  }

  private mapFromDb(row: SubscriptionRow): Subscription {
    return {
      id: row.id,
      userId: row.user_id,
      plan: row.plan,
      status: row.status,
      currentPeriodEnd: row.current_period_end,
      premiumTokens: row.premium_tokens,
      winStreak: row.win_streak,
    };
  }
}

export const billingRepository = new BillingRepository();
"
