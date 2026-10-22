import type { Task } from '@/modules/tasks';

// Extrait de CollaborativeTasks.tsx (fonction pure, sinon fast-refresh casse
// dès qu'un fichier exporte à la fois un composant et une fonction).
//
// Exclut les tâches assignées par d'autres et pas encore acceptées (toujours
// en attente dans SocialRequests) : une tâche collaborative n'est comptée que
// si elle est la mienne, ou partagée par moi.
export function selectCollaborativeTasks(tasks: Task[], userName: string | undefined): Task[] {
  return tasks.filter(task => task.isCollaborative && (!task.sharedBy || task.sharedBy === userName));
}
