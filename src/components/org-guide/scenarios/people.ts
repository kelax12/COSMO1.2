// src/components/org-guide/scenarios/people.ts
import type { GuideAction } from '../guide-types';

const k = (id: string, b: string) => `actions.${id}.${b}`;

export const PEOPLE_ACTIONS: GuideAction[] = [
  // Le responsable se désigne dans la liste des membres (couronne), pas dans un champ à part.
  { id: 'team.create', category: 'people', requires: 'team.create', steps: [
    { kind: 'goto', section: 'teams', via: 'nav-teams' },
    { kind: 'click', target: 'teams-new' },
    { kind: 'field', target: 'team-form-name', bubbleKey: k('team.create', 'b1') },
    { kind: 'field', target: 'team-form-members', bubbleKey: k('team.create', 'b2') },
  ] },
  // Le rôle d'arrivée se choisit APRÈS « Continuer » (bouton qui avance) : on s'arrête avant.
  { id: 'member.inviteEmail', category: 'people', requires: 'member.invite', steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'click', target: 'members-invite' },
    { kind: 'click', target: 'invite-mode-email' },
    { kind: 'field', target: 'invite-email-addresses', bubbleKey: k('member.inviteEmail', 'b1') },
    { kind: 'field', target: 'invite-email-intro', bubbleKey: k('member.inviteEmail', 'b2') },
  ] },
  // Lien et code sont deux onglets de la même modale ; le lien n'a pas de réglage d'expiration.
  { id: 'member.inviteLink', category: 'people', requires: 'member.invite', steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'click', target: 'members-invite' },
    { kind: 'click', target: 'invite-mode-link' },
    { kind: 'field', target: 'invite-link-card', bubbleKey: k('member.inviteLink', 'b1') },
    { kind: 'click', target: 'invite-mode-code' },
    { kind: 'field', target: 'invite-join-code', bubbleKey: k('member.inviteLink', 'b2') },
  ] },
  // Les demandes d'adhésion sont dans Paramètres → Inviter, et aux admins seuls.
  { id: 'member.joinRequest', category: 'people', requires: 'admin', steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'click', target: 'settings-panel-invite' },
    { kind: 'field', target: 'members-join-requests', emptyKey: 'empty.noRequest', bubbleKey: k('member.joinRequest', 'b1') },
    { kind: 'field', target: 'join-request-first', bubbleKey: k('member.joinRequest', 'b2') },
  ] },
  // L'ajout en lot n'a pas de rôle par personne.
  { id: 'team.addMembers', category: 'people', requires: 'team.create', steps: [
    { kind: 'goto', section: 'teams', via: 'nav-teams' },
    { kind: 'pick-first', target: 'teams-list', emptyKey: 'empty.noTeam' },
    { kind: 'click', target: 'team-members-add', emptyKey: 'empty.noOneToAdd' },
    { kind: 'field', target: 'team-add-picker', bubbleKey: k('team.addMembers', 'b1') },
  ] },
  // `pick-first` ouvre le menu « ⋮ » de la première ligne qui en a un (jamais la sienne).
  { id: 'member.offboard', category: 'people', requires: 'admin', steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'pick-first', target: 'members-directory', emptyKey: 'empty.noMember' },
    { kind: 'click', target: 'member-lifecycle-offboard' },
    { kind: 'field', target: 'offboard-reassign', bubbleKey: k('member.offboard', 'b1') },
    { kind: 'field', target: 'offboard-mode', bubbleKey: k('member.offboard', 'b2') },
  ] },
];
