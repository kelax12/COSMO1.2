// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS - Données de démonstration (seed)
// ═══════════════════════════════════════════════════════════════════
//
// Jeu de données seul (V12.3) : aucune lecture ni écriture de stockage ici. Le
// dépôt de démo voisin l'ensemence au premier accès.

import { OrgTeam, OrgTeamMember } from './types';

const DEMO_ORG_ID = 'org-demo-1';
export const DEMO_USER_ID = 'demo-user';
const DAY = 24 * 60 * 60 * 1000;
export const DEMO_TEAMS: OrgTeam[] = [
  { id: 'team-design', orgId: DEMO_ORG_ID, name: 'Design', color: '#8b5cf6', description: null, createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  { id: 'team-dev', orgId: DEMO_ORG_ID, name: 'Dev', color: '#3b82f6', description: null, createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  { id: 'team-marketing', orgId: DEMO_ORG_ID, name: 'Marketing', color: '#f59e0b', description: null, createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 35 * DAY).toISOString() },
];

// Chaque équipe a un responsable (mig. 107) : une organisation de démo dont
// aucune équipe n'aurait de responsable montrerait le cas dégradé plutôt que
// le nominal. Marie et Jean sont déjà les deux managers de la pyramide démo.
export const DEMO_TEAM_MEMBERS: OrgTeamMember[] = [
  { teamId: 'team-design', orgId: DEMO_ORG_ID, userId: 'friend-1', isLead: true },
  { teamId: 'team-design', orgId: DEMO_ORG_ID, userId: 'friend-3', isLead: false },
  { teamId: 'team-design', orgId: DEMO_ORG_ID, userId: 'user-camille', isLead: false },
  { teamId: 'team-dev', orgId: DEMO_ORG_ID, userId: 'friend-2', isLead: true },
  { teamId: 'team-design', orgId: DEMO_ORG_ID, userId: 'user-chloe', isLead: false },
  { teamId: 'team-design', orgId: DEMO_ORG_ID, userId: 'user-emma', isLead: false },
  { teamId: 'team-dev', orgId: DEMO_ORG_ID, userId: 'user-lucas', isLead: false },
  { teamId: 'team-dev', orgId: DEMO_ORG_ID, userId: 'user-ines', isLead: false },
  { teamId: 'team-dev', orgId: DEMO_ORG_ID, userId: 'user-antoine', isLead: false },
  { teamId: 'team-marketing', orgId: DEMO_ORG_ID, userId: 'user-manon', isLead: true },
  { teamId: 'team-marketing', orgId: DEMO_ORG_ID, userId: 'user-paul', isLead: false },
  { teamId: 'team-marketing', orgId: DEMO_ORG_ID, userId: 'user-lea', isLead: false },
  { teamId: 'team-marketing', orgId: DEMO_ORG_ID, userId: 'user-karim', isLead: false },
];
