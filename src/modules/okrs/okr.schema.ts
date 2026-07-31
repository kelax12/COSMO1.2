// Schémas zod pour les entrées OKR (création / mise à jour).
// Fidèles au modèle (cf. types.ts) — messages en français. La cible 0 reste
// tolérée (le calcul `recalcProgress` la neutralise déjà — faille B17) pour
// ne pas durcir un flux existant ; on rejette juste le franchement invalide.
import { z } from 'zod';

export const keyResultSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, 'validation.okr.krTitleRequired').max(500, 'validation.okr.titleTooLong'),
  currentValue: z.coerce.number().min(0, 'validation.okr.currentValueNegative'),
  targetValue: z.coerce.number().min(0, 'validation.okr.targetNegative'),
  unit: z.string(),
  completed: z.boolean(),
  estimatedTime: z.coerce.number().min(0, 'validation.okr.durationNegative'),
  completedAt: z.string().nullable().optional(),
  // Coefficient d'importance 1–10 (défaut 1). Optionnel : les KR antérieurs
  // sans poids restent valides et sont traités comme 1 par recalcProgress.
  weight: z.coerce.number().int().min(1, 'validation.okr.weightMin').max(10, 'validation.okr.weightMax').optional(),
});

export const createOKRSchema = z.object({
  title: z.string().trim().min(1, 'validation.okr.objectiveTitleRequired').max(500, 'validation.okr.titleTooLong'),
  description: z.string().max(5000, 'validation.okr.descriptionTooLong'),
  category: z.string(),
  progress: z.coerce.number().min(0).max(100, 'validation.okr.progressRange'),
  completed: z.boolean(),
  keyResults: z.array(keyResultSchema),
  startDate: z.string(),
  endDate: z.string(),
});

export const updateOKRSchema = createOKRSchema.partial();
