// ═══════════════════════════════════════════════════════════════════
// Frontière paresseuse des écrans de configuration d'entreprise (mig. 195 à
// 199, audit du 2026-09-24). Chaque écran charge SON catalogue `orgConfig`
// avec lui : la route /entreprise n'en paie rien.
//
// ⚠️ Fichier déclaré dans `TAB_GATE_HOSTS` (scripts/i18n-shell-namespaces.mjs) :
// chaque liste doit couvrir TOUT le sous-arbre de son écran, `org` compris.
// ═══════════════════════════════════════════════════════════════════
import { lazyWithRetry } from '@/lib/lazy-with-retry';

export const OrgConfigSettings = lazyWithRetry(() => import('./config/OrgConfigSettings'), ['csv', 'org', 'orgConfig', 'overlays', 'tasks']);
export const ProjectWorkflowSection = lazyWithRetry(() => import('./config/ProjectWorkflowSection'), ['org', 'orgConfig', 'overlays']);
