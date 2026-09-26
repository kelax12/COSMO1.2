import type { KeyOf } from '@/i18n/catalog';
import type { OkrHealth } from './okr-execution.helpers';

/**
 * Apparence d'un état déclaré (KR, objectif). Libellés en CLÉS : cette table
 * est évaluée au premier import, y écrire du texte la figerait dans une langue.
 */
export const HEALTH_META: Record<Exclude<OkrHealth, 'none'>, { labelKey: KeyOf<'org'>; dot: string; pill: string; active: string }> = {
  on_track: {
    labelKey: 'okrExec.healthOnTrack',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    active: 'border-emerald-500 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  },
  at_risk: {
    labelKey: 'okrExec.healthAtRisk',
    dot: 'bg-amber-500',
    pill: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    active: 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  off_track: {
    labelKey: 'okrExec.healthOffTrack',
    dot: 'bg-red-500',
    pill: 'bg-red-500/12 text-red-600 dark:text-red-400',
    active: 'border-red-500 bg-red-500/12 text-red-600 dark:text-red-400',
  },
};
