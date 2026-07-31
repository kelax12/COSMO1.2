// Schémas zod pour les entrées Task (création / mise à jour).
// Fidèles au modèle canonique (cf. types.ts).
//
// i18n — les messages sont des CLÉS de catalogue, pas du texte. Ces schémas sont
// des constantes évaluées à l'import : y appeler `t()` figerait la langue au
// premier import du module, définitivement. La traduction a donc lieu au moment
// de la validation, dans `src/lib/validation/validate.ts`, qui est le seul
// consommateur de ces messages.
import { z } from 'zod';

export const createTaskSchema = z.object({
  name: z.string().trim().min(1, 'validation.task.nameRequired').max(500, 'validation.task.nameTooLong'),
  description: z.string().max(5000, 'validation.task.descriptionTooLong').optional(),
  // Priorité : 0 = « non définie » (UI « Choisir »), 1..5 = P1..P5.
  priority: z.coerce.number().int('validation.task.priorityInteger').min(0).max(5, 'validation.task.priorityRange'),
  category: z.string(),
  deadline: z.string(),
  estimatedTime: z.coerce.number().min(0, 'validation.task.durationNegative').max(100000, 'validation.task.durationUnrealistic'),
  bookmarked: z.boolean(),
  completed: z.boolean(),
  completedAt: z.string().optional(),
  // Sous-tâches (#12) : garde UX — 50 items max, nom 200 caractères max.
  subtasks: z.array(z.object({
    id: z.string(),
    name: z.string().trim().min(1).max(200, 'validation.task.subtaskTooLong'),
    completed: z.boolean(),
  })).max(50, 'validation.task.tooManySubtasks').optional(),
  // Lien vers un Key Result OKR (#28) — '' signifie « aucun lien ».
  krId: z.string().max(100).optional(),
  // Récurrence (#26) — l'occurrence suivante est générée à la complétion.
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']).optional(),
  isCollaborative: z.boolean().optional(),
  pendingInvites: z.array(z.string()).optional(),
  collaboratorValidations: z.record(z.boolean()).optional(),
  sharedBy: z.string().optional(),
  userId: z.string().optional(),
});

// Mise à jour : tous les champs facultatifs (partial).
export const updateTaskSchema = createTaskSchema.partial();

export type CreateTaskSchemaOutput = z.infer<typeof createTaskSchema>;
