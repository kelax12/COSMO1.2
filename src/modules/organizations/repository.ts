// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - Repository Interface
// ═══════════════════════════════════════════════════════════════════

import { MyOrganization, Organization, OrgMember, OrgJoinRequest, OrgRole, UpdateOrganizationInput } from './types';

export interface IOrganizationsRepository {
  // Read operations
  /** Toutes les organisations dont l'utilisateur courant est membre, avec son
   *  rôle dans chacune (multi-org v2). L'« org active » est un état client
   *  (ActiveOrgContext) — le repository renvoie la liste complète. */
  getMyOrganizations(): Promise<MyOrganization[]>;
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

  /** Met à jour le profil de l'entreprise (admin) : nom, description, secteur. */
  updateOrganization(orgId: string, input: UpdateOrganizationInput): Promise<Organization>;

  // Administration des membres (admin) — garde « dernier admin » côté serveur.
  /** Change le rôle d'un membre (admin uniquement). */
  setMemberRole(orgId: string, userId: string, role: OrgRole): Promise<void>;
  /** Retire un membre de l'entreprise (admin uniquement). */
  removeMember(orgId: string, userId: string): Promise<void>;
  /**
   * Place/déplace un membre dans la pyramide (managerId = supérieur direct,
   * null = détacher — admin only). Admin : tout ; manager : son sous-arbre.
   */
  setMemberManager(orgId: string, userId: string, managerId: string | null): Promise<void>;
  /** L'utilisateur courant quitte l'entreprise. */
  leaveOrganization(orgId: string): Promise<void>;
}
