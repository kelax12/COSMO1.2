// Schémas zod — garde UX côté client (messages FR). Pas la frontière de
// sécurité (RLS + triggers + whitelist mapToDb).
import { z } from 'zod';

export const createTeamProjectSchema = z.object({
  name: z.string().trim().min(1, 'Le nom du projet est requis').max(120, 'Nom trop long (120 max)'),
  color: z.string().optional(),
});

export const updateTeamProjectSchema = z.object({
  name: z.string().trim().min(1, 'Le nom du projet est requis').max(120, 'Nom trop long (120 max)').optional(),
  color: z.string().max(30).optional(),
  teamId: z.string().nullable().optional(),
  archived: z.boolean().optional(),
});

export const createTeamTaskSchema = z.object({
  projectId: z.string().min(1, 'Projet requis'),
  name: z.string().trim().min(1, 'Le nom de la tâche est requis').max(500, 'Nom trop long (500 max)'),
  description: z.string().max(5000, 'Description trop longue').optional(),
  priority: z.coerce.number().int().min(1).max(5, 'Priorité invalide (1 à 5)').optional(),
  deadline: z.string().optional(),
  estimatedTime: z.coerce.number().min(0, 'Durée négative').max(100000).optional(),
  assigneeIds: z.array(z.string()).max(20, '20 assignés maximum').optional(),
});

export const updateTeamTaskSchema = createTeamTaskSchema.partial().extend({
  completed: z.boolean().optional(),
});
