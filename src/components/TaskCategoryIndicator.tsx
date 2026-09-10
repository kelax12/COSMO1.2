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
      aria-label={fullPath}
    ></div>
  );
};

export default TaskCategoryIndicator;
