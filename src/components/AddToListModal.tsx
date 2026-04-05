import React from 'react';
import { X } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// Module lists - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useLists, useAddTaskToList, useRemoveTaskFromList } from '@/modules/lists';

type AddToListModalProps = {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
};

const AddToListModal: React.FC<AddToListModalProps> = ({ isOpen, onClose, taskId }) => {
  // ═══════════════════════════════════════════════════════════════════
  // LISTS - Depuis le module lists (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: lists = [] } = useLists();
  const addTaskToListMutation = useAddTaskToList();
  const removeTaskFromListMutation = useRemoveTaskFromList();

  if (!isOpen) return null;

  const handleAddToList = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (list?.taskIds.includes(taskId)) {
      removeTaskFromListMutation.mutate({ taskId, listId }, {
        onSuccess: () => onClose()
      });
    } else {
      addTaskToListMutation.mutate({ taskId, listId }, {
        onSuccess: () => onClose()
      });
    }
  };

  const colorMap: Record<string, string> = {
    blue: '#3B82F6',
    red: '#EF4444',
    green: '#10B981',
    purple: '#8B5CF6',
    orange: '#F97316',
    yellow: '#F59E0B',
    pink: '#EC4899',
    indigo: '#6366F1',
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
         style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div 
        className="rounded-2xl shadow-xl p-6 w-full max-w-md transition-colors"
        style={{ backgroundColor: 'rgb(var(--color-surface))' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b pb-3"
             style={{ borderColor: 'rgb(var(--color-border))' }}>
          <h2 className="text-xl font-bold"
              style={{ color: 'rgb(var(--color-text-primary))' }}>
            Ajouter à une liste
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'rgb(var(--color-text-muted))' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgb(var(--color-text-primary))';
              e.currentTarget.style.backgroundColor = 'rgb(var(--color-hover))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgb(var(--color-text-muted))';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

          <div className="space-y-3">
            {lists.map(list => {
              const isAlreadyInList = list.taskIds.includes(taskId);
              return (
                <button
                  key={list.id}
                  onClick={() => handleAddToList(list.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-lg border transition-all"
                  style={{
                    backgroundColor: isAlreadyInList ? `${colorMap[list.color] || list.color}1A` : 'rgb(var(--color-surface))',
                    borderColor: isAlreadyInList ? colorMap[list.color] || list.color : 'rgb(var(--color-border))',
                    transform: isAlreadyInList ? 'scale(1.02)' : 'scale(1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isAlreadyInList) {
                      e.currentTarget.style.backgroundColor = 'rgb(var(--color-hover))';
                      e.currentTarget.style.borderColor = 'rgb(var(--color-text-muted))';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isAlreadyInList) {
                      e.currentTarget.style.backgroundColor = 'rgb(var(--color-surface))';
                      e.currentTarget.style.borderColor = 'rgb(var(--color-border))';
                    }
                  }}
                  >
                    <div 
                      className="w-1.5 h-8 rounded" 
                      style={{ backgroundColor: colorMap[list.color] || list.color }} 
                    />
                    <div className="flex items-center justify-between flex-1">

                    <span className="font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>
                      {list.name}
                    </span>
                    <div className="flex items-center gap-2">
                      {isAlreadyInList && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" 
                              style={{ backgroundColor: 'rgb(var(--color-active))', color: 'white' }}>
                          Déjà présent
                        </span>
                      )}
                      <span className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        {list.taskIds.length}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

        {/* Footer */}
        <button
          onClick={onClose}
          className="mt-6 w-full px-6 py-3 rounded-lg transition-colors font-medium"
          style={{
            backgroundColor: 'rgb(var(--color-active))',
            color: 'rgb(var(--color-text-primary))'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgb(var(--color-hover))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgb(var(--color-active))';
          }}
        >
          Terminer
        </button>
      </div>
    </div>
  );
};

export default AddToListModal;
