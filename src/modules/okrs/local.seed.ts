// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Données de démonstration (seed)
// ═══════════════════════════════════════════════════════════════════
//
// Jeu de données seul : aucune lecture ni écriture de stockage ici. Le dépôt de
// démo (`local.repository.ts`) l'ensemence au premier accès.

import { OKR } from './types';
import { isEnglishSeed } from '@/lib/seed-i18n';

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

export function createDemoOkrs(): OKR[] {
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

// Unités des résultats clés du seed, par id de KR. Sans elles, la démo anglaise
// affichait « 55 / 90 jours » sous un titre traduit (revue M-50 du 2026-10-23).
const DEMO_KR_UNITS_EN: Record<string, string> = {
  'kr-1': 'tasks', 'kr-2': 'weeks', 'kr-3': 'days',
  'kr-4': 'feedback sessions', 'kr-5': 'features', 'kr-6': 'users',
  'kr-7': 'sessions', 'kr-8': 'nights', 'kr-9': 'days',
  'kr-22': 'sessions', 'kr-23': 'pages', 'kr-24': 'days',
};

/**
 * Titres anglais du seed de démo, pour un couple (OKR, KR).
 *
 * Exporté pour `kr-completions`, dont le journal de démo DUPLIQUE ces titres
 * (`krTitle` / `okrTitle` y sont dénormalisés, comme en base). Les y réécrire à
 * la main aurait donné deux traductions du même libellé, donc deux occasions de
 * diverger — c'est la règle « une seule grille » du § facturation, appliquée
 * ici aux seeds.
 *
 * Rend `null` quand le couple n'est pas dans l'overlay : l'appelant garde alors
 * le français, même repli silencieux que `localizeSeed`.
 */
export function demoOkrTitlesEn(
  okrId: string,
  krId: string
): { okrTitle: string; krTitle: string } | null {
  const patch = DEMO_OKRS_EN[okrId];
  const krTitle = patch?.keyResults[krId];
  return patch && krTitle ? { okrTitle: patch.title, krTitle } : null;
}

/** Applique DEMO_OKRS_EN sur le seed français quand la locale est anglaise. */
export function localizeOkrs(okrs: OKR[]): OKR[] {
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
        unit: DEMO_KR_UNITS_EN[kr.id] ?? kr.unit,
      })),
    };
  });
}
