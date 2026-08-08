// Schémas zod — garde UX côté client (messages FR). Pas la frontière de
// sécurité (RLS + triggers + whitelist mapToDb).
import { z } from 'zod';
import type { TeamTaskStatus } from './types';

// `z.enum` veut un tableau littéral ; ce Record garantit à la COMPILATION que
// la liste couvre exactement les valeurs de `TeamTaskStatus` (types.ts) — ni
// oubli ni surplus. C'est cette dérive-là, invisible en TypeScript normal
// (`status?: TeamTaskStatus` existait bien sur `UpdateTeamTaskInput`), qui
// laissait `status` être silencieusement stripé par zod avant d'atteindre le
// repository : le kanban en mode Statut changeait de colonne au drop, puis
// revenait à sa place après le refetch, la mutation n'ayant écrit qu'un objet
// vidé de son seul champ utile.
const TEAM_TASK_STATUS_EXHAUSTIVE: Record<TeamTaskStatus, true> = {
  todo: true,
  in_progress: true,
  review: true,
  blocked: true,
  done: true,
};
const TEAM_TASK_STATUSES = Object.keys(TEAM_TASK_STATUS_EXHAUSTIVE) as [TeamTaskStatus, ...TeamTaskStatus[]];

export const createTeamProjectSchema = z.object({
  name: z.string().trim().min(1, 'validation.teamProject.nameRequired').max(120, 'validation.teamProject.nameTooLong'),
  color: z.string().optional(),
  // Sans ce champ, zod STRIPPAIT teamId → projet toujours créé sans équipe (bug #9).
  teamId: z.string().nullable().optional(),
});

export const updateTeamProjectSchema = z.object({
  name: z.string().trim().min(1, 'validation.teamProject.nameRequired').max(120, 'validation.teamProject.nameTooLong').optional(),
  color: z.string().max(30).optional(),
  teamId: z.string().nullable().optional(),
  archived: z.boolean().optional(),
});

export const createTeamTaskSchema = z.object({
  projectId: z.string().min(1, 'validation.teamProject.projectRequired'),
  name: z.string().trim().min(1, 'validation.teamProject.taskNameRequired').max(500, 'validation.teamProject.taskNameTooLong'),
  description: z.string().max(5000, 'validation.teamProject.descriptionTooLong').optional(),
  priority: z.coerce.number().int().min(1).max(5, 'validation.teamProject.priorityRange').optional(),
  deadline: z.string().optional(),
  estimatedTime: z.coerce.number().min(0, 'validation.teamProject.durationNegative').max(100000).optional(),
  assigneeIds: z.array(z.string()).max(20, 'validation.teamProject.tooManyAssignees').optional(),
  status: z.enum(TEAM_TASK_STATUSES).optional(),
});

export const updateTeamTaskSchema = createTeamTaskSchema.partial().extend({
  completed: z.boolean().optional(),
});
