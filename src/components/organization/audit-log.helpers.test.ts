import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '@/modules/organizations/governance.types';
import {
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
