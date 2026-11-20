// TEAM-PROJECTS · Chat d'un projet : dépôt démo (localStorage). Interface : `messages.repository.ts`.

import { makeApiError } from '@/lib/normalizeApiError';
import { readJson, writeJsonOrThrow } from '@/lib/safe-json';
import { DEMO_USER_ID, PROJECT_MESSAGE_MAX } from './constants';
import type { IProjectMessagesRepository, TeamProjectMessage } from './messages.repository';

/** Préfixe `cosmo_` : balayé par `clearDemoStorage` au prochain `loginDemo()`. */
export const TEAM_PROJECT_MESSAGES_STORAGE_KEY = 'cosmo_team_project_messages';

const readDemo = (): TeamProjectMessage[] => readJson<TeamProjectMessage[]>(TEAM_PROJECT_MESSAGES_STORAGE_KEY) ?? [];

export class LocalStorageProjectMessagesRepository implements IProjectMessagesRepository {
  async getProjectMessages(projectId: string): Promise<TeamProjectMessage[]> {
    return readDemo().filter((m) => m.projectId === projectId);
  }

  async addProjectMessage(_orgId: string, projectId: string, body: string): Promise<TeamProjectMessage> {
    const text = body.trim().slice(0, PROJECT_MESSAGE_MAX);
    // Code catalogué (`errors.json` § api) : affiché tel quel par le toast du hook.
    if (!text) throw makeApiError('empty_message');
    const msg: TeamProjectMessage = {
      id: `pmsg-${Date.now()}`, projectId, authorId: DEMO_USER_ID, body: text, createdAt: new Date().toISOString(),
    };
    writeJsonOrThrow(TEAM_PROJECT_MESSAGES_STORAGE_KEY, [...readDemo(), msg]);
    return msg;
  }

  async deleteProjectMessage(id: string): Promise<void> {
    writeJsonOrThrow(TEAM_PROJECT_MESSAGES_STORAGE_KEY, readDemo().filter((m) => m.id !== id));
  }
}
