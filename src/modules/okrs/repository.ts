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
  {
    id: 'okr-1',
    title: 'Améliorer ma productivité',
    description: 'Devenir plus efficace dans mes tâches quotidiennes',
    category: 'personal',
    progress: 65,
    completed: false,
    keyResults: [
      { id: 'kr-1', title: 'Compléter 90% des tâches planifiées', currentValue: 68, targetValue: 90, unit: '%', completed: false, estimatedTime: 30 },
      { id: 'kr-2', title: 'Réduire les distractions de 50%', currentValue: 30, targetValue: 50, unit: '%', completed: false, estimatedTime: 15 },
      { id: 'kr-3', title: 'Utiliser la méthode Pomodoro quotidiennement', currentValue: 11, targetValue: 20, unit: 'jours', completed: false, estimatedTime: 25 },
    ],
    startDate: getDate(-30),
    endDate: getDate(60),
  },
  {
    id: 'okr-2',
    title: 'Apprendre React avancé',
    description: 'Maîtriser les concepts avancés de React',
    category: 'learning',
    progress: 40,
    completed: false,
    keyResults: [
      { id: 'kr-4', title: 'Terminer le cours sur les hooks', currentValue: 8, targetValue: 10, unit: 'modules', completed: false, estimatedTime: 60 },
      { id: 'kr-5', title: 'Créer 3 projets pratiques', currentValue: 1, targetValue: 3, unit: 'projets', completed: false, estimatedTime: 120 },
      { id: 'kr-6', title: 'Contribuer à un projet open source', currentValue: 1, targetValue: 10, unit: 'PRs', completed: false, estimatedTime: 45 },
    ],
    startDate: getDate(-20),
    endDate: getDate(70),
  },
  {
    id: 'okr-3',
    title: 'Améliorer ma santé',
    description: 'Adopter un mode de vie plus sain',
    category: 'health',
    progress: 55,
    completed: false,
    keyResults: [
      { id: 'kr-7', title: 'Faire du sport 4x par semaine', currentValue: 14, targetValue: 20, unit: 'séances', completed: false, estimatedTime: 60 },
      { id: 'kr-8', title: 'Dormir 8h par nuit', currentValue: 9, targetValue: 20, unit: 'nuits', completed: false, estimatedTime: 0 },
      { id: 'kr-9', title: 'Manger 5 fruits/légumes par jour', currentValue: 10, targetValue: 20, unit: 'jours', completed: false, estimatedTime: 10 },
    ],
    startDate: getDate(-15),
    endDate: getDate(75),
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
