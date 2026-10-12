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
  if (req === 'manager') return viewer.isAdmin || viewer.isManager ? 'allowed' : 'denied';
  return viewer.can[req] ? 'allowed' : 'denied';
};
