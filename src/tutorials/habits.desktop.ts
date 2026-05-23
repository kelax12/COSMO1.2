import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Habitudes — DESKTOP.
 */
export const habitsTutorialStepsDesktop: TutorialStep[] = [
  {
    title: 'Habitudes quotidiennes',
    description:
      "Créez des gestes à refaire chaque jour. Cosmo vous aide à tenir votre chaîne.",
  },
  {
    title: 'Trois façons de voir vos habitudes',
    description:
      "Liste : suivi hebdomadaire. Tableau : grille des 30 derniers jours. Suivi global : statistiques de toutes vos habitudes.",
    target: '[data-tutorial-id="habits-view-switcher"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer en quelques clics',
    description:
      "Donnez un nom et choisissez une couleur.",
    target: '[data-tutorial-id="habits-create-button"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Cliquez ✓ pour compléter',
    description:
      "Le bouton valide l'habitude du jour et allonge votre série. Un jour manqué la remet à zéro.",
    target: '[data-tutorial-id="habits-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
];
