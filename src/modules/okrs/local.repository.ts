// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Implémentation de démo (localStorage)
// ═══════════════════════════════════════════════════════════════════

import { OKR, CreateOKRInput, UpdateOKRInput, UpdateKeyResultInput, OKRFilters } from './types';
import { recalcProgress } from './progress';
import { OKRS_STORAGE_KEY } from './constants';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';
import { KR_COMPLETIONS_STORAGE_KEY, MAX_REPS_PER_WRITE } from '@/modules/kr-completions/constants';
import { KRCompletion } from '@/modules/kr-completions/types';
import type { CreateOptions } from '@/lib/restore-id';
import { safeGetItem, safeParseArray, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import type { IOKRsRepository } from './repository';
import { createDemoOkrs, localizeOkrs } from './local.seed';

// ═══════════════════════════════════════════════════════════════════
// LOCAL STORAGE REPOSITORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

// Mapping des anciens IDs de catégorie OKR vers les IDs du système partagé
const CATEGORY_MIGRATIONS: Record<string, string> = {
  'personal': 'cat-2',
  'learning': 'cat-4',
  'health':   'cat-3',
  'okrcat-1': 'cat-1',
  'okrcat-2': 'cat-3',
  'okrcat-3': 'cat-4',
  'okrcat-4': 'cat-5',
};

export class LocalStorageOKRsRepository implements IOKRsRepository {
  /**
   * Get all OKRs from localStorage (or initialize with demo data).
   * Migrates legacy category IDs to the shared category system on first load.
   */
  private getOKRs(): OKR[] {
    const stored = safeParseArray<OKR>(safeGetItem(OKRS_STORAGE_KEY));
    // Corrompu ou stockage indisponible : on re-seme plutot que de faire
    // tomber la page (regle B14, helper `safeParseArray`).
    if (!stored) {
      const demo = localizeOkrs(createDemoOkrs());
      this.saveOKRs(demo);
      return demo;
    }
    const okrs: OKR[] = stored;
    const migrated = okrs.map(okr => ({
      ...okr,
      category: CATEGORY_MIGRATIONS[okr.category] ?? okr.category,
    }));
    if (migrated.some((o, i) => o.category !== okrs[i].category)) {
      this.saveOKRs(migrated);
    }
    return migrated;
  }

  /**
   * Save OKRs to localStorage
   */
  private saveOKRs(okrs: OKR[]): void {
    writeJsonOrThrow(OKRS_STORAGE_KEY, okrs);
  }

  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<OKR[]> {
    return this.getOKRs();
  }

  async getById(id: string): Promise<OKR | null> {
    const okrs = this.getOKRs();
    return okrs.find(o => o.id === id) || null;
  }

  async getByCategory(category: string): Promise<OKR[]> {
    const okrs = this.getOKRs();
    return okrs.filter(o => o.category === category);
  }

  async getFiltered(filters: OKRFilters): Promise<OKR[]> {
    let okrs = this.getOKRs();

    if (filters.category) {
      okrs = okrs.filter(o => o.category === filters.category);
    }

    if (filters.completed !== undefined) {
      okrs = okrs.filter(o => o.completed === filters.completed);
    }

    if (filters.startAfter) {
      okrs = okrs.filter(o => o.startDate >= filters.startAfter!);
    }

    if (filters.endBefore) {
      okrs = okrs.filter(o => o.endDate <= filters.endBefore!);
    }

    return okrs;
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateOKRInput, options?: CreateOptions): Promise<OKR> {
    const okrs = this.getOKRs();
    const newOKR: OKR = {
      ...input,
      // Parite avec le repository Supabase : `restoreId` vient d'un
      // « Annuler », jamais d'un formulaire (R-08).
      id: options?.restoreId ?? crypto.randomUUID(),
    };
    this.saveOKRs([...okrs, newOKR]);

    // Journal append-only : on N'enregistre PAS la valeur initiale d'un KR à
    // la création. `currentValue` de départ = état de base (progression
    // antérieure au suivi dans l'app), pas des reps « réalisées aujourd'hui » —
    // sinon créer un KR à 32/100 gonfle le graphe dashboard de 32 ce jour-là.
    // Seuls les incréments ultérieurs (update/updateKeyResult) sont journalisés.

    return newOKR;
  }

  async update(id: string, updates: UpdateOKRInput): Promise<OKR> {
    const okrs = this.getOKRs();
    const index = okrs.findIndex(o => o.id === id);

    if (index === -1) {
      throw makeApiError('not_found');
    }

    // Snapshot AVANT update : pour calculer le delta de currentValue par KR
    const previous = okrs[index];
    const previousKRsById = new Map(previous.keyResults.map(kr => [kr.id, kr]));

    // Whitelist updatable fields rather than spreading raw `updates` — keeps
    // the localStorage path aligned with the Supabase repo's `mapToDb` and
    // prevents accidental id/userId mutation via stray fields. Faille B19.
    const allowed: Partial<OKR> = {};
    if (updates.title !== undefined) allowed.title = updates.title;
    if (updates.description !== undefined) allowed.description = updates.description;
    if (updates.category !== undefined) allowed.category = updates.category;
    if (updates.endDate !== undefined) allowed.endDate = updates.endDate;
    if (updates.keyResults !== undefined) allowed.keyResults = updates.keyResults;
    if (updates.completed !== undefined) allowed.completed = updates.completed;
    if (updates.progress !== undefined) allowed.progress = updates.progress;
    const updatedOKR: OKR = { ...previous, ...allowed };
    okrs[index] = updatedOKR;
    this.saveOKRs(okrs);

    // Journal append-only : delta de reps par KR, SYMÉTRIQUE ±.
    //
    // Le `Math.max(0, …)` d'origine écrasait toute baisse : baisser un
    // `currentValue` en démo laissait les reps au journal, là où le repository
    // Supabase appelle `removeKRReps`. Le graphique « KR réalisés » divergeait
    // donc entre la démo et la prod, sur le même geste. `updateKeyResult` juste
    // en dessous traitait déjà les deux sens : c'est ce chemin-ci qui manquait.
    if (updates.keyResults) {
      for (const kr of updates.keyResults) {
        const prev = previousKRsById.get(kr.id);
        const previousValue = prev?.currentValue ?? 0;
        const delta = Math.round(kr.currentValue - previousValue);
        if (delta > 0) {
          this.appendKRReps(updatedOKR.id, kr, updatedOKR.title, delta);
        } else if (delta < 0) {
          this.removeKRReps(kr.id, -delta);
        }
      }
    }

    return updatedOKR;
  }

  /**
   * Append-only : ajoute `count` lignes (1 par rep) dans le journal
   * localStorage. Toutes timestampées à l'instant — utilisé par
   * create() / update() / updateKeyResult().
   *
   * ⚠️ PARITÉ OBLIGATOIRE avec `recordKRReps` du repository Supabase, sur DEUX
   * points que ce chemin-ci a manqués (audit A-2) :
   *
   *   1. LE CLAMP (faille B18). Le champ `currentValue` de `OKRCard` est un
   *      `input[type=number]` sans `max`, qui remonte à CHAQUE frappe : taper
   *      « 50000 » demandait 5 puis 50 puis 500 puis 5 000 puis 50 000 reps.
   *      Sans borne, la boucle écrivait des dizaines de milliers de lignes,
   *      bloquait le fil principal ~20 s, puis levait un `QuotaExceededError`
   *      des 5 Mo de `localStorage` — mesuré. Le repository Supabase clampe à
   *      100 depuis B18 ; ce chemin ne l'avait jamais fait.
   *   2. L'HORODATAGE. `kr.completedAt` est la date à laquelle le KR a été
   *      ACHEVÉ, pas celle de la rep qu'on ajoute. L'utiliser datait les
   *      nouvelles reps d'un KR déjà terminé au jour de son achèvement : le
   *      graphique « KR réalisés » du tableau de bord ne montrait rien pour
   *      aujourd'hui. Le serveur a toujours utilisé `now()`.
   */
  private appendKRReps(okrId: string, kr: { id: string; title: string; completedAt?: string | null }, okrTitle: string, count: number): void {
    if (count <= 0) return;
    const safeCount = Math.min(count, MAX_REPS_PER_WRITE);
    const completions: KRCompletion[] =
      safeParseArray<KRCompletion>(safeGetItem(KR_COMPLETIONS_STORAGE_KEY)) ?? [];
    const completedAt = new Date().toISOString();
    for (let i = 0; i < safeCount; i++) {
      completions.push({
        id: crypto.randomUUID(),
        krId: kr.id,
        okrId,
        userId: 'demo-user',
        completedAt,
        krTitle: kr.title,
        okrTitle,
      });
    }
    writeJsonOrThrow(KR_COMPLETIONS_STORAGE_KEY, completions);
  }

  /**
   * C-01 — rejoue le journal d'un OKR restauré. Contrat et raison dans
   * `IOKRsRepository.restoreCompletions`.
   *
   * ⚠️ Les horodatages d'ORIGINE sont conservés : c'est tout l'intérêt. Les
   * réécrire à `now()` remettrait les N points d'un coup sur aujourd'hui, ce
   * qui n'est pas restaurer un graphique mais en inventer un autre.
   */
  async restoreCompletions(completions: KRCompletion[]): Promise<void> {
    if (completions.length === 0) return;
    const bounded = completions.slice(0, MAX_REPS_PER_WRITE);
    const existing: KRCompletion[] =
      safeParseArray<KRCompletion>(safeGetItem(KR_COMPLETIONS_STORAGE_KEY)) ?? [];
    writeJsonOrThrow(KR_COMPLETIONS_STORAGE_KEY, [
      ...existing,
      // Identifiant NEUF : un journal est un ensemble d'événements, rien ne
      // référence une de ses lignes. Seul son contenu alimente le graphique.
      ...bounded.map((c) => ({ ...c, id: crypto.randomUUID() })),
    ]);
  }

  /**
   * Symétrique de appendKRReps : retire les `count` reps les plus récentes
   * pour ce KR (par completedAt DESC). Appelé quand currentValue diminue.
   */
  private removeKRReps(krId: string, count: number): void {
    if (count <= 0) return;
    const safeCount = Math.min(count, MAX_REPS_PER_WRITE);
    const completions = safeParseArray<KRCompletion>(safeGetItem(KR_COMPLETIONS_STORAGE_KEY));
    if (!completions) return;
    const toRemoveIds = new Set(
      completions
        .filter(c => c.krId === krId)
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
        .slice(0, safeCount)
        .map(c => c.id)
    );
    if (toRemoveIds.size === 0) return;
    const remaining = completions.filter(c => !toRemoveIds.has(c.id));
    writeJsonOrThrow(KR_COMPLETIONS_STORAGE_KEY, remaining);
  }

  async delete(id: string): Promise<void> {
    const okrs = this.getOKRs();
    const filtered = okrs.filter(o => o.id !== id);

    if (filtered.length === okrs.length) {
      throw makeApiError('not_found');
    }

    this.saveOKRs(filtered);
  }

  // ═══════════════════════════════════════════════════════════════════
  // KEY RESULT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getPage(params: PaginationParams = {}): Promise<PaginatedResult<OKR>> {
    const okrs = this.getOKRs();
    const limit = params.limit ?? DEFAULT_PAGE_SIZE;
    let startIndex = 0;
    if (params.cursor) {
      const cursorIndex = okrs.findIndex(o => o.id === params.cursor);
      if (cursorIndex !== -1) startIndex = cursorIndex + 1;
    }
    const slice = okrs.slice(startIndex, startIndex + limit + 1);
    const hasMore = slice.length > limit;
    const items = hasMore ? slice.slice(0, limit) : slice;
    return {
      data: items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      nextCursorDate: null,
    };
  }

  async updateKeyResult(okrId: string, keyResultId: string, updates: UpdateKeyResultInput): Promise<OKR> {
    const okrs = this.getOKRs();
    const okrIndex = okrs.findIndex(o => o.id === okrId);

    if (okrIndex === -1) {
      throw makeApiError('not_found');
    }

    const okr = okrs[okrIndex];
    const krIndex = okr.keyResults.findIndex(kr => kr.id === keyResultId);

    if (krIndex === -1) {
      throw makeApiError('not_found');
    }

    // Snapshot before update — capture le currentValue d'origine pour delta
    const previousCurrentValue = okr.keyResults[krIndex].currentValue;

    // Update the key result + auto-set completedAt (equivalent to Supabase trigger)
    const merged = { ...okr.keyResults[krIndex], ...updates };
    if (merged.completed && !merged.completedAt) {
      merged.completedAt = new Date().toISOString();
    }
    if (merged.completed === false) {
      merged.completedAt = null;
    }
    okr.keyResults[krIndex] = merged;

    // Recalcule la progression via la source unique pondérée (recalcProgress) :
    // moyenne pondérée par le coefficient des KR + garde divide-by-zero (B17).
    const { progress, completed } = recalcProgress(okr.keyResults);
    okr.progress = progress;
    okr.completed = completed;

    okrs[okrIndex] = okr;
    this.saveOKRs(okrs);

    // ── Journal : delta de reps (1 ligne = 1 rep), symétrique ±  ──
    const delta = Math.round(merged.currentValue - previousCurrentValue);
    if (delta > 0) {
      this.appendKRReps(okrId, merged, okr.title, delta);
    } else if (delta < 0) {
      this.removeKRReps(merged.id, -delta);
    }

    return okr;
  }
}
