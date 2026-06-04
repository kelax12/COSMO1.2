// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE - Supabase Repository Implementation
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { IFriendsRepository } from './repository';
import { Friend, FriendRequestInput, ShareTaskInput, PendingFriendRequest, FriendRequestStatus, TaskShare } from './types';
import { warnIfTruncated } from '@/lib/pagination.warning';

// ═══════════════════════════════════════════════════════════════════
// DB ROW TYPES (snake_case - matches Supabase table schema)
// ═══════════════════════════════════════════════════════════════════

/**
 * Supabase DB row type for friends table
 */
interface FriendRow {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  user_id?: string;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * Supabase DB row type for friend_requests table
 */
interface FriendRequestRow {
  id: string;
  email: string;
  status: FriendRequestStatus;
  sent_at: string;
  sender_id?: string;
  sender_email?: string;
  receiver_id?: string;
  user_id?: string;
}

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class SupabaseFriendsRepository implements IFriendsRepository {
  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<Friend[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('friends')
      .select('*')
      .order('name', { ascending: true })
      .limit(200);

    if (error) throw normalizeApiError(error);
    const friends = warnIfTruncated(data || [], 200, 'friends').map(this.mapFromDb);

    // Enrich with avatar + userId from public `profiles` (auth.user_metadata
    // is private; profiles mirrors it AND exposes the friend's auth.uid by
    // email so we can correctly populate tasks.collaborators and
    // shared_tasks.friend_id with real auth.uids — required by RLS and FK.).
    if (friends.length === 0) return friends;
    const emails = friends.map(f => f.email).filter(Boolean);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, avatar_url')
      .in('email', emails);

    const byEmail = new Map(
      (profilesData ?? []).map(p => [
        (p.email as string).toLowerCase(),
        { id: p.id as string, avatarUrl: p.avatar_url as string | null }
      ])
    );
    const enriched = friends.map(f => {
      const profile = byEmail.get(f.email.toLowerCase());
      return {
        ...f,
        userId: profile?.id ?? f.userId,
        avatar: profile?.avatarUrl ?? f.avatar,
      };
    });

    // Fallback résolution userId : le SELECT direct sur `profiles` peut ne rien
    // renvoyer selon le durcissement RLS (migration 022 / N12). Or `userId` DOIT
    // valoir l'auth.uid du copain — c'est exactement ce que `shareTask` écrit
    // dans `shared_tasks.friend_id`. Sans lui, l'affichage owner-side d'un
    // collaborateur retombe sur l'id de ligne `friends` et ne matche jamais le
    // partage → l'UUID brut s'affiche au lieu du pseudo. On comble les trous via
    // la même RPC SECURITY DEFINER que shareTask (résolution fiable, bypass RLS).
    const unresolved = enriched.filter(f => !f.userId && f.email);
    if (unresolved.length === 0) return enriched;
    const resolvedPairs = await Promise.all(
      unresolved.map(async f => {
        const { data: uid } = await supabase!.rpc('resolve_profile_by_email', {
          p_email: f.email.toLowerCase(),
        });
        return [f.id, (uid as string | null) ?? undefined] as const;
      })
    );
    const uidByRowId = new Map(resolvedPairs);
    return enriched.map(f =>
      f.userId ? f : { ...f, userId: uidByRowId.get(f.id) ?? f.userId }
    );
  }

  async getById(id: string): Promise<Friend | null> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('friends')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw normalizeApiError(error);
    }
    return data ? this.mapFromDb(data) : null;
  }

  async getByEmail(email: string): Promise<Friend | null> {
    if (!supabase) throw new Error('Supabase not configured');
    // L-9 — Validate input at boundary: reject empty / oversized strings and
    // anything without an `@`. Prevents pathological inputs from reaching
    // PostgREST (DoS-by-huge-query) and surfaces caller bugs early.
    if (!email || email.length > 320 || !email.includes('@')) {
      return null;
    }
    // Exact match instead of ILIKE — the old query forwarded unescaped `%` and
    // `_` from caller input as SQL pattern wildcards (PostgREST pattern
    // injection). Emails are stored verbatim, so a lowercased `.eq` suffices.
    // Faille N4.
    const lower = email.toLowerCase();
    const { data, error } = await supabase
      .from('friends')
      .select('*')
      .eq('email', lower)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw normalizeApiError(error);
    }
    if (!data) return null;
    const friend = this.mapFromDb(data);

    // Resolve the friend's auth.uid via the `resolve_profile_by_email` RPC.
    // Direct `profiles` SELECT is restricted to own + confirmed friends after
    // migration 022 (faille N12), so we go through the SECURITY DEFINER RPC
    // which returns only the uid (no avatar/display_name) — sufficient to
    // populate tasks.collaborators / shared_tasks.friend_id.
    const { data: resolvedId } = await supabase.rpc('resolve_profile_by_email', {
      p_email: lower,
    });
    if (resolvedId) {
      friend.userId = resolvedId as string;
    }
    return friend;
  }

  async getPendingRequests(): Promise<PendingFriendRequest[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('status', 'pending')
      .eq('receiver_id', user.id) // uniquement les demandes reçues
      .order('sent_at', { ascending: false });

    if (error) throw normalizeApiError(error);
    const requests = (data || []).map(this.mapRequestFromDb);
    if (requests.length === 0) return requests;

    // Enrichissement avatar/nom de l'expéditeur. La policy SELECT de `profiles`
    // (durcissement N12, migration 022) n'expose pas le profil d'un expéditeur
    // non encore ami → on passe par la RPC SECURITY DEFINER scopée aux demandes
    // qui nous sont adressées (migration 031). Best-effort : en cas d'erreur
    // (RPC pas encore déployée), on garde les demandes sans avatar.
    const { data: senders } = await supabase.rpc('get_incoming_request_senders');
    if (Array.isArray(senders) && senders.length > 0) {
      const byRequestId = new Map(
        (senders as Array<{ request_id: string; avatar_url: string | null; display_name: string | null }>)
          .map((s) => [s.request_id, s])
      );
      return requests.map((r) => {
        const s = byRequestId.get(r.id);
        return s
          ? { ...r, senderAvatar: s.avatar_url ?? undefined, senderName: s.display_name ?? undefined }
          : r;
      });
    }
    return requests;
  }

  async getSentRequests(): Promise<PendingFriendRequest[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('status', 'pending')
      .eq('sender_id', user.id)
      .order('sent_at', { ascending: false });

    if (error) throw normalizeApiError(error);
    return (data || []).map(this.mapRequestFromDb);
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async sendFriendRequest(input: FriendRequestInput): Promise<PendingFriendRequest> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) throw new Error('Non authentifié');

    const email = input.email.toLowerCase();

    // Anti-doublon : ne pas recréer une demande si une est déjà pending pour le
    // même couple (sender, destinataire). Sans ce garde, un double-clic ou un
    // retry réseau insère plusieurs lignes → la demande s'affiche en double
    // dans la boîte de réception et le sélecteur de collaborateurs.
    const { data: existing } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('sender_id', currentUser.id)
      .eq('email', email)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();
    if (existing) return this.mapRequestFromDb(existing);

    const { data, error } = await supabase
      .from('friend_requests')
      .insert([{
        email,
        status: 'pending',
        sent_at: new Date().toISOString(),
        sender_id: currentUser.id,
        // receiver_id sera auto-rempli par le trigger trg_set_receiver_id
      }])
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return this.mapRequestFromDb(data);
  }

  async acceptFriendRequest(requestId: string): Promise<Friend> {
    if (!supabase) throw new Error('Supabase not configured');

    // RPC v2 (migration 023, faille RACE-5) retourne directement la ligne
    // friends créée. L'ancien code faisait un SELECT ORDER BY created_at
    // DESC LIMIT 1 derrière le RPC v1 — race si deux acceptations
    // concurrentes : on récupérait potentiellement le mauvais friend.
    const { data, error } = await supabase.rpc('accept_friend_request_v2', {
      request_id: requestId,
    });
    if (error) throw normalizeApiError(error);
    return this.mapFromDb(data as FriendRow);
  }

  async rejectFriendRequest(requestId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);

    if (error) throw normalizeApiError(error);
  }

  async removeFriend(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    // The friends table stores TWO rows per friendship (receiver→sender and
    // sender→receiver) inserted by `accept_friend_request`. The previous
    // implementation deleted the caller's row then attempted a cross-user
    // delete via RLS — which the DELETE policy `auth.uid()=user_id` rejected,
    // making the reciprocal cleanup a silent no-op. The ex-friend kept seeing
    // the caller. Faille N13.
    //
    // Fix: RPC `remove_friendship` SECURITY DEFINER (migration 022) deletes
    // both sides atomically after verifying the caller owns the row.
    const { error } = await supabase.rpc('remove_friendship', {
      p_friend_row_id: id,
    });
    if (error) throw normalizeApiError(error);
  }

  // ═══════════════════════════════════════════════════════════════════
  // TASK SHARING OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async shareTask(input: ShareTaskInput): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');

    // Convention DB (migration fix_task_sharing_unified) :
    //   shared_tasks.friend_id = auth.users.id du destinataire
    //   shared_tasks.shared_by = auth.users.id du partageur (= caller)
    // Le FK shared_tasks.friend_id → auth.users(id) interdit toute autre
    // valeur (notamment friends.id). On résout donc l'auth.uid canonique
    // via la table profiles, par email.
    let friendUserId = input.friendId;
    if (input.friendEmail) {
      // Go through SECURITY DEFINER RPC instead of direct SELECT on profiles —
      // the restricted policy (faille N12, migration 022) only exposes the
      // profile to confirmed friends. The RPC returns only the uid (no PII).
      const { data: resolvedId } = await supabase.rpc('resolve_profile_by_email', {
        p_email: input.friendEmail.toLowerCase(),
      });
      if (resolvedId) friendUserId = resolvedId as string;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('shared_tasks')
      .upsert(
        [{
          task_id: input.taskId,
          friend_id: friendUserId,
          shared_by: user.id,
          role: input.role || 'viewer',
        }],
        { onConflict: 'task_id,friend_id' },
      );

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === '23503') {
        // FK violation : friend_id n'existe pas dans auth.users — le copain
        // n'est pas inscrit ou son profil n'a pas été résolu.
        throw new Error(
          "Le collaborateur n'est pas (encore) inscrit sur Cosmo. " +
          "Demande-lui de se connecter au moins une fois, puis réessaie."
        );
      }
      throw normalizeApiError(error);
    }
  }

  async unshareTask(taskId: string, friendId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('shared_tasks')
      .delete()
      .eq('task_id', taskId)
      .eq('friend_id', friendId);

    if (error) throw normalizeApiError(error);
  }

  // ═══════════════════════════════════════════════════════════════════
  // TASK SHARING — READ MODEL (owner side)
  // ═══════════════════════════════════════════════════════════════════

  async getTaskShares(taskId: string): Promise<TaskShare[]> {
    if (!supabase) throw new Error('Supabase not configured');
    // RLS `shared_tasks_select` lets the owner (shared_by) read these rows.
    const { data, error } = await supabase
      .from('shared_tasks')
      .select('task_id, friend_id, role')
      .eq('task_id', taskId);
    if (error) throw normalizeApiError(error);
    return (data || []).map((r) => ({
      taskId: r.task_id as string,
      friendId: r.friend_id as string,
      role: ((r.role as string) === 'editor' ? 'editor' : 'viewer'),
    }));
  }

  async getMyTaskShares(): Promise<TaskShare[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('shared_tasks')
      .select('task_id, friend_id, role')
      .eq('shared_by', user.id)
      .limit(500);
    if (error) throw normalizeApiError(error);
    return (data || []).map((r) => ({
      taskId: r.task_id as string,
      friendId: r.friend_id as string,
      role: ((r.role as string) === 'editor' ? 'editor' : 'viewer'),
    }));
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAPPING (snake_case <-> camelCase)
  // ═══════════════════════════════════════════════════════════════════

  private mapFromDb(row: FriendRow): Friend {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      avatar: row.avatar,
    };
  }

  private mapRequestFromDb(row: FriendRequestRow): PendingFriendRequest {
    return {
      id: row.id,
      email: row.email,
      status: row.status,
      sentAt: row.sent_at,
      senderId: row.sender_id,
      senderEmail: row.sender_email,
      receiverId: row.receiver_id,
    };
  }
}
