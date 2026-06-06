// Schémas zod pour les entrées OKR (création / mise à jour).
// Fidèles au modèle (cf. types.ts) — messages en français. La cible 0 reste
// tolérée (le calcul `recalcProgress` la neutralise déjà — faille B17) pour
// ne pas durcir un flux existant ; on rejette juste le franchement invalide.
import { z } from 'zod';

export const keyResultSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, 'Le titre du résultat clé est requis').max(500, 'Titre trop long'),
  currentValue: z.coerce.number().min(0, 'La valeur actuelle ne peut pas être négative'),
  targetValue: z.coerce.number().min(0, 'La cible ne peut pas être négative'),
  unit: z.string(),
  completed: z.boolean(),
  estimatedTime: z.coerce.number().min(0, 'La durée ne peut pas être négative'),
  completedAt: z.string().nullable().optional(),
});

export const createOKRSchema = z.object({
  title: z.string().trim().min(1, 'Le titre de l’objectif est requis').max(500, 'Titre trop long'),
  description: z.string().max(5000, 'Description trop longue'),
  category: z.string(),
  progress: z.coerce.number().min(0).max(100, 'La progression doit être entre 0 et 100'),
  completed: z.boolean(),
  keyResults: z.array(keyResultSchema),
  startDate: z.string(),
  endDate: z.string(),
});

export const updateOKRSchema = createOKRSchema.partial();
