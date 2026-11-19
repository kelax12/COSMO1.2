// Tâche créée automatiquement par une habitude, chaque jour prévu (mig. 265).
// Une entrée = l'option est active pour cette habitude ; pas d'entrée = inactive.

export interface HabitAutoTask {
  habitId: string;
  /** Identifiant de catégorie de la tâche créée (forme de `Task.category`). */
  category: string | null;
  /** Dernier jour réservé (`YYYY-MM-DD`, date locale), clé d'idempotence. */
  lastDay: string | null;
}

export interface IHabitAutoTaskRepository {
  list(): Promise<HabitAutoTask[]>;
  /** Active (ou met à jour la catégorie) ; ne touche pas à `lastDay`. */
  enable(habitId: string, category: string | null): Promise<void>;
  disable(habitId: string): Promise<void>;
  /**
   * Réserve `day` pour l'habitude : `true` seulement si `lastDay` était absent
   * ou antérieur, et qu'il vaut maintenant `day`. Un second appel le même jour
   * (autre onglet, autre appareil) rend `false` : une seule tâche par jour.
   */
  claimDay(habitId: string, day: string): Promise<boolean>;
}
