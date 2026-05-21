import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel page Agenda — DESKTOP uniquement.
 * Centré sur les fonctionnalités FullCalendar : drag-and-drop, resize, vues
 * Jour/Semaine/Mois. La démo drag-ghost glisse une carte depuis la sidebar
 * gauche vers le calendrier — pour bien visualiser, on utilise dimLevel:'light'
 * sur les étapes drag/calendar afin de garder la grille visible.
 */
export const agendaTutorialStepsDesktop: TutorialStep[] = [
  {
    title: 'Votre agenda 📅',
    description: "Visualisez vos événements et tâches planifiées. Drag-and-drop de vos tâches non planifiées directement sur la grille.",
  },
  {
    title: 'Changez de vue',
    description: "Jour pour le détail, Semaine (recommandé) pour la vue d'ensemble, Mois pour le contexte large.",
    target: '[data-tutorial-id="agenda-view-switcher"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Tâches glissables',
    description: "Ce bouton ouvre/ferme le panneau gauche qui liste vos tâches non planifiées. On l'ouvre pour vous.",
    target: '[data-tutorial-id="agenda-task-sidebar-toggle"]',
    cardPlacement: 'bottom',
    action: 'click',
    actionDelay: 1500,
  },
  {
    title: 'Glissez-déposez une tâche',
    description: "Démonstration : on glisse une tâche depuis le panneau gauche vers le calendrier. La tâche devient un événement planifié à l'endroit où vous lâchez.",
    target: '[data-tutorial-id="agenda-task-sidebar-toggle"]',
    cardPlacement: 'right',
    action: 'drag-ghost',
    dragTo: '[data-tutorial-id="agenda-calendar-grid"]',
    actionDelay: 600,
    dimLevel: 'light',
  },
  {
    title: 'Cliquez un créneau libre',
    description: "Un clic sur un slot horaire vide ouvre directement le formulaire d'événement, pré-rempli à cette heure.",
    target: '[data-tutorial-id="agenda-calendar-grid"]',
    cardPlacement: 'left',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    title: 'Étirez pour rallonger',
    description: "Cliquez-glissez le bord d'un événement pour étirer ou raccourcir sa durée. Les modifications sont sauvegardées automatiquement.",
    target: '[data-tutorial-id="agenda-calendar-grid"]',
    cardPlacement: 'left',
    action: 'pulse',
    dimLevel: 'light',
  },
];
