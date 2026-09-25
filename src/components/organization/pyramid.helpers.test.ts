// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Logique de l'organigramme — premiers tests du mode entreprise.
//
// `PyramidTab.tsx` (1 389 LOC) pilote la hiérarchie de l'entreprise et n'avait
// aucune couverture (audit archi 2026-08-07, M1). Ces tests visent les quatre
// fonctions qui décident quelque chose, pas celles qui affichent.
//
// Le cas le plus important est le CYCLE : rattacher un manager sous l'un de
// ses propres subordonnés produirait A→B→A. `get_subtree` étant une CTE
// récursive appelée depuis les policies RLS, un cycle se paierait à chaque
// lecture d'agenda, pas seulement à l'affichage de l'organigramme.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import type { OrgMember } from '@/modules/organizations';
import {
  canManage,
  isValidDestination,
  matchesQuery,
  normalize,
  readCollapsedIds,
  collapsedStorageKey,
  defaultCollapsedIds,
  ancestorIds,
  hasStoredCollapsed,
} from './pyramid.helpers';

const m = (userId: string, managerId: string | null, displayName = userId, email = `${userId}@x.dev`): OrgMember =>
  ({ userId, managerId, displayName, email, role: 'member' } as OrgMember);

//        pdg
//       /   \
//    alice   bob
//      |
//    carol
const MEMBERS: OrgMember[] = [
  m('pdg', null, 'Frédéric Dupont'),
  m('alice', 'pdg', 'Alice Martin'),
  m('carol', 'alice', 'Carol Nguyen'),
  m('bob', 'pdg', 'Bob Léger'),
];

describe('normalize / matchesQuery', () => {
  it('ignore accents et casse', () => {
    expect(normalize('Frédéric')).toBe('frederic');
    expect(matchesQuery(MEMBERS[0], 'frederic')).toBe(true);
    expect(matchesQuery(MEMBERS[0], 'FRÉDÉ')).toBe(true);
  });

  it('cherche aussi dans l\'email', () => {
    expect(matchesQuery(MEMBERS[1], 'alice@x')).toBe(true);
  });

  it('une requête vide ne matche personne (sinon tout serait surligné)', () => {
    expect(matchesQuery(MEMBERS[0], '')).toBe(false);
    expect(matchesQuery(MEMBERS[0], '   ')).toBe(false);
  });
});

describe('canManage', () => {
  it('un admin peut déplacer tout le monde…', () => {
    expect(canManage(MEMBERS[1], MEMBERS, 'pdg', true)).toBe(true);
    expect(canManage(MEMBERS[3], MEMBERS, 'pdg', true)).toBe(true);
  });

  it('…sauf lui-même — se déplacer = s\'octroyer un périmètre', () => {
    expect(canManage(m('pdg', null), MEMBERS, 'pdg', true)).toBe(false);
  });

  it('un manager ne peut déplacer que son propre sous-arbre', () => {
    expect(canManage(MEMBERS[2], MEMBERS, 'alice', false)).toBe(true);  // carol est sous alice
    expect(canManage(MEMBERS[3], MEMBERS, 'alice', false)).toBe(false); // bob ne l'est pas
  });

  it('sans session, rien n\'est déplaçable', () => {
    expect(canManage(MEMBERS[1], MEMBERS, undefined, true)).toBe(false);
  });
});

describe('isValidDestination', () => {
  it('refuse de rattacher quelqu\'un sous LUI-MÊME', () => {
    expect(isValidDestination(MEMBERS[1], 'alice', MEMBERS, 'pdg', true)).toBe(false);
  });

  it('refuse un déplacement qui ne change rien (déjà ce manager)', () => {
    expect(isValidDestination(MEMBERS[2], 'alice', MEMBERS, 'pdg', true)).toBe(false);
  });

  it('⚠️ refuse le CYCLE : alice sous carol, alors que carol est sous alice', () => {
    // Sans cette garde, la hiérarchie devient alice→carol→alice, et
    // `get_subtree` (CTE récursive appelée par les policies RLS) boucle
    // jusqu'à sa borne de profondeur à CHAQUE évaluation.
    expect(isValidDestination(MEMBERS[1], 'carol', MEMBERS, 'pdg', true)).toBe(false);
  });

  it('refuse une destination inexistante', () => {
    expect(isValidDestination(MEMBERS[2], 'fantome', MEMBERS, 'pdg', true)).toBe(false);
  });

  it('accepte un déplacement légitime', () => {
    expect(isValidDestination(MEMBERS[2], 'bob', MEMBERS, 'pdg', true)).toBe(true);
  });

  it('un manager ne peut pas déposer hors de son périmètre', () => {
    // Alice tente de rattacher carol sous bob : bob n'est pas dans son sous-arbre.
    expect(isValidDestination(MEMBERS[2], 'bob', MEMBERS, 'alice', false)).toBe(false);
    // Mais elle peut la rattacher directement sous elle-même.
    expect(isValidDestination(m('carol', 'bob'), 'alice', MEMBERS, 'alice', false)).toBe(true);
  });
});

describe('readCollapsedIds', () => {
  beforeEach(() => localStorage.clear());

  it('relit ce qui a été écrit', () => {
    localStorage.setItem(collapsedStorageKey('org1'), JSON.stringify(['a', 'b']));
    expect([...readCollapsedIds('org1')].sort()).toEqual(['a', 'b']);
  });

  it('rien de stocké = rien de replié', () => {
    expect(readCollapsedIds('org1').size).toBe(0);
  });

  it('JSON corrompu : repli sûr au lieu d\'un crash de tout l\'organigramme (B14)', () => {
    localStorage.setItem(collapsedStorageKey('org1'), '{pas du json');
    expect(readCollapsedIds('org1').size).toBe(0);
  });

  it('filtre les entrées non-chaînes au lieu de rejeter tout le tableau', () => {
    localStorage.setItem(collapsedStorageKey('org1'), JSON.stringify(['a', 42, null, 'b']));
    expect([...readCollapsedIds('org1')].sort()).toEqual(['a', 'b']);
  });

  it('une valeur non-tableau ne fait pas planter', () => {
    localStorage.setItem(collapsedStorageKey('org1'), JSON.stringify({ nope: true }));
    expect(readCollapsedIds('org1').size).toBe(0);
  });
});

// ─── Grande organisation (audit du 2026-09-24) ────────────────────────

describe('pyramide à grande échelle', () => {
  const mk = (userId: string, managerId: string | null) =>
    ({ orgId: 'o', userId, role: 'member' as const, managerId, joinedAt: '', displayName: userId });
  // ceo → (a → (a1 → a1x), b), et b n'a personne
  const members = [mk('ceo', null), mk('a', 'ceo'), mk('b', 'ceo'), mk('a1', 'a'), mk('a1x', 'a1')];
  interface TestNode { member: ReturnType<typeof mk>; children: TestNode[] }
  const node = (id: string, children: TestNode[] = []): TestNode =>
    ({ member: members.find((m) => m.userId === id)!, children });
  const roots = [node('ceo', [node('a', [node('a1', [node('a1x')])]), node('b')])];

  it('defaultCollapsedIds : racine et rapports directs visibles, tout nœud ≥ 1 avec subordonnés replié', () => {
    expect([...defaultCollapsedIds(roots)].sort()).toEqual(['a', 'a1']);
  });

  it('ancestorIds : la chaîne de managers au-dessus des résultats, sans le résultat lui-même', () => {
    expect([...ancestorIds(members, new Set(['a1x']))].sort()).toEqual(['a', 'a1', 'ceo']);
    expect([...ancestorIds(members, new Set(['ceo']))]).toEqual([]);
  });

  it('ancestorIds : un cycle corrompu dans manager_id ne boucle pas', () => {
    const cyclic = [mk('x', 'y'), mk('y', 'x')];
    expect([...ancestorIds(cyclic, new Set(['x']))].sort()).toEqual(['x', 'y']);
  });

  it("hasStoredCollapsed : distingue « aucune préférence » de « rien de replié »", () => {
    localStorage.removeItem(collapsedStorageKey('big'));
    expect(hasStoredCollapsed('big')).toBe(false);
    localStorage.setItem(collapsedStorageKey('big'), '[]');
    expect(hasStoredCollapsed('big')).toBe(true);
    localStorage.removeItem(collapsedStorageKey('big'));
  });
});

// ─── Changement de POSITION (audit du 2026-09-24, étape 4) ────────────
// « Le passage manager → membre se fait par la pyramide, en silence. »
import { positionChange } from './pyramid.helpers';

describe('positionChange — qui perd ou gagne la position de manager', () => {
  const org = [m('ceo', null), m('a', 'ceo'), m('b', 'ceo'), m('a1', 'a'), m('solo', null)];

  it("déplacer le DERNIER subordonné d'un manager lui fait perdre la position", () => {
    const change = positionChange(org, 'a1', 'b');
    expect(change.losesManagerRole?.userId).toBe('a');
    // b n'avait personne : il devient manager.
    expect(change.becomesManager?.userId).toBe('b');
  });

  it("un manager qui garde d'autres subordonnés ne perd rien", () => {
    const change = positionChange(org, 'a', 'b');
    expect(change.losesManagerRole).toBeNull();
    expect(change.becomesManager?.userId).toBe('b');
  });

  it('placer sous quelqu’un qui encadre déjà ne signale aucun gain', () => {
    expect(positionChange(org, 'solo', 'ceo')).toEqual({ losesManagerRole: null, becomesManager: null });
  });

  it('détacher (null) peut faire perdre, jamais gagner', () => {
    expect(positionChange(org, 'a1', null)).toEqual({
      losesManagerRole: expect.objectContaining({ userId: 'a' }),
      becomesManager: null,
    });
  });

  it('un non-déplacement ne signale rien', () => {
    expect(positionChange(org, 'a1', 'a')).toEqual({ losesManagerRole: null, becomesManager: null });
    expect(positionChange(org, 'inconnu', 'a')).toEqual({ losesManagerRole: null, becomesManager: null });
  });
});
