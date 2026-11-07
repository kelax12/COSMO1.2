// ═══════════════════════════════════════════════════════════════════
// KR-COMPLETIONS MODULE - Interface du repository (contrat des deux implémentations)
// ═══════════════════════════════════════════════════════════════════
//
// Forme unique (V12.3, src/modules/CLAUDE.md § Forme d'un module) : ce fichier ne
// porte que l'interface et ses types. Démo : `local.repository.ts`, seed :
// `local.seed.ts`, production : `supabase.repository.ts`.

import type { KRCompletion, CreateKRCompletionInput, KRCompletionFilters } from './types';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface IKRCompletionsRepository {
  // Read operations
  getAll(): Promise<KRCompletion[]>;
  getFiltered(filters: KRCompletionFilters): Promise<KRCompletion[]>;
  /**
   * Le journal ENTIER de la personne connectée, pour l'export de portabilité
   * (RGPD art. 20). `getAll()` est borné à 500 lignes pour le tableau de bord :
   * un export tronqué serait un défaut de conformité.
   */
  getAllForExport(): Promise<KRCompletion[]>;

  // Write operations (append-only)
  create(input: CreateKRCompletionInput): Promise<KRCompletion>;
}
