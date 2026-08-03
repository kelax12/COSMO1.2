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
    titleKey: 'agendaDesktop.step1Title',
    descriptionKey: 'agendaDesktop.step1Desc',
  },
  {
    titleKey: 'agendaDesktop.step2Title',
    descriptionKey: 'agendaDesktop.step2Desc',
    target: '[data-tutorial-id="agenda-view-switcher"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    titleKey: 'agendaDesktop.step3Title',
    descriptionKey: 'agendaDesktop.step3Desc',
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
    titleKey: 'agendaDesktop.step4Title',
    descriptionKey: 'agendaDesktop.step4Desc',
    target: '[data-tutorial-id="agenda-first-task"]',
    cardPlacement: 'right',
    ghostAnimation: 'drag-place',
    placeTarget: WED_COLUMN,
    dragTo: CALENDAR_GRID,
    ghostLabel: 'Travail',
    dimLevel: 'light',
  },
  {
    titleKey: 'agendaDesktop.step5Title',
    descriptionKey: 'agendaDesktop.step5Desc',
    target: CALENDAR_GRID,
    cardPlacement: 'inside',
    ghostAnimation: 'resize-grow',
    placeTarget: WED_COLUMN,
    dragTo: CALENDAR_GRID,
    ghostLabel: 'Travail',
    dimLevel: 'light',
  },
  {
    titleKey: 'agendaDesktop.step6Title',
    descriptionKey: 'agendaDesktop.step6Desc',
    target: CALENDAR_GRID,
    cardPlacement: 'inside',
    ghostAnimation: 'select-create',
    placeTarget: WED_COLUMN,
    dragTo: CALENDAR_GRID,
    ghostLabel: 'Pause café',
    dimLevel: 'light',
  },
];
