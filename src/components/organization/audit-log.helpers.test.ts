import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '@/modules/organizations/governance.types';
import {
  auditChange, auditDayKey,
  AUDIT_ACTIONS, auditActionKey, auditFamilyKey, auditObjectName, auditPersonName, buildAuditCsv, isKnownAuditAction,
  type AuditLookups,
} from './audit-log.helpers';

const entry = (over: Partial<AuditEntry>): AuditEntry => ({
  id: 'e', actorId: 'u1', action: 'project.archived', targetType: 'project', targetId: 'p1',
  targetUserId: null, meta: null, createdAt: '2026-09-25T10:00:00Z', ...over,
});

const lookups: AuditLookups = {
  memberName: (id) => ({ u1: 'Alice', u2: 'Bob' } as Record<string, string>)[id],
  teamName: (id) => (id === 't1' ? 'Produit' : undefined),
  projectName: (id) => (id === 'p1' ? 'Nom actuel' : undefined),
};

describe('audit-log.helpers', () => {
  it('toutes les actions écrites par les triggers ont une clé', () => {
    expect(AUDIT_ACTIONS.every((a) => !auditActionKey(a).includes('.'))).toBe(true);
    expect(auditActionKey('member.role_changed')).toBe('member_role_changed');
    expect(auditFamilyKey('project.')).toBe('project');
  });

  it('une action inconnue (base plus récente) n’est pas prise pour une connue', () => {
    expect(isKnownAuditAction('project.health_changed')).toBe(true);
    expect(isKnownAuditAction('project.exploded')).toBe(false);
  });

  it('le nom FIGÉ au moment du geste passe avant le nom courant', () => {
    expect(auditObjectName(entry({ meta: { name: 'Ancien nom' } }), lookups)).toBe('Ancien nom');
    expect(auditObjectName(entry({ meta: null }), lookups)).toBe('Nom actuel');
    expect(auditObjectName(entry({ targetType: 'team', targetId: 't1' }), lookups)).toBe('Produit');
    expect(auditObjectName(entry({ targetType: 'org', targetId: 'o', meta: { to: 'Acme SA' } }), lookups)).toBe('Acme SA');
  });

  it('la personne visée, ou un repli pour un ancien membre', () => {
    expect(auditPersonName(entry({ targetUserId: 'u2' }), lookups, '?')).toBe('Bob');
    expect(auditPersonName(entry({ targetUserId: 'gone' }), lookups, 'ancien')).toBe('ancien');
    expect(auditPersonName(entry({}), lookups, 'ancien')).toBe('');
  });

  it('CSV : une ligne par entrée, action en code stable', () => {
    const csv = buildAuditCsv(
      [entry({ targetUserId: 'u2', action: 'project.member_added' }), entry({ actorId: null })],
      lookups,
      { headers: ['D', 'A', 'Ac', 'P', 'O'], someone: 'quelqu’un' },
    );
    expect(csv.headers).toEqual(['D', 'A', 'Ac', 'P', 'O']);
    expect(csv.rows[0]).toEqual(['2026-09-25T10:00:00Z', 'Alice', 'project.member_added', 'Bob', 'Nom actuel']);
    expect(csv.rows[1][1]).toBe('quelqu’un');
  });
});

describe('auditChange (reco UI n° 36)', () => {
  const entry = (action: string, meta: Record<string, unknown> | null): AuditEntry => ({
    id: '1', actorId: null, action, targetType: 'x', targetId: null, targetUserId: null, meta, createdAt: '2026-09-29T10:00:00Z',
  });
  const lookups = {
    memberName: (id: string) => ({ u1: 'Léa', u2: 'Tom' } as Record<string, string>)[id],
    teamName: (id: string) => ({ t1: 'Produit' } as Record<string, string>)[id],
    projectName: () => undefined,
  };
  const label = (_k: string, v: string) => `L:${v}`;
  const empty = (k: string) => `vide-${k}`;

  it('nomme les personnes d un déplacement dans la pyramide', () => {
    expect(auditChange(entry('member.moved', { from: 'u1', to: 'u2' }), lookups, label, empty)).toEqual({ from: 'Léa', to: 'Tom' });
  });

  it('lit une audience NULL comme toute l organisation', () => {
    expect(auditChange(entry('project.visibility_changed', { from: 't1', to: null }), lookups, label, empty))
      .toEqual({ from: 'Produit', to: 'vide-team' });
  });

  it('passe les codes par le libellé', () => {
    expect(auditChange(entry('project.status_changed', { name: 'X', from: 'active', to: 'done' }), lookups, label, empty))
      .toEqual({ from: 'L:active', to: 'L:done' });
  });

  it('ne rend rien sans from/to, pour une action sans changement, ou inconnue', () => {
    expect(auditChange(entry('member.moved', null), lookups, label, empty)).toBeNull();
    expect(auditChange(entry('member.joined', { from: 'a', to: 'b' }), lookups, label, empty)).toBeNull();
    expect(auditChange(entry('zzz.future', { from: 'a', to: 'b' }), lookups, label, empty)).toBeNull();
  });

  it('groupe par jour LOCAL', () => {
    const d = new Date(2026, 8, 29, 23, 30);
    expect(auditDayKey(d.toISOString())).toBe('2026-09-29');
  });
});
