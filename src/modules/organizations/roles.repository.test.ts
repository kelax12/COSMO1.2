// `IOrgRolesRepository` (mig. 219) n'a pas de code exécutable : ce test en
// garde le CONTRAT double mode. La liste est exhaustive à la compilation
// (`satisfies`) : une méthode ajoutée à l'interface sans être listée ici
// casse `typecheck`.
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: null }));

import type { IOrgRolesRepository } from './roles.repository';
import { LocalStorageOrgRolesRepository } from './roles.local.repository';
import { SupabaseOrgRolesRepository } from './roles.supabase.repository';

const METHODS = {
  getRoles: true,
  getAssignments: true,
  getMyAssignments: true,
  createRole: true,
  updateRole: true,
  deleteRole: true,
  assignRole: true,
  revokeAssignment: true,
} satisfies Record<keyof IOrgRolesRepository, true>;

const IMPLEMENTATIONS = [
  ['démo (localStorage)', LocalStorageOrgRolesRepository.prototype],
  ['production (Supabase)', SupabaseOrgRolesRepository.prototype],
] as const;

describe('IOrgRolesRepository · contrat double mode', () => {
  it.each(IMPLEMENTATIONS)('%s implémente chaque méthode de l interface', (_label, proto) => {
    const missing = Object.keys(METHODS).filter(
      (m) => typeof (proto as unknown as Record<string, unknown>)[m] !== 'function',
    );
    expect(missing).toEqual([]);
  });

  it('les deux implémentations exposent la même surface publique de l interface', () => {
    const surface = (proto: object) =>
      Object.getOwnPropertyNames(proto).filter((m) => Object.prototype.hasOwnProperty.call(METHODS, m)).sort();
    const [[, local], [, prod]] = IMPLEMENTATIONS;
    expect(surface(local)).toEqual(surface(prod));
    expect(surface(local)).toHaveLength(Object.keys(METHODS).length);
  });
});
