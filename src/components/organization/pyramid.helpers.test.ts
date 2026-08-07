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
