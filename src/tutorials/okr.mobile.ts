import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel OKR — MOBILE.
 */
export const okrTutorialStepsMobile: TutorialStep[] = [
  {
    titleKey: 'okrMobile.step1Title',
    descriptionKey: 'okrMobile.step1Desc',
  },
  {
    titleKey: 'okrMobile.step2Title',
    descriptionKey: 'okrMobile.step2Desc',
    target: '[data-tutorial-id="okr-category-filter"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    titleKey: 'okrMobile.step3Title',
    descriptionKey: 'okrMobile.step3Desc',
  },
  {
    titleKey: 'okrMobile.step4Title',
    descriptionKey: 'okrMobile.step4Desc',
    target: '[data-tutorial-id="okr-first-card"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    titleKey: 'okrMobile.step5Title',
    descriptionKey: 'okrMobile.step5Desc',
  },
];
