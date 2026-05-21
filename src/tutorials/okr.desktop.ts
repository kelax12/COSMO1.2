import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel OKR — DESKTOP.
 */
export const okrTutorialStepsDesktop: TutorialStep[] = [
  {
    title: 'Piloter avec les OKR',
    description:
      "OKR = Objective (ambition) + Key Results (3-5 indicateurs mesurables). Une méthode éprouvée pour rester aligné sur ce qui compte.",
  },
  {
    title: 'Filtrer par catégorie',
    description:
      "Quand vous aurez plusieurs OKR, ces chips vous permettent de zoomer sur un domaine (Travail, Perso, Santé…). Le « + » crée une nouvelle catégorie.",
    target: '[data-tutorial-id="okr-category-filter"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer un objectif',
    description:
      "Ce bouton ouvre le formulaire de création. Donnez un titre clair (ex : « Atteindre 1000 utilisateurs ») et ajoutez 3 à 5 KR avec leur cible chiffrée.",
    target: '[data-tutorial-id="okr-create-button"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Lecture d\'une carte OKR',
    description:
      "Chip catégorie en haut. Période (date début → fin). Titre + description. Jauge de santé à droite (rouge = en retard, vert = OK). Chaque KR avec sa progression — cliquez pour la faire avancer.",
    target: '[data-tutorial-id="okr-first-card"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    title: 'Le lien stratégique : tâches → KR',
    description:
      "Bonne pratique : créer des tâches dont la complétion fait avancer un KR. Vous reliez la stratégie (OKR) à l'exécution (tâches du jour).",
  },
];
