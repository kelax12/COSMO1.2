import type { Task } from '@/modules/tasks';
import type { SmartRulePreset, TaskList } from './types';
import { daysUntilDeadline, isDueToday } from '@/lib/deadline';
import { getTimezonePref, type TimezonePref } from '@/lib/timezone';

/**
 * Définition des presets smart : label affiché, couleur suggérée, icône
 * (lucide-react name), et fonction de filtre pure.
 */
export interface SmartPresetDef {
  preset: SmartRulePreset;
  /**
   * Clé de traduction du namespace `tasks`, JAMAIS un libellé.
   *
   * 🔴 `label` portait « En retard » en dur, et `TasksPage` le PERSISTAIT comme
   * nom de liste : une liste créée par un anglophone gardait un nom français
   * pour toujours, y compris après traduction de l'interface. Le défaut était
   * écrit en base, pas seulement à l'écran (risque R-05).
   */
  labelKey: 'smartPreset.overdue' | 'smartPreset.thisWeek' | 'smartPreset.highPriority';
  color: string;       // valeur du champ color de la TaskList
  descriptionKey: string; // pour le sélecteur de preset
  matches: (task: Task, now: Date, pref?: TimezonePref) => boolean;
}

// 🔴 Les règles comparent des JOURS, pas des instants (risque R-01).
//
// Elles opposaient auparavant `new Date(task.deadline)` à un minuit calculé en
// heure machine. Comme l'échéance était écrite à minuit UTC, une tâche datée du
// jour même retombait la veille au soir pour tout fuseau à décalage négatif :
// elle sortait de « Cette semaine » et entrait dans « En retard ». Passer par
// `daysUntilDeadline` fait porter la comparaison sur la clé de jour vécue dans
// le fuseau retenu, ce qui rend aussi la règle juste pour quelqu'un qui a réglé
// un décalage manuel (Guadeloupe, La Réunion, Nouvelle-Calédonie...).

export const SMART_PRESETS: SmartPresetDef[] = [
  {
    preset: 'overdue',
    labelKey: 'smartPreset.overdue',
    color: 'red',
    descriptionKey: 'smartPreset.overdueDescription',
    matches: (task, now, pref = getTimezonePref()) => {
      if (task.completed) return false;
      const days = daysUntilDeadline(task.deadline, pref, now);
      return Number.isFinite(days) && days < 0;
    },
  },
  {
    preset: 'this-week',
    labelKey: 'smartPreset.thisWeek',
    color: 'blue',
    descriptionKey: 'smartPreset.thisWeekDescription',
    matches: (task, now, pref = getTimezonePref()) => {
      if (task.completed) return false;
      const days = daysUntilDeadline(task.deadline, pref, now);
      return Number.isFinite(days) && days >= 0 && days <= 7;
    },
  },
  {
    preset: 'high-priority',
    labelKey: 'smartPreset.highPriority',
    color: 'orange',
    descriptionKey: 'smartPreset.highPriorityDescription',
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
  now: Date = new Date(),
  pref: TimezonePref = getTimezonePref(),
): Task[] => {
  if (list.type === 'smart' && list.smartRule) {
    const preset = SMART_PRESETS.find(p => p.preset === list.smartRule);
    if (!preset) return [];
    return allTasks.filter(t => preset.matches(t, now, pref));
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
export const tasksDueToday = (
  allTasks: Task[],
  now: Date = new Date(),
  pref: TimezonePref = getTimezonePref(),
): Task[] =>
  allTasks.filter(t => !t.completed && isDueToday(t.deadline, pref, now));
