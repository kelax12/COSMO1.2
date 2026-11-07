// ═══════════════════════════════════════════════════════════════════
// LISTS MODULE - Données de démonstration (seed)
// ═══════════════════════════════════════════════════════════════════
//
// Jeu de données seul : aucune lecture ni écriture de stockage ici. Le dépôt de
// démo (`local.repository.ts`) l'ensemence au premier accès.

import { TaskList } from './types';

// ═══════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════

export const DEMO_LISTS: TaskList[] = [
  {
    id: 'list-1',
    name: 'Urgent',
    color: 'red',
    taskIds: ['task-1', 'task-2'],
    type: 'manual',
    isDefault: true,        // épinglée par défaut à l'ouverture
    position: 0,
  },
  {
    id: 'list-2',
    name: 'Lundi',
    color: 'purple',
    taskIds: ['t002', 't003', 't005', 't007', 't009'],
    type: 'manual',
    position: 1,
  },
  {
    id: 'list-5',
    name: 'Mardi',
    color: 'blue',
    taskIds: [],
    type: 'manual',
    position: 2,
  },
  {
    id: 'list-3-smart-overdue',
    name: 'En retard',
    color: 'red',
    taskIds: [],
    type: 'smart',
    smartRule: 'overdue',
    position: 3,
  },
  {
    id: 'list-4-smart-priority',
    name: 'Priorité haute',
    color: 'orange',
    taskIds: [],
    type: 'smart',
    smartRule: 'high-priority',
    position: 4,
  },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts.
export const DEMO_LISTS_EN: Record<string, Partial<TaskList>> = {
  'list-1': { name: 'Urgent' },
  'list-2': { name: 'Monday' },
  'list-5': { name: 'Tuesday' },
  'list-3-smart-overdue': { name: 'Overdue' },
  'list-4-smart-priority': { name: 'High priority' },
};
