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

// 100 tâches — réparties sur 12 mois, catégories variées
const DEMO_TASKS: Task[] = [
  // ── TRAVAIL (cat-1) — 25 tâches ──────────────────────────────────────
  t('t001','Bilan Q1 2025',                        'Rapport trimestriel direction',             5,'cat-1',-365,-358,-360),
  t('t002','Former équipe sur Jira',               'Workshop sprints + épics',                  3,'cat-1',-355,-347,-349),
  t('t003','Rapport mensuel mai 2025',             'KPIs + activité équipe',                    4,'cat-1',-330,-323,-325),
  t('t004','Préparer entretiens annuels',          'Grilles évaluation + objectifs',            4,'cat-1',-318,-308,-310),
  t('t005','Négociation contrat fournisseur',      'AWS reserved instances',                    4,'cat-1',-305,-295,-297),
  t('t006','Rapport mensuel juin 2025',            'KPIs + activité équipe',                    4,'cat-1',-295,-288,-290),
  t('t007','Présentation résultats S1',            'Board meeting direction',                   5,'cat-1',-278,-270,-272),
  t('t008','Rapport mensuel juillet 2025',         'KPIs + activité équipe',                    4,'cat-1',-262,-255,-257),
  t('t009','Onboarding Thomas — dev back-end',     'Setup + pair programming',                  3,'cat-1',-252,-240,-242),
  t('t010','Audit processus internes',             'Lean + identification gaspillages',         4,'cat-1',-238,-225,-227),
  t('t011','Rapport mensuel août 2025',            'KPIs + activité équipe',                    4,'cat-1',-228,-221,-223),
  t('t012','Préparer team building Q3',            'Escape room + dîner équipe',                3,'cat-1',-218,-205,-207),
  t('t013','Rapport mensuel septembre',            'KPIs + activité équipe',                    4,'cat-1',-198,-191,-193),
  t('t014','Présentation roadmap Q4 2025',         'Planification oct-déc',                     5,'cat-1',-185,-177,-179),
  t('t015','Recrutement lead designer',            'Entretiens + décision finale',              4,'cat-1',-175,-158,-160),
  t('t016','Rapport mensuel octobre',              'KPIs + activité équipe',                    4,'cat-1',-165,-158,-160),
  t('t017','Rapport mensuel novembre',             'KPIs + activité équipe',                    4,'cat-1',-132,-125,-127),
  t('t018','Bilan annuel 2025',                    'Revue complète + plan 2026',                5,'cat-1',-105,-97, -99, true, 120),
  t('t019','Rapport mensuel décembre',             'KPIs + activité équipe',                    4,'cat-1',-98, -91, -93),
  t('t020','Rapport mensuel janvier 2026',         'KPIs + activité équipe',                    4,'cat-1',-68, -61, -63),
  t('t021','Sprint planning février',              'User stories + estimations poker',          3,'cat-1',-58, -50, -52),
  t('t022','Rapport mensuel février 2026',         'KPIs + activité équipe',                    4,'cat-1',-38, -31, -33),
  t('t023','Rapport mensuel mars 2026',            'KPIs + activité équipe',                    4,'cat-1',-10, -3,  -5),
  t('t024','Préparer présentation Q1 2026',        'Résultats 3 mois + projections',            5,'cat-1',-5,   3,  null, true, 90),
  t('t025','Code review PR #187',                  'Nouvelles fonctionnalités module paiement', 4,'cat-1',-1,   1,  null, false, 45, true, ['friend-2']),

  // ── PROJETS (cat-5) — 20 tâches ──────────────────────────────────────
  t('t026','Configurer CI/CD pipeline',            'GitHub Actions + tests auto',               5,'cat-5',-362,-345,-348),
  t('t027','Implémenter système d\'auth',          'JWT + refresh tokens + OAuth',              5,'cat-5',-348,-320,-323),
  t('t028','Refactoriser module paiement',         'Stripe v3 migration + webhooks',            5,'cat-5',-332,-310,-313),
  t('t029','Migration PostgreSQL → v15',           'Mise à jour base + optimisation',           4,'cat-5',-315,-295,-298),
  t('t030','API REST v2 — pagination + filtres',   'CRUD complet + rate limiting',              5,'cat-5',-298,-272,-275),
  t('t031','Déployer infrastructure AWS',          'EC2, RDS, S3, CloudFront + CDN',            4,'cat-5',-282,-258,-261),
  t('t032','Déployer v1.0 en production 🚀',       'Premier release public',                    5,'cat-5',-252,-228,-230),
  t('t033','Optimiser requêtes SQL',               'Index + explain analyze + cache',           4,'cat-5',-238,-215,-218),
  t('t034','Implémenter dark mode',                'Tailwind + préférences système',            3,'cat-5',-218,-198,-200),
  t('t035','Refactoriser système de cache',        'Redis + TTL + invalidation',                4,'cat-5',-202,-182,-185),
  t('t036','Implémenter webhooks clients',         'Notifications temps réel',                  4,'cat-5',-188,-168,-170),
  t('t037','Migration React 18',                   'Concurrent features + Suspense',            5,'cat-5',-172,-150,-153),
  t('t038','Déployer v2.0 🚀',                     'Release majeure — analytics + offline',     5,'cat-5',-122,-100,-103),
  t('t039','Implémenter offline mode',             'Service Workers + sync background',         4,'cat-5',-108,-88, -91),
  t('t040','Refacto permissions RBAC',             'Rôles + audit logs + policies',             4,'cat-5',-88, -68, -71),
  t('t041','Rate limiting API',                    'Protection + quotas par client',            4,'cat-5',-72, -52, -55),
  t('t042','Export données RGPD',                  'DSAR + droit à l\'effacement',              5,'cat-5',-45, -28, -31),
  t('t043','Optimiser bundle JS',                  'Tree-shaking + code splitting + lazy',      4,'cat-5',-28, -12, -15),
  t('t044','Audit sécurité Q1 2026',               'Pentest + correctifs CVE',                  5,'cat-5',-12,  5,  null),
  t('t045','Mettre à jour dépendances npm',        'Màj majeure + breaking changes',            3,'cat-5',-3,   4,  null, false, 60),

  // ── APPRENTISSAGE (cat-4) — 20 tâches ────────────────────────────────
  t('t046','Lire "Clean Architecture"',            'Uncle Bob — notes de lecture',              3,'cat-4',-360,-335,-338, true, 600),
  t('t047','Cours CSS Grid avancé',                'Layout complexes + responsive design',      3,'cat-4',-345,-318,-320, false, 180),
  t('t048','Formation communication assertive',    'Atelier 1 journée — prise de parole',       3,'cat-4',-328,-308,-310),
  t('t049','Lire "Staff Engineer"',                'Will Larson — career growth tech',          3,'cat-4',-312,-285,-288, true, 480),
  t('t050','Cours Docker + Kubernetes',            'Conteneurisation + orchestration',          4,'cat-4',-295,-268,-270),
  t('t051','Lire "Designing Data-Intensive Apps"', 'Kleppmann — architecture data',             4,'cat-4',-278,-245,-248, true, 900),
  t('t052','Formation gestion de projet',          'PMP prep + agile avancé',                   4,'cat-4',-258,-230,-233),
  t('t053','Lire "The Manager\'s Path"',           'Camille Fournier — eng management',         3,'cat-4',-242,-215,-218, true, 600),
  t('t054','Cours GraphQL',                        'Apollo + subscriptions + directives',       4,'cat-4',-222,-198,-200),
  t('t055','Lire "A Philosophy of SW Design"',     'Ousterhout — deep modules',                 3,'cat-4',-205,-178,-180, true, 420),
  t('t056','Formation React Server Components',    'Next.js 15 + RSC patterns',                 4,'cat-4',-185,-160,-163),
  t('t057','Lire "High Output Management"',        'Andy Grove — engineering leadership',       3,'cat-4',-162,-135,-138, true, 480),
  t('t058','Cours Rust — fondamentaux',            'Ownership, lifetimes, traits',              3,'cat-4',-142,-112,-115),
  t('t059','Workshop design thinking',             '2 jours avec l\'équipe produit',            3,'cat-4',-128,-108,-110),
  t('t060','Formation product management',         'OKRs + user stories + métriques',           4,'cat-4',-108,-85, -88),
  t('t061','Lire "Domain-Driven Design"',          'Eric Evans — patterns DDD',                 4,'cat-4',-88, -58, -61, true, 720),
  t('t062','Cours machine learning — bases',       'Régression, classification, clustering',    3,'cat-4',-68, -40, -43),
  t('t063','Formation sécurité OWASP',             'Top 10 + audit + correctifs',               4,'cat-4',-48, -25, -28),
  t('t064','Lire "Accelerate"',                    'Forsgren — DevOps metrics DORA',            3,'cat-4',-28, -5,  -8, true, 360),
  t('t065','Cours deep learning Coursera',         'Réseaux neuronaux + CNN + RNN',             3,'cat-4',-10,  50, null, false, 2400),

  // ── PERSONNEL (cat-2) — 20 tâches ────────────────────────────────────
  t('t066','Planifier vacances été 2025',          'Vols + hôtel + activités',                  2,'cat-2',-355,-330,-333),
  t('t067','Restructurer finances perso',          'Budget mensuel + épargne + PEA',            3,'cat-2',-338,-315,-318),
  t('t068','Réserver billet concert',              'Soirée détente avec amis',                  1,'cat-2',-322,-305,-308),
  t('t069','Renouveler passeport',                 'Dossier + photos + rdv préfecture',         3,'cat-2',-308,-278,-280),
  t('t070','Mettre à jour CV et LinkedIn',         'Nouvelles compétences 2025',                2,'cat-2',-292,-268,-270),
  t('t071','Planifier anniversaire maman',         'Restaurant + cadeau surprise',              2,'cat-2',-278,-255,-258),
  t('t072','Bilan mi-année personnel',             'OKRs + habitudes + bilan financier',        3,'cat-2',-258,-238,-240),
  t('t073','Préparer déménagement',                'Cartons + déménageurs + démarches',         4,'cat-2',-238,-215,-218),
  t('t074','Organiser repas famille',              'Anniversaire + invitations',                2,'cat-2',-218,-200,-202),
  t('t075','Décorer appartement automne',          'Achats déco + rangement',                   1,'cat-2',-198,-182,-184),
  t('t076','Achats cadeaux Noël',                  'Liste + budget + livraison',                2,'cat-2',-178,-158,-160),
  t('t077','Déclarer impôts revenus 2024',         'Documents + vérifications + envoi',         4,'cat-2',-158,-138,-140),
  t('t078','Bilan annuel personnel 2025',          'Revue OKRs + projets + habitudes',          3,'cat-2',-118,-102,-104),
  t('t079','Déclaration revenus micro-ent.',       'URSSAF + cotisations fév',                  4,'cat-2',-75, -58, -60),
  t('t080','Mettre à jour plan épargne',           'PEA + livret A + assurance-vie',            3,'cat-2',-55, -38, -40),
  t('t081','Organiser week-end camping',           'Matériel + réservation + itinéraire',       2,'cat-2',-38, -20, -22),
  t('t082','Renouveler abonnements annuels',       'Streaming + outils + gym',                  2,'cat-2',-22, -10, -12),
  t('t083','Préparer dossier crédit immobilier',   'Documents + simulation + banques',          5,'cat-2',-15,  10, null),
  t('t084','Planifier vacances été 2026',          'Destination + vols + hébergement',          2,'cat-2',-5,   30, null),
  t('t085','Chercher nouvel appartement',          'Critères + visites + budget max',           4,'cat-2',-2,   14, null, false, 120),

  // ── SANTÉ (cat-3) — 15 tâches ────────────────────────────────────────
  t('t086','Inscription salle de sport',           'Abonnement + programme entraînement',       2,'cat-3',-358,-340,-342),
  t('t087','Bilan médecin annuel 2025',            'Check-up complet + bilan sanguin',          2,'cat-3',-342,-325,-327),
  t('t088','Rendez-vous nutritionniste',           'Bilan alimentaire + plan personnalisé',     3,'cat-3',-322,-305,-307),
  t('t089','Séances kiné — programme dos',         'Douleurs chroniques + prévention',          3,'cat-3',-298,-265,-268),
  t('t090','Programme course à pied 10km',         'Préparation course novembre 2025',          3,'cat-3',-255,-195,-197),
  t('t091','Visite ophtalmologue',                 'Contrôle + nouvelles lunettes',             2,'cat-3',-238,-218,-220),
  t('t092','Dentiste — contrôle annuel',           'Nettoyage + détartrage + radio',            2,'cat-3',-218,-200,-202),
  t('t093','Course 10km Paris — participation',    'Inscription + dernier entraînement',        3,'cat-3',-178,-155,-157),
  t('t094','Inscription semi-marathon mars 26',    'Programme préparation 3 mois',              3,'cat-3',-135,-105,-108),
  t('t095','Rendez-vous ostéopathe',               'Douleurs dorsales récurrentes',             3,'cat-3',-98, -80, -82),
  t('t096','Bilan médecin semestriel',             'Suivi + analyses de sang',                  2,'cat-3',-75, -58, -60),
  t('t097','Semi-marathon — longue sortie',        'Dernier entraînement avant course',         3,'cat-3',-28, -15, -17),
  t('t098','Rendez-vous médecin annuel 2026',      'Check-up + vaccins + renouvellements',      2,'cat-3',-5,   7,  null),
  t('t099','Programme stretching quotidien',       'Mobilité + récupération post-sport',        2,'cat-3',-2,   3,  null, false, 20),
  t('t100','Bilan nutritionnel Q1 2026',           'Revue alimentation + ajustements',          3,'cat-3',-1,   5,  null),
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
