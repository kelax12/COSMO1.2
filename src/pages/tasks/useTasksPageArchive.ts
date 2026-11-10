// ═══════════════════════════════════════════════════════════════════
// Archive « Terminées » de la page Tâches (V14.1, PER-01)
//
// Le jeu de travail (`useTasks`) ne garde que 35 jours de terminées. La vue
// terminées lit donc l'archive en pages serveur, filtrée en SQL par les MÊMES
// filtres que la page (`archiveQueryForPage`). Le nombre de terminées masquées
// vient d'un COMPTE serveur, jamais d'une longueur de tableau partiel ; ce
// compte vit dans les composants qui l'affichent (`SeeCompletedButton`,
// `ArchiveLoadMore`) : sa réponse ne redessine qu'eux.
//
// Sorti de `TasksPage` pour que la page reste sous ses plafonds de
// complexité et de longueur.
// ═══════════════════════════════════════════════════════════════════
import { useCallback, useMemo } from 'react';
import { useTaskArchive, type TaskQuery } from '@/modules/tasks';
import { useQuickFilter } from '@/components/task-table/quick-filter.store';
import type { ArchiveFeed } from '@/components/task-table/useArchiveView';
import { archiveQueryForPage, type TaskPageFilterParams } from './task-page-filter';

const NOTHING: TaskQuery = { ids: [] };

/** Ce que la page passe à `TaskTable`, tel quel (`{...archiveProps}`). */
export interface TasksPageArchiveProps {
  archive: ArchiveFeed;
  /** Requête serveur des terminées visées ; `null` : aucune ne peut répondre. */
  completedQuery: TaskQuery | null;
  /** Liste, catégorie(s) OU recherche active : gate « Voir les terminées ». */
  hasActiveFilter: boolean;
}

export function useTasksPageArchive(params: TaskPageFilterParams & { showCompleted: boolean }): TasksPageArchiveProps {
  const { searchTerm, selectedCategories, priorityRange, selectedListId, selectingTasksForListId, lists, categories, showCompleted } = params;
  const hasActiveFilter = !!selectedListId || selectedCategories.length > 0 || searchTerm.trim() !== '';
  const { activeQuickFilter } = useQuickFilter();
  const wanted = showCompleted || activeQuickFilter === 'completed';

  const archiveQuery = useMemo(
    () => archiveQueryForPage({ searchTerm, selectedCategories, priorityRange, selectedListId, selectingTasksForListId, lists, categories }),
    [searchTerm, selectedCategories, priorityRange, selectedListId, selectingTasksForListId, lists, categories],
  );
  const pages = useTaskArchive(archiveQuery ?? NOTHING, { enabled: wanted && archiveQuery !== null });
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = pages;

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const archiveFeed = useMemo<ArchiveFeed>(() => {
    if (archiveQuery === null) {
      return { tasks: [], isLoading: false, hasMore: false, isFetchingMore: false, loadMore };
    }
    return {
      tasks: data?.pages.flatMap((page) => page.data) ?? [],
      isLoading,
      hasMore: !!hasNextPage,
      isFetchingMore: isFetchingNextPage,
      loadMore,
      totalQuery: archiveQuery,
    };
  }, [archiveQuery, data, isLoading, hasNextPage, isFetchingNextPage, loadMore]);

  return useMemo(
    () => ({ archive: archiveFeed, completedQuery: archiveQuery, hasActiveFilter }),
    [archiveFeed, archiveQuery, hasActiveFilter],
  );
}
