// ═══════════════════════════════════════════════════════════════════
// SUPPRIMER UNE CATÉGORIE PERSONNELLE — réaffecter, supprimer, annuler
// ═══════════════════════════════════════════════════════════════════
//
// Extrait de `OKRPage` : la page portait déjà l'écran, les filtres, les OKR et
// leurs modales, et ce flux l'a poussée au-dessus du budget de 600 lignes que
// le garde d'architecture surveille. Il vit mieux ici de toute façon — c'est
// une séquence en trois temps qui n'a rien à voir avec le rendu de la page.
//
// 🔴 L'ORDRE EST LA RÈGLE (R-02). On réaffecte AVANT de supprimer : l'inverse
// laisse une fenêtre où les éléments pointent dans le vide, et un échec du
// reclassement devient irrattrapable puisque plus rien ne dit quels éléments
// portaient la catégorie disparue. Si la réaffectation échoue, on ne supprime
// pas du tout, et l'opération reste rejouable telle quelle.
//
// 🔴 ET « ANNULER » DOIT DÉFAIRE LES DEUX (R-08). Restituer la catégorie ne
// suffit pas : les éléments viennent d'être déplacés ailleurs et ne reviennent
// pas seuls. On garde donc les identifiants déplacés, et l'annulation repose la
// catégorie d'origine sur eux — après l'avoir recréée, jamais avant, sinon on
// écrit un identifiant de catégorie qui n'existe pas encore.

import { useState } from 'react';
import { toast } from 'sonner';
import { showUndoToast } from '@/lib/undo-toast';
import { useT } from '@/i18n/useT';
import type { Category } from '@/modules/categories';
import { useDeleteCategory, useRestoreCategory } from '@/modules/categories';
import { useAssignCategory, useReassignCategory } from '@/modules/categories/useReassignCategory';
import type { Task } from '@/modules/tasks/types';
import type { OKR } from '@/modules/okrs/types';

interface DeleteCategoryFlowArgs {
  categories: Category[];
  tasks: Task[];
  objectives: OKR[];
  /** Remet le filtre sur « toutes » si la catégorie filtrée disparaît. */
  onDeleted: (deletedId: string) => void;
}

export function useDeleteCategoryFlow({ categories, tasks, objectives, onDeleted }: DeleteCategoryFlowArgs) {
  const { t } = useT('okr');
  const { t: tCommon } = useT('common');
  const { tp: tpOv } = useT('overlays');
  const deleteCategoryMutation = useDeleteCategory();
  const restoreCategoryMutation = useRestoreCategory();
  const reassignCategory = useReassignCategory();
  const assignCategory = useAssignCategory();

  const [categoryToDeleteId, setCategoryToDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async (reassignTo: string) => {
    if (!categoryToDeleteId) return;
    setIsDeleting(true);

    let movedTaskIds: string[] = [];
    let movedOkrIds: string[] = [];
    try {
      const { moved, taskIds, okrIds } = await reassignCategory(categoryToDeleteId, reassignTo, tasks, objectives);
      movedTaskIds = taskIds;
      movedOkrIds = okrIds;
      if (moved > 0) toast.success(tpOv('deleteCategory.doneReassigned', moved));
    } catch {
      toast.error(tCommon('pageError.hint'));
      setIsDeleting(false);
      return;
    }
    setIsDeleting(false);

    const snapshot = categories.find((c) => c.id === categoryToDeleteId);
    const deletedId = categoryToDeleteId;
    deleteCategoryMutation.mutate(deletedId, {
      onSuccess: () => {
        onDeleted(deletedId);
        setCategoryToDeleteId(null);
        if (!snapshot) return;
        showUndoToast(t('page.categoryDeleted'), () => {
          // `restorePayload` GARDE l'identifiant : sans lui la catégorie revient
          // sous un nouvel id et les éléments restent orphelins (R-08).
          restoreCategoryMutation.mutate(snapshot, {
            onSuccess: () => {
              if (movedTaskIds.length === 0 && movedOkrIds.length === 0) return;
              assignCategory(movedTaskIds, movedOkrIds, snapshot.id).catch(() => {
                toast.error(tCommon('pageError.hint'));
              });
            },
          });
        });
      },
    });
  };

  return { categoryToDeleteId, setCategoryToDeleteId, isDeleting, confirmDelete };
}
