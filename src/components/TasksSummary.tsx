import React, { useState } from 'react';
import { Settings, Eye, EyeOff } from 'lucide-react';
import { usePendingTasks } from '@/modules/tasks';
import { useCategories } from '@/modules/categories';
import ColorSettingsModal from './ColorSettingsModal';

interface TasksSummaryProps {
  onTogglePosition?: () => void;
  isBottomPosition?: boolean;
}

const TasksSummary: React.FC<TasksSummaryProps> = ({ 
  onTogglePosition,
  isBottomPosition = false 
}) => {
  // Use new module for tasks (read-only)
  const { data: tasks = [], isLoading } = usePendingTasks();
  // Use new module for categories
  const { data: categories = [] } = useCategories();
  const [showColorSettings, setShowColorSettings] = useState(false);
  
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat.id] = tasks.filter(task => task.category === cat.id).length;
    return acc;
  }, {} as Record<string, number>);

  const totalTasks = tasks.length;

  const [isHovered, setIsHovered] = useState(false);

  if (isLoading) {
    return (
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4" style={{ color: 'rgb(var(--color-text-primary))' }}>Chargement...</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        className="card p-6 relative transition-all duration-300"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          borderColor: isHovered ? 'rgb(var(--color-accent))' : 'rgb(var(--color-border))',
          boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)',
          backgroundColor: isHovered ? 'rgb(var(--color-surface)/0.95)' : 'rgb(var(--color-surface))'
        }}
      >
        <div className="absolute top-[5px] right-[5px] flex items-center gap-1">
          {onTogglePosition && (
            <button
              onClick={onTogglePosition}
              className="p-2 rounded-lg transition-colors hidden xl:block"
              style={{ color: 'rgb(var(--color-text-muted))' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgb(var(--color-text-secondary))';
                e.currentTarget.style.backgroundColor = 'rgb(var(--color-hover))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgb(var(--color-text-muted))';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title={isBottomPosition ? "Afficher sur le côté" : "Afficher en bas"}
            >
              {isBottomPosition ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          )}
          <button
            onClick={() => setShowColorSettings(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'rgb(var(--color-text-muted))' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgb(var(--color-text-secondary))';
              e.currentTarget.style.backgroundColor = 'rgb(var(--color-hover))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgb(var(--color-text-muted))';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Modifier la légende des couleurs"
          >
            <Settings size={18} />
          </button>
        </div>
        
        <h2 className="text-xl font-bold mb-4 pr-16" style={{ color: 'rgb(var(--color-text-primary))' }}>Taches en cour : {totalTasks}</h2>
        
        <div className={`grid ${isBottomPosition ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-x-6 gap-y-3 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar`}>
          {categories.map((category) => (
            <div key={category.id} className="flex items-center gap-2 shrink-0">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: category.color }}
              ></div>
              <span className="text-sm font-medium truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                {category.name}
              </span>
              <span className="ml-auto text-sm font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                {categoryCounts[category.id] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      <ColorSettingsModal
        isOpen={showColorSettings}
        onClose={() => setShowColorSettings(false)}
      />
    </>
  );
};

export default TasksSummary;
