// Une colonne du Tableau perso : en-tête, zone de dépôt, cartes, saisie rapide.
//
// Indépendante de l'axe (Statut ou État, 2026-10-09) : le Tableau lui donne
// son identifiant, son libellé, sa pastille et ce qu'une tâche née ici porte
// (`newTask`). La saisie rapide parle la même syntaxe que la barre d'ajout
// global (`parseQuickAdd` : « Dentiste jeudi #santé !! ~30m »). Pas de saisie
// sur « Terminée » (`newTask` nul) : une tâche née terminée n'a rien à faire
// sur un Tableau.
import { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useCreateTask, type CreateTaskInput, type Task } from '@/modules/tasks';
import { useCategories } from '@/modules/categories';
import { parseQuickAdd } from '@/lib/quick-add-parser';
import { deadlineFromDayKey } from '@/lib/deadline';
import { useT } from '@/i18n/useT';
import TaskBoardCard, { TASK_DRAG_TYPE } from './TaskBoardCard';

export interface BoardColumnDef {
  id: string;
  label: string;
  /** Classe Tailwind de la pastille d'en-tête. */
  dot: string;
  tasks: Task[];
  /** Ce que porte une tâche créée dans la colonne ; `null` = pas de saisie. */
  newTask: Pick<CreateTaskInput, 'status' | 'health'> | null;
  /** Mention sous la colonne (« 7 derniers jours »). */
  footer?: string;
}

interface TaskBoardColumnProps {
  column: BoardColumnDef;
  /** Cartes : afficher le statut (colonnes par État). */
  showStatus: boolean;
  canDrag: (task: Task) => boolean;
  onOpen: (task: Task) => void;
  onRequestMove: (task: Task) => void;
  onDropTask: (taskId: string, columnId: string) => void;
}

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const TaskBoardColumn = ({ column, showStatus, canDrag, onOpen, onRequestMove, onDropTask }: TaskBoardColumnProps) => {
  const { id, label, dot, tasks, newTask, footer } = column;
  const { t, tp } = useT('tasks');
  const { data: categories = [] } = useCategories();
  const { mutate: createTask } = useCreateTask();
  const [dragOver, setDragOver] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const headingId = `board-col-${id}`;

  const categoryIdFor = useMemo(() => (token?: string): string => {
    if (!token) return '';
    const wanted = normalize(token);
    const match = categories.find((c) => normalize(c.name) === wanted || normalize(c.name).startsWith(wanted));
    return match?.id ?? '';
  }, [categories]);

  const submit = () => {
    const parsed = parseQuickAdd(draft);
    if (!parsed.name.trim() || !newTask) return;
    createTask({
      name: parsed.name,
      priority: parsed.priority ?? 0,
      category: categoryIdFor(parsed.categoryToken),
      // Un jour, pas un instant (R-01) : `@/lib/deadline` fait foi.
      deadline: deadlineFromDayKey(parsed.deadline),
      estimatedTime: parsed.estimatedTime ?? 0,
      recurrence: parsed.recurrence ?? 'none',
      bookmarked: false,
      completed: false,
      ...newTask,
    });
    // Saisie en rafale, comme la barre d'ajout global.
    setDraft('');
    inputRef.current?.focus();
  };

  return (
    <section
      aria-labelledby={headingId}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(TASK_DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const taskId = e.dataTransfer.getData(TASK_DRAG_TYPE);
        if (taskId) onDropTask(taskId, id);
      }}
      className={`flex flex-col min-h-[12rem] rounded-2xl border p-2.5 transition-colors ${
        dragOver
          ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]/5'
          : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))]/40'
      }`}
    >
      <header className="flex items-center gap-2 px-1.5 pb-2">
        <span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden="true" />
        <h3 id={headingId} className="text-sm font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
          {label}
        </h3>
        <span className="ml-auto text-xs tabular-nums" style={{ color: 'rgb(var(--color-text-muted))' }}>
          <span aria-hidden="true">{tasks.length}</span>
          <span className="sr-only">{tp('board.count', tasks.length)}</span>
        </span>
      </header>

      <ul className="flex flex-col gap-2 flex-1">
        {tasks.map((task) => (
          <li key={task.id}>
            <TaskBoardCard task={task} draggable={canDrag(task)} showStatus={showStatus} onOpen={onOpen} onRequestMove={onRequestMove} />
          </li>
        ))}
        {tasks.length === 0 && !adding && (
          <li className="px-2 py-6 text-center text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
            {t('board.empty')}
          </li>
        )}
      </ul>

      {!newTask ? (
        footer ? <p className="px-1.5 pt-2 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>{footer}</p> : null
      ) : adding ? (
        <input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
            if (e.key === 'Escape') { e.preventDefault(); setAdding(false); setDraft(''); }
          }}
          onBlur={() => { if (!draft.trim()) setAdding(false); }}
          placeholder={t('board.addPlaceholder')}
          aria-label={t('board.addAria', { column: label })}
          className="mt-2 w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] focus:outline-none focus:border-[rgb(var(--color-accent))]"
          style={{ color: 'rgb(var(--color-text-primary))' }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label={t('board.addAria', { column: label })}
          className="mt-2 min-h-11 w-full flex items-center gap-1.5 px-2.5 rounded-lg text-sm hover:bg-[rgb(var(--color-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60"
          style={{ color: 'rgb(var(--color-text-secondary))' }}
        >
          <Plus size={15} aria-hidden="true" /> {t('board.add')}
        </button>
      )}
    </section>
  );
};

export default TaskBoardColumn;
