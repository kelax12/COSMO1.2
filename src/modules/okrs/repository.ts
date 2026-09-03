// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Repository Pattern Implementation
// ═══════════════════════════════════════════════════════════════════

import { OKR, CreateOKRInput, UpdateOKRInput, UpdateKeyResultInput, OKRFilters } from './types';
import { recalcProgress } from './progress';
import { OKRS_STORAGE_KEY } from './constants';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';
import { KR_COMPLETIONS_STORAGE_KEY, MAX_REPS_PER_WRITE } from '@/modules/kr-completions/constants';
import { KRCompletion } from '@/modules/kr-completions/types';
import { isEnglishSeed } from '@/lib/seed-i18n';
import type { CreateOptions } from '@/lib/restore-id';
import { safeGetItem, safeParseArray, writeJsonOrThrow } from '@/lib/safe-json';

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
    category: 'cat-2',
    progress: 70,
    completed: false,
    keyResults: [
      { id: 'kr-1', title: 'Compléter 90 tâches',                           currentValue: 90, targetValue: 90, unit: 'tâches',  completed: true,  estimatedTime: 30,  completedAt: completedAt(0)  },
      { id: 'kr-2', title: 'Terminer 8 semaines sans tâche en retard',      currentValue: 4,  targetValue: 8,  unit: 'semaines', completed: false, estimatedTime: 15,  completedAt: null },
      { id: 'kr-3', title: 'Pratiquer la méthode Pomodoro 90 jours sur le trimestre', currentValue: 55, targetValue: 90, unit: 'jours', completed: false, estimatedTime: 25,  completedAt: null },
    ],
    startDate: getDate(-60),
    endDate: getDate(30),
  },
  {
    id: 'okr-2',
    title: 'Lancer mon projet',
    description: "Passer de l'idée au lancement effectif",
    category: 'cat-5',
    progress: 87,
    completed: false,
    keyResults: [
      { id: 'kr-4', title: 'Recueillir 10 retours utilisateurs sur le concept', currentValue: 10, targetValue: 10, unit: 'retours',        completed: true,  estimatedTime: 60,  completedAt: completedAt(-30) },
      { id: 'kr-5', title: 'Livrer les 8 fonctionnalités clés du MVP',          currentValue: 8,  targetValue: 8,  unit: 'fonctionnalités', completed: true,  estimatedTime: 300, completedAt: completedAt(-10) },
      { id: 'kr-6', title: 'Atteindre 20 premiers utilisateurs',                currentValue: 12, targetValue: 20, unit: 'utilisateurs',    completed: false, estimatedTime: 60,  completedAt: null },
    ],
    startDate: getDate(-90),
    endDate: getDate(90),
  },
  {
    id: 'okr-3',
    title: 'Santé et bien-être 2026',
    description: 'Adopter et maintenir un mode de vie sain',
    category: 'cat-3',
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

  // ── OKR ANCIEN COMPLÉTÉ ────────────────────────────────────────────
  {
    id: 'okr-8',
    title: 'Bien-être et santé H1 2025',
    description: 'Établir de bonnes habitudes de santé durables',
    category: 'cat-3',
    progress: 100,
    completed: true,
    keyResults: [
      { id: 'kr-22', title: 'Sport 3x par semaine pendant 6 mois', currentValue: 72,   targetValue: 72,   unit: 'séances', completed: true, estimatedTime: 60,  completedAt: completedAt(-160) },
      { id: 'kr-23', title: '5000 pages lues en 6 mois',           currentValue: 5240, targetValue: 5000, unit: 'pages',   completed: true, estimatedTime: 0,   completedAt: completedAt(-165) },
      { id: 'kr-24', title: 'Méditation quotidienne, streak 90j', currentValue: 94,   targetValue: 90,   unit: 'jours',   completed: true, estimatedTime: 15,  completedAt: completedAt(-170) },
    ],
    startDate: getDate(-430),
    endDate: getDate(-250),
  },
  ];
}

// Overlay anglais — cf. src/lib/seed-i18n.ts. Structure imbriquée (titre de
// l'OKR + titres de ses key results) : la fusion générique par id top-level
// ne suffit pas, d'où ce merge dédié plutôt que `localizeSeed`.
const DEMO_OKRS_EN: Record<string, { title: string; description: string; keyResults: Record<string, string> }> = {
  'okr-1': {
    title: 'Improve my productivity Q2 2026',
    description: 'Become more efficient in my daily tasks',
    keyResults: {
      'kr-1': 'Complete 90 tasks',
      'kr-2': 'Finish 8 weeks with no overdue task',
      'kr-3': 'Practice the Pomodoro method 90 days this quarter',
    },
  },
  'okr-2': {
    title: 'Launch my project',
    description: 'Go from idea to an actual launch',
    keyResults: {
      'kr-4': 'Collect 10 user feedback sessions on the concept',
      'kr-5': 'Ship the 8 core MVP features',
      'kr-6': 'Reach 20 first users',
    },
  },
  'okr-3': {
    title: 'Health & wellbeing 2026',
    description: 'Adopt and maintain a healthy lifestyle',
    keyResults: {
      'kr-7': 'Exercise 4x a week',
      'kr-8': 'Sleep 7h30+ per night',
      'kr-9': '5 fruits/veggies a day',
    },
  },
  'okr-8': {
    title: 'Wellbeing & health H1 2025',
    description: 'Build lasting healthy habits',
    keyResults: {
      'kr-22': 'Exercise 3x a week for 6 months',
      'kr-23': '5000 pages read in 6 months',
      'kr-24': 'Daily meditation, 90-day streak',
    },
  },
};

/** Applique DEMO_OKRS_EN sur le seed français quand la locale est anglaise. */
function localizeOkrs(okrs: OKR[]): OKR[] {
  if (!isEnglishSeed()) return okrs;
  return okrs.map((okr) => {
    const patch = DEMO_OKRS_EN[okr.id];
    if (!patch) return okr;
    return {
      ...okr,
      title: patch.title,
      description: patch.description,
      keyResults: okr.keyResults.map((kr) => ({
        ...kr,
        title: patch.keyResults[kr.id] ?? kr.title,
      })),
    };
  });
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
  create(input: CreateOKRInput, options?: CreateOptions): Promise<OKR>;
  update(id: string, updates: UpdateOKRInput): Promise<OKR>;
  delete(id: string): Promise<void>;

  // KeyResult operations
  updateKeyResult(okrId: string, keyResultId: string, updates: UpdateKeyResultInput): Promise<OKR>;
}

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
      throw new Error(`OKR with id ${id} not found`);
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
