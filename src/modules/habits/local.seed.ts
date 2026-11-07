// ═══════════════════════════════════════════════════════════════════
// HABITS - Données de démonstration (seed)
// ═══════════════════════════════════════════════════════════════════
//
// Jeu de données seul (V12.3) : aucune lecture ni écriture de stockage ici. Le
// dépôt de démo voisin l'ensemence au premier accès.

import { Habit } from './types';

// Helper pour générer des dates — date LOCALE (en-CA → YYYY-MM-DD), même
// convention que l'UI (HabitCard/HabitTable keyent les complétions en local) ;
// toISOString (UTC) décalait les seeds d'un jour entre minuit et ~2h.
const getDateString = (daysFromNow: number = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toLocaleDateString('en-CA');
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

// Force une série récente avec UN trou couvert par le joker (#23), pour que
// le flocon de gel s'affiche de façon fiable en démo. Coche les `streakLen`
// derniers jours SAUF `gapDaysAgo` (le jour manqué absorbé par le joker).
const withJokerStreak = (habit: Habit, streakLen: number, gapDaysAgo: number): Habit => {
  const completions = { ...habit.completions };
  for (let i = 0; i < streakLen; i++) {
    completions[getDateString(-i)] = i !== gapDaysAgo;
  }
  return { ...habit, completions };
};

// 10 habitudes — 2 par catégorie, historique varié.
// Certaines portent une série récente avec un jour joker (withJokerStreak)
// pour illustrer le « streak freeze » (#23) : flocon de gel visible en démo.
export const DEMO_HABITS: Habit[] = [
  // ── BIEN-ÊTRE MENTAL ──────────────────────────────────────────────────
  withJokerStreak(h('h001','Méditation',  '15 min de pleine conscience',      '#8B5CF6','🧘', 15, -120, 0.87, 42), 12, 3),
  h('h002','Journaling',           'Écrire mes pensées du jour',            '#6366F1','✏️', 10, -110, 0.74, 188),

  // ── SANTÉ PHYSIQUE ────────────────────────────────────────────────────
  withJokerStreak(h('h003','Course à pied','30 min de running',              '#EF4444','🏃', 30, -120, 0.71, 137), 8, 2),
  h('h004','Marche quotidienne',   '8000 pas minimum',                      '#F87171','👟', 45, -110, 0.84, 61),

  // ── ALIMENTATION ─────────────────────────────────────────────────────
  h('h005','Hydratation 2L',       'Boire 2 litres d\'eau par jour',        '#06B6D4','💧',  1, -120, 0.91, 319),
  h('h006','5 fruits & légumes',   'Minimum 5 portions par jour',           '#10B981','🥦',  5, -115, 0.73, 234),

  // ── PRODUCTIVITÉ ─────────────────────────────────────────────────────
  h('h007','Technique Pomodoro',   '4 sessions x 25 min de focus',          '#EF4444','⏱️', 100, -120, 0.82, 101),
  h('h008','Revue agenda matin',   'Planifier la journée en 5 min',         '#6366F1','📅',   5, -110, 0.88, 67),

  // ── APPRENTISSAGE ─────────────────────────────────────────────────────
  withJokerStreak(h('h009','Duolingo','15 min de pratique linguistique',     '#10B981','🌍',  15, -120, 0.84, 251), 10, 4),
  h('h010','Veille technologique', 'Lire Hacker News + Reddit tech',        '#F97316','🔭',  15,  -80, 0.82, 287),
];

// Overlay anglais — cf. src/lib/seed-i18n.ts.
export const DEMO_HABITS_EN: Record<string, Partial<Habit>> = {
  h001: { name: 'Meditation', description: '15 min of mindfulness' },
  h002: { name: 'Journaling', description: "Write down today's thoughts" },
  h003: { name: 'Running', description: '30 min run' },
  h004: { name: 'Daily walk', description: '8000 steps minimum' },
  h005: { name: 'Drink 2L of water', description: '2 liters of water a day' },
  h006: { name: '5 fruits & veggies', description: 'At least 5 servings a day' },
  h007: { name: 'Pomodoro technique', description: '4 sessions of 25 min focus' },
  h008: { name: 'Morning calendar review', description: 'Plan the day in 5 min' },
  h009: { name: 'Duolingo', description: '15 min of language practice' },
  h010: { name: 'Tech watch', description: 'Read Hacker News + tech Reddit' },
};
