// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS · Chat d'un projet : interface commune démo / production (mig. 220)
//
// Quiconque voit le projet lit et écrit (RLS `can_access_team_project`) ;
// seul l'auteur supprime. Implémentations : `messages.local.repository.ts` et
// `messages.supabase.repository.ts`. Instanciation : `getProjectMessagesRepository`
// (`src/lib/repository.factory.ts`). Que des méthodes asynchrones (`lazy`).
// ═══════════════════════════════════════════════════════════════════

export interface TeamProjectMessage {
  id: string;
  projectId: string;
  /** NULL : auteur parti (compte supprimé). */
  authorId: string | null;
  body: string;
  createdAt: string;
}

export interface IProjectMessagesRepository {
  getProjectMessages(projectId: string): Promise<TeamProjectMessage[]>;
  addProjectMessage(orgId: string, projectId: string, body: string): Promise<TeamProjectMessage>;
  deleteProjectMessage(id: string): Promise<void>;
}
