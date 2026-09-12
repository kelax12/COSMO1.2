import React, { useMemo } from 'react';
import { useCategories, useCategoryLookup } from '@/modules/categories';
import { categoryPath, formatPath } from '@/modules/categories/tree';

type TaskCategoryProps = {
  category: string;
};

const TaskCategoryIndicator: React.FC<TaskCategoryProps> = ({ category }) => {
  const getCategoryById = useCategoryLookup();
  const categoryData = getCategoryById(category);
  // Le chemin complet sert seulement à l'infobulle et au libellé
  // accessible : la pastille elle-même reste sans texte.
  const { data: categories = [] } = useCategories();
  const path = useMemo(() => categoryPath(category, categories), [category, categories]);
  const fullPath = formatPath(path);

  return (
    <div
      className="w-6 h-6 rounded"
      style={{
        backgroundColor: categoryData?.color || '#CBD5E1'
      }}
      title={fullPath}
      // 🔴 `role="img"` est OBLIGATOIRE ici, pas décoratif. Un `<div>` nu a le
      // rôle `generic`, et l'ARIA INTERDIT de nommer un generic : axe le rend
      // en `aria-prohibited-attr` (serious), donc le nom est purement et
      // simplement ignoré par les lecteurs d'écran — la pastille redevient
      // muette alors qu'elle porte la seule indication de catégorie de la
      // rangée. Même défaut, même correctif que le bloc de la landing traité
      // le 2026-09-04 (cf. en-tête d'`e2e/a11y-audit.spec.ts`).
      role="img"
      aria-label={fullPath}
    ></div>
  );
};

export default TaskCategoryIndicator;
