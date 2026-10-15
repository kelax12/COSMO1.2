// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — chat d'un projet (mig. 220, 2026-10-13)
//
// Quiconque voit le projet lit et écrit (RLS `can_access_team_project`) ;
// seul l'auteur supprime. Le rôle affiché derrière le nom se lit dans les
// membres du projet, il n'est pas copié dans le message.
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { appModeStore } from '@/lib/app-mode.store';
import { getCurrentUserId } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { readJson, writeJsonOrThrow } from '@/lib/safe-json';
import { DEMO_USER_ID } from './demo-seed';

export interface TeamProjectMessage {
  id: string;
  projectId: string;
  /** NULL : auteur parti (compte supprimé). */
  authorId: string | null;
  body: string;
  createdAt: string;
}

/** Préfixe `cosmo_` : balayé par `clearDemoStorage` au prochain `loginDemo()`. */
export const TEAM_PROJECT_MESSAGES_STORAGE_KEY = 'cosmo_team_project_messages';

export const PROJECT_MESSAGE_MAX = 2000;
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

const readDemo = (): TeamProjectMessage[] => readJson<TeamProjectMessage[]>(TEAM_PROJECT_MESSAGES_STORAGE_KEY) ?? [];

export async function getProjectMessages(projectId: string): Promise<TeamProjectMessage[]> {
  if (appModeStore.isDemo) return readDemo().filter((m) => m.projectId === projectId);
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

export async function addProjectMessage(orgId: string, projectId: string, body: string): Promise<TeamProjectMessage> {
  const text = body.trim().slice(0, PROJECT_MESSAGE_MAX);
  // Code catalogué (`errors.json` § api) : la phrase est affichée telle quelle
  // par le toast de `useAddProjectMessage`, jamais une chaîne en dur.
  if (!text) throw makeApiError('empty_message');
  if (appModeStore.isDemo) {
    const msg: TeamProjectMessage = {
      id: `pmsg-${Date.now()}`, projectId, authorId: DEMO_USER_ID, body: text, createdAt: new Date().toISOString(),
    };
    writeJsonOrThrow(TEAM_PROJECT_MESSAGES_STORAGE_KEY, [...readDemo(), msg]);
    return msg;
  }
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

export async function deleteProjectMessage(id: string): Promise<void> {
  if (appModeStore.isDemo) {
    writeJsonOrThrow(TEAM_PROJECT_MESSAGES_STORAGE_KEY, readDemo().filter((m) => m.id !== id));
    return;
  }
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('team_project_messages').delete().eq('id', id);
  if (error) throw normalizeApiError(error);
}
