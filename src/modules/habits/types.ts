export type HabitFrequency = 'daily' | 'weekly' | 'monthly';

export interface Habit {
  id: string;
  name: string;
  description?: string;
  frequency: HabitFrequency;
  estimatedTime: number;
  color: string;
  icon: string;
  /**
   * Jours cochés — canonique (jamais `completedDates`, faille B5).
   *
   * ⚠️ **Potentiellement BORNÉ en mode Supabase** : `get_my_habits()` (mig. 119)
   * ne renvoie que les `completionsWindowDays` derniers jours, parce que cette
   * structure gagnait une entrée par jour et par habitude SANS AUCUNE BORNE
   * (12,7 o/jour mesurés, ~280 ko par lecture de liste à trois ans).
   * Ne JAMAIS en dériver une série ou un total : utiliser les champs
   * pré-calculés ci-dessous, qui, eux, portent sur l'historique entier.
   */
  completions: Record<string, boolean>;
  createdAt?: string;
  userId?: string;

  // ─── Agrégats calculés SERVEUR sur l'historique COMPLET (mig. 119) ───
  // Absents en mode démo et en local : les helpers retombent alors sur le
  // calcul JS, qui a toute la donnée sous la main.
  /** Série en cours, en jours consécutifs. */
  streakCurrent?: number;
  /** Plus longue série jamais atteinte. */
  streakBest?: number;
  /** Nombre total de jours cochés, toutes périodes. */
  completionsTotal?: number;
  /** Premier jour coché (`YYYY-MM-DD`) — borne basse réelle de l'historique. */
  firstCompletionDate?: string;
  /** Profondeur réellement présente dans `completions`. */
  completionsWindowDays?: number;
}

export type CreateHabitInput = Omit<Habit, 'id' | 'createdAt' | 'completions'> & {
  completions?: Record<string, boolean>;
};

export type UpdateHabitInput = Partial<Omit<Habit, 'id' | 'createdAt'>>;
