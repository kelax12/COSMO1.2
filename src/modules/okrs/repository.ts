// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Interface du repository (contrat des deux implémentations)
// ═══════════════════════════════════════════════════════════════════
//
// Forme unique (V12.3, src/modules/CLAUDE.md § Forme d'un module) : ce fichier ne
// porte que l'interface et ses types. Démo : `local.repository.ts`, seed :
// `local.seed.ts`, production : `supabase.repository.ts`.

import type { OKR, CreateOKRInput, UpdateOKRInput, UpdateKeyResultInput, OKRFilters } from './types';
import type { PaginationParams, PaginatedResult } from '@/lib/pagination.types';
import type { KRCompletion } from '@/modules/kr-completions/types';
import type { CreateOptions } from '@/lib/restore-id';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface IOKRsRepository {
  // Read operations
  getAll(): Promise<OKR[]>;
  getById(id: string): Promise<OKR | null>;
  getByCategory(category: string): Promise<OKR[]>;
  getFiltered(filters: OKRFilters): Promise<OKR[]>;
  getPage(params?: PaginationParams): Promise<PaginatedResult<OKR>>;

  // Write operations
  create(input: CreateOKRInput, options?: CreateOptions): Promise<OKR>;
  update(id: string, updates: UpdateOKRInput): Promise<OKR>;
  delete(id: string): Promise<void>;


  /**
   * Rejoue le journal d'un OKR qu'on vient de restaurer (C-01).
   *
   * 🔴 POURQUOI C'EST UNE METHODE DE REPOSITORY, ET PAS UN APPEL CLIENT.
   *
   * La premiere version de C-01 appelait
   * `getKRCompletionsRepository().create()` depuis le hook. C'est exactement
   * ce que l'arbitrage du 2026-09-03 fait SUPPRIMER avec
   * `useCreateKRCompletion` : « un INSERT client libre dans un journal
   * append-only que ce fichier interdit par ailleurs ». Le contourner en
   * appelant le repository plutot que le hook aurait garde le defaut en
   * changeant son nom.
   *
   * L'ecriture du journal appartient donc au repository OKR, comme
   * `appendKRReps` / `recordKRReps` — le meme chemin que celui que l'item
   * C-01 designe explicitement.
   *
   * ⚠️ Borne `MAX_REPS_PER_WRITE` (faille B18) : le tableau vient d'une
   *    lecture, mais il traverse l'etat d'un composant, donc un objet que des
   *    devtools peuvent enrichir.
   */
  restoreCompletions(completions: KRCompletion[]): Promise<void>;

  // KeyResult operations
  updateKeyResult(okrId: string, keyResultId: string, updates: UpdateKeyResultInput): Promise<OKR>;
}
