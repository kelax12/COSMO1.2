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
  { id: 'project.fromTemplate', category: 'work', requires: 'project.create', steps: [
    { kind: 'goto', section: 'projects', via: 'nav-projects' },
    { kind: 'click', target: 'projects-new' },
    { kind: 'click', target: 'project-form-templates-tab' },
    { kind: 'field', target: 'project-templates-list', bubbleKey: k('project.fromTemplate', 'b1') },
    { kind: 'field', target: 'project-templates-preview', bubbleKey: k('project.fromTemplate', 'b2') },
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
  { id: 'task.assign', category: 'work', steps: [
    { kind: 'goto', section: 'tasks', via: 'nav-tasks' },
    { kind: 'pick-first', target: 'tasks-list', emptyKey: 'empty.noTask' },
    { kind: 'field', target: 'task-detail-assignees', bubbleKey: k('task.assign', 'b1') },
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
  { id: 'project.audience', category: 'work', requires: 'project.edit', steps: [
    { kind: 'goto', section: 'projects', via: 'nav-projects' },
    { kind: 'pick-first', target: 'projects-list', emptyKey: 'empty.noProject' },
    { kind: 'click', target: 'project-detail-audience' },
    { kind: 'field', target: 'project-audience-who', bubbleKey: k('project.audience', 'b1') },
    { kind: 'field', target: 'project-audience-confidential', bubbleKey: k('project.audience', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'list.create', category: 'work', steps: [
    { kind: 'goto', section: 'tasks', via: 'nav-tasks' },
    { kind: 'click', target: 'task-lists-new' },
    { kind: 'field', target: 'task-list-form-name', bubbleKey: k('list.create', 'b1') },
    { kind: 'field', target: 'task-list-form-pin', bubbleKey: k('list.create', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'trash.restore', category: 'work', requires: 'task.deleteAny', steps: [
    { kind: 'goto', section: 'tasks', via: 'nav-tasks' },
    { kind: 'click', target: 'tasks-more-menu' },
    { kind: 'click', target: 'tasks-open-trash' },
    { kind: 'field', target: 'trash-list', bubbleKey: k('trash.restore', 'b1') },
    { kind: 'field', target: 'trash-restore-hint', bubbleKey: k('trash.restore', 'b2') },
    { kind: 'field', target: 'trash-retention', bubbleKey: k('trash.restore', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
];
