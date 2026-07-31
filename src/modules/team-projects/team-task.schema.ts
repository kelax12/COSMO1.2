// Schémas zod — garde UX côté client (messages FR). Pas la frontière de
// sécurité (RLS + triggers + whitelist mapToDb).
import { z } from 'zod';

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
});

export const updateTeamTaskSchema = createTeamTaskSchema.partial().extend({
  completed: z.boolean().optional(),
});
