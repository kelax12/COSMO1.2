// src/components/org-guide/scenarios/work.ts
import type { GuideAction } from '../guide-types';

const k = (id: string, b: string) => `actions.${id}.${b}`;

export const WORK_ACTIONS: GuideAction[] = [
  { id: 'project.create', category: 'work', requires: 'project.create', steps: [
    { kind: 'goto', section: 'projects', via: 'nav-projects' },
    { kind: 'click', target: 'projects-new' },
    { kind: 'field', target: 'project-form-name', bubbleKey: k('project.create', 'b1') },
    { kind: 'field', target: 'project-form-team', bubbleKey: k('project.create', 'b2') },
    { kind: 'field', target: 'project-form-due', bubbleKey: k('project.create', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  // Le modèle se choisit dans une liste en tête du formulaire (pas d'onglet) ;
  // ses tâches s'ajoutent à la section « Tâches de départ ».
  { id: 'project.fromTemplate', category: 'work', requires: 'project.create', steps: [
    { kind: 'goto', section: 'projects', via: 'nav-projects' },
    { kind: 'click', target: 'projects-new' },
    { kind: 'field', target: 'project-form-template', bubbleKey: k('project.fromTemplate', 'b1') },
    { kind: 'field', target: 'project-form-tasks', bubbleKey: k('project.fromTemplate', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'task.create', category: 'work', requires: 'task.create', steps: [
    { kind: 'goto', section: 'tasks', via: 'nav-tasks' },
    { kind: 'click', target: 'tasks-new' },
    { kind: 'field', target: 'task-form-title', bubbleKey: k('task.create', 'b1') },
    { kind: 'field', target: 'task-form-project', bubbleKey: k('task.create', 'b2') },
    { kind: 'field', target: 'task-form-assignees', bubbleKey: k('task.create', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  // La fiche d'une tâche existante est le même modal que la création.
  { id: 'task.assign', category: 'work', steps: [
    { kind: 'goto', section: 'tasks', via: 'nav-tasks' },
    { kind: 'pick-first', target: 'tasks-list', emptyKey: 'empty.noTask' },
    { kind: 'field', target: 'task-form-assignees', bubbleKey: k('task.assign', 'b1') },
    { kind: 'field', target: 'task-detail-followers', bubbleKey: k('task.assign', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'task.subtaskDependency', category: 'work', steps: [
    { kind: 'goto', section: 'tasks', via: 'nav-tasks' },
    { kind: 'pick-first', target: 'tasks-list', emptyKey: 'empty.noTask' },
    { kind: 'field', target: 'task-detail-subtasks', bubbleKey: k('task.subtaskDependency', 'b1') },
    { kind: 'field', target: 'task-detail-dependencies', bubbleKey: k('task.subtaskDependency', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  // L'audience d'un projet = ses équipes associées (pas de case « confidentiel »).
  { id: 'project.audience', category: 'work', requires: 'project.edit', steps: [
    { kind: 'goto', section: 'projects', via: 'nav-projects' },
    { kind: 'pick-first', target: 'projects-list', emptyKey: 'empty.noProject' },
    { kind: 'click', target: 'project-detail-audience' },
    { kind: 'field', target: 'project-audience-who', bubbleKey: k('project.audience', 'b1') },
    { kind: 'field', target: 'project-audience-add', bubbleKey: k('project.audience', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  // Le formulaire de liste porte un nom et une couleur ; l'épinglage se fait sur une liste existante.
  { id: 'list.create', category: 'work', steps: [
    { kind: 'goto', section: 'tasks', via: 'nav-tasks' },
    { kind: 'click', target: 'task-lists-new' },
    { kind: 'field', target: 'task-list-form-name', bubbleKey: k('list.create', 'b1') },
    { kind: 'field', target: 'task-list-form-color', bubbleKey: k('list.create', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  // La corbeille vit dans la barre de l'onglet Projets (et OKR), pas dans Tâches.
  { id: 'trash.restore', category: 'work', requires: 'task.deleteAny', steps: [
    { kind: 'goto', section: 'projects', via: 'nav-projects' },
    { kind: 'click', target: 'trash-open' },
    { kind: 'field', target: 'trash-list', bubbleKey: k('trash.restore', 'b1') },
    { kind: 'field', target: 'trash-retention', bubbleKey: k('trash.restore', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
];
