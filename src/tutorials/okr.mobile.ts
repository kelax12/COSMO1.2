import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel OKR — MOBILE.
 */
export const okrTutorialStepsMobile: TutorialStep[] = [
  {
    title: 'Piloter avec les OKR',
    description:
      "OKR = Objective (un cap ambitieux) + Key Results (3-5 indicateurs chiffrés). La méthode des startups pour avancer dans la bonne direction.",
  },
  {
    title: 'Filtrer par catégorie',
    description:
      "Faites glisser les chips horizontalement pour filtrer vos objectifs (Travail, Perso, Santé…). Touchez « Tous » pour réinitialiser.",
    target: '[data-tutorial-id="okr-category-filter"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer un objectif',
    description:
      "Le bouton flottant en bas à droite ouvre le formulaire. Définissez 3 à 5 KR mesurables — pas plus, sinon vous diluez votre énergie.",
  },
  {
    title: 'Une carte = un objectif',
    description:
      "Tapez la carte pour ouvrir le détail. La jauge à droite indique la santé globale. Chaque KR a sa barre de progression, ajustable au tap.",
    target: '[data-tutorial-id="okr-first-card"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    title: 'Le lien stratégique : tâches → KR',
    description:
      "Astuce : créez d'abord vos OKR. Ensuite, créez des tâches qui font progresser un KR. Votre dashboard reflètera l'avancement réel.",
  },
];
