// ═══════════════════════════════════════════════════════════════════
// BILLING MODULE — Repository Supabase
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';

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

    const user = await getCurrentUser();
    if (!user) throw makeApiError('not_authenticated');

    const { data: existing, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) throw normalizeApiError(fetchError);

    if (!existing) {
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
    // RPC SECURITY DEFINER — les clients n'ont plus le droit d'UPDATE direct.
    const { data, error } = await supabase.rpc('consume_premium_token');
    if (error) throw normalizeApiError(error);
    return this.mapFromDb(data as SubscriptionRow);
  }

  /**
   * Crédite 1 token premium suite au visionnage d'une publicité.
   * L'activation Premium (plan/status/period_end) ne peut se faire que
   * via le webhook Stripe (service_role), `activatePremium` est ignoré.
   */
  async addTokens(amount: number, _activatePremium = false): Promise<Subscription> {
    if (!supabase) throw new Error('Supabase not configured');
    if (amount !== 1) {
      throw makeApiError('invalid_input');
    }
    const { data, error } = await supabase.rpc('credit_premium_token_from_ad');
    if (error) throw normalizeApiError(error);
    return this.mapFromDb(data as SubscriptionRow);
  }

  /**
   * Variante « chemin chaud » de `getSubscription`, pour le BillingProvider.
   *
   * Deux différences ASSUMÉES avec `getSubscription`, chacune pour une raison
   * précise — ne pas les fusionner sans les relire :
   *
   *   1. `getSession()` au lieu de `getCurrentUser()`. `getSession()` lit le
   *      stockage local, sans aller-retour réseau ; `getUser()` revalide le JWT
   *      auprès de Supabase à CHAQUE appel, ce qui ajoute un RTT qui se
   *      sérialise derrière les autres requêtes en vol. Ce provider est monté
   *      pour toute l'application : le coût y est payé sur chaque écran.
   *   2. Renvoie `null` au lieu de lever. Le billing est une information
   *      d'affichage ; une panne de lecture ne doit pas casser l'app, et
   *      `PREMIUM_ENFORCED` vaut `false` de toute façon aujourd'hui.
   *
   * Renvoie la LIGNE brute : le provider expose sa propre forme (avec alias
   * camelCase de rétro-compatibilité), qui n'est pas celle de `Subscription`.
   */
  async fetchOwnSubscriptionRow(): Promise<Record<string, unknown> | null> {
    if (!supabase) return null;

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return null;
    if (data) return data as Record<string, unknown>;

    const { data: created } = await supabase
      .from('subscriptions')
      .insert([{ user_id: user.id, plan: 'free', status: 'active', premium_tokens: 0, win_streak: 0 }])
      .select()
      .single();
    return (created as Record<string, unknown> | null) ?? null;
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

