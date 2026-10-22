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
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: 'free' | 'premium';
  status: 'active' | 'cancelled' | 'expired';
  current_period_end: string | null;
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
        .insert([{ user_id: user.id, plan: 'free', status: 'active' }])
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
    return true;
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
      .insert([{ user_id: user.id, plan: 'free', status: 'active' }])
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
    };
  }
}

export const billingRepository = new BillingRepository();

