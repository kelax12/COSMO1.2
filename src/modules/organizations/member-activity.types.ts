// ═══════════════════════════════════════════════════════════════════
// Dernière activité d'un membre (mig. 170) : le modèle, sans dépendance
//
// « Activité » = travail d'équipe seulement : une entrée du journal de tâche,
// un commentaire, une tâche assignée terminée. ❌ Jamais une date de
// connexion (`auth.users.last_sign_in_at`) : c'est une donnée
// d'authentification, hors du traitement « Mode entreprise » du registre.
// ═══════════════════════════════════════════════════════════════════

export type MemberActivitySource = 'activity' | 'comment' | 'completion';

export interface MemberLastActivity {
  userId: string;
  /** null = dans le périmètre, mais aucune trace de travail d'équipe. */
  lastActivityAt: string | null;
  source: MemberActivitySource | null;
}

const SOURCES: readonly MemberActivitySource[] = ['activity', 'comment', 'completion'];

/** `source` vient d'une colonne TEXT : tout ce qui n'est pas connu devient null. */
export const toMemberActivitySource = (raw: string | null | undefined): MemberActivitySource | null =>
  raw && (SOURCES as readonly string[]).includes(raw) ? (raw as MemberActivitySource) : null;
