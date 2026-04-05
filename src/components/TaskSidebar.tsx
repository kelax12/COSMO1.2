import React, { useState } from 'react';
import { Search, Clock, Bookmark, Filter, X, CheckCircle2 } from 'lucide-react';
import TaskModal from './TaskModal';
import CollaboratorAvatars from './CollaboratorAvatars';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useTasks, Task } from '@/modules/tasks';

// ═══════════════════════════════════════════════════════════════════
// Module events - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useEvents } from '@/modules/events';

// ═══════════════════════════════════════════════════════════════════
// Module categories - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useCategories } from '@/modules/categories';

// ═══════════════════════════════════════════════════════════════════
// TaskContext - uniquement pour domaines NON MIGRÉS
// ═══════════════════════════════════════════════════════════════════
import { useTasks as useTaskContext } from '../context/TaskContext';

type TaskSidebarProps = {
  onClose?: () => void;
  onDragStart?: () => void;
};

const TaskSidebar: React.FC<TaskSidebarProps> = ({ onClose, onDragStart }) => {
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: tasks = [] } = useTasks();

  // ═══════════════════════════════════════════════════════════════════
  // EVENTS - Depuis le module events (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: events = [] } = useEvents();

  // ═══════════════════════════════════════════════════════════════════
  // CATEGORIES - Depuis le module categories (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: categories = [] } = useCategories();

  // ═══════════════════════════════════════════════════════════════════
  // Domaines NON MIGRÉS (depuis TaskContext)
  // ═══════════════════════════════════════════════════════════════════
  const { colorSettings, priorityRange, friends } = useTaskContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [showTutorial, setShowTutorial] = useState(true);
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<Task | null>(null);

  // Filter tasks (exclude completed ones and respect priority range)
  const availableTasks = tasks.filter(task => 
    !task.completed &&
    task.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterCategory === '' || task.category === filterCategory) &&
    (filterPriority === '' || task.priority.toString() === filterPriority) &&
    task.priority >= priorityRange[0] && task.priority <= priorityRange[1]
  );

  const getCategoryColor = (category: string) => {
    return categories.find(cat => cat.id === category)?.color || '#6B7280';
  };

  const getPriorityColor = (priority: number) => {
    const colors = {
      1: 'bg-red-200 text-red-900',
      2: 'bg-orange-100 text-orange-800',
      3: 'bg-yellow-100 text-yellow-800',
      4: 'bg-blue-100 text-blue-800',
      5: 'bg-purple-100 text-purple-800'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const isTaskPlacedInCalendar = (taskId: string) => {
    return events.some(event => event.taskId === taskId);
  };

    return (
      <div className="w-56 lg:w-72 lg:sm:w-80 border-r flex flex-col h-full" style={{ backgroundColor: 'rgb(var(--nav-bg))', borderColor: 'rgb(var(--nav-border))' }}>
        {/* Sidebar Header */}
      <div className="p-4 border-b" style={{ borderColor: 'rgb(var(--nav-border))' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>Tâches disponibles</h2>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              style={{ color: 'rgb(var(--color-text-secondary))' }}
            >
              <X size={20} />
            </button>
          )}
        </div>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: 'rgb(var(--color-text-muted))' }} />
          <input
            type="text"
            placeholder="Rechercher une tâche..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            style={{ 
              backgroundColor: 'rgb(var(--color-surface))',
              borderColor: 'rgb(var(--color-border))',
              color: 'rgb(var(--color-text-primary))'
            }}
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
            style={{ 
              backgroundColor: 'rgb(var(--color-surface))',
              borderColor: 'rgb(var(--color-border))',
              color: 'rgb(var(--color-text-primary))'
            }}
          >
            <option value="">Toutes catégories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
            style={{ 
              backgroundColor: 'rgb(var(--color-surface))',
              borderColor: 'rgb(var(--color-border))',
              color: 'rgb(var(--color-text-primary))'
            }}
          >
            <option value="">Toutes priorités</option>
            <option value="1">Priorité 1</option>
            <option value="2">Priorité 2</option>
            <option value="3">Priorité 3</option>
            <option value="4">Priorité 4</option>
            <option value="5">Priorité 5</option>
          </select>
        </div>
      </div>

      {/* Tasks List Container for External Events */}
      <div id="external-events-container" className="flex-1 overflow-y-auto p-4 space-y-3">
        {availableTasks.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'rgb(var(--color-text-muted))' }}>
            <Filter size={48} className="mx-auto mb-2" style={{ color: 'rgb(var(--color-text-muted))' }} />
            <p>Aucune tâche trouvée</p>
          </div>
        ) : (
          availableTasks.map(task => {
            const isPlaced = isTaskPlacedInCalendar(task.id);
            
            return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskForModal(task)}
                    className={`external-event rounded-lg p-3 border group select-none ${
                      isPlaced ? 'opacity-50 cursor-not-allowed' : 'cursor-move hover:shadow-md'
                    }`}
                    style={{ 
                      backgroundColor: isPlaced ? 'rgb(var(--color-hover))' : 'rgb(var(--color-surface))',
                      borderColor: 'rgb(var(--color-border))',
                      borderLeft: `4px solid ${getCategoryColor(task.category)}`,
                      position: 'relative',
                      touchAction: 'none',
                      transition: isPlaced ? 'none' : 'background-color 0.2s, border-color 0.2s, box-shadow 0.2s'
                    }}

                  onMouseEnter={(e) => !isPlaced && (e.currentTarget.style.backgroundColor = 'rgb(var(--color-hover))')}
                    onMouseLeave={(e) => !isPlaced && (e.currentTarget.style.backgroundColor = 'rgb(var(--color-surface))')}
                    onPointerDown={() => !isPlaced && onDragStart?.()}
                    data-task={JSON.stringify(task)}
                  >
                {isPlaced && (
                  <div className="absolute inset-0 bg-black bg-opacity-10 rounded-lg flex items-center justify-center pointer-events-none">
                    <div className="bg-white dark:bg-slate-800 rounded-full p-2 shadow-lg">
                      <CheckCircle2 size={24} className="text-green-500" />
                    </div>
                  </div>
                )}
                
                    <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getCategoryColor(task.category) }}
                      />
                      <span className={`font-medium text-sm ${isPlaced ? 'line-through' : ''}`} style={{ color: 'rgb(var(--color-text-primary))' }}>{task.name}</span>
                        {task.bookmarked && (
                          <Bookmark size={14} className="favorite-icon filled" />
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        P{task.priority}
                      </span>
                      {task.isCollaborative && task.collaborators && (
                        <CollaboratorAvatars collaborators={task.collaborators} friends={friends} size="sm" />
                      )}
                    </div>
                  </div>

                
                <div className="flex items-center justify-between text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{task.estimatedTime} min</span>
                  </div>
                  <span className="text-xs px-2 py-1 rounded border" style={{ 
                    backgroundColor: 'rgb(var(--color-surface))',
                    borderColor: 'rgb(var(--color-border))',
                    color: 'rgb(var(--color-text-secondary))'
                  }}>
                    {colorSettings[task.category] || 'Sans catégorie'}
                  </span>
                </div>
                
                <div className="mt-2 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
                  Deadline: {new Date(task.deadline).toLocaleDateString('fr-FR')}
                </div>
                
                {/* Drag indicator */}
                {!isPlaced ? (
                  <div className="mt-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'rgb(var(--color-accent))' }}>
                    ↗ Glisser vers le calendrier
                  </div>
                ) : (
                  <div className="mt-2 text-xs font-semibold" style={{ color: 'rgb(var(--color-success))' }}>
                    ✓ Déjà planifiée
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Instructions */}
      {showTutorial && (
        <div className="p-4 border-t relative group/tuto" style={{ borderColor: 'rgb(var(--nav-border))', backgroundColor: 'rgb(var(--color-hover))' }}>
          <button 
            onClick={() => setShowTutorial(false)}
            className="absolute top-2 right-2 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors opacity-60 hover:opacity-100"
            style={{ color: 'rgb(var(--color-text-muted))' }}
            title="Fermer le tutoriel"
          >
            <X size={14} />
          </button>
          <div className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
            <p className="font-medium mb-1">💡 Comment utiliser :</p>
            <p>• Glissez une tâche vers le calendrier</p>
            <p>• Les propriétés se transfèrent automatiquement</p>
            <p>• La durée définit la longueur de l'événement</p>
          </div>
          </div>
        )}

        {selectedTaskForModal && (
          <TaskModal 
            task={selectedTaskForModal} 
            isOpen={!!selectedTaskForModal} 
            onClose={() => setSelectedTaskForModal(null)} 
          />
        )}
      </div>
    );
  };
  
  export default TaskSidebar;
