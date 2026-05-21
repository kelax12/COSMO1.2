import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Habitudes — DESKTOP.
 */
export const habitsTutorialStepsDesktop: TutorialStep[] = [
  {
    title: 'Construire vos habitudes',
    description:
      "Une habitude = un comportement à répéter régulièrement. Cosmo suit votre série (jours consécutifs) et votre taux de complétion.",
  },
  {
    title: 'Trois vues au choix',
    description:
      "Liste : une carte par habitude (par défaut). Tableau : grille des 30 derniers jours. Suivi global : statistiques agrégées.",
    target: '[data-tutorial-id="habits-view-switcher"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer une habitude',
    description:
      "Ce bouton ouvre le formulaire. Définissez un nom, une couleur, une cadence (chaque jour, X fois par semaine, jours précis).",
    target: '[data-tutorial-id="habits-create-button"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Valider la journée',
    description:
      "Sur chaque carte, le bouton ✓ marque l'habitude faite aujourd'hui. Votre série s'allonge. Sauter un jour la remet à zéro — c'est la règle.",
    target: '[data-tutorial-id="habits-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    title: 'Repérer les jours « secs »',
    description:
      "Passez en vue Tableau pour voir une grille de toutes vos habitudes sur 30 jours. Les cases vides sautent aux yeux — utile pour ajuster votre rythme.",
  },
];
