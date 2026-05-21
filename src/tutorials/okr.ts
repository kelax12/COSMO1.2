import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel page OKR — 5 étapes.
 */
export const okrTutorialSteps: TutorialStep[] = [
  {
    title: 'Vos OKR 🎯',
    description: "Objectives & Key Results — la méthode de pilotage stratégique. Un objectif = une ambition. Des KR = les indicateurs mesurables qui prouvent la progression.",
  },
  {
    title: 'Filtrer par catégorie',
    description: "Quand vous aurez beaucoup d'objectifs, ces filtres vous laissent zoomer sur un domaine (Travail, Perso, Santé…).",
    target: '[data-tutorial-id="okr-category-filter"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer un objectif',
    description: "Ce bouton ouvre le formulaire. Un objectif typique a 3 à 5 Key Results mesurables (ex: « Atteindre 1000 utilisateurs »).",
    target: '[data-tutorial-id="okr-create-button"]',
    cardPlacement: 'bottom',
    action: 'pulse',
    visibility: 'desktop',
  },
  {
    title: 'Anatomie d\'un objectif',
    description: "Chaque carte affiche : la catégorie, la période, le titre, la santé globale, et la progression de chaque KR. Cliquez un KR pour le faire avancer.",
    target: '[data-tutorial-id="okr-first-card"]',
    cardPlacement: 'top',
    action: 'pulse',
  },
  {
    title: 'Astuce : tâches ↔ KR',
    description: "Une bonne pratique : créer des tâches dont la complétion fait progresser un KR. C'est la passerelle entre stratégie (OKR) et exécution (Tâches).",
  },
];
