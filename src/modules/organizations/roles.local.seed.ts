// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS (rôles) - Données de démonstration (seed)
// ═══════════════════════════════════════════════════════════════════
//
// Jeu de données seul (V12.3) : aucune lecture ni écriture de stockage ici. Le
// dépôt de démo voisin l'ensemence au premier accès.

import { localizeSeed } from '@/lib/seed-i18n';
import { DEMO_ORG_ID } from './local.repository';
import type { OrgCustomRole, OrgRoleAssignment } from './roles.types';

export const DEMO_USER_ID = 'demo-user';
const DAY = 24 * 60 * 60 * 1000;

export const seedRoles = (): OrgCustomRole[] => {
  const now = new Date().toISOString();
  const base: OrgCustomRole[] = [
    {
      id: 'role-demo-lead', orgId: DEMO_ORG_ID, name: 'Chef de projet', color: '#6366f1',
      grantedKeys: ['task.create', 'task.editAny', 'project.create', 'project.edit', 'okr.create'],
      assignTargets: ['everyone'], createdBy: DEMO_USER_ID, createdAt: now, updatedAt: now,
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

export const seedAssignments = (): OrgRoleAssignment[] => {
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
