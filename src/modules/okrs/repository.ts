// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Repository Pattern Implementation
// ═══════════════════════════════════════════════════════════════════

import { OKR, CreateOKRInput, UpdateOKRInput, UpdateKeyResultInput, OKRFilters } from './types';
import { OKRS_STORAGE_KEY } from './constants';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';

// ═══════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════

const getDate = (daysFromNow: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
};

const DEMO_OKRS: OKR[] = [
  // ── OKRs ACTUELS (en cours) ───────────────────────────────────────────
  {
    id: 'okr-1',
    title: 'Améliorer ma productivité Q1 2026',
    description: 'Devenir plus efficace dans mes tâches quotidiennes',
    category: 'personal',
    progress: 65,
    completed: false,
    keyResults: [
      { id: 'kr-1', title: 'Compléter 90% des tâches planifiées', currentValue: 68, targetValue: 90, unit: '%',     completed: false, estimatedTime: 30 },
      { id: 'kr-2', title: 'Réduire les distractions de 50%',     currentValue: 30, targetValue: 50, unit: '%',     completed: false, estimatedTime: 15 },
      { id: 'kr-3', title: 'Méthode Pomodoro quotidiennement',     currentValue: 55, targetValue: 90, unit: 'jours', completed: false, estimatedTime: 25 },
    ],
    startDate: getDate(-90),
    endDate: getDate(0),
  },
  {
    id: 'okr-2',
    title: 'Maîtriser le machine learning',
    description: 'Acquérir des compétences solides en ML/IA',
    category: 'learning',
    progress: 38,
    completed: false,
    keyResults: [
      { id: 'kr-4', title: 'Terminer la spécialisation Coursera',  currentValue: 3,  targetValue: 5,  unit: 'cours',    completed: false, estimatedTime: 180 },
      { id: 'kr-5', title: 'Créer 2 projets ML en production',     currentValue: 0,  targetValue: 2,  unit: 'projets',  completed: false, estimatedTime: 300 },
      { id: 'kr-6', title: 'Kaggle competitions top 20%',          currentValue: 1,  targetValue: 3,  unit: 'compét.',  completed: false, estimatedTime: 120 },
    ],
    startDate: getDate(-90),
    endDate: getDate(90),
  },
  {
    id: 'okr-3',
    title: 'Santé et bien-être 2026',
    description: 'Adopter et maintenir un mode de vie sain',
    category: 'health',
    progress: 72,
    completed: false,
    keyResults: [
      { id: 'kr-7', title: 'Sport 4x par semaine',                 currentValue: 48, targetValue: 52, unit: 'séances', completed: false, estimatedTime: 60 },
      { id: 'kr-8', title: 'Dormir 7h30+ par nuit',               currentValue: 58, targetValue: 90, unit: 'nuits',   completed: false, estimatedTime: 0  },
      { id: 'kr-9', title: '5 fruits/légumes par jour',            currentValue: 65, targetValue: 90, unit: 'jours',   completed: false, estimatedTime: 10 },
    ],
    startDate: getDate(-100),
    endDate: getDate(80),
  },

  // ── OKRs PASSÉS COMPLÉTÉS ─────────────────────────────────────────────
  {
    id: 'okr-4',
    title: 'Lancer COSMO v1.0 en production',
    description: 'Développer et déployer la première version publique',
    category: 'personal',
    progress: 100,
    completed: true,
    keyResults: [
      { id: 'kr-10', title: 'Livrer les 8 fonctionnalités core',   currentValue: 8,  targetValue: 8,  unit: 'features',      completed: true, estimatedTime: 200 },
      { id: 'kr-11', title: 'Déployer en production',              currentValue: 1,  targetValue: 1,  unit: 'déploiement',   completed: true, estimatedTime: 20  },
      { id: 'kr-12', title: 'Atteindre 50 utilisateurs beta',      currentValue: 67, targetValue: 50, unit: 'utilisateurs',  completed: true, estimatedTime: 30  },
    ],
    startDate: getDate(-420),
    endDate: getDate(-210),
  },
  {
    id: 'okr-5',
    title: 'Maîtriser TypeScript et architecture propre',
    description: 'Monter en compétences sur TypeScript avancé',
    category: 'learning',
    progress: 100,
    completed: true,
    keyResults: [
      { id: 'kr-13', title: 'Terminer formation TypeScript avancé', currentValue: 12, targetValue: 12, unit: 'modules',  completed: true, estimatedTime: 240 },
      { id: 'kr-14', title: 'Refactoriser 100% du code legacy',     currentValue: 100,targetValue: 100,unit: '%',        completed: true, estimatedTime: 480 },
      { id: 'kr-15', title: 'Lire 3 livres sur l\'architecture',    currentValue: 3,  targetValue: 3,  unit: 'livres',  completed: true, estimatedTime: 1800},
    ],
    startDate: getDate(-410),
    endDate: getDate(-340),
  },
  {
    id: 'okr-6',
    title: 'Croissance utilisateurs COSMO v1',
    description: 'Acquérir les premiers utilisateurs actifs',
    category: 'personal',
    progress: 100,
    completed: true,
    keyResults: [
      { id: 'kr-16', title: 'Atteindre 200 utilisateurs actifs',   currentValue: 234, targetValue: 200, unit: 'users',    completed: true, estimatedTime: 60 },
      { id: 'kr-17', title: 'NPS score supérieur à 40',            currentValue: 47,  targetValue: 40,  unit: 'score',   completed: true, estimatedTime: 30 },
      { id: 'kr-18', title: 'Rétention J30 > 40%',                currentValue: 43,  targetValue: 40,  unit: '%',       completed: true, estimatedTime: 20 },
    ],
    startDate: getDate(-210),
    endDate: getDate(-120),
  },
  {
    id: 'okr-7',
    title: 'Excellence technique Q3 2025',
    description: 'Améliorer la qualité et la performance du code',
    category: 'personal',
    progress: 100,
    completed: true,
    keyResults: [
      { id: 'kr-19', title: 'Couverture de tests > 80%',           currentValue: 84,  targetValue: 80,  unit: '%',       completed: true, estimatedTime: 300 },
      { id: 'kr-20', title: 'Temps de chargement < 1.5s',          currentValue: 1.2, targetValue: 1.5, unit: 'sec',     completed: true, estimatedTime: 120 },
      { id: 'kr-21', title: 'Zéro vulnérabilité critique',          currentValue: 0,   targetValue: 0,   unit: 'vuln.',   completed: true, estimatedTime: 90  },
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
      { id: 'kr-22', title: 'Sport 3x par semaine pendant 6 mois', currentValue: 72,  targetValue: 72,  unit: 'séances', completed: true, estimatedTime: 60  },
      { id: 'kr-23', title: '5000 pages lues en 6 mois',           currentValue: 5240,targetValue: 5000,unit: 'pages',   completed: true, estimatedTime: 0   },
      { id: 'kr-24', title: 'Méditation quotidienne — streak 90j', currentValue: 94,  targetValue: 90,  unit: 'jours',   completed: true, estimatedTime: 15  },
    ],
    startDate: getDate(-430),
    endDate: getDate(-250),
  },
];

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
      this.saveOKRs(DEMO_OKRS);
      return DEMO_OKRS;
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

    // Update the key result
    okr.keyResults[krIndex] = { ...okr.keyResults[krIndex], ...updates };

    // Recalculate OKR progress
    const totalProgress = okr.keyResults.reduce((sum, kr) => {
      return sum + Math.min((kr.currentValue / kr.targetValue) * 100, 100);
    }, 0);
    okr.progress = Math.round(totalProgress / okr.keyResults.length);

    // Check if all key results are completed
    okr.completed = okr.keyResults.every(kr => kr.currentValue >= kr.targetValue);

    okrs[okrIndex] = okr;
    this.saveOKRs(okrs);
    return okr;
  }
}
