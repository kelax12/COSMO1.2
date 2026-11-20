// TEAM-PROJECTS · Chat d'un projet : dépôt Supabase (mig. 220). Interface : `messages.repository.ts`.
//
// Le rôle affiché derrière le nom se lit dans les membres du projet, il n'est
// pas copié dans le message.

import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { PROJECT_MESSAGE_MAX } from './constants';
import type { IProjectMessagesRepository, TeamProjectMessage } from './messages.repository';

/** Les derniers messages seulement : un fil de projet ne se relit pas en entier. */
const MESSAGES_LIMIT = 200;

interface MessageRow {
  id: string;
  project_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

const fromRow = (r: MessageRow): TeamProjectMessage => ({
  id: r.id, projectId: r.project_id, authorId: r.author_id, body: r.body, createdAt: r.created_at,
});

export class SupabaseProjectMessagesRepository implements IProjectMessagesRepository {
  async getProjectMessages(projectId: string): Promise<TeamProjectMessage[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('team_project_messages')
      .select('id, project_id, author_id, body, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_LIMIT);
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as MessageRow[]).map(fromRow).reverse();
  }

  async addProjectMessage(orgId: string, projectId: string, body: string): Promise<TeamProjectMessage> {
    const text = body.trim().slice(0, PROJECT_MESSAGE_MAX);
    if (!text) throw makeApiError('empty_message');
    if (!supabase) throw new Error('Supabase not configured');
    const uid = await getCurrentUserId();
    // Whitelist : `author_id` est vérifié par la policy INSERT (= auth.uid()).
    const { data, error } = await supabase
      .from('team_project_messages')
      .insert({ project_id: projectId, org_id: orgId, author_id: uid, body: text })
      .select('id, project_id, author_id, body, created_at')
      .single();
    if (error) throw normalizeApiError(error);
    return fromRow(data as MessageRow);
  }

  async deleteProjectMessage(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.from('team_project_messages').delete().eq('id', id);
    if (error) throw normalizeApiError(error);
  }
}
