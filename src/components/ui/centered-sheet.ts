/**
 * Une fiche latérale (`SheetContent side="right"`) affichée en popup CENTRALE
 * à partir de `sm` : 80 % de la largeur et de la hauteur de la fenêtre, donc
 * 80 % de sa diagonale, centrée par ses marges (10 %) plutôt que par un
 * `translate`, que l'animation d'entrée réécrirait. Le glissement depuis la
 * droite devient un fondu zoomé. Sous `sm`, la fiche garde son rendu mobile.
 *
 * Utilisée par les fiches OKR perso (`OKRModalSheet`) et entreprise
 * (`TeamOKRModal`).
 */
export const CENTERED_SHEET =
  'sm:inset-auto sm:top-[10vh] sm:left-[10vw] sm:right-auto sm:h-[80vh] sm:w-[80vw] sm:max-w-none sm:!rounded-2xl sm:border sm:border-[rgb(var(--color-border))] sm:shadow-2xl sm:data-[state=open]:slide-in-from-right-0 sm:data-[state=closed]:slide-out-to-right-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95';
