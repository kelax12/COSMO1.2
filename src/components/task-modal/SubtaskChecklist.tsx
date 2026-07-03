// ═══════════════════════════════════════════════════════════════════
// SubtaskChecklist — checklist de sous-tâches (#12).
// Deux modes :
//   - Édition (taskId) : état local pour un feedback 0 ms, persistance en
//     arrière-plan via useUpdateTask (subtasks jsonb, whitelist mapTaskToDb,
//     garde zod ≤ 50).
//   - Création (value/onChange) : contrôlé par le formulaire parent, les
//     sous-tâches partent dans le payload createTask.
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { useTask, useUpdateTask, Subtask } from '@/modules/tasks';

interface SubtaskChecklistProps {
  /** Mode édition : id de la tâche à muter. Omis en mode création contrôlé. */
  taskId?: string;
  /** Snapshot déjà connu de l'appelant — affiché en attendant le détail. */
  initialSubtasks?: Subtask[];
  /** Masque le label interne (quand l'appelant affiche déjà un titre de section). */
  hideLabel?: boolean;
  /** Mode création contrôlé : liste courante… */
  value?: Subtask[];
  /** …et callback à chaque changement (remplace la mutation). */
  onChange?: (subtasks: Subtask[]) => void;
}

const SubtaskChecklist: React.FC<SubtaskChecklistProps> = ({ taskId, initialSubtasks, hideLabel = false, value, onChange }) => {
  const isControlled = value !== undefined && onChange !== undefined;
  // Le détail (getById) porte toujours subtasks ; le cache liste peut être
  // plus frais après une mutation — on privilégie le détail s'il existe.
  const { data: detail } = useTask(isControlled ? '' : taskId ?? '');
  const updateTaskMutation = useUpdateTask();

  const [localItems, setLocalItems] = useState<Subtask[]>(initialSubtasks ?? []);
  const [newName, setNewName] = useState('');
  const items = isControlled ? value : localItems;

  useEffect(() => {
    if (isControlled) return;
    const source = detail?.subtasks ?? initialSubtasks ?? [];
    setLocalItems(source);
    // Resynchronise uniquement quand on change de tâche ou que le détail
    // arrive (pas à chaque frappe).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, detail?.id]);

  const commit = (next: Subtask[]) => {
    if (isControlled) { onChange(next); return; }
    setLocalItems(next);
    if (taskId) updateTaskMutation.mutate({ id: taskId, updates: { subtasks: next } });
  };

  const addItem = () => {
    const name = newName.trim();
    if (!name || items.length >= 50) return;
    commit([...items, { id: crypto.randomUUID(), name, completed: false }]);
    setNewName('');
  };

  const doneCount = items.filter(s => s.completed).length;

  return (
    <div>
      {!hideLabel && (
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
          Sous-tâches {items.length > 0 && <span className="normal-case font-normal opacity-70">({doneCount}/{items.length})</span>}
        </label>
      )}

      {items.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {items.map((sub) => (
            <li key={sub.id} className="group flex items-center gap-2.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={sub.completed}
                aria-label={sub.completed ? `Décocher « ${sub.name} »` : `Cocher « ${sub.name} »`}
                onClick={() => commit(items.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s))}
                className={`w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded border-2 flex items-center justify-center transition-all ${
                  sub.completed ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600 hover:border-blue-400'
                }`}
              >
                {sub.completed && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span
                className={`flex-1 text-sm ${sub.completed ? 'line-through opacity-60' : ''}`}
                style={{ color: 'rgb(var(--color-text-primary))' }}
              >
                {sub.name}
              </span>
              <button
                type="button"
                onClick={() => commit(items.filter(s => s.id !== sub.id))}
                aria-label={`Supprimer la sous-tâche « ${sub.name} »`}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 rounded transition-all hover:bg-red-500/10"
                style={{ color: 'rgb(var(--color-text-muted))' }}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addItem(); }
          }}
          placeholder="Ajouter une sous-tâche…"
          aria-label="Ajouter une sous-tâche"
          className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-blue-500 border-slate-200 dark:border-slate-700"
          style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!newName.trim() || items.length >= 50}
          aria-label="Ajouter"
          className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-all"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

export default SubtaskChecklist;
