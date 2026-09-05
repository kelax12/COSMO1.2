// ═══════════════════════════════════════════════════════════════════
// Boite de reception d'entreprise : la forme rendue par `get_my_org_inbox()`
// (mig. 129), et sa traduction vers le modele.
//
// Ce mapping vit a part parce qu'il est purement declaratif, et parce que
// `supabase.repository.ts` passait le budget de 600 lignes en l'accueillant.
// ═══════════════════════════════════════════════════════════════════
import type { OrgInbox } from './types';
import type { OrgNotification } from './notifications';

/** La forme exacte renvoyee par la RPC, en snake_case comme la base. */
export interface OrgInboxRow {
  invitations?: Array<{
    id: string; org_id: string; org_name: string;
    inviter_id: string; inviter_name: string | null; created_at: string;
  }>;
  removal_notices?: Array<{
    id: string; org_id: string; org_name: string;
    actor_name: string | null; created_at: string;
  }>;
  my_join_request?: { id: string; org_id: string; user_id: string; requested_at: string } | null;
  join_requests?: Array<{
    id: string; org_id: string; user_id: string; requested_at: string;
    requester_name: string | null; requester_email: string | null;
  }>;
  notifications?: Array<{
    id: string; org_id: string; actor_id: string | null; kind: string;
    task_id: string | null; read_at: string | null; created_at: string;
  }>;
  /** mig. 142 — `my_org_badge_tasks()`, agregee dans la meme lecture. */
  badge_tasks?: Array<{
    org_id: string; id: string; name: string; created_at: string; kind: string;
  }>;
}

export function mapOrgInbox(raw: OrgInboxRow): OrgInbox {
  const m = raw.my_join_request;
  return {
    invitations: (raw.invitations ?? []).map((r) => ({
      id: r.id,
      orgId: r.org_id,
      orgName: r.org_name,
      inviterId: r.inviter_id,
      // Meme repli qu'avant l'agregation : jamais un identifiant nu.
      inviterName: r.inviter_name ?? 'Un collaborateur',
      createdAt: r.created_at,
    })),
    removalNotices: (raw.removal_notices ?? []).map((r) => ({
      id: r.id,
      orgId: r.org_id,
      orgName: r.org_name,
      actorName: r.actor_name,
      createdAt: r.created_at,
    })),
    myJoinRequest: m
      ? { id: m.id, orgId: m.org_id, userId: m.user_id, requestedAt: m.requested_at, status: 'pending' as const }
      : null,
    joinRequests: (raw.join_requests ?? []).map((r) => ({
      id: r.id,
      orgId: r.org_id,
      userId: r.user_id,
      requestedAt: r.requested_at,
      status: 'pending' as const,
      // Le nom affiche, sinon la partie locale de l'email, sinon un mot
      // generique. Jamais un UUID, qui ne dit rien a personne.
      requesterName: r.requester_name ?? r.requester_email?.split('@')[0] ?? 'Utilisateur',
      requesterEmail: r.requester_email ?? undefined,
    })),
    notifications: (raw.notifications ?? []).map((r) => ({
      id: r.id,
      orgId: r.org_id,
      actorId: r.actor_id,
      kind: r.kind as OrgNotification['kind'],
      taskId: r.task_id,
      readAt: r.read_at,
      createdAt: r.created_at,
    })),
    // `kind` vient d'une colonne TEXT : tout ce qui n'est pas `assigned` est
    // traite comme un simple libelle d'apercu. Un `kind` inconnu ne doit
    // JAMAIS pouvoir gonfler un compteur.
    badgeTasks: (raw.badge_tasks ?? []).map((r) => ({
      orgId: r.org_id,
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      kind: r.kind === 'assigned' ? ('assigned' as const) : ('notified' as const),
    })),
  };
}
