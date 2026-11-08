// ═══════════════════════════════════════════════════════════════════
// TEAM-LISTS MODULE - Données de démonstration (seed)
// ═══════════════════════════════════════════════════════════════════
//
// Jeu de données seul : aucune lecture ni écriture de stockage ici. Le dépôt de
// démo (`local.repository.ts`) l'ensemence au premier accès.

import type { TeamList } from './types';
import { localizeSeed } from '@/lib/seed-i18n';

export type StoredList = Omit<TeamList, 'taskIds' | 'isDefault'>;
export interface StoredLink { listId: string; taskId: string }

const DEMO_ORG_ID = 'org-demo-1';

export const DEMO_LISTS: StoredList[] = [
  { id: 'tlist-client', orgId: DEMO_ORG_ID, name: 'À valider par le client', color: 'purple', type: 'manual', position: 0 },
  { id: 'tlist-vendredi', orgId: DEMO_ORG_ID, name: 'Revue du vendredi', color: 'blue', type: 'manual', position: 1 },
];
// Overlay anglais — cf. src/lib/seed-i18n.ts.
export const DEMO_LISTS_EN: Record<string, Partial<StoredList>> = {
  'tlist-client': { name: 'Client approval' },
  'tlist-vendredi': { name: 'Friday review' },
};
export const DEMO_LINKS: StoredLink[] = [
  { listId: 'tlist-client', taskId: 'ttask-1' },
  { listId: 'tlist-client', taskId: 'ttask-9' },
  { listId: 'tlist-vendredi', taskId: 'ttask-2' },
  { listId: 'tlist-vendredi', taskId: 'ttask-4' },
  { listId: 'tlist-vendredi', taskId: 'ttask-5' },
];

/** Le seed dans la langue de l'interface (overlay anglais par id, cf. src/lib/seed-i18n.ts). */
export const localizedDemoTeamLists = () => localizeSeed(DEMO_LISTS, DEMO_LISTS_EN);
