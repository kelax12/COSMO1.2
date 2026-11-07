// ═══════════════════════════════════════════════════════════════════
// TEAM-CATEGORIES MODULE - Données de démonstration (seed)
// ═══════════════════════════════════════════════════════════════════
//
// Jeu de données seul : aucune lecture ni écriture de stockage ici. Le dépôt de
// démo (`local.repository.ts`) l'ensemence au premier accès.

import { TeamCategory } from './types';

const DEMO_ORG_ID = 'org-demo-1';
export const DEMO_USER_ID = 'demo-user';
const DAY = 24 * 60 * 60 * 1000;

export const DEMO_CATEGORIES: TeamCategory[] = [
  { id: 'teamcat-client', orgId: DEMO_ORG_ID, name: 'Client', color: '#3b82f6', parentId: null, position: 0, createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  { id: 'teamcat-produit', orgId: DEMO_ORG_ID, name: 'Produit', color: '#10b981', parentId: null, position: 1, createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  { id: 'teamcat-support', orgId: DEMO_ORG_ID, name: 'Support', color: '#f59e0b', parentId: null, position: 2, createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  // Racines dédiées aux OKR d'équipe (ex-org_okr_categories, mig. 148).
  { id: 'teamcat-croissance', orgId: DEMO_ORG_ID, name: 'Croissance', color: '#6366f1', parentId: null, position: 3, createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  { id: 'teamcat-interne', orgId: DEMO_ORG_ID, name: 'Interne', color: '#ec4899', parentId: null, position: 4, createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  // Sous-catégorie de démonstration, pour montrer le pliage/dépliage d'emblée.
  { id: 'teamcat-design', orgId: DEMO_ORG_ID, name: 'Design', color: '#8b5cf6', parentId: 'teamcat-produit', position: 0, createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 39 * DAY).toISOString() },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts.
export const DEMO_CATEGORIES_EN: Record<string, Partial<TeamCategory>> = {
  'teamcat-client': { name: 'Client' },
  'teamcat-produit': { name: 'Product' },
  'teamcat-support': { name: 'Support' },
  'teamcat-croissance': { name: 'Growth' },
  'teamcat-interne': { name: 'Internal' },
  'teamcat-design': { name: 'Design' },
};
