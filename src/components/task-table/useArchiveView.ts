// ═══════════════════════════════════════════════════════════════════
// Vue « Terminées » du tableau : l'archive paginée ou le jeu de travail
// (V14.1, PER-01)
//
// Extrait de `TaskTable` pour qu'il garde sa complexité : toutes les
// bascules qui dépendent de « l'archive est-elle affichée ? » se décident
// ICI, une fois, et le composant ne lit plus que le résultat.
// ═══════════════════════════════════════════════════════════════════
import type { Task } from '@/modules/tasks';
import type { TaskQuery } from '@/modules/tasks';

/** L'archive « Terminées » en pages serveur, telle que la page la fournit. */
export interface ArchiveFeed {
  tasks: Task[];
  isLoading: boolean;
  hasMore: boolean;
  isFetchingMore: boolean;
  loadMore: () => void;
  /** Requête serveur de l'archive filtrée, pour en afficher le total. */
  totalQuery?: TaskQuery;
}

export interface ArchiveView {
  /** L'archive s'affiche (vue terminées active ET archive fournie). */
  active: boolean;
  /** L'archive affichée, ou `null`. */
  feed: ArchiveFeed | null;
  /** Les tâches perso que la liste montre. */
  tasks: Task[];
  isLoading: boolean;
}

export function useArchiveView(params: {
  archive: ArchiveFeed | undefined;
  showCompleted: boolean;
  quickFilter: string;
  fallbackTasks: Task[];
  fallbackLoading: boolean;
}): ArchiveView {
  const { archive, showCompleted, quickFilter, fallbackTasks, fallbackLoading } = params;
  const wantsArchive = showCompleted || quickFilter === 'completed';
  if (archive && wantsArchive) {
    return { active: true, feed: archive, tasks: archive.tasks, isLoading: archive.isLoading };
  }
  return { active: false, feed: null, tasks: fallbackTasks, isLoading: fallbackLoading };
}

/**
 * Le marqueur de fin de liste ne se montre que sur une liste FINIE : tant que
 * l'archive a une page suivante, dire « fin de la liste · 50 » serait faux.
 */
export function endOfListVisible(rowCount: number, addToListMode: boolean, view: ArchiveView): boolean {
  if (rowCount === 0 || addToListMode) return false;
  return !view.feed?.hasMore;
}
