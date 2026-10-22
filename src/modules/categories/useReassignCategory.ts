// ═══════════════════════════════════════════════════════════════════
// RÉAFFECTATION AVANT SUPPRESSION D'UNE CATÉGORIE (R-02)
// ═══════════════════════════════════════════════════════════════════
//
// Déplace tout ce qui porte une catégorie vers une autre (ou vers « aucune »),
// AVANT que la catégorie ne soit supprimée. L'ordre compte : supprimer d'abord
// laisserait une fenêtre où les éléments pointent dans le vide, et un échec de
// la réaffectation deviendrait irrattrapable puisque plus rien ne dirait quels
// éléments étaient concernés.
//
// ⚠️ La réaffectation s'exécute EN SÉQUENCE et non en `Promise.all` : chaque
// écriture passe par une mutation qui met le cache à jour, et les lancer toutes
// ensemble sur un compte chargé fait partir des dizaines de requêtes d'un coup.
// Le volume attendu se compte en dizaines, pas en milliers.
//
// ⚠️ Elle est volontairement NON transactionnelle. Une réaffectation partielle
// laisse un état cohérent — des éléments déjà déplacés, d'autres non — et la
// fonction lève, donc la suppression n'a pas lieu et l'opération est rejouable.
// Le contraire (supprimer quand même) reproduirait exactement le défaut d'origine.

import { useCallback } from 'react';
import { useUpdateTask } from '@/modules/tasks';
import { useUpdateOkr } from '@/modules/okrs';
import { categoryDependents } from './impact';
import type { Task } from '@/modules/tasks/types';
import type { OKR } from '@/modules/okrs/types';

export interface ReassignResult {
  /** Nombre d'éléments effectivement déplacés. */
  moved: number;
  /**
   * Ce qui a bougé, nominativement.
   *
   * 🔴 Sans ces identifiants, « Annuler » ne peut pas défaire la réaffectation :
   * il restitue la catégorie et laisse les éléments là où on vient de les
   * mettre. L'annulation réparait alors en apparence seulement, exactement le
   * défaut que R-08 dit fermer (constaté sur `OKRPage` le 2026-09-02).
   */
  taskIds: string[];
  okrIds: string[];
}

export function useReassignCategory() {
  const updateTask = useUpdateTask();
  const updateOkr = useUpdateOkr();

  /**
   * Déplace les dépendants de `fromCategoryId` vers `toCategoryId`.
   *
   * `toCategoryId` vaut `NO_CATEGORY` (chaîne vide) pour « laisser sans
   * catégorie ». Lève si une écriture échoue, pour que l'appelant renonce à
   * supprimer la catégorie.
   */
  return useCallback(
    async (
      fromCategoryId: string,
      toCategoryId: string,
      tasks: readonly Task[],
      okrs: readonly OKR[],
    ): Promise<ReassignResult> => {
      const { taskIds, okrIds } = categoryDependents(fromCategoryId, tasks, okrs);

      for (const id of taskIds) {
        await updateTask.mutateAsync({ id, updates: { category: toCategoryId } });
      }
      for (const id of okrIds) {
        await updateOkr.mutateAsync({ id, updates: { category: toCategoryId } });
      }

      return { moved: taskIds.length + okrIds.length, taskIds, okrIds };
    },
    [updateTask, updateOkr],
  );
}

/**
 * Repose une catégorie sur des éléments désignés — le retour d'« Annuler ».
 *
 * Prend des IDENTIFIANTS et non une catégorie d'origine : au moment où l'on
 * annule, ces éléments ne portent plus la catégorie supprimée, donc rien dans
 * les données ne permettrait plus de les retrouver. C'est l'appelant qui les a
 * gardés, entre la réaffectation et l'annulation.
 *
 * ⚠️ À n'appeler qu'APRÈS avoir restauré la catégorie elle-même : écrire un
 * identifiant de catégorie qui n'existe pas recréerait des orphelins.
 */
export function useAssignCategory() {
  const updateTask = useUpdateTask();
  const updateOkr = useUpdateOkr();

  return useCallback(
    async (taskIds: readonly string[], okrIds: readonly string[], categoryId: string): Promise<void> => {
      for (const id of taskIds) {
        await updateTask.mutateAsync({ id, updates: { category: categoryId } });
      }
      for (const id of okrIds) {
        await updateOkr.mutateAsync({ id, updates: { category: categoryId } });
      }
    },
    [updateTask, updateOkr],
  );
}
