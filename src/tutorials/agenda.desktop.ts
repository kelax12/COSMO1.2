import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Agenda — DESKTOP (FullCalendar + drag + resize).
 *
 * Steps 4 → 5 → 6 utilisent le système de « ghost persistant »
 * (ghostAnimation) : l'événement créé à l'étape 4 reste visible à l'étape 5
 * (où il est étiré), puis disparaît au début de l'étape 6 pour laisser place
 * à une démo « sélection d'une plage horaire → création d'événement », qui
 * disparaît à son tour à la fin.
 *
 * Cible commune pour le placement : la colonne MERCREDI (`.fc-day-wed`),
 * généralement vide dans les données démo.
 */
const WED_COLUMN = '.fc-timegrid-col.fc-day-wed';
const CALENDAR_GRID = '[data-tutorial-id="agenda-calendar-grid"]';

export const agendaTutorialStepsDesktop: TutorialStep[] = [
  {
    title: 'Votre agenda',
    description:
      "Visualisez événements et tâches planifiées. Le drag-and-drop relie vos tâches non planifiées au calendrier en un geste.",
  },
  {
    title: 'Changer de vue',
    description:
      "Jour pour le détail heure par heure. Semaine pour la vue d'ensemble (recommandée). Mois pour le contexte large.",
    target: '[data-tutorial-id="agenda-view-switcher"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Panneau Tâches',
    description:
      "Ce bouton ouvre la barre latérale listant toutes vos tâches non planifiées, prêtes à glisser dans le calendrier.",
    target: '[data-tutorial-id="agenda-task-sidebar-toggle"]',
    cardPlacement: 'bottom',
    action: 'custom',
    actionDelay: 1200,
    customAction: async (target) => {
      if (!target) return;
      // Garantit que le sidebar est ouvert à la fin (nécessaire pour l'étape suivante)
      const isOpen = !!document.getElementById('external-events-container');
      if (isOpen) {
        // Ferme puis rouvre pour montrer l'animation
        target.click();
        await new Promise(r => setTimeout(r, 700));
      }
      target.click();
      await new Promise(r => setTimeout(r, 650));
    },
  },
  {
    title: 'Glisser une tâche vers le calendrier',
    description:
      "Saisissez une tâche dans le panneau, glissez-la sur un créneau horaire et lâchez — elle devient un événement planifié, calé sur la colonne du jour.",
    target: '[data-tutorial-id="agenda-first-task"]',
    cardPlacement: 'right',
    ghostAnimation: 'drag-place',
    placeTarget: WED_COLUMN,
    dragTo: CALENDAR_GRID,
    ghostLabel: 'Travail',
    dimLevel: 'light',
  },
  {
    title: 'Étirer pour rallonger',
    description:
      "Une fois posé, attrapez le bord inférieur de l'événement et glissez vers le bas pour allonger sa durée. La démo le fait pour vous.",
    target: CALENDAR_GRID,
    cardPlacement: 'inside',
    ghostAnimation: 'resize-grow',
    placeTarget: WED_COLUMN,
    dragTo: CALENDAR_GRID,
    ghostLabel: 'Travail',
    dimLevel: 'light',
  },
  {
    title: 'Créer depuis un créneau vide',
    description:
      "Pas envie de drag ? Cliquez-glissez sur une plage horaire vide pour ouvrir directement le formulaire d'événement, pré-rempli à cette heure.",
    target: CALENDAR_GRID,
    cardPlacement: 'inside',
    ghostAnimation: 'select-create',
    placeTarget: WED_COLUMN,
    dragTo: CALENDAR_GRID,
    ghostLabel: 'Pause café',
    dimLevel: 'light',
  },
];
