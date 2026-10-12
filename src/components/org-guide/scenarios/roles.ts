// src/components/org-guide/scenarios/roles.ts
import type { GuideAction } from '../guide-types';

const k = (id: string, b: string) => `actions.${id}.${b}`;

export const ROLES_ACTIONS: GuideAction[] = [
  { id: 'role.create', category: 'roles', requires: 'role.manage', needsCustomRoles: true, steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'click', target: 'settings-roles-new' },
    { kind: 'field', target: 'role-editor-name', bubbleKey: k('role.create', 'b1') },
    { kind: 'field', target: 'role-editor-matrix', bubbleKey: k('role.create', 'b2') },
    { kind: 'field', target: 'role-editor-color', bubbleKey: k('role.create', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'role.edit', category: 'roles', requires: 'role.manage', needsCustomRoles: true, steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'pick-first', target: 'settings-roles-list', emptyKey: 'empty.noRole' },
    { kind: 'field', target: 'role-editor-matrix', bubbleKey: k('role.edit', 'b1') },
    { kind: 'field', target: 'role-editor-members', bubbleKey: k('role.edit', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'role.assign', category: 'roles', requires: 'role.manage', needsCustomRoles: true, steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'pick-first', target: 'members-directory', emptyKey: 'empty.noMember' },
    { kind: 'click', target: 'member-assign-role' },
    { kind: 'field', target: 'assign-role-select', bubbleKey: k('role.assign', 'b1') },
    { kind: 'field', target: 'assign-role-stack', bubbleKey: k('role.assign', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'role.assignTimed', category: 'roles', requires: 'role.manage', needsCustomRoles: true, steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'pick-first', target: 'members-directory', emptyKey: 'empty.noMember' },
    { kind: 'click', target: 'member-assign-role' },
    { kind: 'field', target: 'assign-role-until', bubbleKey: k('role.assignTimed', 'b1') },
    { kind: 'field', target: 'assign-role-until-hint', bubbleKey: k('role.assignTimed', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'member.permissions', category: 'roles', requires: 'admin', steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'pick-first', target: 'members-directory', emptyKey: 'empty.noMember' },
    { kind: 'click', target: 'member-open-permissions' },
    { kind: 'field', target: 'member-permissions-matrix', bubbleKey: k('member.permissions', 'b1') },
    { kind: 'field', target: 'member-permissions-default', bubbleKey: k('member.permissions', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'me.permissions', category: 'roles', steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'field', target: 'my-permissions-card', bubbleKey: k('me.permissions', 'b1') },
    { kind: 'field', target: 'my-permissions-source', bubbleKey: k('me.permissions', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'org.transferOwnership', category: 'roles', requires: 'owner', steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'click', target: 'settings-transfer-ownership' },
    { kind: 'field', target: 'transfer-new-owner', bubbleKey: k('org.transferOwnership', 'b1') },
    { kind: 'field', target: 'transfer-warning', bubbleKey: k('org.transferOwnership', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
];
