// ═══════════════════════════════════════════════════════════════════
// RENOMMER / RECOLORER UNE CATÉGORIE EN LIGNE (barre de filtres OKR)
// ═══════════════════════════════════════════════════════════════════
//
// Extrait de `OKRPage` le 2026-10-02, comme `useDeleteCategoryFlow` avant lui :
// la section « OKR pro » (05ddf746) avait repoussé la page à 617 lignes, au-dessus
// du budget de 600 que surveille `architecture.guard`. Trois états et trois
// gestes qui ne concernent que l'édition d'une pastille : ils n'ont rien à
// faire dans le rendu de la page.

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { useT } from '@/i18n/useT';
import { useUpdateCategory } from '@/modules/categories';

/** `onStart` : la page referme la barre flottante de la pastille survolée. */
export function useInlineCategoryEdit(onStart: () => void) {
  const { t } = useT('okr');
  const updateCategoryMutation = useUpdateCategory();
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryColor, setEditCategoryColor] = useState('blue');

  const startEditCategory = (cat: { id: string; name: string; color: string }) => {
    setEditingCategoryId(cat.id);
    setEditCategoryName(cat.name);
    setEditCategoryColor(cat.color);
    onStart();
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditCategoryName('');
    setEditCategoryColor('blue');
  };

  const submitEditCategory = () => {
    if (!editingCategoryId) return;
    const name = editCategoryName.trim();
    if (name.length < 2) {
      toast.error(t('page.categoryNameTooShort'));
      return;
    }
    updateCategoryMutation.mutate(
      { id: editingCategoryId, updates: { name, color: editCategoryColor } },
      { onSuccess: () => cancelEditCategory() },
    );
  };

  return {
    editingCategoryId,
    editCategoryName,
    setEditCategoryName,
    editCategoryColor,
    setEditCategoryColor,
    startEditCategory,
    cancelEditCategory,
    submitEditCategory,
  };
}
