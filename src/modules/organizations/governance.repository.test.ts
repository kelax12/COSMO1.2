// `IOrgGovernanceRepository` n'a pas de code exécutable : ce test en garde le
// CONTRAT double mode. La liste est exhaustive à la compilation
// (`satisfies`) : une méthode ajoutée à l'interface sans être listée ici
// casse `typecheck`.
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: null }));

import type { IOrgGovernanceRepository } from './governance.repository';
import { LocalStorageOrgGovernanceRepository } from './governance.local.repository';
import { SupabaseOrgGovernanceRepository } from './governance.supabase.repository';

const METHODS = {
  getDepartureImpact: true,
  offboardMember: true,
  setMemberAccess: true,
  createEmailInvitations: true,
  sendEmailInvitations: true,
  getEmailInvitations: true,
  revokeEmailInvitation: true,
  getAuditLog: true,
  getNotificationSettings: true,
  saveNotificationSettings: true,
  getWeeklyReviews: true,
  saveWeeklyReview: true,
  search: true,
} satisfies Record<keyof IOrgGovernanceRepository, true>;

const IMPLEMENTATIONS = [
  ['démo (localStorage)', LocalStorageOrgGovernanceRepository.prototype],
  ['production (Supabase)', SupabaseOrgGovernanceRepository.prototype],
] as const;

describe('IOrgGovernanceRepository · contrat double mode', () => {
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
