// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Rôles personnalisés — mode démo (localStorage, mig. 219)
//
// Rejoue les règles de la base qui se voient à l'écran : nom unique par
// organisation (insensible à la casse), jamais d'attribution à un admin, une
// seule ligne par (rôle, membre), suppression d'un rôle = attributions parties.
// ═══════════════════════════════════════════════════════════════════

import { readJsonArray, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import { localizeSeed } from '@/lib/seed-i18n';
import { DEMO_ORG_ID, LocalStorageOrganizationsRepository } from './local.repository';
import type { IOrgRolesRepository } from './roles.repository';
import type { AssignRoleInput, MyOrgRoleAssignment, OrgCustomRole, OrgRoleAssignment, SaveCustomRoleInput } from './roles.types';

export const ORG_ROLES_STORAGE_KEY = 'cosmo_org_roles';
export const ORG_MEMBER_ROLES_STORAGE_KEY = 'cosmo_org_member_roles';
const DEMO_USER_ID = 'demo-user';
const DAY = 24 * 60 * 60 * 1000;

const seedRoles = (): OrgCustomRole[] => {
  const now = new Date().toISOString();
  const base: OrgCustomRole[] = [
    {
      id: 'role-demo-lead', orgId: DEMO_ORG_ID, name: 'Chef de projet', color: '#6366f1',
      grantedKeys: ['task.create', 'task.editAny', 'project.create', 'project.edit', 'okr.create'],
      assignTargets: ['self', 'peers', 'subordinates'], createdBy: DEMO_USER_ID, createdAt: now, updatedAt: now,
    },
    {
      id: 'role-demo-intern', orgId: DEMO_ORG_ID, name: 'Stagiaire', color: '#14b8a6',
      grantedKeys: ['task.create'], assignTargets: ['self'], createdBy: DEMO_USER_ID, createdAt: now, updatedAt: now,
    },
  ];
  return localizeSeed(base, {
    'role-demo-lead': { name: 'Project lead' },
    'role-demo-intern': { name: 'Intern' },
  });
};

const seedAssignments = (): OrgRoleAssignment[] => {
  const now = Date.now();
  return [
    {
      id: 'mr-demo-1', orgId: DEMO_ORG_ID, roleId: 'role-demo-lead', userId: 'user-lucas',
      startsAt: new Date(now - 10 * DAY).toISOString(), endsAt: new Date(now + 20 * DAY).toISOString(),
      grantedBy: DEMO_USER_ID, createdAt: new Date(now - 10 * DAY).toISOString(),
    },
    {
      id: 'mr-demo-2', orgId: DEMO_ORG_ID, roleId: 'role-demo-intern', userId: 'user-karim',
      startsAt: new Date(now - 14 * DAY).toISOString(), endsAt: new Date(now + 3 * DAY).toISOString(),
      grantedBy: DEMO_USER_ID, createdAt: new Date(now - 14 * DAY).toISOString(),
    },
  ];
};

const readOrSeed = <T>(key: string, seed: () => T[]): T[] => {
  const stored = readJsonArray<T>(key);
  if (stored) return stored;
  const initial = seed();
  writeJsonOrThrow(key, initial);
  return initial;
};

export class LocalStorageOrgRolesRepository implements IOrgRolesRepository {
  private orgs = new LocalStorageOrganizationsRepository();

  private roles(): OrgCustomRole[] {
    return readOrSeed(ORG_ROLES_STORAGE_KEY, seedRoles);
  }

  private assignments(): OrgRoleAssignment[] {
    return readOrSeed(ORG_MEMBER_ROLES_STORAGE_KEY, seedAssignments);
  }

  private assertNameFree(orgId: string, name: string, exceptId?: string) {
    const wanted = name.trim().toLowerCase();
    if (!wanted) throw makeApiError('invalid_input');
    if (this.roles().some((r) => r.orgId === orgId && r.id !== exceptId && r.name.trim().toLowerCase() === wanted)) {
      throw makeApiError('23505');
    }
  }

  async getRoles(orgId: string): Promise<OrgCustomRole[]> {
    return this.roles()
      .filter((r) => r.orgId === orgId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getAssignments(orgId: string): Promise<OrgRoleAssignment[]> {
    return this.assignments().filter((a) => a.orgId === orgId);
  }

  async getMyAssignments(): Promise<MyOrgRoleAssignment[]> {
    // Même filtre que la production : le seed attribue des rôles à d'AUTRES
    // membres de l'organisation démo, qui ne sortent jamais dans l'export.
    const roles = new Map(this.roles().map((r) => [r.id, r]));
    return this.assignments()
      .filter((a) => a.userId === DEMO_USER_ID)
      .map((a) => ({
        ...a,
        roleName: roles.get(a.roleId)?.name ?? '',
        grantedKeys: roles.get(a.roleId)?.grantedKeys ?? [],
      }));
  }

  async createRole(orgId: string, input: SaveCustomRoleInput): Promise<OrgCustomRole> {
    this.assertNameFree(orgId, input.name);
    const now = new Date().toISOString();
    const role: OrgCustomRole = {
      id: crypto.randomUUID(), orgId, name: input.name.trim(), color: input.color,
      grantedKeys: [...new Set(input.grantedKeys)].sort(),
      assignTargets: [...new Set(input.assignTargets)].sort(),
      createdBy: DEMO_USER_ID, createdAt: now, updatedAt: now,
    };
    writeJsonOrThrow(ORG_ROLES_STORAGE_KEY, [...this.roles(), role]);
    return role;
  }

  async updateRole(roleId: string, input: SaveCustomRoleInput): Promise<void> {
    const all = this.roles();
    const current = all.find((r) => r.id === roleId);
    if (!current) throw makeApiError('not_found');
    this.assertNameFree(current.orgId, input.name, roleId);
    writeJsonOrThrow(ORG_ROLES_STORAGE_KEY, all.map((r) => (r.id === roleId
      ? {
          ...r, name: input.name.trim(), color: input.color,
          grantedKeys: [...new Set(input.grantedKeys)].sort(),
          assignTargets: [...new Set(input.assignTargets)].sort(),
          updatedAt: new Date().toISOString(),
        }
      : r)));
  }

  async deleteRole(roleId: string): Promise<void> {
    writeJsonOrThrow(ORG_ROLES_STORAGE_KEY, this.roles().filter((r) => r.id !== roleId));
    writeJsonOrThrow(ORG_MEMBER_ROLES_STORAGE_KEY, this.assignments().filter((a) => a.roleId !== roleId));
  }

  async assignRole(input: AssignRoleInput): Promise<void> {
    const role = this.roles().find((r) => r.id === input.roleId && r.orgId === input.orgId);
    if (!role) throw makeApiError('not_found');
    const target = (await this.orgs.getMembers(input.orgId)).find((m) => m.userId === input.userId);
    if (!target) throw makeApiError('member_not_found');
    if (target.role === 'admin') throw makeApiError('forbidden');

    const now = new Date().toISOString();
    const all = this.assignments();
    const existing = all.find((a) => a.roleId === input.roleId && a.userId === input.userId);
    const next: OrgRoleAssignment[] = existing
      ? all.map((a) => (a.id === existing.id ? { ...a, startsAt: now, endsAt: input.endsAt } : a))
      : [...all, {
          id: crypto.randomUUID(), orgId: input.orgId, roleId: input.roleId, userId: input.userId,
          startsAt: now, endsAt: input.endsAt, grantedBy: DEMO_USER_ID, createdAt: now,
        }];
    writeJsonOrThrow(ORG_MEMBER_ROLES_STORAGE_KEY, next);
  }

  async revokeAssignment(assignmentId: string): Promise<void> {
    writeJsonOrThrow(ORG_MEMBER_ROLES_STORAGE_KEY, this.assignments().filter((a) => a.id !== assignmentId));
  }
}
