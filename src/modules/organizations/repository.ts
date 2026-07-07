// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - Repository Interface
// ═══════════════════════════════════════════════════════════════════

import { MyOrganization, Organization, OrgMember, OrgJoinRequest, OrgRole } from './types';

export interface IOrganizationsRepository {
  // Read operations
  /** L'organisation de l'utilisateur courant (V1 : une seule max), avec son rôle. */
  getMyOrganization(): Promise<MyOrganization | null>;
  /** Annuaire des membres (enrichi profiles : nom/avatar). */
  getMembers(orgId: string): Promise<OrgMember[]>;
  /** Demandes d'adhésion en attente (vue admin). */
  getPendingJoinRequests(orgId: string): Promise<OrgJoinRequest[]>;
  /** La demande envoyée par l'utilisateur courant, s'il en a une (0..1). */
  getMySentJoinRequest(): Promise<OrgJoinRequest | null>;

  // Write operations (prod : RPC SECURITY DEFINER uniquement)
  /** Crée l'org (code généré serveur) et fait de l'appelant l'admin. */
  createOrganization(name: string): Promise<Organization>;
  /** Envoie une demande d'adhésion via le code. Renvoie le nom de l'org. */
  requestJoin(code: string): Promise<{ orgName: string }>;
  /** Admin : accepte ou refuse une demande d'adhésion. */
  respondJoinRequest(requestId: string, accept: boolean): Promise<void>;
  /** Demandeur : annule sa demande en attente. */
  cancelJoinRequest(requestId: string): Promise<void>;

  // Administration des membres (admin) — garde « dernier admin » côté serveur.
  /** Change le rôle d'un membre (admin uniquement). */
  setMemberRole(orgId: string, userId: string, role: OrgRole): Promise<void>;
  /** Retire un membre de l'entreprise (admin uniquement). */
  removeMember(orgId: string, userId: string): Promise<void>;
  /** L'utilisateur courant quitte l'entreprise. */
  leaveOrganization(orgId: string): Promise<void>;
}
