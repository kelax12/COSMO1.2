// ═══════════════════════════════════════════════════════════════════
// TEAM-CATEGORIES MODULE - Interface du repository (contrat des deux implémentations)
// ═══════════════════════════════════════════════════════════════════
//
// Forme unique (V12.3, src/modules/CLAUDE.md § Forme d'un module) : ce fichier ne
// porte que l'interface et ses types. Démo : `local.repository.ts`, seed :
// `local.seed.ts`, production : `supabase.repository.ts`.

import type { TeamCategory, CreateTeamCategoryInput, UpdateTeamCategoryInput } from './types';

export interface ITeamCategoriesRepository {
  getCategories(orgId: string): Promise<TeamCategory[]>;
  createCategory(orgId: string, input: CreateTeamCategoryInput): Promise<TeamCategory>;
  updateCategory(categoryId: string, input: UpdateTeamCategoryInput): Promise<TeamCategory>;
  deleteCategory(categoryId: string): Promise<void>;
}
