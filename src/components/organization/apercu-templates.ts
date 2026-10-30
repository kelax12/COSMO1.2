import type { PlacedWidget } from './apercu-widgets';

/**
 * Modèles d'Aperçu par rôle (2026-10-19). Chacun répond à la question que
 * se pose la personne en ouvrant l'écran :
 * - membre : « qu'est-ce que je fais aujourd'hui ? »
 * - chef d'équipe : « mon équipe avance-t-elle, que dois-je valider ? »
 * - administrateur : « l'entreprise va-t-elle bien, qu'est-ce qui coince ? »
 *
 * Un modèle n'est qu'un point de départ : tout reste modifiable ensuite.
 */

export type TemplateId = 'member' | 'manager' | 'admin';

export const TEMPLATE_IDS: readonly TemplateId[] = ['member', 'manager', 'admin'];

export const TEMPLATES: Record<TemplateId, readonly PlacedWidget[]> = {
  member: [
    { id: 'kpi', size: 'large' },
    { id: 'tasks', size: 'medium' },
    { id: 'deadlines', size: 'medium' },
    { id: 'mentions', size: 'small' },
    { id: 'blockedByMe', size: 'small' },
    { id: 'agenda', size: 'small' },
    { id: 'krs', size: 'small' },
    { id: 'load', size: 'small' },
    { id: 'note', size: 'small' },
  ],
  manager: [
    { id: 'kpi', size: 'large' },
    { id: 'waiting', size: 'medium' },
    { id: 'teamLoad', size: 'medium' },
    { id: 'teamOverdue', size: 'medium' },
    { id: 'waitingOn', size: 'medium' },
    { id: 'projects', size: 'small' },
    { id: 'companyOkrs', size: 'small' },
    { id: 'tasks', size: 'medium' },
    { id: 'activity', size: 'medium' },
    { id: 'orgEvents', size: 'medium' },
  ],
  admin: [
    { id: 'orgHealth', size: 'large' },
    // Un admin a aussi des tâches attribuées (2026-10-20) : « Mes tâches » en tête.
    { id: 'tasks', size: 'medium' },
    { id: 'riskProjects', size: 'medium' },
    { id: 'companyOkrs', size: 'medium' },
    { id: 'activity', size: 'medium' },
    { id: 'unassigned', size: 'small' },
    { id: 'invitations', size: 'small' },
    { id: 'orgEvents', size: 'small' },
    { id: 'waiting', size: 'small' },
    { id: 'note', size: 'small' },
  ],
};

/**
 * Le modèle d'arrivée : admin, sinon membre. Encadrer quelqu'un ne choisit plus
 * de modèle (mig. 229) ; « manager » reste proposé dans le choix des modèles.
 */
export const templateForRole = (isAdmin: boolean): TemplateId =>
  isAdmin ? 'admin' : 'member';
