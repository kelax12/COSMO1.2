// ═══════════════════════════════════════════════════════════════════
// SUPPRIMER UNE CATÉGORIE D'ÉQUIPE — réaffecter, puis supprimer
// ═══════════════════════════════════════════════════════════════════
//
// Jumeau entreprise de `pages/okr/useDeleteCategoryFlow` (risque R-02, item
// C-02). Même règle, même ordre, une différence de modèle : ici le lien est un
// NOM (`team_okrs.category`), pas un identifiant — cf. `org-okr-categories/impact.ts`.
//
// 🔴 L'ORDRE EST LA RÈGLE. On réaffecte AVANT de supprimer : l'inverse laisse
// une fenêtre où les OKR pointent dans le vide, et un échec du reclassement
// devient irrattrapable puisque plus rien ne dit quels objectifs portaient la
// catégorie disparue. Si la réaffectation échoue, on ne supprime pas du tout,
// et l'opération reste rejouable telle quelle — la catégorie visée est même
// conservée dans l'état, pour que le dialogue ne se referme pas sur un échec.
//
// ⚠️ Pas d'« Annuler » ici, contrairement au versant personnel : rien ne permet
// de restituer une `org_okr_categories` supprimée sous son identifiant d'origine
// (`createCategory` en forge un neuf). Ce serait une réparation en apparence
// seulement — exactement ce que R-08 reproche. La confirmation annonce donc
// l'impact AVANT, faute de pouvoir revenir APRÈS.

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useT } from '@/i18n/useT';
import { useDeleteOrgOKRCategory, type OrgOKRCategory } from '@/modules/org-okr-categories';
import { orgOkrCategoryDependents } from '@/modules/org-okr-categories/impact';
import { useReassignTeamOKRCategory, type TeamOKR } from '@/modules/team-okrs';

interface DeleteOrgOKRCategoryFlowArgs {
  orgId: string;
  categories: OrgOKRCategory[];
  okrs: TeamOKR[];
  /** Remet le filtre sur « toutes » si la catégorie filtrée disparaît. */
  onDeleted: (deletedId: string) => void;
}

export function useDeleteOrgOKRCategoryFlow({ orgId, categories, okrs, onDeleted }: DeleteOrgOKRCategoryFlowArgs) {
  const { tp } = useT('okr');
  const { t: tCommon } = useT('common');
  const deleteCategory = useDeleteOrgOKRCategory(orgId);
  const reassignCategory = useReassignTeamOKRCategory(orgId);

  const [categoryToDeleteId, setCategoryToDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * `reassignTo` vaut le NOM de la catégorie de destination, ou la chaîne vide
   * pour « laisser sans catégorie ».
   */
  const confirmDelete = useCallback(
    async (reassignTo: string) => {
      if (!categoryToDeleteId) return;
      const doomed = categories.find((c) => c.id === categoryToDeleteId);
      if (!doomed) return;

      setIsDeleting(true);
      const okrIds = orgOkrCategoryDependents(doomed.name, okrs);

      if (okrIds.length > 0) {
        try {
          await reassignCategory.mutateAsync({ okrIds, category: reassignTo });
          toast.success(tp('deleteCategory.doneReassigned', okrIds.length));
        } catch {
          // La mutation a déjà signalé l'erreur ; on renonce à supprimer, et on
          // garde la catégorie visée pour que le geste puisse être rejoué.
          toast.error(tCommon('pageError.hint'));
          setIsDeleting(false);
          return;
        }
      }

      try {
        await deleteCategory.mutateAsync(categoryToDeleteId);
        onDeleted(categoryToDeleteId);
        setCategoryToDeleteId(null);
      } catch {
        // La mutation signale déjà l'erreur. La réaffectation, elle, reste
        // faite : c'est le sens acceptable de l'échec — des OKR reclassés et
        // une catégorie encore là, jamais l'inverse.
      } finally {
        setIsDeleting(false);
      }
    },
    [categoryToDeleteId, categories, okrs, reassignCategory, deleteCategory, onDeleted, tp, tCommon],
  );

  return { categoryToDeleteId, setCategoryToDeleteId, isDeleting, confirmDelete };
}
