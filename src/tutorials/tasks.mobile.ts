import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Tâches — MOBILE (gestes tactiles).
 * 7 étapes : intro → listes → filtres → calendrier → FAB → swipes → bouton "…"
 */
export const tasksTutorialStepsMobile: TutorialStep[] = [
  {
    titleKey: 'tasksMobile.step1Title',
    descriptionKey: 'tasksMobile.step1Desc',
  },
  {
    titleKey: 'tasksMobile.step2Title',
    descriptionKey: 'tasksMobile.step2Desc',
    target: '[data-tutorial-id="tasks-lists"]',
    cardPlacement: 'bottom',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    titleKey: 'tasksMobile.step3Title',
    descriptionKey: 'tasksMobile.step3Desc',
    target: '[data-tutorial-id="tasks-filter"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    titleKey: 'tasksMobile.step4Title',
    descriptionKey: 'tasksMobile.step4Desc',
    target: '[data-tutorial-id="tasks-calendar-toggle"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    titleKey: 'tasksMobile.step5Title',
    descriptionKey: 'tasksMobile.step5Desc',
    target: '[data-tutorial-id="global-quick-add-fab"]',
    cardPlacement: 'top',
    action: 'pulse',
  },
  {
    titleKey: 'tasksMobile.step6Title',
    descriptionKey: 'tasksMobile.step6Desc',
    target: '[data-tutorial-id="tasks-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    titleKey: 'tasksMobile.step7Title',
    descriptionKey: 'tasksMobile.step7Desc',
    target: '[data-tutorial-id="tasks-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
];
