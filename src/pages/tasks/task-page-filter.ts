// Logique de filtrage pure de TasksPage — extraite pour être testable.
// Vit dans pages/tasks/ (pas modules/tasks) pour éviter une dépendance
// circulaire tasks ↔ lists (lists importe déjà les types tasks).
// Comportement déplacé verbatim depuis TasksPage.tsx.
import { tasksInList, tasksDueToday, type TaskList } from '@/modules/lists';
import type { Task } from '@/modules/tasks';
import type { Category } from '@/modules/categories';
import { descendantIdSet } from '@/modules/categories/tree';

// Sentinel de la liste virtuelle « Aujourd'hui » (jamais en base).
export const VIRTUAL_TODAY_ID = 'virtual-today';

export interface TaskPageFilterParams {
  searchTerm: string;
  selectedCategories: string[];
  priorityRange: readonly [number, number] | number[];
  selectedListId: string | null;
  selectingTasksForListId: string | null;
  lists: TaskList[];
  // Optionnel et par défaut vide : les appelants qui ne connaissent pas
  // encore l'arbre (anciens tests, appelants qui n'ont pas encore chargé
  // les catégories) retrouvent exactement le comportement d'avant — un
  // `descendantIdSet` sur un lot vide ne rend jamais de descendant.
  categories?: readonly Category[];
}

export function filterTasksForPage(tasks: Task[], params: TaskPageFilterParams): Task[] {
  const {
    searchTerm, selectedCategories, priorityRange, selectedListId,
    selectingTasksForListId, lists, categories = [],
  } = params;
  let result = tasks;

  // Filtre par terme de recherche
  if (searchTerm) {
    const lowerSearch = searchTerm.toLowerCase();
    result = result.filter(task =>
      task.name.toLowerCase().includes(lowerSearch)
    );
  }

  // Filtre par catégories sélectionnées — remonte aussi les descendants de
  // chaque catégorie cochée : filtrer « Travail » retrouve les tâches
  // classées sous « Travail › SEO ».
  //
  // 🔴 CHANGEMENT DE SÉMANTIQUE ASSUMÉ (2026-09-09, tâche 12 sous-catégories).
  // C'est l'attente naturelle d'un arbre ; un compte dont les catégories
  // restent plates ne voit AUCUNE différence, `descendantIdSet` rendant alors
  // un ensemble vide pour chaque sélection. Règle exprimée UNE SEULE FOIS,
  // ici : `TaskFilter` (et son arbre repliable `CategoryFilterTree`) ne fait
  // que cocher des identifiants, jamais la remontée de branche elle-même —
  // voir `task-page-filter.test.ts` pour la couverture (mono et
  // multi-sélection).
  if (selectedCategories.length > 0) {
    // Le `Set` de correspondance est calculé UNE FOIS pour tout l'appel, pas
    // par tâche filtrée : hissé hors de la boucle `.filter`, comme l'exige
    // `descendantIdSet` (`src/modules/categories/tree.ts`). Sans ça, le coût
    // redevient quadratique en catégories là où il est plat aujourd'hui.
    const matchSet = new Set(selectedCategories);
    for (const id of selectedCategories) {
      for (const descendant of descendantIdSet(id, categories)) matchSet.add(descendant);
    }
    result = result.filter(task => matchSet.has(task.category));
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
