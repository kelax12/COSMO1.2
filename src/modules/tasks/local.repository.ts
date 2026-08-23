import { ITasksRepository, ToggleCompleteResult } from './repository';
import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from './types';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';
import { localizeSeed } from '@/lib/seed-i18n';
const STORAGE_KEY = 'cosmo_demo_tasks';

// Helper pour générer des dates
const getDate = (daysFromNow: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
};

// Raccourci pour créer une tâche rapidement
const t = (
  id: string, name: string, description: string,
  priority: number, category: string,
  createdDays: number, deadlineDays: number,
  completedDays: number | null,
  bookmarked = false, estimatedTime = 60,
  isCollaborative = false
): Task => ({
  id, name, description, priority, category,
  deadline: getDate(deadlineDays),
  estimatedTime,
  createdAt: getDate(createdDays),
  bookmarked,
  completed: completedDays !== null,
  completedAt: completedDays !== null ? getDate(completedDays) : undefined,
  isCollaborative,
  pendingInvites: [],
});

// 10 tâches — 2 par catégorie, variété de statuts et priorités
const DEMO_TASKS: Task[] = [
  // ── TRAVAIL (cat-1) ───────────────────────────────────────────────────
  t('t001','Bilan annuel 2025',               'Revue complète + plan 2026',               5,'cat-1',-105,-97, -99, true, 120),
  t('t002','Préparer présentation Q1 2026',   'Résultats 3 mois + projections',           5,'cat-1',-5,   3,  null, true, 90),
  t('t013','Envoyer facture client Dupont',   'Facture en retard, relance client',        4,'cat-1',-10,  -3, null, false, 30),

  // ── PROJETS (cat-5) ───────────────────────────────────────────────────
  t('t003','Audit sécurité Q1 2026',          'Pentest + correctifs CVE',                 5,'cat-5',-12,  5,  null),
  t('t004','Mettre à jour dépendances npm',   'Màj majeure + breaking changes',           3,'cat-5',-3,   4,  null, false, 60),

  // ── APPRENTISSAGE (cat-4) ─────────────────────────────────────────────
  t('t005','Lire "Accelerate"',               'Forsgren, DevOps metrics DORA',           3,'cat-4',-28, -5,  -8, true, 360),
  t('t006','Cours deep learning Coursera',    'Réseaux neuronaux + CNN + RNN',            3,'cat-4',-10,  50, null, false, 2400),

  // ── PERSONNEL (cat-2) ─────────────────────────────────────────────────
  t('t007','Préparer dossier crédit immo',    'Documents + simulation + banques',         5,'cat-2',-15,  10, null),
  t('t008','Chercher nouvel appartement',     'Critères + visites + budget max',          4,'cat-2',-2,   14, null, false, 120),

  // ── SANTÉ (cat-3) ─────────────────────────────────────────────────────
  t('t009','Rendez-vous médecin annuel 2026', 'Check-up + vaccins + renouvellements',     2,'cat-3',-5,   7,  null),
  t('t010','Programme stretching quotidien',  'Mobilité + récupération post-sport',       2,'cat-3',-2,   3,  null, false, 20),

  // ── TÂCHES ASSIGNÉES PAR D'AUTRES ─────────────────────────────────────
  { ...t('t011','Réviser le pitch deck',      'Intégrer les retours avant lundi',         4,'cat-5',-1,   3,  null, false, 60, true), sharedBy: 'Marie Dupont' },
  { ...t('t012','Tester le prototype mobile', 'Flow onboarding + feedback UX',            3,'cat-5',-2,   5,  null, false, 45, true),  sharedBy: 'Jean Martin'  },

  // ── TÂCHES PARTAGÉES (shared TO the demo user) ────────────────────────
  {
    id: 'shared-001',
    name: 'Réviser le rapport mensuel',
    description: 'Vérifier les chiffres et commenter',
    priority: 3,
    category: 'cat-1',
    deadline: getDate(5),
    estimatedTime: 45,
    createdAt: getDate(-1),
    bookmarked: false,
    completed: false,
    isCollaborative: true,
    pendingInvites: [],
    sharedBy: 'Marie Dupont',
  },
  {
    id: 'shared-002',
    name: 'Préparer la réunion de lancement',
    description: 'Agenda + présentation + invitations',
    priority: 2,
    category: 'cat-5',
    deadline: getDate(3),
    estimatedTime: 90,
    createdAt: getDate(-2),
    bookmarked: false,
    completed: false,
    isCollaborative: true,
    pendingInvites: [],
    sharedBy: 'Jean Martin',
  },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts. `sharedBy` (nom de personne)
// n'est PAS traduit : un nom propre n'est pas une langue.
const DEMO_TASKS_EN: Record<string, Partial<Task>> = {
  t001: { name: '2025 annual review', description: 'Full review + 2026 plan' },
  t002: { name: 'Prepare Q1 2026 presentation', description: '3-month results + projections' },
  t013: { name: 'Send invoice to Dupont client', description: 'Overdue invoice, follow up with client' },
  t003: { name: 'Q1 2026 security audit', description: 'Pentest + CVE fixes' },
  t004: { name: 'Update npm dependencies', description: 'Major upgrade + breaking changes' },
  t005: { name: 'Read "Accelerate"', description: 'Forsgren, DORA DevOps metrics' },
  t006: { name: 'Deep learning course on Coursera', description: 'Neural networks + CNN + RNN' },
  t007: { name: 'Prepare mortgage application', description: 'Documents + simulation + banks' },
  t008: { name: 'Look for a new apartment', description: 'Criteria + viewings + budget cap' },
  t009: { name: '2026 annual check-up', description: 'Check-up + vaccines + renewals' },
  t010: { name: 'Daily stretching routine', description: 'Mobility + post-workout recovery' },
  t011: { name: 'Review the pitch deck', description: 'Incorporate feedback before Monday' },
  t012: { name: 'Test the mobile prototype', description: 'Onboarding flow + UX feedback' },
  'shared-001': { name: 'Review the monthly report', description: 'Check figures and add comments' },
  'shared-002': { name: 'Prepare the kickoff meeting', description: 'Agenda + slides + invitations' },
};

export class LocalStorageTasksRepository implements ITasksRepository {
  private getTasks(): Task[] {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      const seeded = localizeSeed(DEMO_TASKS, DEMO_TASKS_EN);
      this.saveTasks(seeded);
      return seeded;
    }
    return JSON.parse(data);
  }

  private saveTasks(tasks: Task[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS (Phase 1)
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<Task[]> {
    return this.getTasks();
  }

  /**
   * Mode démo : le partage cross-compte n'existe pas en LocalStorage, la
   * boîte de réception démo s'appuie sur `task.sharedBy` + les acquittements
   * locaux (cf. InboxMenu). Rien à renvoyer ici.
   */
  async getPendingSharedTasks(): Promise<Task[]> {
    return [];
  }

  async getById(id: string): Promise<Task | null> {
    const tasks = this.getTasks();
    return tasks.find(t => t.id === id) || null;
  }

  async getByDate(date: string): Promise<Task[]> {
    const tasks = this.getTasks();
    const targetDate = date.split('T')[0];
    return tasks.filter(t => t.deadline.split('T')[0] === targetDate);
  }

  async getFiltered(filters: TaskFilters): Promise<Task[]> {
    let tasks = this.getTasks();

    if (filters.completed !== undefined) {
      tasks = tasks.filter(t => t.completed === filters.completed);
    }

    if (filters.bookmarked !== undefined) {
      tasks = tasks.filter(t => t.bookmarked === filters.bookmarked);
    }

    if (filters.category) {
      tasks = tasks.filter(t => t.category === filters.category);
    }

    if (filters.priorityMin !== undefined) {
      tasks = tasks.filter(t => t.priority >= filters.priorityMin!);
    }

    if (filters.priorityMax !== undefined) {
      tasks = tasks.filter(t => t.priority <= filters.priorityMax!);
    }

    if (filters.deadlineBefore) {
      tasks = tasks.filter(t => t.deadline <= filters.deadlineBefore!);
    }

    if (filters.deadlineAfter) {
      tasks = tasks.filter(t => t.deadline >= filters.deadlineAfter!);
    }

    return tasks;
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS (Phase 2)
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateTaskInput): Promise<Task> {
    const tasks = this.getTasks();
    const newTask: Task = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      bookmarked: input.bookmarked ?? false,
      completed: input.completed ?? false,
      isCollaborative: input.isCollaborative ?? false,
      pendingInvites: input.pendingInvites ?? [],
    };
    this.saveTasks([newTask, ...tasks]);
    return newTask;
  }

  async update(id: string, updates: UpdateTaskInput): Promise<Task> {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);
    
    if (index === -1) {
      throw new Error(`Task with id ${id} not found`);
    }
    
    const updatedTask: Task = { ...tasks[index], ...updates };
    tasks[index] = updatedTask;
    this.saveTasks(tasks);
    return updatedTask;
  }

  async delete(id: string): Promise<void> {
    const tasks = this.getTasks();
    const filtered = tasks.filter(t => t.id !== id);
    
    if (filtered.length === tasks.length) {
      throw new Error(`Task with id ${id} not found`);
    }
    
    this.saveTasks(filtered);
  }

  /**
   * Bascule la complétion, et génère/retire l'occurrence récurrente suivante.
   *
   * ⚠️ PARITÉ OBLIGATOIRE avec `toggle_task_complete_v2` (mig. 086) — même
   * règle que `recordKRCompletion` (cf. CLAUDE.md) : une règle métier qui
   * n'existe que dans un des deux repositories diverge en silence. Ici,
   * l'invariant à préserver est l'IDEMPOTENCE : recocher deux fois la même
   * tâche ne doit jamais produire deux occurrences.
   *
   * Côté serveur, l'index unique `ux_tasks_recurrence_parent` la garantit.
   * Côté LocalStorage, elle est obtenue par la recherche d'un enfant existant
   * (`recurrenceParentId === id`) avant toute création.
   */
  async toggleComplete(id: string, nextDeadline?: string | null): Promise<ToggleCompleteResult> {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);

    if (index === -1) {
      throw new Error(`Task with id ${id} not found`);
    }

    const task = tasks[index];
    const updatedTask: Task = {
      ...task,
      completed: !task.completed,
      completedAt: !task.completed ? new Date().toISOString() : undefined,
    };
    tasks[index] = updatedTask;

    let spawned: Task | null = null;
    const existingChild = tasks.find(t => t.recurrenceParentId === id);

    if (
      updatedTask.completed &&
      (updatedTask.recurrence ?? 'none') !== 'none' &&
      nextDeadline &&
      !existingChild // ← garde d'idempotence (pendant serveur : ON CONFLICT DO NOTHING)
    ) {
      spawned = {
        ...task,
        id: crypto.randomUUID(),
        deadline: nextDeadline,
        completed: false,
        completedAt: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subtasks: (task.subtasks ?? []).map(s => ({ ...s, completed: false })),
        // Le partage ne se propage pas à l'occurrence suivante.
        isCollaborative: undefined,
        pendingInvites: undefined,
        sharedBy: undefined,
        recurrenceParentId: id,
      };
      tasks.unshift(spawned);
    } else if (!updatedTask.completed && existingChild) {
      // Dé-validation : on retire l'occurrence générée SI elle est intacte
      // (non complétée, jamais modifiée). Sinon elle appartient désormais à
      // l'utilisateur — on la détache seulement. Miroir exact du SQL.
      const untouched =
        !existingChild.completed && existingChild.updatedAt === existingChild.createdAt;
      if (untouched) {
        const childIndex = tasks.findIndex(t => t.id === existingChild.id);
        if (childIndex !== -1) tasks.splice(childIndex, 1);
      } else {
        const childIndex = tasks.findIndex(t => t.id === existingChild.id);
        if (childIndex !== -1) {
          tasks[childIndex] = { ...existingChild, recurrenceParentId: undefined };
        }
      }
    }

    this.saveTasks(tasks);
    return { task: updatedTask, spawned };
  }

  async toggleBookmark(id: string): Promise<Task> {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);

    if (index === -1) {
      throw new Error(`Task with id ${id} not found`);
    }

    const task = tasks[index];
    const updatedTask: Task = {
      ...task,
      bookmarked: !task.bookmarked,
    };
    tasks[index] = updatedTask;
    this.saveTasks(tasks);
    return updatedTask;
  }

  async getPage(params: PaginationParams = {}): Promise<PaginatedResult<Task>> {
    const tasks = this.getTasks();
    const limit = params.limit ?? DEFAULT_PAGE_SIZE;
    // En mode démo, simule la pagination en mémoire
    let startIndex = 0;
    if (params.cursor) {
      const cursorIndex = tasks.findIndex(t => t.id === params.cursor);
      if (cursorIndex !== -1) startIndex = cursorIndex + 1;
    }
    const slice = tasks.slice(startIndex, startIndex + limit + 1);
    const hasMore = slice.length > limit;
    const items = hasMore ? slice.slice(0, limit) : slice;
    return {
      data: items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      nextCursorDate: null,
    };
  }
}
