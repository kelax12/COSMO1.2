import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Bookmark, Pencil, Trash2 } from 'lucide-react';
import { useLists, tasksInList } from '@/modules/lists';
import { useTasks, useToggleTaskComplete, useToggleTaskBookmark, useDeleteTask, useRestoreTask, type Task } from '@/modules/tasks';
import { showUndoToast } from '@/lib/undo-toast';
import { useT } from '@/i18n/useT';
import { DashboardCardSkeleton } from '@/components/skeletons';
import OkrPickerMenu from '@/components/OkrPickerMenu';
import TaskRow from '@/components/TaskRow';
import TaskModal from '@/components/TaskModal';

interface TaskListWidgetProps {
  /** Liste choisie pour cet exemplaire ; absente ou supprimée = `fallbackIndex`. */
  listId: string | undefined;
  fallbackIndex: number;
  onSelect: (listId: string) => void;
  compact?: boolean;
}

/**
 * Liste de tâches (widget du tableau de bord perso, 2026-10-21) : UNE liste
 * choisie par le même menu que le widget OKR (couleur, mini-barre = part
 * des tâches faites), ses tâches ouvertes en rangées `TaskRow`.
 * Posable plusieurs fois, une liste par exemplaire.
 */
const TaskListWidget = ({ listId, fallbackIndex, onSelect, compact = false }: TaskListWidgetProps) => {
  const { t, tp } = useT('dashboard');
  const { t: tt } = useT('tasks');
  const navigate = useNavigate();
  const { data: lists = [], isLoading: loadingLists } = useLists();
  const { data: tasks = [] } = useTasks();
  const toggleComplete = useToggleTaskComplete();
  const toggleBookmark = useToggleTaskBookmark();
  const deleteTask = useDeleteTask();
  const restoreTask = useRestoreTask();
  const [editing, setEditing] = useState<Task | null>(null);

  if (loadingLists && lists.length === 0) return <DashboardCardSkeleton />;

  const list = lists.find((l) => l.id === listId) ?? lists[fallbackIndex % Math.max(lists.length, 1)];

  if (!list) {
    return (
      <div className="card-plain-mobile p-gutter md:p-6 rounded-2xl">
        <h2 className="text-headline sm:text-lg font-bold text-[rgb(var(--color-text-primary))]">{t('widgets.names.taskList')}</h2>
        <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">{t('dw.list.noLists')}</p>
        <button type="button" onClick={() => navigate('/tasks')} className="mt-2 text-sm text-[rgb(var(--color-accent))] hover:underline">
          {t('dw.list.create')}
        </button>
      </div>
    );
  }

  const doneShare = (all: Task[]) => (all.length ? Math.round((all.filter((x) => x.completed).length / all.length) * 100) : 0);
  const inList = tasksInList(list, tasks);
  const open = inList.filter((x) => !x.completed);

  const remove = (task: Task) => {
    deleteTask.mutate(task.id, {
      onSuccess: () => showUndoToast(tt('toast.deleted'), () => restoreTask.mutate(task)),
    });
  };

  return (
    <div className="card-plain-mobile p-gutter md:p-6 rounded-2xl">
      <div className="mb-3">
        <div className="flex min-w-0">
          <OkrPickerMenu
            options={lists.map((l) => ({ id: l.id, title: l.name, color: l.color, progress: doneShare(tasksInList(l, tasks)) }))}
            value={list.id}
            onChange={onSelect}
            label={list.name}
            ariaLabel={t('dw.list.choose')}
          />
        </div>
        <p className="text-label sm:text-sm text-[rgb(var(--color-text-secondary))]">{tp('dw.list.open', open.length)}</p>
      </div>

      {open.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('dw.list.empty')}</p>
      ) : (
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {open.map((task) => (
            <TaskRow
              key={task.id}
              name={task.name}
              completeLabel={t('todayTasks.markDone', { name: task.name })}
              onComplete={() => toggleComplete.mutate(task.id)}
              onOpen={() => setEditing(task)}
              compact={compact}
              actions={[
                { key: 'edit', label: tt('rowMenu.edit'), icon: Pencil, run: () => setEditing(task) },
                { key: 'bookmark', label: t('todayTasks.bookmark'), icon: Bookmark, active: !!task.bookmarked, run: () => toggleBookmark.mutate(task.id) },
                { key: 'delete', label: tt('rowMenu.delete'), icon: Trash2, danger: true, run: () => remove(task) },
              ]}
            />
          ))}
        </ul>
      )}

      {editing && <TaskModal task={editing} isOpen onClose={() => setEditing(null)} />}
    </div>
  );
};

export default TaskListWidget;
