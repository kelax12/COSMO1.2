// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - Repository Interface
// ═══════════════════════════════════════════════════════════════════

import { MyOrganization, Organization, OrgMember, OrgJoinRequest, OrgRole, UpdateOrganizationInput, OrgInviteLink, OrgInvitation, OrgRemovalNotice } from './types';
import type { OrgMemberPermissions, SetOrgPermissionsInput } from './permissions';

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

  /** Invite un AMI (amitie confirmee) dans une organisation dont je suis membre. */
  inviteFriendToOrg(orgId: string, friendUserId: string): Promise<void>;

  /**
   * auth.users.id des amis que J'AI invités dans cette org et qui n'ont ni
   * accepté ni refusé — sert uniquement à distinguer « jamais invité » de
   * « invitation en attente » dans InviteFriendsToOrg (le bouton se grise).
   * La policy `org_invitations_select` (mig. 105) autorise déjà tout membre
   * de l'org à lire ces lignes ; pas de RPC dédiée nécessaire.
   */
  getPendingSentInvitationIds(orgId: string): Promise<string[]>;

  /** Mes invitations d'entreprise en attente (boite de reception). */
  getMyOrgInvitations(): Promise<OrgInvitation[]>;

  /** J'accepte ou je refuse une invitation qui m'est adressee. */
  respondOrgInvitation(invitationId: string, accept: boolean): Promise<void>;

  /** Les retraits d'entreprise dont je n'ai pas encore accuse reception. */
  getMyOrgRemovalNotices(): Promise<OrgRemovalNotice[]>;

  /** J'accuse reception d'un retrait (la notification disparait). */
  dismissOrgRemovalNotice(noticeId: string): Promise<void>;
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
  /** Supprime DÉFINITIVEMENT l'entreprise (admin — RPC, cascade totale). */
  deleteOrganization(orgId: string): Promise<void>;
  /** Transfère la propriété à un autre membre (owner actuel uniquement, mig. 081). */
  transferOwnership(orgId: string, newOwnerId: string): Promise<void>;

  // Invitations placées (v2, lot 1c) — entrée directe, single-use, 7 jours.
  /** Crée un lien d'invitation vers une place de la pyramide (managerId null = non placé, admin only). */
  createInviteLink(orgId: string, managerId: string | null): Promise<OrgInviteLink>;
  /** Liens actifs que je peux voir (créés par moi, ou tous si admin). */
  getInviteLinks(orgId: string): Promise<OrgInviteLink[]>;
  /** Révoque (supprime) un lien. */
  revokeInviteLink(linkId: string): Promise<void>;
  /** Consomme un lien d'invitation (single-use) — rejoint l'org directement. */
  claimInviteLink(token: string): Promise<{ orgId: string; orgName: string }>;
  /** Régénère le code permanent de l'org (admin) — l'ancien est invalidé. */
  regenerateJoinCode(orgId: string): Promise<string>;

  // Permissions explicites par membre (mig. 115) — SURCHARGES uniquement.
  /**
   * Les surcharges posées dans cette org. Un membre absent de la liste suit
   * les défauts dérivés (admin / manager / membre) : ne jamais interpréter
   * une absence comme « aucun droit ».
   */
  getMemberPermissions(orgId: string): Promise<OrgMemberPermissions[]>;
  /**
   * Pose ou met à jour la surcharge d'un membre. Le plafond (« ne pas
   * accorder un droit qu'on n'a pas ») est appliqué par le SERVEUR
   * (`enforce_org_permission_ceiling`) — ce chemin n'est qu'une façade.
   */
  setMemberPermissions(orgId: string, userId: string, input: SetOrgPermissionsInput): Promise<void>;
}
