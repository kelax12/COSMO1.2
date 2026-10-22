// Couleur de pastille par statut perso. Mêmes teintes que les statuts
// d'équipe (`organization/team-projects.helpers` · STATUS_META), sans
// `review`, absent du perso (mig. 214).
import type { TaskStatus } from '@/modules/tasks';

export const STATUS_DOT: Record<TaskStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  blocked: 'bg-red-500',
  done: 'bg-emerald-500',
};
