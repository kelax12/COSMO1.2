// Données statiques de la LandingPage — extraites pour alléger le composant.
//
// Les textes sont des CLÉS du catalogue `landing`, pas des chaînes : ce module
// est évalué au premier import, y stocker du français figerait la landing dans
// cette langue pour toute la session (cf. src/i18n/catalog.ts).
import type { KeyOf } from '@/i18n/catalog';

export interface UseCase {
  /** Clés du catalogue `landing`, résolues au rendu (cf. en-tête). */
  profileKey: KeyOf<'landing'>;
  accent: string;
  titleKey: KeyOf<'landing'>;
  descriptionKey: KeyOf<'landing'>;
  featureKeys: KeyOf<'landing'>[];
  path: string;
}

export const USE_CASES: UseCase[] = [
  { profileKey: 'useCases.students.profile', accent: '#7C3AED', titleKey: 'useCases.students.title', descriptionKey: 'useCases.students.description', featureKeys: ['useCases.students.f1', 'useCases.students.f2', 'useCases.students.f3'], path: '/tasks' },
  { profileKey: 'useCases.professionals.profile', accent: '#2563EB', titleKey: 'useCases.professionals.title', descriptionKey: 'useCases.professionals.description', featureKeys: ['useCases.professionals.f1', 'useCases.professionals.f2', 'useCases.professionals.f3'], path: '/dashboard' },
  { profileKey: 'useCases.teams.profile', accent: '#047857', titleKey: 'useCases.teams.title', descriptionKey: 'useCases.teams.description', featureKeys: ['useCases.teams.f1', 'useCases.teams.f2', 'useCases.teams.f3'], path: '/okr' },
  { profileKey: 'useCases.founders.profile', accent: '#C2410C', titleKey: 'useCases.founders.title', descriptionKey: 'useCases.founders.description', featureKeys: ['useCases.founders.f1', 'useCases.founders.f2', 'useCases.founders.f3'], path: '/okr' },
];

export const ENTRY_OFFSETS = [
  { x: -400, y: -300, rotate: -15 },
  { x:  400, y: -300, rotate:  15 },
  { x: -400, y:  300, rotate: -15 },
  { x:  400, y:  300, rotate:  15 },
];

export interface FaqItemData {
  questionKey: KeyOf<'landing'>;
  answerKey: KeyOf<'landing'>;
}

// ── FAQ data ──────────────────────────────────────────────────────────────
// Questions retenues (2026-11-20) : les numéros 7, 10, 11 et 12 (collaboration,
// hors connexion, surveillance, cloisonnement) ont été retirés de la page perso.
// La liste alimente aussi le JSON-LD FAQPage.
const FAQ_NUMEROS = [1, 2, 3, 4, 5, 6, 8, 9] as const;
export const FAQ_ITEMS: FaqItemData[] = FAQ_NUMEROS.map((n) => ({
  questionKey: `faq.q${n}` as KeyOf<'landing'>,
  answerKey: `faq.a${n}` as KeyOf<'landing'>,
}));
