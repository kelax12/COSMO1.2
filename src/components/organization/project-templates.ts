// ═══════════════════════════════════════════════════════════════════
// Gabarits de projet
//
// `handleCreateProjectFull(input, draftTasks)` savait déjà créer un projet ET
// ses tâches initiales : il ne manquait que de quoi les pré-remplir. Un gabarit
// n'est donc qu'un jeu de valeurs par défaut — aucune mécanique nouvelle, et
// rien à défaire si l'utilisateur repart de zéro.
//
// Les libellés sont des CLÉS de catalogue, pas du texte : une constante de
// module est évaluée au premier import, y écrire du français figerait les
// gabarits en FR pour toute la session (même piège que les onglets de
// OrganizationPage).
// ═══════════════════════════════════════════════════════════════════

import type { KeyOf } from '@/i18n/catalog';

export interface ProjectTemplate {
  id: string;
  /** Clé du nom affiché ET du nom pré-rempli du projet. */
  labelKey: KeyOf<'org'>;
  color: string;
  /** Clés des tâches initiales, dans l'ordre. */
  taskKeys: KeyOf<'org'>[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'onboarding',
    labelKey: 'templates.onboarding',
    color: 'teal',
    taskKeys: [
      'templates.onboardingT1',
      'templates.onboardingT2',
      'templates.onboardingT3',
      'templates.onboardingT4',
    ],
  },
  {
    id: 'launch',
    labelKey: 'templates.launch',
    color: 'indigo',
    taskKeys: [
      'templates.launchT1',
      'templates.launchT2',
      'templates.launchT3',
      'templates.launchT4',
      'templates.launchT5',
    ],
  },
  {
    id: 'sprint',
    labelKey: 'templates.sprint',
    color: 'amber',
    taskKeys: [
      'templates.sprintT1',
      'templates.sprintT2',
      'templates.sprintT3',
      'templates.sprintT4',
    ],
  },
];
