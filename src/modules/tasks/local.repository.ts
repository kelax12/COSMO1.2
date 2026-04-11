import { ITasksRepository } from './repository';
import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from './types';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';
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
  isCollaborative = false, collaborators: string[] = []
): Task => ({
  id, name, description, priority, category,
  deadline: getDate(deadlineDays),
  estimatedTime,
  createdAt: getDate(createdDays),
  bookmarked,
  completed: completedDays !== null,
  completedAt: completedDays !== null ? getDate(completedDays) : undefined,
  isCollaborative,
  collaborators,
  pendingInvites: [],
});

// Données de démonstration — 14 mois d'historique
const DEMO_TASKS: Task[] = [
  // ── TÂCHES ACTUELLES / EN COURS ──────────────────────────────────────
  t('task-1', 'Finaliser le rapport mensuel',       'Rapport Q1 2026 pour la direction',        5, 'cat-1', -2,   1,    null, true, 120),
  t('task-2', 'Préparer la présentation client',    'Présentation pour le client XYZ',          4, 'cat-1', -1,   3,    null, false, 90, true, ['friend-1']),
  t('task-3', 'Réviser les cours de React',         'Hooks avancés et Context API',             3, 'cat-4', -3,   5,    null, true, 60),
  t('task-4', 'Rendez-vous médecin',                'Bilan annuel',                             2, 'cat-3', -5,   0,    0, false, 45),
  t('task-5', 'Planifier les vacances',             'Réserver hôtel et billets',                2, 'cat-2', -7,   14,   null, false, 30),
  t('task-6', 'Code review PR #42',                 'Review des nouvelles fonctionnalités',     4, 'cat-1', -1,   0,    null, false, 45, true, ['friend-2']),
  t('task-7', 'Répondre aux emails',                'Emails en attente depuis lundi',           3, 'cat-1', -2,   0,    null, false, 30),
  t('task-50','Cours machine learning Coursera',    'Deep learning spécialisation — en cours',  3, 'cat-4', -90,  60,   null, false, 3600),
  t('task-51','Préparer DevFest 2026',              'CFP soumis, préparation du talk',          4, 'cat-1', -45,  60,   null, false, 300),

  // ── IL Y A PLUS D'UN AN (>365 jours) ─────────────────────────────────
  t('task-8', 'Lancement du projet COSMO',          'Kickoff officiel du projet',               5, 'cat-5', -430, -410, -415, false, 180),
  t('task-9', 'Analyse des besoins utilisateurs',   'Interviews UX + personas',                 4, 'cat-1', -420, -400, -405, false, 120),
  t('task-10','Bilan annuel 2024',                  'Revue complète de l\'année écoulée',       5, 'cat-1', -415, -395, -398, false, 90),
  t('task-11','Formation TypeScript avancé',        'Generics, decorators, types conditionnels',4, 'cat-4', -410, -385, -390, false, 240),
  t('task-12','Renouveler abonnements logiciels',   'GitHub, Figma, Notion, Linear',            3, 'cat-1', -408, -395, -396, false, 30),
  t('task-13','Restructurer l\'espace de travail',  'Nouveau bureau standing + écran',          2, 'cat-2', -400, -380, -383, false, 120),
  t('task-19','Refactoriser architecture legacy',   'Migration vers clean architecture',        5, 'cat-5', -375, -340, -343, false, 480),

  // ── IL Y A 10-12 MOIS ────────────────────────────────────────────────
  t('task-14','Implémenter système d\'auth',        'JWT, refresh tokens, OAuth Google',        5, 'cat-5', -368, -340, -344, false, 300),
  t('task-15','Préparer DevFest 2025',              'Talk sur React architecture',              4, 'cat-1', -360, -330, -333, false, 180),
  t('task-16','Lire "The Pragmatic Programmer"',    'Notes de lecture incluses',               3, 'cat-4', -355, -320, -322, true, 600),
  t('task-17','Mise à jour politique de sécurité',  'RGPD et conformité ISO 27001',            4, 'cat-1', -348, -315, -318, false, 90),
  t('task-18','Inscription programme fitness',      'Abonnement salle + programme 3 mois',     2, 'cat-3', -340, -325, -327, false, 30),

  // ── IL Y A 8-10 MOIS ─────────────────────────────────────────────────
  t('task-20','Développer API REST v2',             'Endpoints CRUD + pagination + filtres',   5, 'cat-5', -298, -270, -273, false, 360),
  t('task-21','Préparer présentation investisseurs','Pitch deck + métriques de croissance',    5, 'cat-1', -292, -268, -270, false, 240),
  t('task-22','Lire "Atomic Habits"',               'Résumé exécutif + plan d\'action',        3, 'cat-4', -285, -258, -260, true, 480),
  t('task-23','Bilan mi-année',                     'Revue OKRs + ajustements stratégiques',   3, 'cat-2', -280, -255, -258, false, 60),
  t('task-24','Déployer infrastructure cloud AWS',  'EC2, RDS, S3, CloudFront + CDN',          4, 'cat-5', -275, -248, -251, false, 300),
  t('task-25','Formation SQL avancé',               'Window functions, CTEs, optimisation',    4, 'cat-4', -270, -245, -248, false, 180),

  // ── IL Y A 6-8 MOIS ──────────────────────────────────────────────────
  t('task-26','Déployer v1.0 en production',        'Premier déploiement public 🚀',           5, 'cat-5', -236, -212, -214, false, 120),
  t('task-27','Optimiser requêtes base de données', 'Index, explain analyze, query plan',      4, 'cat-5', -228, -204, -207, false, 180),
  t('task-28','Rapport Q3 2025',                    'Bilan trimestriel complet',               5, 'cat-1', -222, -200, -202, false, 90),
  t('task-29','Formation leadership',               'Communication et gestion d\'équipe',      3, 'cat-4', -218, -195, -198, false, 360),
  t('task-30','Visite dentiste',                    'Détartrage + bilan',                      2, 'cat-3', -214, -200, -201, false, 60),
  t('task-31','Analyser métriques v1.0',            'Mixpanel + Google Analytics setup',       4, 'cat-1', -208, -185, -188, false, 120),
  t('task-32','Implémenter dark mode',              'Tailwind CSS + préférences système',      3, 'cat-5', -204, -182, -185, false, 90),

  // ── IL Y A 4-6 MOIS ──────────────────────────────────────────────────
  t('task-33','Migration React 18',                 'Concurrent features + Suspense',          5, 'cat-5', -177, -155, -158, false, 240),
  t('task-34','Configurer monitoring et alertes',   'Sentry + Datadog dashboards',             4, 'cat-5', -168, -148, -151, false, 120),
  t('task-35','Workshop design thinking',           '2 jours avec l\'équipe produit',          3, 'cat-4', -162, -140, -142, false, 900),
  t('task-36','Planifier team building Q4',         'Escape room + dîner d\'équipe',           3, 'cat-1', -155, -138, -140, false, 60),
  t('task-37','Préparer les objectifs 2026',        'OKRs stratégiques annuels',               5, 'cat-1', -148, -125, -128, true, 120),
  t('task-38','Bilan Q4 2025',                      'Revue annuelle + présentation direction', 5, 'cat-1', -134, -120, -123, false, 90),
  t('task-39','Mettre à jour la documentation',     'README, API docs, guides contributeurs',  3, 'cat-5', -145, -130, -132, false, 180),

  // ── IL Y A 1-4 MOIS ──────────────────────────────────────────────────
  t('task-40','Implémenter notifications push',     'Service Worker + Firebase FCM',           4, 'cat-5', -119, -100, -103, false, 180),
  t('task-41','Formation sécurité web OWASP',       'Top 10 vulnérabilités + audit',           4, 'cat-4', -112, -90,  -92,  false, 300),
  t('task-42','Révision architecture microservices','Event sourcing + CQRS pattern',           5, 'cat-5', -105, -85,  -88,  false, 240),
  t('task-43','Bilan mensuel janvier 2026',         'KPIs + revue de performance équipe',      3, 'cat-1', -95,  -80,  -82,  false, 60),
  t('task-44','Sprint planning Mars 2026',          'User stories + estimations poker',        3, 'cat-1', -72,  -62,  -65,  false, 90),
  t('task-45','Déployer la v2.0',                   'Nouvelles fonctionnalités majeures',      5, 'cat-5', -68,  -52,  -55,  false, 120),
  t('task-46','Code review équipe back-end',        '15 PRs à reviewer cette semaine',         4, 'cat-1', -52,  -42,  -45,  false, 120),
  t('task-47','Mise à jour roadmap produit',        'Q2 2026 + vision 18 mois',               4, 'cat-5', -40,  -28,  -30,  false, 90),
  t('task-48','Bilan mars 2026',                    'Performance + OKRs trimestriels',         3, 'cat-1', -30,  -18,  -20,  false, 60),
  t('task-49','Onboarding nouveau développeur',     'Guide setup + pair programming',          3, 'cat-1', -22,  -12,  -14,  false, 120),
];

export class LocalStorageTasksRepository implements ITasksRepository {
  private getTasks(): Task[] {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      this.saveTasks(DEMO_TASKS);
      return DEMO_TASKS;
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
      collaborators: input.collaborators ?? [],
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

  async toggleComplete(id: string): Promise<Task> {
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
    this.saveTasks(tasks);
    return updatedTask;
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
