/**
 * Garde de fermeture des modals (#40) : protège la saisie non sauvegardée
 * contre un misclick d'overlay ou un Échap. Retourne true si la fermeture
 * peut continuer. Confirm natif : synchrone, accessible, uniforme.
 */
export function confirmDiscard(hasUnsavedChanges: boolean): boolean {
  if (!hasUnsavedChanges) return true;
  return window.confirm('Abandonner les modifications non enregistrées ?');
}
