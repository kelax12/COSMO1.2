import React from 'react';
import { useCategoryLookup } from '@/modules/categories';

type TaskCategoryProps = {
  category: string;
};

const TaskCategoryIndicator: React.FC<TaskCategoryProps> = ({ category }) => {
  const getCategoryById = useCategoryLookup();
  const categoryData = getCategoryById(category);
  
  return (
    <div 
      className="w-6 h-6 rounded" 
      style={{ 
        backgroundColor: categoryData?.color || '#CBD5E1' 
      }}
    ></div>
  );
};

export default TaskCategoryIndicator;
