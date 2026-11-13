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
  /**
   * Le journal depuis `sinceISO` (inclus), du plus récent au plus ancien, sans
   * plafond. C'est la lecture des écrans (graphiques, statistiques), bornée par
   * une fenêtre de dates (`KR_COMPLETIONS_WINDOW_DAYS`) et non par un nombre de
   * lignes (PER-01).
   */
  getSince(sinceISO: string): Promise<KRCompletion[]>;
  /** Le journal filtré, ENTIER (sans plafond) : par exemple celui d'un OKR. */
  getFiltered(filters: KRCompletionFilters): Promise<KRCompletion[]>;
  /**
   * Le journal ENTIER de la personne connectée, pour l'export de portabilité
   * (RGPD art. 20), filtré explicitement sur `user_id`, sans plafond.
   */
  getAllForExport(): Promise<KRCompletion[]>;

  // Write operations (append-only)
  create(input: CreateKRCompletionInput): Promise<KRCompletion>;
}
