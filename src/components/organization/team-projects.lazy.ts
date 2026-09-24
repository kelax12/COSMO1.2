// ═══════════════════════════════════════════════════════════════════
// Onglet Projets : les surfaces qu'on n'ouvre qu'À LA DEMANDE
//
// Le portefeuille (M2) avait fait passer le chunk `TeamProjectsTab` de 16,0 à
// 28,6 ko gzip, pour un plafond de 17 (`scripts/check-bundle-budget.mjs`).
// Tout y était importé en dur, alors que la vue par défaut est la liste de
// cartes : le tableau, le planning, le portefeuille, la page projet et les
// modales de projet n'étaient payés que par ceux qui les ouvrent, mais
// téléchargés par tous.
//
// Aucun catalogue en second argument : ces surfaces ne traduisent que dans
// `org`, déjà déclaré par la route (cf. l'avertissement d'`OrganizationPage`).
// ═══════════════════════════════════════════════════════════════════

import { lazyWithRetry } from '@/lib/lazy-with-retry';

export const TeamProjectsKanban = lazyWithRetry(() => import('./TeamProjectsKanban'));
export const TeamProjectsTimeline = lazyWithRetry(() => import('./TeamProjectsTimeline'));
export const ProjectPortfolioView = lazyWithRetry(() => import('./ProjectPortfolioView'));
export const ProjectDetailPage = lazyWithRetry(() => import('./ProjectDetailPage'));
export const ProjectEditDialog = lazyWithRetry(() => import('./ProjectEditDialog'));
export const NewTeamProjectModal = lazyWithRetry(() => import('./NewTeamProjectModal'));
export const CreateTeamModal = lazyWithRetry(() => import('./CreateTeamModal'));
export const AssignTaskSheet = lazyWithRetry(() => import('./AssignTaskSheet'));
export const BulkActionsBar = lazyWithRetry(() => import('./BulkActionsBar'));
