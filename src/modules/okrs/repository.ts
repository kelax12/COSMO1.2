// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Repository Pattern Implementation
// ═══════════════════════════════════════════════════════════════════

import { OKR, CreateOKRInput, UpdateOKRInput, UpdateKeyResultInput, OKRFilters } from './types';
import { OKRS_STORAGE_KEY } from './constants';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';
import { KR_COMPLETIONS_STORAGE_KEY } from '@/modules/kr-completions/constants';
import { KRCompletion } from '@/modules/kr-completions/types';

// ═══════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════

const getDate = (daysFromNow: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
};

// completedAt à daysFromNow jours (ISO string)
const completedAt = (daysFromNow: number): string => getDate(daysFromNow);

function createDemoOkrs(): OKR[] {
  return [
  // ── OKRs ACTUELS (en cours) — KR partiellement complétés récemment ───
  {
    id: 'okr-1',
    title: 'Améliorer ma productivité Q2 2026',
    description: 'Devenir plus efficace dans mes tâches quotidiennes',
    category: 'personal',
    progress: 55,
    completed: false,
    keyResults: [
      { id: 'kr-1', title: 'Compléter 90% des tâches planifiées', currentValue: 90, targetValue: 90, unit: '%',     completed: true,  estimatedTime: 30,  completedAt: completedAt(0)  },
      { id: 'kr-2', title: 'Réduire les distractions de 50%',     currentValue: 30, targetValue: 50, unit: '%',     completed: false, estimatedTime: 15,  completedAt: null },
      { id: 'kr-3', title: 'Méthode Pomodoro quotidiennement',     currentValue: 55, targetValue: 90, unit: 'jours', completed: false, estimatedTime: 25,  completedAt: null },
    ],
    startDate: getDate(-60),
    endDate: getDate(30),
  },
  {
    id: 'okr-2',
    title: 'Maîtriser le machine learning',
    description: 'Acquérir des compétences solides en ML/IA',
    category: 'learning',
    progress: 50,
    completed: false,
    keyResults: [
      { id: 'kr-4', title: 'Terminer la spécialisation Coursera',  currentValue: 5,  targetValue: 5,  unit: 'cours',   completed: true,  estimatedTime: 180, completedAt: completedAt(-2) },
      { id: 'kr-5', title: 'Créer 2 projets ML en production',     currentValue: 1,  targetValue: 2,  unit: 'projets', completed: false, estimatedTime: 300, completedAt: null },
      { id: 'kr-6', title: 'Kaggle competitions top 20%',          currentValue: 1,  targetValue: 3,  unit: 'compét.', completed: false, estimatedTime: 120, completedAt: null },
    ],
    startDate: getDate(-90),
    endDate: getDate(90),
  },
  {
    id: 'okr-3',
    title: 'Santé et bien-être 2026',
    description: 'Adopter et maintenir un mode de vie sain',
    category: 'health',
    progress: 78,
    completed: false,
    keyResults: [
      { id: 'kr-7', title: 'Sport 4x par semaine',        currentValue: 52, targetValue: 52, unit: 'séances', completed: true,  estimatedTime: 60, completedAt: completedAt(-1) },
      { id: 'kr-8', title: 'Dormir 7h30+ par nuit',       currentValue: 58, targetValue: 90, unit: 'nuits',   completed: false, estimatedTime: 0,  completedAt: null },
      { id: 'kr-9', title: '5 fruits/légumes par jour',   currentValue: 90, targetValue: 90, unit: 'jours',   completed: true,  estimatedTime: 10, completedAt: completedAt(-3) },
    ],
    startDate: getDate(-100),
    endDate: getDate(80),
  },

  // ── OKRs RÉCENTS COMPLÉTÉS (ce mois / semaine passée) ────────────────
  {
    id: 'okr-4',
    title: 'Lancer COSMO v1.2 en production',
    description: 'Développer et déployer la version 1.2',
    category: 'personal',
    progress: 100,
    completed: true,
    keyResults: [
      { id: 'kr-10', title: 'Livrer les 5 nouvelles features',  currentValue: 5,  targetValue: 5,  unit: 'features',    completed: true, estimatedTime: 200, completedAt: completedAt(-5)  },
      { id: 'kr-11', title: 'Déployer sur Vercel',              currentValue: 1,  targetValue: 1,  unit: 'déploiement', completed: true, estimatedTime: 20,  completedAt: completedAt(-4)  },
      { id: 'kr-12', title: 'Atteindre 100 utilisateurs beta',  currentValue: 112,targetValue: 100,unit: 'users',       completed: true, estimatedTime: 30,  completedAt: completedAt(-6)  },
    ],
    startDate: getDate(-30),
    endDate: getDate(-4),
  },
  {
    id: 'okr-5',
    title: 'Optimisation performances app',
    description: 'Réduire les temps de chargement et améliorer le score Lighthouse',
    category: 'personal',
    progress: 100,
    completed: true,
    keyResults: [
      { id: 'kr-13', title: 'Score Lighthouse > 90',          currentValue: 94,  targetValue: 90,  unit: '/100',  completed: true, estimatedTime: 120, completedAt: completedAt(-8)  },
      { id: 'kr-14', title: 'Réduire bundle size de 30%',     currentValue: 33,  targetValue: 30,  unit: '%',     completed: true, estimatedTime: 90,  completedAt: completedAt(-10) },
      { id: 'kr-15', title: 'TTI < 2s sur mobile',            currentValue: 1.8, targetValue: 2.0, unit: 'sec',   completed: true, estimatedTime: 80,  completedAt: completedAt(-9)  },
    ],
    startDate: getDate(-25),
    endDate: getDate(-8),
  },
  {
    id: 'okr-6',
    title: 'Croissance utilisateurs COSMO v1',
    description: 'Acquérir les premiers utilisateurs actifs',
    category: 'personal',
    progress: 100,
    completed: true,
    keyResults: [
      { id: 'kr-16', title: 'Atteindre 200 utilisateurs actifs', currentValue: 234, targetValue: 200, unit: 'users',  completed: true, estimatedTime: 60, completedAt: completedAt(-18) },
      { id: 'kr-17', title: 'NPS score supérieur à 40',          currentValue: 47,  targetValue: 40,  unit: 'score',  completed: true, estimatedTime: 30, completedAt: completedAt(-20) },
      { id: 'kr-18', title: 'Rétention J30 > 40%',              currentValue: 43,  targetValue: 40,  unit: '%',      completed: true, estimatedTime: 20, completedAt: completedAt(-22) },
    ],
    startDate: getDate(-45),
    endDate: getDate(-15),
  },

  // ── OKRs ANCIENS COMPLÉTÉS ────────────────────────────────────────────
  {
    id: 'okr-7',
    title: 'Excellence technique Q3 2025',
    description: 'Améliorer la qualité et la performance du code',
    category: 'personal',
    progress: 100,
    completed: true,
    keyResults: [
      { id: 'kr-19', title: 'Couverture de tests > 80%',      currentValue: 84,  targetValue: 80,  unit: '%',     completed: true, estimatedTime: 300, completedAt: completedAt(-90)  },
      { id: 'kr-20', title: 'Temps de chargement < 1.5s',     currentValue: 1.2, targetValue: 1.5, unit: 'sec',   completed: true, estimatedTime: 120, completedAt: completedAt(-95)  },
      { id: 'kr-21', title: 'Zéro vulnérabilité critique',    currentValue: 0,   targetValue: 0,   unit: 'vuln.', completed: true, estimatedTime: 90,  completedAt: completedAt(-100) },
    ],
    startDate: getDate(-240),
    endDate: getDate(-150),
  },
  {
    id: 'okr-8',
    title: 'Bien-être et santé H1 2025',
    description: 'Établir de bonnes habitudes de santé durables',
    category: 'health',
    progress: 100,
    completed: true,
    keyResults: [
      { id: 'kr-22', title: 'Sport 3x par semaine pendant 6 mois', currentValue: 72,   targetValue: 72,   unit: 'séances', completed: true, estimatedTime: 60,  completedAt: completedAt(-160) },
      { id: 'kr-23', title: '5000 pages lues en 6 mois',           currentValue: 5240, targetValue: 5000, unit: 'pages',   completed: true, estimatedTime: 0,   completedAt: completedAt(-165) },
      { id: 'kr-24', title: 'Méditation quotidienne — streak 90j', currentValue: 94,   targetValue: 90,   unit: 'jours',   completed: true, estimatedTime: 15,  completedAt: completedAt(-170) },
    ],
    startDate: getDate(-430),
    endDate: getDate(-250),
  },
  ];
}

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
  create(input: CreateOKRInput): Promise<OKR>;
  update(id: string, updates: UpdateOKRInput): Promise<OKR>;
  delete(id: string): Promise<void>;

  // KeyResult operations
  updateKeyResult(okrId: string, keyResultId: string, updates: UpdateKeyResultInput): Promise<OKR>;
}

// ═══════════════════════════════════════════════════════════════════
// LOCAL STORAGE REPOSITORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class LocalStorageOKRsRepository implements IOKRsRepository {
  /**
   * Get all OKRs from localStorage (or initialize with demo data)
   */
  private getOKRs(): OKR[] {
    const data = localStorage.getItem(OKRS_STORAGE_KEY);
    if (!data) {
      const demo = createDemoOkrs();
      this.saveOKRs(demo);
      return demo;
    }
    return JSON.parse(data);
  }

  /**
   * Save OKRs to localStorage
   */
  private saveOKRs(okrs: OKR[]): void {
    localStorage.setItem(OKRS_STORAGE_KEY, JSON.stringify(okrs));
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

  async create(input: CreateOKRInput): Promise<OKR> {
    const okrs = this.getOKRs();
    const newOKR: OKR = {
      ...input,
      id: crypto.randomUUID(),
    };
    this.saveOKRs([...okrs, newOKR]);
    return newOKR;
  }

  async update(id: string, updates: UpdateOKRInput): Promise<OKR> {
    const okrs = this.getOKRs();
    const index = okrs.findIndex(o => o.id === id);

    if (index === -1) {
      throw new Error(`OKR with id ${id} not found`);
    }

    const updatedOKR: OKR = { ...okrs[index], ...updates };
    okrs[index] = updatedOKR;
    this.saveOKRs(okrs);
    return updatedOKR;
  }

  async delete(id: string): Promise<void> {
    const okrs = this.getOKRs();
    const filtered = okrs.filter(o => o.id !== id);

    if (filtered.length === okrs.length) {
      throw new Error(`OKR with id ${id} not found`);
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
      throw new Error(`OKR with id ${okrId} not found`);
    }

    const okr = okrs[okrIndex];
    const krIndex = okr.keyResults.findIndex(kr => kr.id === keyResultId);

    if (krIndex === -1) {
      throw new Error(`KeyResult with id ${keyResultId} not found`);
    }

    // Snapshot before update
    const wasPreviouslyCompleted = okr.keyResults[krIndex].completed;

    // Update the key result + auto-set completedAt (equivalent to Supabase trigger)
    const merged = { ...okr.keyResults[krIndex], ...updates };
    if (merged.completed && !merged.completedAt) {
      merged.completedAt = new Date().toISOString();
    }
    if (merged.completed === false) {
      merged.completedAt = null;
    }
    okr.keyResults[krIndex] = merged;

    // Recalculate OKR progress
    const totalProgress = okr.keyResults.reduce((sum, kr) => {
      return sum + Math.min((kr.currentValue / kr.targetValue) * 100, 100);
    }, 0);
    okr.progress = Math.round(totalProgress / okr.keyResults.length);

    // Check if all key results are completed
    okr.completed = okr.keyResults.every(kr => kr.currentValue >= kr.targetValue);

    okrs[okrIndex] = okr;
    this.saveOKRs(okrs);

    // ── ATOMIC: create completion record in the same synchronous call ──
    // No race condition possible — localStorage writes are synchronous
    if (merged.completed && !wasPreviouslyCompleted) {
      const raw = localStorage.getItem(KR_COMPLETIONS_STORAGE_KEY);
      const completions: KRCompletion[] = raw ? JSON.parse(raw) : [];
      completions.push({
        id: crypto.randomUUID(),
        krId: keyResultId,
        okrId: okrId,
        userId: 'demo-user',
        completedAt: merged.completedAt!,
        krTitle: merged.title,
        okrTitle: okr.title,
      });
      localStorage.setItem(KR_COMPLETIONS_STORAGE_KEY, JSON.stringify(completions));
    }

    return okr;
  }
}
