import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Agenda — MOBILE.
 *
 * UX mobile spécifique :
 *  - Pas de drag-and-drop tâche → grille (réservé au desktop)
 *  - Vue en colonne verticale par jour (FullCalendar timeGridDay)
 *  - Bandeau de dates horizontal en haut + tab bar fixe en bas
 *  - Modales en bottom-sheet
 *
 * Toutes les cartes utilisent `cardPlacement: 'bottom'` (ou 'inside' pour
 * la grille calendrier) — le code de PageTutorial clampe automatiquement
 * la position horizontale dans la viewport, donc aucune carte ne sort de
 * l'écran sur les tailles iPhone SE (375) → iPhone 14 Pro Max (430).
 */
export const agendaTutorialStepsMobile: TutorialStep[] = [
  {
    title: 'Votre agenda',
    description:
      "Vue verticale par jour, optimisée pour le scroll au pouce. Touchez les zones surlignées pour découvrir l'essentiel.",
  },
  {
    title: 'Naviguer dans les jours',
    description:
      "Faites glisser horizontalement pour parcourir vos prochaines journées. Touchez une date pour la centrer dans la grille ci-dessous.",
    target: '[data-tutorial-id="agenda-mobile-day-strip"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: "Trois vues d'agenda",
    description:
      "Jour pour le détail heure par heure, 2J pour comparer deux jours, Mois pour le contexte large. Bascule en un toucher.",
    target: '[data-tutorial-id="agenda-mobile-view-switcher"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Vos tâches à planifier',
    description:
      "Ce bouton ouvre le panneau de vos tâches non planifiées. Touchez-en une puis « Planifier dans l'agenda » — le glisser-déposer est réservé au desktop.",
    target: '[data-tutorial-id="agenda-mobile-tasks-toggle"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer un événement',
    description:
      "Le bouton « + » en bas de l'écran ouvre le formulaire en bottom-sheet, pré-rempli à l'heure courante du jour sélectionné.",
    target: '[data-tutorial-id="global-quick-add-fab"]',
    cardPlacement: 'top',
    action: 'pulse',
  },
  {
    title: 'Toucher un créneau libre',
    description:
      "Maintenez votre doigt sur une plage horaire vide dans la grille pour créer un événement directement à cette heure.",
    target: '[data-tutorial-id="agenda-mobile-calendar"]',
    cardPlacement: 'inside',
    // 'custom' avec un no-op évite le gros pulse autour de toute la grille
    action: 'custom',
    customAction: () => { /* spotlight uniquement */ },
    dimLevel: 'light',
  },
];
