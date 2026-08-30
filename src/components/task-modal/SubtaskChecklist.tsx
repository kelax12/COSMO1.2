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
import { useT } from '@/i18n/useT';

/**
 * Plafond aligné sur la garde zod (`task.schema.ts`) : afficher un compteur
 * qui laisse taper au-delà de ce que le serveur accepte fait échouer
 * l'enregistrement APRÈS la saisie, sans jamais dire pourquoi.
 */
const MAX_SUBTASKS = 50;

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
  const { t } = useT('tasks');
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
    if (!name || items.length >= MAX_SUBTASKS) return;
    commit([...items, { id: crypto.randomUUID(), name, completed: false }]);
    setNewName('');
  };

  const doneCount = items.filter(s => s.completed).length;

  return (
    <div>
      {!hideLabel && (
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
          {t('subtasks.label')}{' '}
          {items.length > 0 && (
            <span className="normal-case font-normal opacity-70">
              ({t('subtasks.progress', { done: doneCount, total: items.length })})
            </span>
          )}
        </label>
      )}

      {items.length > 0 && (
        <div
          className="h-1 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden mb-2"
          role="progressbar"
          aria-valuenow={Math.round((doneCount / items.length) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }}
          />
        </div>
      )}

      {items.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {items.map((sub) => (
            <li key={sub.id} className="group flex items-center gap-2.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={sub.completed}
                aria-label={sub.completed ? t('subtasks.uncheck', { name: sub.name }) : t('subtasks.check', { name: sub.name })}
                onClick={() => commit(items.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s))}
                className={`w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded border-2 flex items-center justify-center transition-all ${
                  sub.completed ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))]' : 'border-slate-300 dark:border-slate-600 hover:border-[rgb(var(--color-accent-solid-hover))]'
                }`}
              >
                {sub.completed && (
                  <svg className="w-3 h-3 text-[rgb(var(--color-accent-solid-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
                aria-label={t('subtasks.delete', { name: sub.name })}
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
          placeholder={`${t('subtasks.placeholder')}…`}
          aria-label={t('subtasks.add')}
          className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-[rgb(var(--color-accent-solid))] border-slate-200 dark:border-slate-700"
          style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!newName.trim() || items.length >= MAX_SUBTASKS}
          aria-label={t('subtasks.addAction')}
          className="p-2 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] disabled:opacity-40 transition-all"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Le plafond ne se dit qu'une fois atteint : l'annoncer d'emblée
          encombrerait 99 % des tâches pour une limite qu'elles n'atteindront
          jamais. Mais un champ qui cesse de répondre sans un mot, si. */}
      {items.length >= MAX_SUBTASKS && (
        <p className="mt-2 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
          {t('subtasks.limitReached', { max: MAX_SUBTASKS })}
        </p>
      )}
    </div>
  );
};

export default SubtaskChecklist;
