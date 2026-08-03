import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Tâches — DESKTOP (souris + grand écran).
 * 6 étapes : intro → listes → filtres → calendrier → création → tableau.
 */
export const tasksTutorialStepsDesktop: TutorialStep[] = [
  {
    titleKey: 'tasksDesktop.step1Title',
    descriptionKey: 'tasksDesktop.step1Desc',
  },
  {
    titleKey: 'tasksDesktop.step2Title',
    descriptionKey: 'tasksDesktop.step2Desc',
    target: '[data-tutorial-id="tasks-lists"]',
    cardPlacement: 'bottom',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    titleKey: 'tasksDesktop.step3Title',
    descriptionKey: 'tasksDesktop.step3Desc',
    target: '[data-tutorial-id="tasks-filter"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    titleKey: 'tasksDesktop.step4Title',
    descriptionKey: 'tasksDesktop.step4Desc',
    target: '[data-tutorial-id="tasks-calendar-toggle"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    titleKey: 'tasksDesktop.step5Title',
    descriptionKey: 'tasksDesktop.step5Desc',
    target: '[data-tutorial-id="tasks-create-button"]',
    cardPlacement: 'bottom',
    action: 'click',
    actionDelay: 1800,
  },
  {
    titleKey: 'tasksDesktop.step6Title',
    descriptionKey: 'tasksDesktop.step6Desc',
    target: '[data-tutorial-id="tasks-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
];
