// Schémas zod pour les entrées Task (création / mise à jour).
// Fidèles au modèle canonique (cf. types.ts) — messages en français.
import { z } from 'zod';

export const createTaskSchema = z.object({
  name: z.string().trim().min(1, 'Le nom de la tâche est requis').max(500, 'Nom trop long (500 caractères max)'),
  description: z.string().max(5000, 'Description trop longue').optional(),
  // Priorité : 0 = « non définie » (UI « Choisir »), 1..5 = P1..P5.
  priority: z.coerce.number().int('La priorité doit être un entier').min(0).max(5, 'Priorité invalide (0 à 5)'),
  category: z.string(),
  deadline: z.string(),
  estimatedTime: z.coerce.number().min(0, 'La durée ne peut pas être négative').max(100000, 'Durée irréaliste'),
  bookmarked: z.boolean(),
  completed: z.boolean(),
  completedAt: z.string().optional(),
  // Sous-tâches (#12) : garde UX — 50 items max, nom 200 caractères max.
  subtasks: z.array(z.object({
    id: z.string(),
    name: z.string().trim().min(1).max(200, 'Sous-tâche trop longue'),
    completed: z.boolean(),
  })).max(50, 'Trop de sous-tâches (50 max)').optional(),
  // Lien vers un Key Result OKR (#28) — '' signifie « aucun lien ».
  krId: z.string().max(100).optional(),
  isCollaborative: z.boolean().optional(),
  pendingInvites: z.array(z.string()).optional(),
  collaboratorValidations: z.record(z.boolean()).optional(),
  sharedBy: z.string().optional(),
  userId: z.string().optional(),
});

// Mise à jour : tous les champs facultatifs (partial).
export const updateTaskSchema = createTaskSchema.partial();

export type CreateTaskSchemaOutput = z.infer<typeof createTaskSchema>;
