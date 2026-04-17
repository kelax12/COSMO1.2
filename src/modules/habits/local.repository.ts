import { IHabitsRepository } from './repository';
import { Habit, CreateHabitInput, UpdateHabitInput } from './types';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';

const STORAGE_KEY = 'cosmo_demo_habits';

// Helper pour générer des dates
const getDateString = (daysFromNow: number = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
};

// Génère un historique de complétion déterministe sur toute une période
const generateCompletions = (daysBack: number, rate: number, seed: number): Record<string, boolean> => {
  const completions: Record<string, boolean> = {};
  for (let i = daysBack; i <= 0; i++) {
    const date = getDateString(i);
    // Hash déterministe basé sur le jour et la graine — pas de Math.random()
    const hash = Math.abs((i * 1664525 + seed * 1013904223 + i * seed * 22695477) % 100);
    completions[date] = hash < rate * 100;
  }
  return completions;
};

// Raccourci pour créer une habitude rapidement
const h = (
  id: string, name: string, description: string,
  color: string, icon: string, estimatedTime: number,
  daysBack: number, rate: number, seed: number,
  frequency: 'daily' | 'weekly' | 'monthly' = 'daily'
): Habit => ({
  id, name, description, frequency, estimatedTime, color, icon,
  completions: generateCompletions(daysBack, rate, seed),
  createdAt: getDateString(daysBack),
});

// 100 habitudes — catégories variées, historique 30-120 jours
const DEMO_HABITS: Habit[] = [
  // ── BIEN-ÊTRE MENTAL (20) ─────────────────────────────────────────────
  h('h001','Méditation',           '15 min de pleine conscience',           '#8B5CF6','🧘', 15, -120, 0.87, 42),
  h('h002','Journaling',           'Écrire mes pensées du jour',            '#6366F1','✏️', 10, -110, 0.74, 188),
  h('h003','Gratitude',            '3 choses positives du jour',            '#EC4899','🙏',  5, -100, 0.83, 91),
  h('h004','Respiration 4-7-8',    '5 min de cohérence cardiaque',          '#A78BFA','🌬️',  5, -95,  0.79, 217),
  h('h005','Visualisation',        '10 min de visualisation positive',      '#7C3AED','💭', 10, -90,  0.68, 334),
  h('h006','Déconnexion digitale', '1h sans écran avant de dormir',         '#4F46E5','📵', 60, -85,  0.62, 451),
  h('h007','Lecture fiction',      '20 pages de roman le soir',             '#818CF8','📖', 25, -80,  0.77, 129),
  h('h008','Nature walk',          '15 min de marche en plein air',         '#34D399','🌿', 15, -75,  0.71, 267),
  h('h009','Bilan de journée',     '5 min de réflexion avant de dormir',    '#6D28D9','🌙',  5, -70,  0.85, 83),
  h('h010','No social media matin','Pas de réseaux sociaux avant 9h',       '#7C3AED','🚫', 60, -65,  0.58, 502),
  h('h011','Affirmations',         '5 affirmations positives le matin',     '#C084FC','🌟',  5, -60,  0.81, 164),
  h('h012','Temps calme',          '20 min de silence intentionnel',        '#A855F7','🔇', 20, -55,  0.73, 293),
  h('h013','Lecture développement','20 min de lecture non-fiction',         '#9333EA','📚', 20, -50,  0.80, 77),
  h('h014','Cold shower',          'Douche froide 30 secondes',             '#60A5FA','🚿', 10, -45,  0.55, 618),
  h('h015','Cohérence cardiaque',  '3x5 min de respiration guidée',         '#8B5CF6','💓', 15, -42,  0.76, 341),
  h('h016','Body scan',            '10 min de scan corporel conscient',     '#7C3AED','🧠', 10, -38,  0.69, 455),
  h('h017','Temps créatif',        '15 min de dessin / musique / écriture', '#A78BFA','🎨', 15, -35,  0.64, 172),
  h('h018','Yoga du matin',        '10 min de yoga au réveil',              '#6366F1','🧘', 10, -30,  0.78, 98),
  h('h019','Screen time < 3h',     'Maximum 3h d\'écran personnel',         '#4F46E5','📱',  1, -25,  0.61, 539),
  h('h020','Écriture créative',    '15 min d\'écriture libre',              '#818CF8','🖊️', 15, -20,  0.72, 223),

  // ── SANTÉ PHYSIQUE (20) ───────────────────────────────────────────────
  h('h021','Course à pied',        '30 min de running',                     '#EF4444','🏃', 30, -120, 0.71, 137),
  h('h022','Gainage / abdos',      '10 min de renforcement core',           '#DC2626','💪', 10, -115, 0.75, 284),
  h('h023','Marche quotidienne',   '8000 pas minimum',                      '#F87171','👟', 45, -110, 0.84, 61),
  h('h024','Étirements',           '15 min de stretching',                  '#FCA5A5','🤸', 15, -105, 0.78, 195),
  h('h025','Natation',             'Séance piscine — 30 min',               '#3B82F6','🏊', 45, -100, 0.55, 408),
  h('h026','Vélo',                 'Sortie cyclisme — 1h',                  '#F97316','🚴', 60, -95,  0.52, 521),
  h('h027','Workout maison',       'Programme HIIT 20 min',                 '#EF4444','🏋️', 20, -90,  0.67, 176),
  h('h028','Flexibilité épaules',  '5 min mobilité articulaire',            '#DC2626','💆',  5, -85,  0.81, 89),
  h('h029','Planche (Plank)',       '3 séries x 1 minute',                  '#B91C1C','🦾',  5, -80,  0.74, 317),
  h('h030','Tennis / Badminton',   'Match ou entraînement hebdo',           '#F59E0B','🎾', 60, -75,  0.45, 632,'weekly'),
  h('h031','Montée escaliers',     'Pas d\'ascenseur au bureau',            '#EF4444','🏢',  5, -70,  0.88, 43),
  h('h032','Repos actif',          'Promenade légère jour de repos',        '#FCA5A5','🌸', 30, -65,  0.72, 256),
  h('h033','Musculation',          'Séance salle de sport',                 '#DC2626','🏋️', 60, -60,  0.62, 387),
  h('h034','Saut à la corde',      '200 sauts le matin',                    '#EF4444','⚡', 10, -55,  0.69, 148),
  h('h035','Posture bureau',       'Check toutes les 2h au bureau',         '#F87171','🪑',  1, -50,  0.76, 473),
  h('h036','Step quotidien',       '15 min de step box',                    '#DC2626','📦', 15, -45,  0.58, 591),
  h('h037','Pompes',               '3 séries x 20 pompes',                  '#B91C1C','💪', 10, -40,  0.73, 214),
  h('h038','Squat challenge',      '50 squats par jour',                    '#EF4444','🦵', 10, -35,  0.71, 329),
  h('h039','Récupération active',  'Foam roller + auto-massage 10 min',     '#FCA5A5','🎯', 10, -30,  0.79, 106),
  h('h040','Cardio elliptique',    '20 min d\'elliptique',                  '#DC2626','🔄', 20, -25,  0.64, 448),

  // ── ALIMENTATION & HYGIÈNE (20) ──────────────────────────────────────
  h('h041','Hydratation 2L',       'Boire 2 litres d\'eau par jour',        '#06B6D4','💧',  1, -120, 0.91, 319),
  h('h042','5 fruits & légumes',   'Minimum 5 portions par jour',           '#10B981','🥦',  5, -115, 0.73, 234),
  h('h043','Petit-déjeuner sain',  'Petit-déj complet sans sucre raffiné', '#22C55E','🍳',  5, -110, 0.82, 147),
  h('h044','Pas de gluten le soir','Dîner sans gluten',                     '#84CC16','🌾',  1, -105, 0.61, 512),
  h('h045','Café max 2 tasses',    'Limiter la caféine',                    '#78350F','☕',  1, -100, 0.77, 83),
  h('h046','Dîner avant 20h',      'Pas de repas tardif',                   '#16A34A','🍽️',  1, -95,  0.68, 396),
  h('h047','Pas d\'alcool',        'Journée sans alcool',                   '#15803D','🚫', 1,  -90,  0.85, 54),
  h('h048','Smoothie matinal',     'Fruits + légumes + protéines',          '#4ADE80','🥤', 10, -85,  0.71, 271),
  h('h049','Cuisine maison',       'Préparer son propre repas',             '#22C55E','👨‍🍳', 30, -80,  0.78, 188),
  h('h050','Jeûne intermittent',   '16:8 — fenêtre alimentaire 12h-20h',   '#10B981','⏰',  1, -75,  0.64, 433),
  h('h051','Protéines chaque repas','Vérifier apport protéique',            '#86EFAC','🥩',  1, -70,  0.79, 117),
  h('h052','Probiotiques',         'Yaourt ou supplément prébiotique',      '#4ADE80','🦠',  5, -65,  0.88, 302),
  h('h053','Sucre < 25g',          'Limiter sucre ajouté par jour',         '#22C55E','🍬',  1, -60,  0.62, 577),
  h('h054','Oméga-3',              'Poisson gras ou supplément',            '#06B6D4','🐟',  5, -55,  0.81, 93),
  h('h055','Assiette colorée',     '3 couleurs différentes par repas',      '#10B981','🌈',  1, -50,  0.75, 248),
  h('h056','Pas de grignotage',    'Manger uniquement aux repas',           '#16A34A','🙅',  1, -45,  0.67, 461),
  h('h057','Complément Vit D',     'Supplémentation quotidienne',           '#FDE047','☀️',  2, -40,  0.92, 35),
  h('h058','Thé vert',             '1 tasse de thé vert par jour',          '#34D399','🍵',  5, -35,  0.84, 174),
  h('h059','Repas en pleine conscience','Manger sans distraction',          '#4ADE80','🧘', 30, -30,  0.61, 529),
  h('h060','Curcuma quotidien',    'Anti-inflammatoire naturel',            '#FBBF24','🌿',  2, -25,  0.77, 88),

  // ── PRODUCTIVITÉ (20) ─────────────────────────────────────────────────
  h('h061','Technique Pomodoro',   '4 sessions x 25 min de focus',         '#EF4444','⏱️', 100, -120, 0.82, 101),
  h('h062','Inbox zéro',           'Traiter tous les emails',               '#3B82F6','📧',  15, -115, 0.71, 205),
  h('h063','Revue agenda matin',   'Planifier la journée en 5 min',         '#6366F1','📅',   5, -110, 0.88, 67),
  h('h064','MIT — 3 tâches',       'Identifier les 3 tâches importantes',  '#8B5CF6','🎯',   5, -105, 0.84, 183),
  h('h065','Revue hebdomadaire',   'Bilan + planification de la semaine',  '#4F46E5','📋',  30,  -100, 0.79, 314,'weekly'),
  h('h066','No meeting morning',   'Bloquer les matins pour deep work',    '#6366F1','🚫',   1,  -95, 0.65, 442),
  h('h067','Time blocking',        'Planifier les blocs de temps',         '#3B82F6','⏰',  10,  -90, 0.77, 159),
  h('h068','Fin de journée ritual','Clore les tâches + noter le lendemain','#4F46E5','✅',  10,  -85, 0.81, 276),
  h('h069','1 tâche difficile/matin','Commencer par la plus dure',         '#EF4444','🔥',   5,  -80, 0.72, 393),
  h('h070','Revue notes Obsidian', 'Relire et lier les notes du jour',      '#6366F1','🗒️', 10,  -75, 0.68, 517),
  h('h071','Clavier raccourcis',   'Utiliser raccourcis IDE + OS',          '#3B82F6','⌨️',   1,  -70, 0.75, 134),
  h('h072','Automatiser 1 chose',  'Identifier + automatiser une tâche',   '#8B5CF6','🤖',  20,  -65, 0.48, 658,'weekly'),
  h('h073','Lecture technique',    '20 min de doc ou article tech',         '#6366F1','💻',  20,  -60, 0.74, 241),
  h('h074','Revue GitHub',         'PRs + issues + discussions',            '#4F46E5','💾',  15,  -55, 0.79, 358),
  h('h075','No email avant 10h',   'Travailler 2h avant les emails',        '#3B82F6','📵',   1,  -50, 0.63, 475),
  h('h076','Retrospective perso',  'Qu\'ai-je appris cette semaine ?',     '#8B5CF6','🔍',  15,  -45, 0.71, 192,'weekly'),
  h('h077','1 commit/jour',        'Au moins un commit par jour',           '#6366F1','🔄',   5,  -40, 0.76, 309),
  h('h078','Clean code review',    'Vérifier lisibilité avant chaque PR',   '#4F46E5','🧹',  10,  -35, 0.82, 126),
  h('h079','Side project 30 min',  '30 min sur projet personnel',           '#3B82F6','🚀',  30,  -30, 0.61, 543),
  h('h080','Clore les tabs',       'Fermer les onglets non utilisés',       '#6366F1','🌐',   2,  -25, 0.78, 87),

  // ── APPRENTISSAGE & CROISSANCE (20) ──────────────────────────────────
  h('h081','Duolingo',             '15 min de pratique linguistique',       '#10B981','🌍',  15, -120, 0.84, 251),
  h('h082','Podcast tech',         '20 min de podcast en déplacement',      '#F97316','🎙️', 20, -115, 0.77, 368),
  h('h083','Cours en ligne',       '30 min de formation Coursera/Udemy',   '#3B82F6','🎓',  30, -110, 0.71, 485),
  h('h084','Flashcards Anki',      '10 min de révision espacée',            '#8B5CF6','🃏',  10, -105, 0.80, 102),
  h('h085','Newsletter tech',      'Lire 1 newsletter spécialisée',         '#6366F1','📰',  10, -100, 0.85, 219),
  h('h086','Tutoriel YouTube',     '15 min de tutoriel technique',          '#EF4444','▶️',  15,  -95, 0.66, 336),
  h('h087','Projet open source',   'Contribution ou exploration OSS',       '#10B981','🐙',  30,  -90, 0.45, 553,'weekly'),
  h('h088','Anglais professionnel','10 min de pratique écrite/orale',       '#3B82F6','🇬🇧',  10,  -85, 0.74, 170),
  h('h089','Veille technologique', 'Lire Hacker News + Reddit tech',        '#F97316','🔭',  15,  -80, 0.82, 287),
  h('h090','Mind mapping',         'Visualiser un concept appris',          '#8B5CF6','🗺️',  15,  -75, 0.62, 404),
  h('h091','Enseigner une chose',  'Expliquer ce que j\'ai appris',         '#10B981','👩‍🏫',  10,  -70, 0.55, 521),
  h('h092','Résoudre algo',        '1 exercice LeetCode / HackerRank',      '#6366F1','🧩',  20,  -65, 0.68, 138),
  h('h093','Revoir mes notes',     'Relire les notes de la semaine',        '#8B5CF6','📓',  10,  -60, 0.77, 255),
  h('h094','Livre audio',          '20 min d\'audiobook en déplacement',    '#F97316','🎧',  20,  -55, 0.80, 372),
  h('h095','Curiosité quotidienne','Apprendre 1 fait nouveau',              '#10B981','🤔',   5,  -50, 0.88, 89),
  h('h096','Écriture technique',   'Rédiger article ou doc 15 min',         '#3B82F6','📝',  15,  -45, 0.54, 506,'weekly'),
  h('h097','Revue livres lus',     'Revoir le résumé d\'un ancien livre',   '#8B5CF6','📚',  10,  -40, 0.71, 223),
  h('h098','Chat GPT exploratoire','Expérimenter avec l\'IA 10 min',        '#10B981','🤖',  10,  -35, 0.79, 340),
  h('h099','Mentorat / Pair prog', '1 session de peer learning',            '#6366F1','👥',  60,  -30, 0.42, 557,'weekly'),
  h('h100','Portfolio update',     'Mettre à jour portfolio / GitHub',      '#F97316','🌐',  20,  -25, 0.65, 174,'weekly'),
];

export class LocalStorageHabitsRepository implements IHabitsRepository {
  private getHabits(): Habit[] {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      this.saveHabits(DEMO_HABITS);
      return DEMO_HABITS;
    }
    return JSON.parse(data);
  }

  private saveHabits(habits: Habit[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  }

  async fetchHabits(): Promise<Habit[]> {
    return this.getHabits();
  }

  async getById(id: string): Promise<Habit | null> {
    const habits = this.getHabits();
    const habit = habits.find(h => h.id === id);
    return habit || null;
  }

  async createHabit(input: CreateHabitInput): Promise<Habit> {
    const habits = this.getHabits();
    const newHabit: Habit = {
      ...input,
      id: crypto.randomUUID(),
      completions: input.completions || {},
      createdAt: new Date().toISOString(),
    };
    this.saveHabits([newHabit, ...habits]);
    return newHabit;
  }

  async updateHabit(id: string, updates: UpdateHabitInput): Promise<Habit> {
    const habits = this.getHabits();
    const index = habits.findIndex(h => h.id === id);
    if (index === -1) throw new Error('Habit not found');

    const updatedHabit = { ...habits[index], ...updates };
    habits[index] = updatedHabit;
    this.saveHabits(habits);
    return updatedHabit;
  }

  async deleteHabit(id: string): Promise<void> {
    const habits = this.getHabits();
    const filteredHabits = habits.filter(h => h.id !== id);
    this.saveHabits(filteredHabits);
  }

  async toggleCompletion(id: string, date: string): Promise<Habit> {
    const habits = this.getHabits();
    const index = habits.findIndex(h => h.id === id);
    if (index === -1) throw new Error('Habit not found');

    const habit = habits[index];
    const completions = { ...habit.completions };
    completions[date] = !completions[date];

    const updatedHabit = { ...habit, completions };
    habits[index] = updatedHabit;
    this.saveHabits(habits);
    return updatedHabit;
  }

  async getPage(params: PaginationParams = {}): Promise<PaginatedResult<Habit>> {
    const habits = this.getHabits();
    const limit = params.limit ?? DEFAULT_PAGE_SIZE;
    let startIndex = 0;
    if (params.cursor) {
      const cursorIndex = habits.findIndex(h => h.id === params.cursor);
      if (cursorIndex !== -1) startIndex = cursorIndex + 1;
    }
    const slice = habits.slice(startIndex, startIndex + limit + 1);
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
