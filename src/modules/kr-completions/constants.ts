// ═══════════════════════════════════════════════════════════════════
// KR-COMPLETIONS MODULE - Constants & Query Keys
// ═══════════════════════════════════════════════════════════════════

import { KRCompletionFilters } from './types';

/**
 * LocalStorage key for persisting KR completions in demo mode
 */
export const KR_COMPLETIONS_STORAGE_KEY = 'cosmo_demo_kr_completions';

/**
 * React Query keys for KR Completions
 */
export const krCompletionKeys = {
  all: ['kr-completions'] as const,
  lists: () => [...krCompletionKeys.all, 'list'] as const,
  list: (filters: KRCompletionFilters) => [...krCompletionKeys.lists(), filters] as const,
};

/**
 * Borne du nombre de reps écrites en UNE fois dans le journal (faille B18).
 *
 * Elle vit ici, et pas dans l'un des deux repositories, parce qu'elle a déjà
 * divergé : le repository Supabase clampait, le repository localStorage non
 * (audit A-2). Une règle métier qui n'existe que d'un côté diverge en silence,
 * exactement comme `recordKRCompletion` que CLAUDE.md protège déjà.
 *
 * 100 reps par écriture couvre tout usage réel ; au-delà, c'est une saisie
 * aberrante (le champ de progression d'un KR est un `input[type=number]` sans
 * `max`, qui remonte à chaque frappe).
 */
export const MAX_REPS_PER_WRITE = 100;
