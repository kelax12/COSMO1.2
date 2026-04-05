import React, { useState } from 'react';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// Module lists - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { 
  useLists, 
  useCreateList, 
  useUpdateList, 
  useDeleteList,
  TaskList 
} from '@/modules/lists';

interface ListManagerProps {
  isNested?: boolean;
}

const ListManager: React.FC<ListManagerProps> = ({ isNested }) => {
  // ═══════════════════════════════════════════════════════════════════
  // LISTS - Depuis le module lists (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: lists = [] } = useLists();
  const createListMutation = useCreateList();
  const updateListMutation = useUpdateList();
  const deleteListMutation = useDeleteList();

  const [isCreating, setIsCreating] = useState(false);
  const [editingList, setEditingList] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState('blue');
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('blue');
  const [listToDelete, setListToDelete] = useState<string | null>(null);

  const colorOptions = [
    { value: 'blue', color: '#3B82F6', name: 'Bleu' },
    { value: 'red', color: '#EF4444', name: 'Rouge' },
    { value: 'green', color: '#10B981', name: 'Vert' },
    { value: 'purple', color: '#8B5CF6', name: 'Violet' },
    { value: 'orange', color: '#F97316', name: 'Orange' },
    { value: 'yellow', color: '#F59E0B', name: 'Jaune' },
    { value: 'pink', color: '#EC4899', name: 'Rose' },
    { value: 'indigo', color: '#6366F1', name: 'Indigo' },
  ];

  const handleCreateList = () => {
    if (!newListName.trim()) return;
    
    createListMutation.mutate({
      name: newListName,
      color: newListColor
    }, {
      onSuccess: () => {
        setNewListName('');
        setNewListColor('blue');
        setIsCreating(false);
      }
    });
  };

  const handleEditList = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (list) {
      setEditingList(listId);
      setEditName(list.name);
      setEditColor(list.color);
    }
  };

  const handleSaveEdit = () => {
    if (!editName.trim() || !editingList) return;
    
    updateListMutation.mutate({
      id: editingList,
      updates: {
        name: editName,
        color: editColor
      }
    }, {
      onSuccess: () => {
        setEditingList(null);
        setEditName('');
        setEditColor('blue');
      }
    });
  };

  const handleCancelEdit = () => {
    setEditingList(null);
    setEditName('');
    setEditColor('blue');
  };

  const confirmDelete = () => {
    if (listToDelete) {
      deleteListMutation.mutate(listToDelete, {
        onSuccess: () => {
          setListToDelete(null);
        }
      });
    }
  };

  return (
    <div className={`${isNested ? 'p-4' : 'p-6'} rounded-lg shadow-sm border transition-all duration-300`} style={{
      backgroundColor: 'rgb(var(--color-surface))',
      borderColor: 'rgb(var(--color-border))'
    }}>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`${isNested ? 'text-lg' : 'text-xl'} font-bold`} style={{ color: 'rgb(var(--color-text-primary))' }}>Gestion des listes</h2>
        <button
          onClick={() => setIsCreating(true)}
          className={`flex items-center gap-2 rounded-lg ${isNested ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'} transition-all shadow-sm border bg-blue-600 text-white border-blue-700 hover:bg-blue-700 dark:bg-blue-500 dark:border-blue-600 dark:hover:bg-blue-600 font-medium`}
        >
          <Plus size={isNested ? 16 : 20} />
          <span>Nouvelle liste</span>
        </button>
      </div>

      {/* Create new list form */}
      {isCreating && (
        <div className="p-4 rounded-lg mb-6 transition-colors" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
          <h3 className="text-lg font-medium mb-4" style={{ color: 'rgb(var(--color-text-primary))' }}>Créer une nouvelle liste</h3>
          <div className={`grid grid-cols-1 ${isNested ? '' : 'md:grid-cols-2'} gap-4`}>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                Nom de la liste
              </label>
                <div className="relative">
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    style={{
                      backgroundColor: 'rgb(var(--color-surface))',
                      color: 'rgb(var(--color-text-primary))',
                      borderColor: 'rgb(var(--color-border))'
                    }}
                    placeholder="Entrez le nom de la liste"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  Couleur
                </label>
                <div className="relative">
                  <select
                    value={newListColor}
                    onChange={(e) => setNewListColor(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    style={{
                      backgroundColor: 'rgb(var(--color-surface))',
                      color: 'rgb(var(--color-text-primary))',
                      borderColor: 'rgb(var(--color-border))'
                    }}
                  >
                    {colorOptions.map(color => (
                      <option key={color.value} value={color.value}>
                        {color.name}
                      </option>
                    ))}
                  </select>
                  <div 
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/20 shadow-sm pointer-events-none transition-colors duration-200"
                    style={{ backgroundColor: colorOptions.find(c => c.value === newListColor)?.color || '#3B82F6' }}
                  />
                </div>
              </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setIsCreating(false)}
              className={`${isNested ? 'px-4 py-2 text-sm' : 'px-6 py-3'} rounded-lg transition-all font-medium`}
              style={{
                backgroundColor: 'rgb(var(--color-hover))',
                color: 'rgb(var(--color-text-secondary))'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--color-active))'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--color-hover))'}
            >
              Annuler
            </button>
            <button
              onClick={handleCreateList}
              className={`${isNested ? 'px-4 py-2 text-sm' : 'px-6 py-3'} rounded-lg transition-all font-bold text-white shadow-lg shadow-blue-500/25 bg-blue-600 hover:bg-blue-700 border border-blue-700`}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Créer
            </button>
          </div>
        </div>
      )}

      {/* Lists grid */}
      <div className={`grid grid-cols-1 ${isNested ? 'sm:grid-cols-1 md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'} gap-4`}>
        {lists.map(list => (
          <div key={list.id} className="border rounded-lg p-4 transition-colors" style={{
            backgroundColor: 'rgb(var(--color-surface))',
            borderColor: 'rgb(var(--color-border))'
          }}>
            {editingList === list.id ? (
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                      style={{
                        backgroundColor: 'rgb(var(--color-surface))',
                        color: 'rgb(var(--color-text-primary))',
                        borderColor: 'rgb(var(--color-border))'
                      }}
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                      style={{
                        backgroundColor: 'rgb(var(--color-surface))',
                        color: 'rgb(var(--color-text-primary))',
                        borderColor: 'rgb(var(--color-border))'
                      }}
                    >
                      {colorOptions.map(color => (
                        <option key={color.value} value={color.value}>
                          {color.name}
                        </option>
                      ))}
                    </select>
                    <div 
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/20 shadow-sm pointer-events-none transition-colors duration-200"
                      style={{ backgroundColor: colorOptions.find(c => c.value === editColor)?.color || '#3B82F6' }}
                    />
                  </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 text-[rgb(var(--color-text-muted))] hover:text-blue-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="p-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                  >
                    <Check size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: colorOptions.find(c => c.value === list.color)?.color || '#3B82F6' }}
                  />
                  <span className="font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>{list.name}</span>
                </div>
                <div className="text-sm mb-3" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  {list.taskIds.length} tâche{list.taskIds.length !== 1 ? 's' : ''}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleEditList(list.id)}
                    className="p-1 text-[rgb(var(--color-text-muted))] hover:text-blue-600 transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => setListToDelete(list.id)}
                    className="p-1 text-[rgb(var(--color-text-muted))] hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {listToDelete && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#1e2235] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-700/50">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-3">Confirmer la suppression</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-6">
                Êtes-vous sûr de vouloir supprimer cette liste ? Toutes les tâches associées resteront mais ne seront plus groupées.
              </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setListToDelete(null)}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white border border-slate-600 hover:bg-slate-800 transition-all duration-200"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all duration-200"
                  >
                    Confirmer
                  </button>
                </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListManager;
