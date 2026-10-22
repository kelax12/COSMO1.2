import { describe, it, expect } from 'vitest';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import { rowsToCSV } from '@/lib/csv-export';
import { buildDirectoryCsv, type DirectoryCsvLabels } from './member-directory.export';

const mk = (userId: string, over: Partial<OrgMember> = {}): OrgMember => ({
  orgId: 'o', userId, role: 'member', joinedAt: '2026-03-05T22:30:00Z', displayName: userId, managerId: null, ...over,
});
const team = (id: string, name: string): OrgTeam => ({ id, orgId: 'o', name, color: '#000', createdBy: null, createdAt: '' });

const LABELS: DirectoryCsvLabels = {
  headers: { name: 'Nom', email: 'E-mail', role: 'Rôle', manager: 'Manager', teams: 'Équipes', joinedAt: 'Arrivée' },
  roles: { admin: 'Admin', manager: 'Manager', member: 'Membre' },
};

const MEMBERS = [
  mk('boss', { role: 'admin', displayName: 'Alice', email: 'alice@acme.io' }),
  mk('ann', { managerId: 'boss', displayName: '=HYPERLINK("x")' }),
];

describe('buildDirectoryCsv', () => {
  it('six colonnes fermées, rôle dérivé, manager par son NOM, équipes triées', () => {
    const teams = new Map([['ann', [team('b', 'Ventes'), team('a', 'Achats')]]]);
    const out = buildDirectoryCsv(MEMBERS, MEMBERS, teams, LABELS);
    expect(out.headers).toEqual(['Nom', 'E-mail', 'Rôle', 'Manager', 'Équipes', 'Arrivée']);
    expect(out.rows[0]).toEqual(['Alice', 'alice@acme.io', 'Admin', '', '', '2026-03-05']);
    expect(out.rows[1]).toEqual(['=HYPERLINK("x")', '', 'Membre', 'Alice', 'Achats | Ventes', '2026-03-05']);
  });

  it('n exporte QUE les lignes passées (le résultat filtré), mais résout les managers sur tout l annuaire', () => {
    const out = buildDirectoryCsv([MEMBERS[1]], MEMBERS, new Map(), LABELS);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0][3]).toBe('Alice');
  });

  it('un nom qui commence par = est neutralisé par l échappement commun (N11)', () => {
    const out = buildDirectoryCsv(MEMBERS, MEMBERS, new Map(), LABELS);
    expect(rowsToCSV(out.headers, out.rows)).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
