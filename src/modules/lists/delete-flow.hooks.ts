// ═══════════════════════════════════════════════════════════════════
// LISTS — supprimer une liste, avec « Annuler », partout pareil
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (C-41, revue du 2026-09-03).
//
// Le MEME geste avait DEUX garanties differentes selon l'ecran :
//
//   - `TasksPage.deleteListById` supprimait avec un « Annuler » qui restaure
//     l'identifiant d'origine (R-08) ET repose `taskIds` ;
//   - `DesktopAddToList` et `MobileAddToList` appelaient
//     `deleteListMutation.mutate(listId)` nu : aucun retour possible, et la
//     liste des taches qu'elle contenait etait perdue pour de bon.
//
// Ce fichier porte le flux UNE fois, et les trois appelants le partagent. Une
// suppression de liste doit toujours etre annulable, quel que soit l'ecran
// depuis lequel on l'a declenchee.
//
// ── LES DEUX TEMPS, ET POURQUOI ─────────────────────────────────────
//
// `create()` force `taskIds: []` (c'est la whitelist du repository, pas un
// oubli : le contenu d'une liste ne se pose pas depuis un payload de
// creation). La restauration se fait donc en DEUX temps — recreer la liste
// sous son identifiant, puis reposer son contenu. Le second temps est
// conditionne a un contenu non vide, pour ne pas ecrire une mutation inutile.

import { useCallback } from 'react';
import { showUndoToast } from '@/lib/undo-toast';
import { translator } from '@/i18n/useT';
import { useDeleteList, useRestoreList, useUpdateList } from './hooks';
import type { TaskList } from './types';

/**
 * Rend une fonction `deleteList(list, options?)` qui supprime et propose
 * « Annuler ».
 *
 * @param onDeleted appele apres la suppression effective — sert aux ecrans qui
 *   doivent oublier une selection keyee par l'identifiant supprime.
 */
export function useDeleteListWithUndo(onDeleted?: (listId: string) => void) {
  const deleteListMutation = useDeleteList();
  const restoreListMutation = useRestoreList();
  const updateListMutation = useUpdateList();

  const deleteList = useCallback(
    (list: TaskList) => {
      deleteListMutation.mutate(list.id, {
        onSuccess: () => {
          onDeleted?.(list.id);
          // L'identifiant est restaure (R-08) : le tri memorise par liste
          // (`sortPrefs`) et la selection courante sont keyes dessus, donc les
          // perdre revenait a reinitialiser la liste en la « restaurant ».
          showUndoToast(translator('tasks').t('lists.deleted'), () => {
            restoreListMutation.mutate(list, {
              onSuccess: (newList) => {
                // `create()` force `taskIds: []` : le contenu se repose apres.
                if (list.taskIds.length > 0) {
                  updateListMutation.mutate({
                    id: newList.id,
                    updates: { taskIds: list.taskIds },
                  });
                }
              },
            });
          });
        },
      });
    },
    [deleteListMutation, restoreListMutation, updateListMutation, onDeleted],
  );

  return { deleteList, isPending: deleteListMutation.isPending };
}
