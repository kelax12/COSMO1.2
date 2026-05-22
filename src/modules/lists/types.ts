// ═══════════════════════════════════════════════════════════════════
// LISTS MODULE - Type Definitions
// ═══════════════════════════════════════════════════════════════════

/**
 * Smart rule preset — règle prédéfinie qui filtre dynamiquement les tâches.
 * Plus simple qu'un builder libre, plus puissant qu'une liste manuelle.
 *
 *   - 'overdue'        : tâches en retard ET non complétées
 *   - 'this-week'      : deadline dans [today, today+7j]
 *   - 'high-priority'  : priorité <= 2
 */
export type SmartRulePreset =
  | 'overdue'
  | 'this-week'
  | 'high-priority';

/**
 * TaskList - Représente une liste de tâches.
 *
 * Deux types :
 *   - 'manual' (défaut) : groupement explicite via taskIds
 *   - 'smart'           : filtre dynamique via smartRule, taskIds ignoré
 */
export interface TaskList {
  id: string;
  name: string;
  color: string;
  taskIds: string[];
  /** 'manual' (défaut) ou 'smart'. Optionnel pour rétro-compat. */
  type?: 'manual' | 'smart';
  /** Pour les listes smart : la règle à appliquer */
  smartRule?: SmartRulePreset;
  /** Liste épinglée par défaut à l'ouverture de la page Tasks */
  isDefault?: boolean;
  /** Position dans l'ordre d'affichage (drag-to-reorder). Plus petit = avant. */
  position?: number;
}

/**
 * Input type for creating a new list
 */
export type CreateListInput = Omit<TaskList, 'id' | 'taskIds'>;

/**
 * Input type for updating an existing list
 */
export type UpdateListInput = Partial<Omit<TaskList, 'id'>>;
