// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - Type Definitions (mode entreprise)
// ═══════════════════════════════════════════════════════════════════

/**
 * Rôle STOCKÉ d'un membre. Depuis la v2 (pyramide), « manager » n'est plus
 * un rôle : il est DÉRIVÉ de l'arbre hiérarchique (a ≥ 1 subordonné).
 */
export type OrgRole = 'admin' | 'member';

export interface Organization {
  id: string;
  name: string;
  /**
   * Code d'invitation permanent ('COSMO-XXXXXX'). Uniquement présent pour un
   * membre (RLS : SELECT réservé aux membres) — ne jamais le mettre dans un
   * cache/état partagé hors de l'org.
   */
  joinCode?: string;
  ownerId: string;
  createdAt: string;
  /** Profil d'entreprise (v2) — éditable par les admins. */
  description?: string;
  industry?: string;
}

/** Champs de profil modifiables par un admin (jamais joinCode/ownerId). */
export interface UpdateOrganizationInput {
  name?: string;
  description?: string;
  industry?: string;
}

/** L'organisation de l'utilisateur courant, enrichie de son propre rôle. */
export interface MyOrganization extends Organization {
  myRole: OrgRole;
}

/** Membre de l'annuaire, enrichi depuis `profiles` (nom/avatar sanitizés). */
export interface OrgMember {
  orgId: string;
  /** auth.users.id du membre. */
  userId: string;
  role: OrgRole;
  joinedAt: string;
  displayName: string;
  email?: string;
  /** URL/data URL/emoji — même convention que Friend.avatar. */
  avatar?: string;
  /** Supérieur direct dans la pyramide (auth.users.id) — null = non placé. */
  managerId?: string | null;
}

/** Nœud de l'arbre hiérarchique (construit côté client depuis managerId). */
export interface OrgTreeNode {
  member: OrgMember;
  children: OrgTreeNode[];
}

/**
 * Construit la pyramide depuis la liste plate des membres. Racines = membres
 * sans manager qui ONT des subordonnés (ou l'owner) ; les membres sans
 * manager NI subordonnés (hors racines) sont « non placés ».
 */
export function buildOrgTree(members: OrgMember[], ownerId: string): {
  roots: OrgTreeNode[];
  unplaced: OrgMember[];
} {
  const byId = new Map(members.map((m) => [m.userId, m]));
  const childrenOf = new Map<string, OrgMember[]>();
  for (const m of members) {
    if (m.managerId && byId.has(m.managerId)) {
      const arr = childrenOf.get(m.managerId) ?? [];
      arr.push(m);
      childrenOf.set(m.managerId, arr);
    }
  }
  // Garde anti-cycle côté client : profondeur max 50 (miroir du cap SQL).
  const toNode = (m: OrgMember, depth: number): OrgTreeNode => ({
    member: m,
    children:
      depth >= 50
        ? []
        : (childrenOf.get(m.userId) ?? []).map((c) => toNode(c, depth + 1)),
  });

  const topLevel = members.filter((m) => !m.managerId || !byId.has(m.managerId ?? ''));
  const roots = topLevel
    .filter((m) => m.userId === ownerId || (childrenOf.get(m.userId)?.length ?? 0) > 0)
    .map((m) => toNode(m, 0));
  const rootIds = new Set(
    topLevel
      .filter((m) => m.userId === ownerId || (childrenOf.get(m.userId)?.length ?? 0) > 0)
      .map((m) => m.userId),
  );
  const unplaced = topLevel.filter((m) => !rootIds.has(m.userId));
  return { roots, unplaced };
}

/** Un membre est « manager » s'il a au moins un subordonné direct (dérivé). */
export function isManagerOf(members: OrgMember[], userId: string): boolean {
  return members.some((m) => m.managerId === userId);
}

/** Sous-arbre strict (ids des descendants) de `root`. Profondeur max 50 (miroir du cap SQL). */
export function subtreeOf(members: OrgMember[], root: string): Set<string> {
  const out = new Set<string>();
  let frontier = [root];
  for (let depth = 0; depth < 50 && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const m of members) {
      if (m.managerId && frontier.includes(m.managerId) && !out.has(m.userId)) {
        out.add(m.userId);
        next.push(m.userId);
      }
    }
    frontier = next;
  }
  return out;
}

/**
 * Lien d'invitation placé (v2) : token secret single-use, expire à 7 jours,
 * fait entrer directement le destinataire sous `managerId` (null = non placé).
 */
export interface OrgInviteLink {
  /** Le token (UUID) — sert à construire l'URL /org-invite/:token. */
  id: string;
  orgId: string;
  managerId: string | null;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  claimedAt?: string | null;
}

export type OrgJoinRequestStatus = 'pending' | 'accepted' | 'rejected';

/**
 * Demande d'adhésion (pattern inbox : accepted_at NULL = pending côté DB,
 * exposé ici via `status`). Vue admin (entrantes) et vue demandeur (envoyée).
 */
export interface OrgJoinRequest {
  id: string;
  orgId: string;
  /** auth.users.id du demandeur. */
  userId: string;
  requestedAt: string;
  status: OrgJoinRequestStatus;
  /** Enrichi depuis `profiles` (vue admin). */
  requesterName?: string;
  requesterEmail?: string;
  requesterAvatar?: string;
  /** Nom de l'org — renseigné en démo ; en prod la RPC de demande le renvoie
   *  au moment de l'envoi (non re-lisible ensuite : RLS membres-only). */
  orgName?: string;
}
