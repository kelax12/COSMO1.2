// `IOrganizationsRepository` n'a pas de code exécutable : ce test en garde le
// CONTRAT. Une fonctionnalité qui ne marche que dans un des deux modes n'est
// pas finie (`CLAUDE.md` racine) : chaque méthode doit exister dans
// l'implémentation démo ET dans l'implémentation Supabase.
//
// `satisfies Record<keyof …, true>` rend la liste exhaustive à la compilation :
// une méthode ajoutée à l'interface sans être listée ici casse `typecheck`.
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: null }));

import type { IOrganizationsRepository } from './repository';
import { LocalStorageOrganizationsRepository } from './local.repository';
import { SupabaseOrganizationsRepository } from './supabase.repository';

const METHODS = {
  getMyOrganizations: true,
  getMembers: true,
  getPendingJoinRequests: true,
  getMySentJoinRequest: true,
  getMyOrgInbox: true,
  createOrganization: true,
  requestJoin: true,
  inviteFriendToOrg: true,
  getPendingSentInvitationIds: true,
  getMyOrgInvitations: true,
  respondOrgInvitation: true,
  getMyOrgRemovalNotices: true,
  dismissOrgRemovalNotice: true,
  respondJoinRequest: true,
  cancelJoinRequest: true,
  updateOrganization: true,
  setMemberRole: true,
  removeMember: true,
  setMemberManager: true,
  leaveOrganization: true,
  deleteOrganization: true,
  transferOwnership: true,
  createInviteLink: true,
  getInviteLinks: true,
  revokeInviteLink: true,
  claimInviteLink: true,
  regenerateJoinCode: true,
  getMemberPermissions: true,
  setMemberPermissions: true,
} satisfies Record<keyof IOrganizationsRepository, true>;

const IMPLEMENTATIONS = [
  ['démo (localStorage)', LocalStorageOrganizationsRepository.prototype],
  ['production (Supabase)', SupabaseOrganizationsRepository.prototype],
] as const;

describe('IOrganizationsRepository · contrat double mode', () => {
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
