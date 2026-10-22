// src/components/org-guide/scenarios/steer.ts
import type { GuideAction } from '../guide-types';

const k = (id: string, b: string) => `actions.${id}.${b}`;

// « Lier un KR à un projet » est retiré : aucun écran ne le permet aujourd'hui
// (`TeamOKRLinkFields` et `KRExecutionDialog` ne sont montés nulle part).
export const STEER_ACTIONS: GuideAction[] = [
  { id: 'okr.create', category: 'steer', requires: 'okr.create', steps: [
    { kind: 'goto', section: 'okr', via: 'nav-okr' },
    { kind: 'click', target: 'okr-new' },
    { kind: 'field', target: 'okr-form-objective', bubbleKey: k('okr.create', 'b1') },
    { kind: 'field', target: 'okr-form-krs', bubbleKey: k('okr.create', 'b2') },
    { kind: 'field', target: 'okr-form-audience', bubbleKey: k('okr.create', 'b3') },
  ] },
  // La valeur d'un KR se saisit en ligne sur la carte (desktop), sans dialogue.
  { id: 'kr.update', category: 'steer', steps: [
    { kind: 'goto', section: 'okr', via: 'nav-okr' },
    { kind: 'field', target: 'okr-kr-value', emptyKey: 'empty.noOkr', bubbleKey: k('kr.update', 'b1') },
    { kind: 'field', target: 'okr-kr-progress', bubbleKey: k('kr.update', 'b2') },
  ] },
  // Les rapports sont une rubrique de Paramètres, lus par période (pas de liste à choisir).
  { id: 'report.view', category: 'steer', requires: 'report.org', steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'click', target: 'settings-panel-reports' },
    { kind: 'field', target: 'report-period', emptyKey: 'empty.noReport', bubbleKey: k('report.view', 'b1') },
    { kind: 'field', target: 'report-scope', bubbleKey: k('report.view', 'b2') },
  ] },
  { id: 'team.workload', category: 'steer', requires: 'manager', steps: [
    { kind: 'goto', section: 'teams', via: 'nav-teams' },
    { kind: 'pick-first', target: 'teams-list', emptyKey: 'empty.noTeam' },
    { kind: 'field', target: 'team-workload-members', emptyKey: 'empty.noTeamProject', bubbleKey: k('team.workload', 'b1') },
    { kind: 'field', target: 'team-workload-legend', bubbleKey: k('team.workload', 'b2') },
  ] },
  // L'export est un CSV de toutes les tâches, sans format ni filtre à régler.
  { id: 'tasks.export', category: 'steer', requires: 'admin', steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'click', target: 'settings-panel-export' },
    { kind: 'field', target: 'export-hint', bubbleKey: k('tasks.export', 'b1') },
  ] },
  // Le profil n'a pas de fuseau horaire : la bulle 3 vise la description.
  // Paramètres garde sa rubrique tant qu'on y reste : cliquer Profil, ne pas le supposer.
  { id: 'org.profile', category: 'steer', requires: 'admin', steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'click', target: 'settings-panel-profile' },
    { kind: 'field', target: 'org-profile-name', bubbleKey: k('org.profile', 'b1') },
    { kind: 'field', target: 'org-profile-logo', bubbleKey: k('org.profile', 'b2') },
    { kind: 'field', target: 'org-profile-description', bubbleKey: k('org.profile', 'b3') },
  ] },
];
