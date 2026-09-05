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
  /** Image de profil de l'entreprise (data URL/URL) — admins (#12). */
  avatarUrl?: string;
}

/** Champs de profil modifiables par un admin (jamais joinCode/ownerId). */
export interface UpdateOrganizationInput {
  name?: string;
  description?: string;
  industry?: string;
  /** null = supprimer l'image. */
  avatarUrl?: string | null;
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

/**
 * Invitation NOMINATIVE d'un ami dans une organisation (mig. 105).
 *
 * A ne pas confondre avec OrgJoinRequest, qui va dans l'autre sens : la
 * demande part de la personne qui veut entrer et un admin l'approuve. Ici
 * c'est un membre qui invite, et le destinataire repond depuis sa boite de
 * reception.
 */
export interface OrgInvitation {
  id: string;
  orgId: string;
  orgName: string;
  inviterId: string;
  inviterName: string;
  createdAt: string;
}

/**
 * « Vous avez ete retire de X » — notification lue par un EX-membre.
 *
 * Portee par `org_notifications` (kind = 'org_removed', mig. 106), dont la
 * policy SELECT est `user_id = auth.uid()` et non `is_org_member` : c'est ce
 * qui permet a quelqu'un qui n'est plus dans l'organisation de la lire.
 */
export interface OrgRemovalNotice {
  id: string;
  orgId: string;
  orgName: string;
  /** Admin ayant procede au retrait (null si son profil a disparu). */
  actorName: string | null;
  createdAt: string;
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

/**
 * Boite de reception d'entreprise, telle que la rend `get_my_org_inbox()`
 * (mig. 129) : ce que cinq requetes distinctes lisaient a chaque ouverture de
 * l'application, sur toutes les pages protegees.
 *
 * `joinRequests` et `notifications` couvrent TOUTES mes organisations, pas
 * seulement l'active : c'est ce qui permet a la lecture de partir sans
 * attendre que l'organisation active soit resolue. Le filtrage par
 * organisation se fait cote client, sur une liste deja bornee par la RPC.
 */
/**
 * Une tache d'equipe telle que la pastille en a besoin, et rien de plus
 * (mig. 142). `kind` dit POURQUOI elle est la :
 *
 *   • `assigned` — assignation en cours qui ne vient pas de moi. C'est le
 *     comptage derive, celui que le client filtre ensuite par `lastSeen`.
 *   • `notified` — tache visee par une de mes notifications non lues. Elle ne
 *     sert qu'a NOMMER l'apercu, jamais a compter : sans elle, la pastille
 *     afficherait un nombre qu'aucune liste ne peut expliquer.
 *
 * ❌ Ne pas la confondre avec `TeamTask`, et ne pas l'elargir « tant qu'on y
 * est » : c'est precisement la lecture org-wide de `team_tasks`, montee par
 * `Layout` sur toutes les pages protegees, que cette section a remplacee.
 */
export interface OrgBadgeTask {
  orgId: string;
  id: string;
  name: string;
  createdAt: string;
  kind: 'assigned' | 'notified';
}

export interface OrgInbox {
  invitations: OrgInvitation[];
  removalNotices: OrgRemovalNotice[];
  /** Ma demande d'adhesion en attente, ou null. */
  myJoinRequest: OrgJoinRequest | null;
  /** Vue ADMIN : les demandes adressees aux organisations que j'administre. */
  joinRequests: OrgJoinRequest[];
  notifications: import('./notifications').OrgNotification[];
  /**
   * De quoi peindre la pastille d'entreprise sans lire la liste des taches
   * d'equipe (mig. 142). Vide en mode demo, ou la source reste locale.
   */
  badgeTasks: OrgBadgeTask[];
}
