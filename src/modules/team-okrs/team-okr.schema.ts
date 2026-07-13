// Schémas zod — garde UX (messages FR). Frontière de sécurité = RLS + triggers.
import { z } from 'zod';

export const createTeamKRSchema = z.object({
  title: z.string().trim().min(1, 'Le titre du KR est requis').max(300, 'Titre trop long'),
  // Garde B17 : la cible doit être strictement positive (division par la cible).
  targetValue: z.coerce.number().gt(0, 'La cible doit être supérieure à 0'),
  currentValue: z.coerce.number().min(0).optional(),
  unit: z.string().max(30).optional(),
  assigneeId: z.string().nullable().optional(),
  weight: z.coerce.number().int().min(1, 'Le coefficient doit être au moins 1').max(10, 'Le coefficient ne peut pas dépasser 10').optional(),
  estimatedTime: z.coerce.number().min(0).max(100000).optional(),
});

export const createTeamOKRSchema = z.object({
  title: z.string().trim().min(1, "Le titre de l'objectif est requis").max(200, 'Titre trop long'),
  description: z.string().max(2000).optional(),
  category: z.string().max(60).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  // Rattachement d'équipes (cloisonnement) — 20 max par garde-fou.
  teamIds: z.array(z.string()).max(20).optional(),
  keyResults: z.array(createTeamKRSchema).min(1, 'Ajoutez au moins un résultat clé').max(10, '10 KR max'),
});

export const updateTeamOKRSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(60).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  teamIds: z.array(z.string()).max(20).optional(),
});

export const updateTeamKRSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  currentValue: z.coerce.number().optional(),
  targetValue: z.coerce.number().gt(0, 'La cible doit être supérieure à 0').optional(),
  unit: z.string().max(30).optional(),
  assigneeId: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  weight: z.coerce.number().int().min(1).max(10).optional(),
  estimatedTime: z.coerce.number().min(0).max(100000).optional(),
});
