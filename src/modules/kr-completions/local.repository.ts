// ═══════════════════════════════════════════════════════════════════
// KR-COMPLETIONS MODULE - Implémentation de démo (localStorage)
// ═══════════════════════════════════════════════════════════════════

import { KRCompletion, CreateKRCompletionInput, KRCompletionFilters } from './types';
import { KR_COMPLETIONS_STORAGE_KEY } from './constants';
import { safeGetItem, safeParseArray, writeJsonOrThrow } from '@/lib/safe-json';
import type { IKRCompletionsRepository } from './repository';
import { createDemoCompletions } from './local.seed';

// ═══════════════════════════════════════════════════════════════════
// LOCAL STORAGE REPOSITORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class LocalStorageKRCompletionsRepository implements IKRCompletionsRepository {

  private getCompletions(): KRCompletion[] {
    const stored = safeParseArray<KRCompletion>(safeGetItem(KR_COMPLETIONS_STORAGE_KEY));
    // Corrompu ou stockage indisponible : on re-seme plutot que de faire
    // tomber la page (regle B14, helper `safeParseArray`).
    if (!stored) {
      const demo = createDemoCompletions();
      this.saveCompletions(demo);
      return demo;
    }
    return stored;
  }

  private saveCompletions(completions: KRCompletion[]): void {
    writeJsonOrThrow(KR_COMPLETIONS_STORAGE_KEY, completions);
  }

  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getSince(sinceISO: string): Promise<KRCompletion[]> {
    // Comparaison d'INSTANTS : les deux côtés peuvent porter des formats ISO
    // différents (`Z` ou `+00:00`), un tri de chaînes se tromperait.
    const since = Date.parse(sinceISO);
    return this.getCompletions()
      .filter((c) => Date.parse(c.completedAt) >= since)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  async getAllForExport(): Promise<KRCompletion[]> {
    return [...this.getCompletions()].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  async getFiltered(filters: KRCompletionFilters): Promise<KRCompletion[]> {
    let completions = this.getCompletions();

    if (filters.userId) {
      completions = completions.filter(c => c.userId === filters.userId);
    }
    if (filters.okrId) {
      completions = completions.filter(c => c.okrId === filters.okrId);
    }
    if (filters.krId) {
      completions = completions.filter(c => c.krId === filters.krId);
    }
    if (filters.completedAfter) {
      completions = completions.filter(c => c.completedAt >= filters.completedAfter!);
    }
    if (filters.completedBefore) {
      completions = completions.filter(c => c.completedAt <= filters.completedBefore!);
    }

    return completions;
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS (append-only)
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateKRCompletionInput): Promise<KRCompletion> {
    const completions = this.getCompletions();
    const newCompletion: KRCompletion = {
      ...input,
      id: crypto.randomUUID(),
    };
    this.saveCompletions([...completions, newCompletion]);
    return newCompletion;
  }
}
