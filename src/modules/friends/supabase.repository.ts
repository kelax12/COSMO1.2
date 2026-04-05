// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE - Supabase Repository Implementation
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { IFriendsRepository } from './repository';
import { Friend, FriendRequestInput, ShareTaskInput, PendingFriendRequest, FriendRequestStatus } from './types';

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
}

/**
 * Supabase DB row type for friend_requests table
 */
interface FriendRequestRow {
  id: string;
  email: string;
  status: FriendRequestStatus;
  sent_at: string;
  user_id?: string;
}

/**
 * DB input type for friend insert/update operations
 */
interface FriendDbInput {
  name?: string;
  email?: string;
  avatar?: string;
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
      .limit(200); // Sécurité — les amis ne devraient jamais dépasser 200

    if (error) throw normalizeApiError(error);
    return (data || []).map(this.mapFromDb);
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
    const { data, error } = await supabase
      .from('friends')
      .select('*')
      .ilike('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw normalizeApiError(error);
    }
    return data ? this.mapFromDb(data) : null;
  }

  async getPendingRequests(): Promise<PendingFriendRequest[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('status', 'pending')
      .order('sent_at', { ascending: false });

    if (error) throw normalizeApiError(error);
    return (data || []).map(this.mapRequestFromDb);
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async sendFriendRequest(input: FriendRequestInput): Promise<PendingFriendRequest> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('friend_requests')
      .insert([{ email: input.email, status: 'pending', sent_at: new Date().toISOString() }])
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return this.mapRequestFromDb(data);
  }

  async acceptFriendRequest(requestId: string): Promise<Friend> {
    if (!supabase) throw new Error('Supabase not configured');
    
    // Update request status
    const { data: request, error: requestError } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId)
      .select()
      .single();

    if (requestError) throw normalizeApiError(requestError);

    // Create friend from request
    const { data: friend, error: friendError } = await supabase
      .from('friends')
      .insert([{ 
        name: request.email.split('@')[0], 
        email: request.email, 
        avatar: '👤' 
      }])
      .select()
      .single();

    if (friendError) throw normalizeApiError(friendError);
    return this.mapFromDb(friend);
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
    const { error } = await supabase
      .from('friends')
      .delete()
      .eq('id', id);

    if (error) throw normalizeApiError(error);
  }

  // ═══════════════════════════════════════════════════════════════════
  // TASK SHARING OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async shareTask(input: ShareTaskInput): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('shared_tasks')
      .upsert([{ 
        task_id: input.taskId, 
        friend_id: input.friendId, 
        role: input.role || 'viewer' 
      }]);

    if (error) throw normalizeApiError(error);
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
    };
  }
}
