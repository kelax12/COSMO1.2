// ═══════════════════════════════════════════════════════════════════
// KR-COMPLETIONS MODULE - Repository Pattern Implementation
// ═══════════════════════════════════════════════════════════════════

import { KRCompletion, CreateKRCompletionInput, KRCompletionFilters } from './types';
import { KR_COMPLETIONS_STORAGE_KEY } from './constants';

// ═══════════════════════════════════════════════════════════════════
// DEMO DATA — Seeds matching the completed KRs in OKR demo data
// ═══════════════════════════════════════════════════════════════════

const getDate = (daysFromNow: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
};

/**
 * Factory function — called each time demo data is seeded.
 * Dates are computed fresh relative to today.
 */
function createDemoCompletions(): KRCompletion[] {
  return [
    // ── KRs complétés récemment (aujourd'hui / cette semaine) ──────────
    { id: 'krc-1', krId: 'kr-1', okrId: 'okr-1', userId: 'demo-user', completedAt: getDate(0),   krTitle: 'Compléter 90 tâches',                                 okrTitle: 'Améliorer ma productivité Q2 2026' },
    { id: 'krc-2', krId: 'kr-7', okrId: 'okr-3', userId: 'demo-user', completedAt: getDate(-1),  krTitle: 'Sport 4x par semaine',                                okrTitle: 'Santé et bien-être 2026' },
    { id: 'krc-3', krId: 'kr-9', okrId: 'okr-3', userId: 'demo-user', completedAt: getDate(-3),  krTitle: '5 fruits/légumes par jour',                            okrTitle: 'Santé et bien-être 2026' },

    // ── KRs complétés ce mois ──────────────────────────────────────────
    { id: 'krc-4', krId: 'kr-5', okrId: 'okr-2', userId: 'demo-user', completedAt: getDate(-10), krTitle: 'Livrer les 8 fonctionnalités clés du MVP',            okrTitle: 'Lancer mon projet' },
    { id: 'krc-5', krId: 'kr-4', okrId: 'okr-2', userId: 'demo-user', completedAt: getDate(-30), krTitle: 'Recueillir 10 retours utilisateurs sur le concept',   okrTitle: 'Lancer mon projet' },

    // ── KRs complétés il y a longtemps ─────────────────────────────────
    { id: 'krc-6', krId: 'kr-22', okrId: 'okr-8', userId: 'demo-user', completedAt: getDate(-160), krTitle: 'Sport 3x par semaine pendant 6 mois', okrTitle: 'Bien-être et santé H1 2025' },
    { id: 'krc-7', krId: 'kr-23', okrId: 'okr-8', userId: 'demo-user', completedAt: getDate(-165), krTitle: '5000 pages lues en 6 mois',           okrTitle: 'Bien-être et santé H1 2025' },
    { id: 'krc-8', krId: 'kr-24', okrId: 'okr-8', userId: 'demo-user', completedAt: getDate(-170), krTitle: 'Méditation quotidienne — streak 90j', okrTitle: 'Bien-être et santé H1 2025' },
  ];
}

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface IKRCompletionsRepository {
  // Read operations
  getAll(): Promise<KRCompletion[]>;
  getFiltered(filters: KRCompletionFilters): Promise<KRCompletion[]>;

  // Write operations (append-only)
  create(input: CreateKRCompletionInput): Promise<KRCompletion>;
}

// ═══════════════════════════════════════════════════════════════════
// LOCAL STORAGE REPOSITORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class LocalStorageKRCompletionsRepository implements IKRCompletionsRepository {

  private getCompletions(): KRCompletion[] {
    const data = localStorage.getItem(KR_COMPLETIONS_STORAGE_KEY);
    if (!data) {
      const demo = createDemoCompletions();
      this.saveCompletions(demo);
      return demo;
    }
    return JSON.parse(data);
  }

  private saveCompletions(completions: KRCompletion[]): void {
    localStorage.setItem(KR_COMPLETIONS_STORAGE_KEY, JSON.stringify(completions));
  }

  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<KRCompletion[]> {
    return this.getCompletions();
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
