// src/components/org-guide/scenarios/people.ts
import type { GuideAction } from '../guide-types';

const k = (id: string, b: string) => `actions.${id}.${b}`;

export const PEOPLE_ACTIONS: GuideAction[] = [
  { id: 'team.create', category: 'people', requires: 'team.create', steps: [
    { kind: 'goto', section: 'teams', via: 'nav-teams' },
    { kind: 'click', target: 'teams-new' },
    { kind: 'field', target: 'team-form-name', bubbleKey: k('team.create', 'b1') },
    { kind: 'field', target: 'team-form-lead', bubbleKey: k('team.create', 'b2') },
    { kind: 'field', target: 'team-form-members', bubbleKey: k('team.create', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'member.inviteEmail', category: 'people', requires: 'member.invite', steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'click', target: 'members-invite' },
    { kind: 'click', target: 'invite-mode-email' },
    { kind: 'field', target: 'invite-email-addresses', bubbleKey: k('member.inviteEmail', 'b1') },
    { kind: 'field', target: 'invite-email-role', bubbleKey: k('member.inviteEmail', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'member.inviteLink', category: 'people', requires: 'member.invite', steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'click', target: 'members-invite' },
    { kind: 'click', target: 'invite-mode-link' },
    { kind: 'field', target: 'invite-link-copy', bubbleKey: k('member.inviteLink', 'b1') },
    { kind: 'field', target: 'invite-link-expiry', bubbleKey: k('member.inviteLink', 'b2') },
    { kind: 'field', target: 'invite-join-code', bubbleKey: k('member.inviteLink', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'member.joinRequest', category: 'people', requires: 'member.invite', steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'pick-first', target: 'members-join-requests', emptyKey: 'empty.noRequest', bubbleKey: k('member.joinRequest', 'b1') },
    { kind: 'field', target: 'join-request-actions', bubbleKey: k('member.joinRequest', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'team.addMembers', category: 'people', requires: 'manager', steps: [
    { kind: 'goto', section: 'teams', via: 'nav-teams' },
    { kind: 'pick-first', target: 'teams-list', emptyKey: 'empty.noTeam' },
    { kind: 'click', target: 'team-members-add' },
    { kind: 'field', target: 'team-add-picker', bubbleKey: k('team.addMembers', 'b1') },
    { kind: 'field', target: 'team-add-role', bubbleKey: k('team.addMembers', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'pyramid.place', category: 'people', requires: 'admin', steps: [
    { kind: 'goto', section: 'pyramid', via: 'nav-pyramid' },
    { kind: 'pick-first', target: 'pyramid-unplaced', emptyKey: 'empty.noUnplaced' },
    { kind: 'field', target: 'pyramid-place-manager', bubbleKey: k('pyramid.place', 'b1') },
    { kind: 'field', target: 'pyramid-place-effect', bubbleKey: k('pyramid.place', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'member.offboard', category: 'people', requires: 'admin', steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'pick-first', target: 'members-directory', emptyKey: 'empty.noMember' },
    { kind: 'click', target: 'member-lifecycle-offboard' },
    { kind: 'field', target: 'offboard-reassign', bubbleKey: k('member.offboard', 'b1') },
    { kind: 'field', target: 'offboard-kept', bubbleKey: k('member.offboard', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
];
