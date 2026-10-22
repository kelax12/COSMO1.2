// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { exportAllCSV, exportKRCompletionsCSV, exportOrgRolesCSV } from './csv-export';
import type { KRCompletion } from '@/modules/kr-completions';
import { SupabaseKRCompletionsRepository } from '@/modules/kr-completions/supabase.repository';
import { LocalStorageKRCompletionsRepository } from '@/modules/kr-completions/repository';
import { SupabaseOrgRolesRepository } from '@/modules/organizations/roles.supabase.repository';
import {
  LocalStorageOrgRolesRepository,
  ORG_MEMBER_ROLES_STORAGE_KEY,
} from '@/modules/organizations/roles.local.repository';
import type { MyOrgRoleAssignment } from '@/modules/organizations/roles.types';
import { DEMO_ORG_ID } from '@/modules/organizations/local.repository';

// ═══════════════════════════════════════════════════════════════════
// Portabilité (RGPD art. 20) : le JOURNAL des KR et les RÔLES reçus
// ═══════════════════════════════════════════════════════════════════
//
// `kr_completions` était déclarée non exportée (« discutable, à rouvrir ») :
// c'est pourtant la seule trace de QUAND chaque résultat clé a été atteint.
// `org_member_roles` l'était aussi : les rôles qu'une organisation a donnés à
// la personne, et pour combien de temps. Ces tests exigent les deux fichiers,
// dans les deux modes, et que l'export d'une personne ne contienne QUE ses
// propres lignes : la RLS de `org_member_roles` laisse lire celles de toute
// l'organisation (`is_org_member(org_id)`), c'est donc au repository de filtrer.

const telecharges: { name: string; text: Promise<string> }[] = [];

beforeEach(() => {
  telecharges.length = 0;
  supabaseMock.reset();
  localStorage.clear();
  let dernierBlob: Blob | null = null;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
    dernierBlob = b as Blob;
    return 'blob:test';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    telecharges.push({ name: this.download, text: dernierBlob!.text() });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// Le BOM UTF-8 posé par `rowsToCSV`, écrit par son code : jamais en caractère littéral (no-irregular-whitespace).
const BOM = new RegExp(`^${String.fromCharCode(0xfeff)}`);
const lignes = async (i = 0) => (await telecharges[i].text).replace(BOM, '').split('\n');

const completion: KRCompletion = {
  id: 'c1', krId: 'kr-1', okrId: 'okr-1', userId: 'u1',
  completedAt: '2026-06-10T09:00:00.000Z', krTitle: 'Courir 10 km', okrTitle: 'Santé',
};

const role: MyOrgRoleAssignment = {
  id: 'mr-1', orgId: 'org-1', roleId: 'role-1', userId: 'u1',
  startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-12-31T00:00:00.000Z',
  grantedBy: 'manager-1', createdAt: '2026-10-01T00:00:00.000Z',
  roleName: 'Chef de projet', grantedKeys: ['task.create', 'okr.create'],
};

describe('export du journal des complétions de KR', () => {
  it('une ligne par complétion : date, OKR et KR (identifiants et titres)', async () => {
    exportKRCompletionsCSV([completion]);
    expect(telecharges[0].name).toMatch(/^cosmo-okr-historique-\d{4}-\d{2}-\d{2}\.csv$/);
    const l = await lignes();
    expect(l).toHaveLength(2);
    expect(l[1]).toBe('2026-06-10T09:00:00.000Z,okr-1,Santé,kr-1,Courir 10 km');
  });
});

describe('export des rôles reçus dans une organisation', () => {
  it('une ligne par attribution, sans désigner qui l’a accordée (un tiers)', async () => {
    exportOrgRolesCSV([role]);
    expect(telecharges[0].name).toMatch(/^cosmo-roles-\d{4}-\d{2}-\d{2}\.csv$/);
    const l = await lignes();
    expect(l).toHaveLength(2);
    expect(l[1]).toBe('org-1,role-1,Chef de projet,task.create okr.create,2026-10-01T00:00:00.000Z,2026-12-31T00:00:00.000Z');
    expect(l.join('\n')).not.toContain('manager-1');
  });

  it('un rôle sans limite garde une fin vide', async () => {
    exportOrgRolesCSV([{ ...role, endsAt: null }]);
    expect((await lignes())[1].endsWith('2026-10-01T00:00:00.000Z,')).toBe(true);
  });
});

describe('exportAllCSV livre les deux nouveaux fichiers', () => {
  it('dix fichiers, dont le journal des KR et les rôles', async () => {
    vi.useFakeTimers();
    exportAllCSV({
      tasks: [], taskDependencies: [], habits: [], events: [], okrs: [], categories: [], lists: [],
      krCompletions: [completion],
      orgRoles: [role],
      profile: { id: 'u1', name: 'A', email: 'a@example.com' },
    });
    vi.runAllTimers();
    expect(telecharges).toHaveLength(10);
    expect(telecharges.some((d) => d.name.startsWith('cosmo-okr-historique-'))).toBe(true);
    expect(telecharges.some((d) => d.name.startsWith('cosmo-roles-'))).toBe(true);
  });
});

describe('production : lecture sous RLS, bornée à la personne', () => {
  it('kr_completions : filtre user_id = moi et pagine (pas de troncature à 500)', async () => {
    supabaseMock.queueTable('kr_completions', {
      data: [{ id: 'c1', kr_id: 'kr-1', okr_id: 'okr-1', user_id: 'u1', completed_at: completion.completedAt, kr_title: 'Courir 10 km', okr_title: 'Santé' }],
    });
    const lues = await new SupabaseKRCompletionsRepository().getAllForExport();

    expect(supabaseMock.argsOf('kr_completions', 'eq')).toEqual(['user_id', '11111111-1111-4111-8111-111111111111']);
    expect(supabaseMock.argsOf('kr_completions', 'range')).toBeDefined();
    expect(supabaseMock.argsOf('kr_completions', 'limit')).toBeUndefined();
    exportKRCompletionsCSV(lues);
    expect((await lignes())[1]).toBe('2026-06-10T09:00:00.000Z,okr-1,Santé,kr-1,Courir 10 km');
  });

  it('org_member_roles : filtre user_id = moi (la RLS laisse voir toute l’org) et joint le nom du rôle', async () => {
    supabaseMock.queueTable('org_member_roles', {
      data: [{ id: 'mr-1', org_id: 'org-1', role_id: 'role-1', user_id: 'u1', starts_at: role.startsAt, ends_at: role.endsAt, granted_by: 'manager-1', created_at: role.createdAt }],
    });
    supabaseMock.queueTable('org_roles', {
      data: [{ id: 'role-1', name: 'Chef de projet', granted_keys: ['task.create', 'okr.create'] }],
    });
    const lues = await new SupabaseOrgRolesRepository().getMyAssignments();

    expect(supabaseMock.argsOf('org_member_roles', 'eq')).toEqual(['user_id', '11111111-1111-4111-8111-111111111111']);
    expect(supabaseMock.argsOf('org_roles', 'in')).toEqual(['id', ['role-1']]);
    exportOrgRolesCSV(lues);
    expect((await lignes())[1]).toBe('org-1,role-1,Chef de projet,task.create okr.create,2026-10-01T00:00:00.000Z,2026-12-31T00:00:00.000Z');
  });

  it('org_member_roles : aucune attribution, aucune seconde requête', async () => {
    supabaseMock.queueTable('org_member_roles', { data: [] });
    expect(await new SupabaseOrgRolesRepository().getMyAssignments()).toEqual([]);
    expect(supabaseMock.callsFor('org_roles')).toEqual([]);
  });
});

describe('démo : mêmes fichiers depuis le localStorage', () => {
  it('kr_completions : le journal seedé sort en entier', async () => {
    const repo = new LocalStorageKRCompletionsRepository();
    const tout = await repo.getAll();
    const lues = await repo.getAllForExport();
    expect(lues).toHaveLength(tout.length);
    exportKRCompletionsCSV(lues);
    expect(await lignes()).toHaveLength(tout.length + 1);
  });

  it('org_member_roles : seules les attributions du compte démo, jointes au rôle', async () => {
    const repo = new LocalStorageOrgRolesRepository();
    // Le seed attribue des rôles à d'AUTRES membres (user-lucas, user-karim) :
    // ils ne doivent jamais sortir dans l'export du compte démo.
    const seed = await repo.getAssignments(DEMO_ORG_ID);
    localStorage.setItem(ORG_MEMBER_ROLES_STORAGE_KEY, JSON.stringify([
      ...seed,
      { ...seed[0], id: 'mr-moi', userId: 'demo-user', roleId: 'role-demo-intern', endsAt: null },
    ]));

    const lues = await repo.getMyAssignments();
    expect(lues.map((a) => a.id)).toEqual(['mr-moi']);
    expect(lues[0].grantedKeys).toEqual(['task.create']);
    exportOrgRolesCSV(lues);
    const l = await lignes();
    expect(l).toHaveLength(2);
    expect(l[1]).toContain(',role-demo-intern,');
    expect(l.join('\n')).not.toMatch(/user-lucas|user-karim/);
  });
});
