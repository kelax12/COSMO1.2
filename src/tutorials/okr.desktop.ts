import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel page OKR — DESKTOP uniquement.
 */
export const okrTutorialStepsDesktop: TutorialStep[] = [
  {
    title: 'Vos OKR 🎯',
    description: "Objectives & Key Results — la méthode de pilotage stratégique. Un objectif = une ambition. Des KR = indicateurs mesurables qui prouvent la progression.",
  },
  {
    title: 'Filtrer par catégorie',
    description: "Quand vous aurez beaucoup d'objectifs, ces filtres vous laissent zoomer sur un domaine (Travail, Perso, Santé…). Bouton + pour créer une catégorie.",
    target: '[data-tutorial-id="okr-category-filter"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer un objectif',
    description: "Ce bouton ouvre le formulaire. Un objectif typique a 3 à 5 Key Results mesurables (ex : « Atteindre 1000 utilisateurs »).",
    target: '[data-tutorial-id="okr-create-button"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: "Anatomie d'un objectif",
    description: "Chaque carte affiche : la catégorie (chip coloré), la période, le titre, la santé globale (jauge à droite), et chaque KR avec sa barre de progression.",
    target: '[data-tutorial-id="okr-first-card"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    title: 'Astuce : tâches ↔ KR',
    description: "Bonne pratique : créer des tâches dont la complétion fait progresser un KR. C'est la passerelle entre stratégie (OKR) et exécution (Tâches).",
  },
];
