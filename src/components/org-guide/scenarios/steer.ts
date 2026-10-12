// src/components/org-guide/scenarios/steer.ts
import type { GuideAction } from '../guide-types';

const k = (id: string, b: string) => `actions.${id}.${b}`;

export const STEER_ACTIONS: GuideAction[] = [
  { id: 'okr.create', category: 'steer', requires: 'okr.create', steps: [
    { kind: 'goto', section: 'okr', via: 'nav-okr' },
    { kind: 'click', target: 'okr-new' },
    { kind: 'field', target: 'okr-form-objective', bubbleKey: k('okr.create', 'b1') },
    { kind: 'field', target: 'okr-form-krs', bubbleKey: k('okr.create', 'b2') },
    { kind: 'field', target: 'okr-form-audience', bubbleKey: k('okr.create', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'kr.update', category: 'steer', steps: [
    { kind: 'goto', section: 'okr', via: 'nav-okr' },
    { kind: 'pick-first', target: 'okr-kr-list', emptyKey: 'empty.noOkr' },
    { kind: 'field', target: 'kr-exec-value', bubbleKey: k('kr.update', 'b1') },
    { kind: 'field', target: 'kr-exec-comment', bubbleKey: k('kr.update', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'kr.linkProject', category: 'steer', requires: 'okr.create', steps: [
    { kind: 'goto', section: 'okr', via: 'nav-okr' },
    { kind: 'pick-first', target: 'okr-list', emptyKey: 'empty.noOkr' },
    { kind: 'field', target: 'okr-link-project', bubbleKey: k('kr.linkProject', 'b1') },
    { kind: 'field', target: 'okr-link-effect', bubbleKey: k('kr.linkProject', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'review.weekly', category: 'steer', requires: 'manager', steps: [
    { kind: 'goto', section: 'overview', via: 'nav-overview' },
    { kind: 'click', target: 'overview-weekly-review' },
    { kind: 'field', target: 'weekly-review-progress', bubbleKey: k('review.weekly', 'b1') },
    { kind: 'field', target: 'weekly-review-blockers', bubbleKey: k('review.weekly', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'report.view', category: 'steer', requires: 'report.org', steps: [
    { kind: 'goto', section: 'reports', via: 'nav-reports' },
    { kind: 'pick-first', target: 'reports-list', emptyKey: 'empty.noReport' },
    { kind: 'field', target: 'report-period', bubbleKey: k('report.view', 'b1') },
    { kind: 'field', target: 'report-scope', bubbleKey: k('report.view', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'team.workload', category: 'steer', requires: 'manager', steps: [
    { kind: 'goto', section: 'teams', via: 'nav-teams' },
    { kind: 'pick-first', target: 'teams-list', emptyKey: 'empty.noTeam' },
    { kind: 'field', target: 'team-workload-members', bubbleKey: k('team.workload', 'b1') },
    { kind: 'field', target: 'team-workload-overload', bubbleKey: k('team.workload', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'tasks.export', category: 'steer', requires: 'admin', steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'field', target: 'export-format', bubbleKey: k('tasks.export', 'b1') },
    { kind: 'field', target: 'export-filters', bubbleKey: k('tasks.export', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'org.profile', category: 'steer', requires: 'admin', steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'field', target: 'org-profile-name', bubbleKey: k('org.profile', 'b1') },
    { kind: 'field', target: 'org-profile-logo', bubbleKey: k('org.profile', 'b2') },
    { kind: 'field', target: 'org-profile-timezone', bubbleKey: k('org.profile', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
];
