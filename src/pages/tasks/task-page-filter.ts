// Logique de filtrage pure de TasksPage — extraite pour être testable.
// Vit dans pages/tasks/ (pas modules/tasks) pour éviter une dépendance
// circulaire tasks ↔ lists (lists importe déjà les types tasks).
// Comportement déplacé verbatim depuis TasksPage.tsx.
import { tasksInList, tasksDueToday, type TaskList } from '@/modules/lists';
import type { Task } from '@/modules/tasks';

// Sentinel de la liste virtuelle « Aujourd'hui » (jamais en base).
export const VIRTUAL_TODAY_ID = 'virtual-today';

export interface TaskPageFilterParams {
  searchTerm: string;
  selectedCategories: string[];
  priorityRange: readonly [number, number] | number[];
  selectedListId: string | null;
  selectingTasksForListId: string | null;
  lists: TaskList[];
}

export function filterTasksForPage(tasks: Task[], params: TaskPageFilterParams): Task[] {
  const { searchTerm, selectedCategories, priorityRange, selectedListId, selectingTasksForListId, lists } = params;
  let result = tasks;

  // Filtre par terme de recherche
  if (searchTerm) {
    const lowerSearch = searchTerm.toLowerCase();
    result = result.filter(task =>
      task.name.toLowerCase().includes(lowerSearch)
    );
  }

  // Filtre par catégories sélectionnées
  if (selectedCategories.length > 0) {
    result = result.filter(task =>
      selectedCategories.includes(task.category)
    );
  }

  // Filtre par plage de priorité — une tâche sans priorité (0, facultative)
  // reste toujours visible.
  result = result.filter(task =>
    task.priority === 0 || (task.priority >= priorityRange[0] && task.priority <= priorityRange[1])
  );

  // Filtre par liste sélectionnée — désactivé en mode "ajouter à une liste"
  // pour permettre de sélectionner n'importe quelle tâche.
  if (selectedListId && !selectingTasksForListId) {
    if (selectedListId === VIRTUAL_TODAY_ID) {
      // Liste virtuelle "Aujourd'hui" — toutes les tâches dont
      // deadline tombe aujourd'hui et qui ne sont pas complétées.
      const todayIds = new Set(tasksDueToday(tasks).map(t => t.id));
      result = result.filter(t => todayIds.has(t.id));
    } else {
      const selectedList = lists.find(list => list.id === selectedListId);
      if (selectedList) {
        // tasksInList gère manual ET smart (filtrage dynamique par règle)
        const allowed = new Set(tasksInList(selectedList, tasks).map(t => t.id));
        result = result.filter(task => allowed.has(task.id));
      }
    }
  }

  return result;
}
