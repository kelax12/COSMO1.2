import type { Task } from '@/modules/tasks';
import type { SmartRulePreset, TaskList } from './types';

/**
 * Définition des presets smart : label affiché, couleur suggérée, icône
 * (lucide-react name), et fonction de filtre pure.
 */
export interface SmartPresetDef {
  preset: SmartRulePreset;
  label: string;
  color: string;       // valeur du champ color de la TaskList
  description: string; // pour le sélecteur de preset
  matches: (task: Task, now: Date) => boolean;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const SMART_PRESETS: SmartPresetDef[] = [
  {
    preset: 'overdue',
    label: 'En retard',
    color: 'red',
    description: 'Tâches passées non complétées',
    matches: (task, now) => {
      if (task.completed) return false;
      if (!task.deadline) return false;
      return new Date(task.deadline) < startOfDay(now);
    },
  },
  {
    preset: 'this-week',
    label: 'Cette semaine',
    color: 'blue',
    description: 'Tâches à faire dans les 7 prochains jours',
    matches: (task, now) => {
      if (task.completed) return false;
      if (!task.deadline) return false;
      const d = new Date(task.deadline);
      return d >= startOfDay(now) && d <= endOfDay(addDays(now, 7));
    },
  },
  {
    preset: 'high-priority',
    label: 'Priorité haute',
    color: 'orange',
    description: 'Priorité 1 ou 2 (très haute / haute)',
    matches: (task) => {
      if (task.completed) return false;
      return task.priority <= 2;
    },
  },
];

/**
 * Helper utilisé par le composant TasksPage pour filtrer les tâches
 * appartenant à une liste, qu'elle soit manuelle ou smart.
 */
export const tasksInList = (
  list: TaskList,
  allTasks: Task[],
  now: Date = new Date()
): Task[] => {
  if (list.type === 'smart' && list.smartRule) {
    const preset = SMART_PRESETS.find(p => p.preset === list.smartRule);
    if (!preset) return [];
    return allTasks.filter(t => preset.matches(t, now));
  }
  // Manuelle : intersection avec taskIds
  const ids = new Set(list.taskIds);
  return allTasks.filter(t => ids.has(t.id));
};

/**
 * Helper pour la liste virtuelle "Aujourd'hui" — toujours présente,
 * jamais stockée. C'est une smart-list de fait mais on ne la traite pas
 * comme une vraie liste pour ne pas polluer le repository.
 */
export const tasksDueToday = (allTasks: Task[], now: Date = new Date()): Task[] => {
  const start = startOfDay(now);
  const end = endOfDay(now);
  return allTasks.filter(t => {
    if (t.completed) return false;
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    return d >= start && d <= end;
  });
};
