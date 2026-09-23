// Géométrie partagée de la vitrine Agenda.
//
// La barre « Tâches disponibles » a une largeur FIXE ; le calendrier prend le
// reste. `FeaturesSection` a besoin de cette largeur pour élargir le calendrier
// SANS toucher à la barre : elle vit donc ici, et nulle part ailleurs — deux
// `218` recopiés finiraient par diverger en silence.

/** Largeur de la barre des tâches, en px. */
export const LARGEUR_BARRE_TACHES = 218;

/**
 * Le calendrier de la landing est 30 % plus large que la place que lui
 * laisserait une colonne à moitié (demande du 2026-09-23). La barre, elle, ne
 * bouge pas.
 */
export const ELARGISSEMENT_CALENDRIER = 1.3;

/**
 * `flex-basis` de la colonne qui porte la vitrine, dans une rangée à deux
 * colonnes séparées par `gap`. Sans élargissement, chaque colonne vaudrait
 * `50% - gap/2` ; le calendrier en recevrait `50% - gap/2 - barre`. On garde
 * la barre, et on multiplie la seule part du calendrier.
 *
 * ⚠️ Le pourcentage se résout sur la boîte de contenu de la rangée flex : c'est
 * exactement la base des deux `flex-1` d'origine, donc le calcul est juste à
 * toute largeur, sans mesure.
 */
export const basisColonneAgenda = (gapPx: number): string =>
  `calc(${LARGEUR_BARRE_TACHES}px + (50% - ${gapPx / 2 + LARGEUR_BARRE_TACHES}px) * ${ELARGISSEMENT_CALENDRIER})`;
