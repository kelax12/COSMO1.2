// ═══════════════════════════════════════════════════════════════════
// Modèles de projet livrés avec COSMO (mig. 153, M2)
//
// Les catalogues `org.templates.*` existaient déjà, sans aucun écran pour les
// proposer. Ils deviennent les modèles « COSMO », à côté de ceux que
// l'entreprise enregistre elle-même (`team_projects.is_template`).
//
// Même forme que `TeamProjectTemplatePayload` : des DÉCALAGES en jours depuis
// le début du projet, jamais des dates.
// ═══════════════════════════════════════════════════════════════════

import type { TeamProjectTemplatePayload } from '@/modules/team-projects';

type TemplateKey = 'onboarding' | 'launch' | 'sprint';

interface BuiltInTemplate {
  key: TemplateKey;
  /** Clé de la tâche sous `templates.*`, décalage de l'échéance, priorité. */
  tasks: { key: string; deadlineOffset: number; startOffset?: number; priority?: number }[];
  durationDays: number;
}

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    key: 'onboarding',
    durationDays: 30,
    tasks: [
      { key: 'onboardingT1', startOffset: 0, deadlineOffset: 1, priority: 2 },
      { key: 'onboardingT2', startOffset: 1, deadlineOffset: 5 },
      { key: 'onboardingT3', startOffset: 5, deadlineOffset: 10 },
      { key: 'onboardingT4', startOffset: 28, deadlineOffset: 30 },
    ],
  },
  {
    key: 'launch',
    durationDays: 45,
    tasks: [
      { key: 'launchT1', startOffset: 0, deadlineOffset: 7, priority: 2 },
      { key: 'launchT2', startOffset: 7, deadlineOffset: 25 },
      { key: 'launchT3', startOffset: 25, deadlineOffset: 35 },
      { key: 'launchT4', startOffset: 36, deadlineOffset: 38, priority: 1 },
      { key: 'launchT5', startOffset: 40, deadlineOffset: 45 },
    ],
  },
  {
    key: 'sprint',
    durationDays: 14,
    tasks: [
      { key: 'sprintT1', startOffset: 0, deadlineOffset: 1, priority: 2 },
      { key: 'sprintT2', startOffset: 1, deadlineOffset: 10 },
      { key: 'sprintT3', startOffset: 10, deadlineOffset: 13 },
      { key: 'sprintT4', startOffset: 14, deadlineOffset: 14 },
    ],
  },
];

/** Contenu d'un modèle COSMO, libellés résolus dans la langue courante. */
export function builtInPayload(
  template: BuiltInTemplate,
  translate: (key: string) => string,
): TeamProjectTemplatePayload {
  return {
    tasks: template.tasks.map((task) => ({
      name: translate(`templates.${task.key}`),
      priority: task.priority ?? 3,
      startOffset: task.startOffset ?? null,
      deadlineOffset: task.deadlineOffset,
    })),
    milestones: [],
    durationDays: template.durationDays,
  };
}
