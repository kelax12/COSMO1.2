// ═══════════════════════════════════════════════════════════════════
// Couleur d'une barre de complétion, en dégradé continu rouge → vert
// ═══════════════════════════════════════════════════════════════════
//
// La barre de la section Habitudes portait un vert fixe : 20 % et 100 % se
// ressemblaient, et la couleur ne disait rien que le chiffre ne disait déjà.
// Elle suit désormais le taux, en teinte continue.
//
// ⚠️ Cette couleur est REDONDANTE avec le pourcentage affiché à côté : elle ne
// porte aucune information seule (WCAG 1.4.1). Ne pas l'appliquer à du TEXTE :
// une teinte continue ne garantit aucun rapport de contraste, ni en thème clair
// ni en thème sombre. Elle ne remplit qu'une surface.

/** Teinte HSL du taux, 0° (rouge) à 140° (vert). Entrée bornée [0, 100]. */
export const completionHue = (rate: number): number => {
  const safe = Number.isFinite(rate) ? Math.min(100, Math.max(0, rate)) : 0;
  return Math.round(safe * 1.4);
};

/**
 * Couleur de remplissage d'une barre de complétion.
 * Saturation et luminosité fixes : seule la teinte bouge, pour que deux barres
 * voisines se comparent sur un seul axe.
 */
export const completionColor = (rate: number): string =>
  `hsl(${completionHue(rate)}, 68%, 45%)`;
