// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE - Supabase Repository Implementation
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { IFriendsRepository } from './repository';
import { Friend, FriendRequestInput, ShareTaskInput, PendingFriendRequest, FriendRequestStatus } from './types';
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

    if (!profilesData?.length) return friends;
    const byEmail = new Map(
      profilesData.map(p => [
        (p.email as string).toLowerCase(),
        { id: p.id as string, avatarUrl: p.avatar_url as string | null }
      ])
    );
    return friends.map(f => {
      const profile = byEmail.get(f.email.toLowerCase());
      return {
        ...f,
        userId: profile?.id ?? f.userId,
        avatar: profile?.avatarUrl ?? f.avatar,
      };
    });
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

    // Resolve the friend's auth.uid via the public profiles table — required
    // so tasks.collaborators / shared_tasks.friend_id are populated with real
    // auth.uids (RLS + FK).
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .eq('email', lower)
      .maybeSingle();
    if (profile) {
      friend.userId = profile.id as string;
      friend.avatar = (profile.avatar_url as string | null) ?? friend.avatar;
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
    return (data || []).map(this.mapRequestFromDb);
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

    const { data, error } = await supabase
      .from('friend_requests')
      .insert([{
        email: input.email,
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

    // Utilise la fonction SECURITY DEFINER pour créer l'amitié bidirectionnelle
    const { error: rpcError } = await supabase.rpc('accept_friend_request', {
      request_id: requestId,
    });
    if (rpcError) throw normalizeApiError(rpcError);

    // Retourner le nouvel ami depuis la table friends
    const { data: friends, error: fetchError } = await supabase
      .from('friends')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) throw normalizeApiError(fetchError);
    return this.mapFromDb(friends?.[0]);
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
    // sender→receiver) inserted by `accept_friend_request`. Deleting just one
    // row leaves the reciprocal entry behind — the ex-friend still sees the
    // caller in their list. Find the email of the friend being removed, then
    // delete both sides. Faille B15.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: row, error: readError } = await supabase
      .from('friends')
      .select('email')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (readError) throw normalizeApiError(readError);
    if (!row) return; // nothing to delete

    // Delete the caller's row.
    const { error: ownError } = await supabase
      .from('friends')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (ownError) throw normalizeApiError(ownError);

    // Best-effort: delete the reciprocal row owned by the other user, scoped
    // by their email pointing back at the caller. RLS still applies — if the
    // policy forbids cross-user delete, this is a no-op and we surface it
    // in logs rather than silently passing.
    const { error: reciprocalError } = await supabase
      .from('friends')
      .delete()
      .eq('email', user.email ?? '')
      .neq('user_id', user.id);
    if (reciprocalError) {
      console.warn('removeFriend: reciprocal row not removed (RLS or schema)', reciprocalError);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // TASK SHARING OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async shareTask(input: ShareTaskInput): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');

    // Resolve the canonical auth.uid for the friend. The frontend may pass
    // either the friend's auth.uid (preferred — works directly) or, when the
    // profile lookup hasn't populated friend.userId, the friends-table row
    // id (random UUID, fails the FK to auth.users). To handle both cases
    // robustly, we always try to look up the auth.uid from the profiles
    // table by email when an email is provided.
    let friendUserId = input.friendId;
    if (input.friendEmail) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', input.friendEmail.toLowerCase())
        .maybeSingle();
      if (profile?.id) friendUserId = profile.id as string;
    }

    const { error } = await supabase
      .from('shared_tasks')
      .upsert([{
        task_id: input.taskId,
        friend_id: friendUserId,
        role: input.role || 'viewer'
      }]);

    if (error) {
      // FK violation usually means we couldn't resolve auth.uid (profile
      // missing). Surface a clearer message so the user knows the friend
      // hasn't fully registered yet rather than a generic error.
      const code = (error as { code?: string }).code;
      if (code === '23503') {
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
