// Forme intermédiaire de l'import : chaque adaptateur (Todoist, TickTick,
// CSV quelconque) la produit, le plan et l'exécution ne connaissent qu'elle.
import type { TaskRecurrence } from '@/modules/tasks';

export type ImportSource = 'todoist' | 'ticktick' | 'generic';

export interface ImportedTask {
  name: string;
  description?: string;
  /** Jour `YYYY-MM-DD`, jamais un instant : `deadlineFromDayKey` à l'écriture (R-01). */
  dueDay?: string;
  /** 0 = non définie, 1..5 comme COSMO (1 = la plus haute). */
  priority: number;
  completed: boolean;
  /** Du parent vers l'enfant, ex. ['Travail', 'Clients']. Vide = sans catégorie. */
  categoryPath: string[];
  /** Noms des sous-tâches (COSMO n'a qu'un niveau de sous-tâches). */
  subtasks: string[];
  recurrence: TaskRecurrence;
  /** Numéro de ligne dans le fichier (1 = première ligne), pour les messages. */
  line: number;
}

export type SkipReason = 'empty_title' | 'unsupported_type' | 'orphan_subtask' | 'over_limit';

export interface SkippedRow {
  line: number;
  reason: SkipReason;
  fileName: string;
}

export interface ParsedImport {
  source: ImportSource;
  fileName: string;
  tasks: ImportedTask[];
  skipped: SkippedRow[];
}
