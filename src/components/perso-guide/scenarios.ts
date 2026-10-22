// src/components/perso-guide/scenarios.ts
import type { GuideStep } from '@/components/org-guide/guide-types';

/** Page de l'espace perso qu'une étape `goto` ouvre (`/<section>`). */
export type PersoGuideSection = 'tasks' | 'agenda' | 'habits' | 'okr';

export type PersoGuideCategory = 'tasks' | 'agenda' | 'habits' | 'okr';

export interface PersoGuideAction {
  /** Identifiant stable, aussi suffixe des clés i18n `actions.<id>.*`. */
  id: string;
  category: PersoGuideCategory;
  steps: GuideStep<PersoGuideSection>[];
}

export const PERSO_GUIDE_CATEGORIES: PersoGuideCategory[] = ['tasks', 'agenda', 'habits', 'okr'];

const k = (id: string, b: string) => `actions.${id}.${b}`;

/**
 * Même contrat que le guide entreprise : une étape ne SAISIT rien et ne clique
 * jamais un bouton qui écrit. `perso-guide-scenarios.guard.test.ts` le vérifie.
 * Desktop uniquement (v1), comme le guide entreprise.
 */
export const PERSO_GUIDE_ACTIONS: PersoGuideAction[] = [
  { id: 'task.create', category: 'tasks', steps: [
    { kind: 'goto', section: 'tasks', via: 'perso-nav-tasks' },
    { kind: 'click', target: 'perso-tasks-new' },
    { kind: 'field', target: 'perso-task-form-name', bubbleKey: k('task.create', 'b1') },
    // En création, les champs facultatifs sont repliés derrière « Plus d'options ».
    { kind: 'click', target: 'perso-task-form-more', optional: true },
    { kind: 'field', target: 'perso-task-form-priority', bubbleKey: k('task.create', 'b2') },
    { kind: 'field', target: 'perso-task-form-deadline', bubbleKey: k('task.create', 'b3') },
  ] },
  { id: 'list.create', category: 'tasks', steps: [
    { kind: 'goto', section: 'tasks', via: 'perso-nav-tasks' },
    { kind: 'click', target: 'task-lists-new' },
    { kind: 'field', target: 'task-list-form-name', bubbleKey: k('list.create', 'b1') },
    { kind: 'field', target: 'task-list-form-color', bubbleKey: k('list.create', 'b2') },
  ] },
  { id: 'task.find', category: 'tasks', steps: [
    { kind: 'goto', section: 'tasks', via: 'perso-nav-tasks' },
    { kind: 'field', target: 'perso-tasks-filter', bubbleKey: k('task.find', 'b1') },
    { kind: 'field', target: 'perso-tasks-calendar', bubbleKey: k('task.find', 'b2') },
  ] },
  { id: 'agenda.plan', category: 'agenda', steps: [
    { kind: 'goto', section: 'agenda', via: 'perso-nav-agenda' },
    { kind: 'field', target: 'perso-agenda-tasks', bubbleKey: k('agenda.plan', 'b1') },
    { kind: 'field', target: 'perso-agenda-grid', bubbleKey: k('agenda.plan', 'b2') },
  ] },
  { id: 'agenda.event', category: 'agenda', steps: [
    { kind: 'goto', section: 'agenda', via: 'perso-nav-agenda' },
    { kind: 'field', target: 'perso-agenda-grid', bubbleKey: k('agenda.event', 'b1') },
  ] },
  { id: 'agenda.views', category: 'agenda', steps: [
    { kind: 'goto', section: 'agenda', via: 'perso-nav-agenda' },
    { kind: 'field', target: 'perso-agenda-views', bubbleKey: k('agenda.views', 'b1') },
    { kind: 'field', target: 'perso-agenda-zoom', bubbleKey: k('agenda.views', 'b2') },
  ] },
  { id: 'habit.create', category: 'habits', steps: [
    { kind: 'goto', section: 'habits', via: 'perso-nav-habits' },
    { kind: 'click', target: 'perso-habits-new' },
    { kind: 'field', target: 'perso-habit-form-name', bubbleKey: k('habit.create', 'b1') },
    { kind: 'field', target: 'perso-habit-form-time', bubbleKey: k('habit.create', 'b2') },
    { kind: 'field', target: 'perso-habit-form-color', bubbleKey: k('habit.create', 'b3') },
  ] },
  // Le sélecteur de vue n'existe qu'à partir de la première habitude.
  { id: 'habit.track', category: 'habits', steps: [
    { kind: 'goto', section: 'habits', via: 'perso-nav-habits' },
    { kind: 'field', target: 'perso-habits-views', bubbleKey: k('habit.track', 'b1'), emptyKey: 'empty.noHabit' },
    { kind: 'field', target: 'perso-habits-list', bubbleKey: k('habit.track', 'b2') },
  ] },
  { id: 'okr.create', category: 'okr', steps: [
    { kind: 'goto', section: 'okr', via: 'perso-nav-okr' },
    { kind: 'click', target: 'perso-okr-new' },
    { kind: 'field', target: 'perso-okr-form-title', bubbleKey: k('okr.create', 'b1') },
    { kind: 'field', target: 'perso-okr-form-deadline', bubbleKey: k('okr.create', 'b2') },
    { kind: 'field', target: 'perso-okr-form-krs', bubbleKey: k('okr.create', 'b3') },
  ] },
  { id: 'okr.progress', category: 'okr', steps: [
    { kind: 'goto', section: 'okr', via: 'perso-nav-okr' },
    { kind: 'field', target: 'perso-okr-first-card', bubbleKey: k('okr.progress', 'b1'), emptyKey: 'empty.noOkr' },
    { kind: 'field', target: 'perso-okr-categories', bubbleKey: k('okr.progress', 'b2') },
  ] },
];
