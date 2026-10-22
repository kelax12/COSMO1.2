// ═══════════════════════════════════════════════════════════════════
// Droits sur UNE tâche d'équipe — miroir des policies (mig. 115, 152)
//
// Audit du 2026-09-24 : les menus « … » proposaient des actions que le serveur
// refusait ensuite (tableau des tâches). Chaque écran recalculait — ou ne
// calculait pas — son droit ; la règle vit désormais ici, une fois.
//
//   • modifier : `task.editAny`, OU créateur, OU assigné ;
//   • supprimer (corbeille) : `task.deleteAny`, OU créateur.
//
// Ce n'est qu'un affichage : les policies `team_tasks_update` / la RPC
// `trash_team_task` restent seules juges.
// ═══════════════════════════════════════════════════════════════════

import type { EffectiveOrgPermissions } from '@/modules/organizations';
import type { TeamTask } from '@/modules/team-projects';

type TaskLike = Pick<TeamTask, 'createdBy' | 'assigneeIds'>;

export const canEditTeamTask = (
  can: Pick<EffectiveOrgPermissions, 'task.editAny'>,
  userId: string | undefined,
  task: TaskLike,
): boolean =>
  can['task.editAny'] || (!!userId && (task.createdBy === userId || task.assigneeIds.includes(userId)));

export const canDeleteTeamTask = (
  can: Pick<EffectiveOrgPermissions, 'task.deleteAny'>,
  userId: string | undefined,
  task: TaskLike,
): boolean => can['task.deleteAny'] || (!!userId && task.createdBy === userId);
