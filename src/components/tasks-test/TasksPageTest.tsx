// Page To-Do — refonte « test » shadcn (desktop). Orchestrateur : réutilise les
// mêmes hooks que TasksPage (aucune logique métier nouvelle), recompose l'UI en
// composants shadcn. Branché depuis TasksPage quand theme==='test' && !isMobile.
import { useMemo, useState } from 'react';
import { Plus, CalendarDays, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  useTasks,
  useToggleTaskComplete,
  useToggleTaskBookmark,
  useDeleteTask,
  type Task,
} from '@/modules/tasks';
import { useLists, tasksDueToday } from '@/modules/lists';
import { useCategories, useCategoryLookup } from '@/modules/categories';
import { usePriorityRange } from '@/modules/ui-states';
import { filterAndSortTasks } from '@/modules/tasks/task-filtering';
import { filterTasksForPage } from '@/pages/tasks/task-page-filter';
import TaskTableTest from './TaskTableTest';
import TaskFilterTest from './TaskFilterTest';
import ListsBarTest from './ListsBarTest';
import TaskModalTest from './TaskModalTest';
import AddToListModalTest from './AddToListModalTest';
import ColorSettingsModalTest from './ColorSettingsModalTest';
import EventModalTest from './EventModalTest';
import DeadlineCalendarTest from './DeadlineCalendarTest';

const TODAY_HIDDEN_KEY = 'cosmo_lists_today_hidden';

export default function TasksPageTest() {
  const { data: tasks = [] } = useTasks();
  const { data: lists = [] } = useLists();
  const { data: categories = [] } = useCategories();
  const categoryLookup = useCategoryLookup();
  const { priorityRange, setPriorityRange } = usePriorityRange();

  const toggleComplete = useToggleTaskComplete();
  const toggleBookmark = useToggleTaskBookmark();
  const deleteTask = useDeleteTask();

  // ── État UI local (présentation uniquement) ──
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortField, setSortField] = useState('deadline');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [todayHidden, setTodayHidden] = useState(
    () => localStorage.getItem(TODAY_HIDDEN_KEY) === '1'
  );

  // ── Modals ──
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [addToListTask, setAddToListTask] = useState<Task | null>(null);
  const [scheduleTask, setScheduleTask] = useState<Task | null>(null);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Task | null>(null);

  const todayCount = useMemo(() => tasksDueToday(tasks).length, [tasks]);

  // ── Pipeline filtrage + tri (réutilise les helpers purs existants) ──
  const displayedTasks = useMemo(() => {
    const byPage = filterTasksForPage(tasks, {
      searchTerm,
      selectedCategories,
      priorityRange,
      selectedListId,
      selectingTasksForListId: null,
      lists,
    });
    return filterAndSortTasks({
      tasks: byPage,
      quickFilter: 'none',
      showCompleted,
      priorityRange,
      sortField,
      sortDirection,
    });
  }, [tasks, searchTerm, selectedCategories, priorityRange, selectedListId, lists, showCompleted, sortField, sortDirection]);

  const toggleCategory = (id: string) =>
    setSelectedCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const handleToggleToday = () => {
    setTodayHidden((prev) => {
      const next = !prev;
      localStorage.setItem(TODAY_HIDDEN_KEY, next ? '1' : '0');
      if (next && selectedListId === 'virtual-today') setSelectedListId(null);
      return next;
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      {/* En-tête */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="text-muted-foreground mb-1 inline-flex items-center gap-1.5 text-xs font-medium">
            <FlaskConical className="size-3.5" aria-hidden="true" /> Mode test
          </div>
          <h1 className="text-3xl font-bold tracking-tight">To-do list</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-pressed={showCalendar}
            onClick={() => setShowCalendar((v) => !v)}
          >
            <CalendarDays aria-hidden="true" /> Calendrier
          </Button>
          <Button type="button" size="lg" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" /> Nouvelle tâche
          </Button>
        </div>
      </div>

      {/* Barre de listes */}
      <div className="mb-4">
        <ListsBarTest
          lists={lists}
          selectedListId={selectedListId}
          onSelectList={setSelectedListId}
          todayCount={todayCount}
          todayHidden={todayHidden}
          onToggleToday={handleToggleToday}
        />
      </div>

      {/* Calendrier (toggle) */}
      {showCalendar && (
        <div className="mb-4">
          <DeadlineCalendarTest tasks={tasks} categoryLookup={categoryLookup} onEditTask={setEditTask} />
        </div>
      )}

      {/* Filtres */}
      <div className="mb-4">
        <TaskFilterTest
          searchTerm={searchTerm}
          onSearchTerm={setSearchTerm}
          sortField={sortField}
          onSortField={setSortField}
          sortDirection={sortDirection}
          onToggleSortDirection={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
          showCompleted={showCompleted}
          onShowCompleted={setShowCompleted}
          categories={categories}
          selectedCategories={selectedCategories}
          onToggleCategory={toggleCategory}
          priorityRange={priorityRange}
          onPriorityRange={setPriorityRange}
        />
      </div>

      {/* Liste */}
      <TaskTableTest
        tasks={displayedTasks}
        categoryLookup={categoryLookup}
        onEdit={setEditTask}
        onToggleComplete={(id) => toggleComplete.mutate(id)}
        onToggleBookmark={(id) => toggleBookmark.mutate(id)}
        onDelete={setDeleteConfirm}
        onAddToList={setAddToListTask}
        onSchedule={setScheduleTask}
      />

      {/* ── Modals ── */}
      <TaskModalTest
        open={createOpen}
        onOpenChange={setCreateOpen}
        onManageCategories={() => setManageCategoriesOpen(true)}
      />
      <TaskModalTest
        open={!!editTask}
        onOpenChange={(o) => !o && setEditTask(null)}
        task={editTask}
        onManageCategories={() => setManageCategoriesOpen(true)}
      />
      <AddToListModalTest
        open={!!addToListTask}
        onOpenChange={(o) => !o && setAddToListTask(null)}
        taskId={addToListTask?.id ?? null}
      />
      <EventModalTest
        open={!!scheduleTask}
        onOpenChange={(o) => !o && setScheduleTask(null)}
        task={scheduleTask}
      />
      <ColorSettingsModalTest open={manageCategoriesOpen} onOpenChange={setManageCategoriesOpen} />

      {/* Confirmation suppression (depuis la table) */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleteConfirm?.name} » sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteConfirm) {
                  deleteTask.mutate(deleteConfirm.id, { onSuccess: () => setDeleteConfirm(null) });
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
