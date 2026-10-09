// Une colonne du Tableau perso : en-tête, zone de dépôt, cartes, saisie rapide.
//
// La saisie rapide parle la même syntaxe que la barre d'ajout global
// (`parseQuickAdd` : « Dentiste jeudi #santé !! ~30m ») et fait naître la tâche
// DANS le statut de la colonne. « Terminée » n'a pas de saisie : une tâche née
// terminée n'a rien à faire sur un Tableau.
import { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useCreateTask, type Task, type TaskStatus } from '@/modules/tasks';
import { useCategories } from '@/modules/categories';
import { parseQuickAdd } from '@/lib/quick-add-parser';
import { deadlineFromDayKey } from '@/lib/deadline';
import { useT } from '@/i18n/useT';
import TaskBoardCard, { TASK_DRAG_TYPE } from './TaskBoardCard';
import { STATUS_DOT } from './status-style';

interface TaskBoardColumnProps {
  status: TaskStatus;
  tasks: Task[];
  canDrag: (task: Task) => boolean;
  onOpen: (task: Task) => void;
  onRequestMove: (task: Task) => void;
  onDropTask: (taskId: string, to: TaskStatus) => void;
}

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const TaskBoardColumn = ({ status, tasks, canDrag, onOpen, onRequestMove, onDropTask }: TaskBoardColumnProps) => {
  const { t, tp } = useT('tasks');
  const { data: categories = [] } = useCategories();
  const { mutate: createTask } = useCreateTask();
  const [dragOver, setDragOver] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const label = t(`board.columns.${status}`);
  const headingId = `board-col-${status}`;

  const categoryIdFor = useMemo(() => (token?: string): string => {
    if (!token) return '';
    const wanted = normalize(token);
    const match = categories.find((c) => normalize(c.name) === wanted || normalize(c.name).startsWith(wanted));
    return match?.id ?? '';
  }, [categories]);

  const submit = () => {
    const parsed = parseQuickAdd(draft);
    if (!parsed.name.trim()) return;
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
      status,
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
        const id = e.dataTransfer.getData(TASK_DRAG_TYPE);
        if (id) onDropTask(id, status);
      }}
      className={`flex flex-col min-h-[12rem] rounded-2xl border p-2.5 transition-colors ${
        dragOver
          ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]/5'
          : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))]/40'
      }`}
    >
      <header className="flex items-center gap-2 px-1.5 pb-2">
        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
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
            <TaskBoardCard task={task} draggable={canDrag(task)} onOpen={onOpen} onRequestMove={onRequestMove} />
          </li>
        ))}
        {tasks.length === 0 && !adding && (
          <li className="px-2 py-6 text-center text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
            {t('board.empty')}
          </li>
        )}
      </ul>

      {status === 'done' ? (
        <p className="px-1.5 pt-2 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>{t('board.doneWindow')}</p>
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
