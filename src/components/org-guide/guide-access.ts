import type { GuideAccess, GuideAction, GuideViewer } from './guide-types';

/**
 * État d'une action pour l'utilisateur courant. Miroir d'affichage seulement :
 * la démo n'écrit rien, le serveur reste la barrière de toute action réelle.
 */
export const guideAccess = (action: GuideAction, viewer: GuideViewer): GuideAccess => {
  if (action.needsCustomRoles && !viewer.customRolesAvailable) return 'hidden';
  const req = action.requires;
  if (!req) return 'allowed';
  if (req === 'owner') return viewer.isOwner ? 'allowed' : 'denied';
  if (req === 'admin') return viewer.isAdmin ? 'allowed' : 'denied';
  return viewer.can[req] ? 'allowed' : 'denied';
};

/** Clé du droit manquant : `task.create` devient `task_create` (`t()` découpe sur les points). */
export const deniedRightKey = (action: GuideAction): string =>
  `denied.rights.${(action.requires ?? 'admin').replace(/\./g, '_')}`;
