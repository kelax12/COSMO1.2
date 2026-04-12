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
    { id: 'krc-1',  krId: 'kr-1',  okrId: 'okr-1', userId: 'demo-user', completedAt: getDate(0),   krTitle: 'Compléter 90% des tâches planifiées', okrTitle: 'Améliorer ma productivité Q2 2026' },
    { id: 'krc-2',  krId: 'kr-4',  okrId: 'okr-2', userId: 'demo-user', completedAt: getDate(-2),  krTitle: 'Terminer la spécialisation Coursera',  okrTitle: 'Maîtriser le machine learning' },
    { id: 'krc-3',  krId: 'kr-7',  okrId: 'okr-3', userId: 'demo-user', completedAt: getDate(-1),  krTitle: 'Sport 4x par semaine',                okrTitle: 'Santé et bien-être 2026' },
    { id: 'krc-4',  krId: 'kr-9',  okrId: 'okr-3', userId: 'demo-user', completedAt: getDate(-3),  krTitle: '5 fruits/légumes par jour',            okrTitle: 'Santé et bien-être 2026' },

    // ── KRs complétés ce mois ──────────────────────────────────────────
    { id: 'krc-5',  krId: 'kr-10', okrId: 'okr-4', userId: 'demo-user', completedAt: getDate(-5),  krTitle: 'Livrer les 5 nouvelles features',      okrTitle: 'Lancer COSMO v1.2 en production' },
    { id: 'krc-6',  krId: 'kr-11', okrId: 'okr-4', userId: 'demo-user', completedAt: getDate(-4),  krTitle: 'Déployer sur Vercel',                  okrTitle: 'Lancer COSMO v1.2 en production' },
    { id: 'krc-7',  krId: 'kr-12', okrId: 'okr-4', userId: 'demo-user', completedAt: getDate(-6),  krTitle: 'Atteindre 100 utilisateurs beta',      okrTitle: 'Lancer COSMO v1.2 en production' },
    { id: 'krc-8',  krId: 'kr-13', okrId: 'okr-5', userId: 'demo-user', completedAt: getDate(-8),  krTitle: 'Score Lighthouse > 90',                okrTitle: 'Optimisation performances app' },
    { id: 'krc-9',  krId: 'kr-14', okrId: 'okr-5', userId: 'demo-user', completedAt: getDate(-10), krTitle: 'Réduire bundle size de 30%',            okrTitle: 'Optimisation performances app' },
    { id: 'krc-10', krId: 'kr-15', okrId: 'okr-5', userId: 'demo-user', completedAt: getDate(-9),  krTitle: 'TTI < 2s sur mobile',                  okrTitle: 'Optimisation performances app' },

    // ── KRs complétés le mois dernier ──────────────────────────────────
    { id: 'krc-11', krId: 'kr-16', okrId: 'okr-6', userId: 'demo-user', completedAt: getDate(-18), krTitle: 'Atteindre 200 utilisateurs actifs',    okrTitle: 'Croissance utilisateurs COSMO v1' },
    { id: 'krc-12', krId: 'kr-17', okrId: 'okr-6', userId: 'demo-user', completedAt: getDate(-20), krTitle: 'NPS score supérieur à 40',             okrTitle: 'Croissance utilisateurs COSMO v1' },
    { id: 'krc-13', krId: 'kr-18', okrId: 'okr-6', userId: 'demo-user', completedAt: getDate(-22), krTitle: 'Rétention J30 > 40%',                  okrTitle: 'Croissance utilisateurs COSMO v1' },

    // ── KRs complétés il y a longtemps ─────────────────────────────────
    { id: 'krc-14', krId: 'kr-19', okrId: 'okr-7', userId: 'demo-user', completedAt: getDate(-90),  krTitle: 'Couverture de tests > 80%',           okrTitle: 'Excellence technique Q3 2025' },
    { id: 'krc-15', krId: 'kr-20', okrId: 'okr-7', userId: 'demo-user', completedAt: getDate(-95),  krTitle: 'Temps de chargement < 1.5s',          okrTitle: 'Excellence technique Q3 2025' },
    { id: 'krc-16', krId: 'kr-21', okrId: 'okr-7', userId: 'demo-user', completedAt: getDate(-100), krTitle: 'Zéro vulnérabilité critique',         okrTitle: 'Excellence technique Q3 2025' },
    { id: 'krc-17', krId: 'kr-22', okrId: 'okr-8', userId: 'demo-user', completedAt: getDate(-160), krTitle: 'Sport 3x par semaine pendant 6 mois', okrTitle: 'Bien-être et santé H1 2025' },
    { id: 'krc-18', krId: 'kr-23', okrId: 'okr-8', userId: 'demo-user', completedAt: getDate(-165), krTitle: '5000 pages lues en 6 mois',           okrTitle: 'Bien-être et santé H1 2025' },
    { id: 'krc-19', krId: 'kr-24', okrId: 'okr-8', userId: 'demo-user', completedAt: getDate(-170), krTitle: 'Méditation quotidienne — streak 90j', okrTitle: 'Bien-être et santé H1 2025' },
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
