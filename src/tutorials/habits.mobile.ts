import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel page Habitudes — MOBILE uniquement.
 * Focalisé sur les cards individuelles (la vue table desktop est plus
 * complexe à manier au doigt).
 */
export const habitsTutorialStepsMobile: TutorialStep[] = [
  {
    title: 'Vos habitudes 🔁',
    description: "Les habitudes construisent vos routines. Une touche suffit pour valider la journée. Votre série s'allonge — ou repart à zéro si vous sautez un jour.",
  },
  {
    title: 'Changez de vue',
    description: "Liste (recommandée mobile) pour le quotidien, Tableau pour scroller la grille des 30 derniers jours.",
    target: '[data-tutorial-id="habits-view-switcher"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer une habitude',
    description: "Le bouton flottant en bas à droite ouvre le formulaire. Nom, couleur, cadence (quotidien / hebdo / X fois par semaine).",
    target: '[data-tutorial-id="habits-fab"]',
    cardPlacement: 'top',
    action: 'pulse',
  },
  {
    title: 'Validez d\'un tap',
    description: "Sur chaque habitude, touchez le bouton ✓ pour valider aujourd'hui. La carte change de couleur. Re-touchez pour défaire si besoin.",
    target: '[data-tutorial-id="habits-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    title: 'Heatmap discrète',
    description: "Sous chaque habitude, un mini-bandeau montre vos 30 derniers jours. Plus c'est rempli, plus votre constance est élevée.",
    target: '[data-tutorial-id="habits-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
];
