// ═══════════════════════════════════════════════════════════════════
// Onglets de la fiche membre unifiée (item #18)
//
// Trois sheets montraient la même personne, chacun avec son propre chrome
// (portal + overlay `fixed inset-0`) et ouverts depuis des menus différents.
// Les imbriquer aurait superposé trois overlays et trois pièges de focus : le
// chrome appartient donc à un hôte unique (`MemberSheet`), et ce module porte
// la seule chose qui DÉCIDE quoi que ce soit — quels onglets sont ouverts.
// ═══════════════════════════════════════════════════════════════════

export type MemberTab = 'profile' | 'tasks' | 'contribution' | 'agenda';

export interface MemberTabAccess {
  /** Supérieur hiérarchique : voit tâches et contribution. */
  canSeeInsights: boolean;
  /** Agenda éditable — droit distinct (mig. 077, agenda manager). */
  canSeeAgenda: boolean;
}

/**
 * Onglets visibles, dans l'ordre d'affichage. Le profil est toujours là :
 * c'est le seul contenu qu'un pair a le droit de voir.
 */
export const visibleMemberTabs = (access: MemberTabAccess): MemberTab[] => {
  const tabs: MemberTab[] = ['profile'];
  if (access.canSeeInsights) tabs.push('tasks', 'contribution');
  if (access.canSeeAgenda) tabs.push('agenda');
  return tabs;
};

/**
 * Un onglet venu de l'URL doit être validé contre les onglets AUTORISÉS, pas
 * seulement contre la liste des noms possibles : sinon `?memberTab=agenda`
 * ouvrirait l'agenda d'un collègue à quelqu'un qui n'y a pas droit.
 * (La RLS reste la frontière réelle — ceci évite un écran vide et trompeur.)
 */
export const isValidMemberTab = (value: string, allowed: MemberTab[]): boolean =>
  (allowed as string[]).includes(value);
