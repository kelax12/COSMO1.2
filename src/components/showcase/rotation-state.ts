// ═══════════════════════════════════════════════════════════════════
// C-69 — quand la vitrine du hero a-t-elle le droit de tourner ?
//
// 🔴 CE QUI ÉTAIT FAUX. `AppWindowShowcase` changeait de vue toutes les 2,5 s,
// indéfiniment, sans bouton de pause, sans arrêt au survol ni au focus, et
// **sans le moindre égard pour `prefers-reduced-motion`**. WCAG 2.2.2 (AA)
// vise exactement ce cas : une information en mouvement qui démarre seule,
// dure plus de 5 s et coexiste avec d'autres contenus doit offrir un moyen de
// la mettre en pause, l'arrêter ou la masquer.
//
// ⚠️ `aria-hidden="true"` NE DISPENSAIT DE RIEN, et c'est ce qui a permis au
// défaut de vivre : le critère ne parle pas des lecteurs d'écran, il parle des
// personnes qui ne peuvent pas lire une page pendant que quelque chose bouge à
// côté — troubles de l'attention, sensibilité vestibulaire. Cacher la fenêtre
// aux technologies d'assistance la laissait entièrement visible pour elles.
//
// ── LES TROIS ÉTATS, ET POURQUOI TROIS ─────────────────────────────
//
//   `auto`    défaut. Tourne, SAUF si `prefers-reduced-motion` est posé.
//   `pause`   l'utilisateur a demandé l'arrêt. Ne tourne jamais.
//   `lecture` l'utilisateur a demandé le mouvement. Tourne MÊME en
//             `prefers-reduced-motion`.
//
// 🔴 Le troisième état n'est pas un luxe, c'est ce qui rend le réglage
// honnête. Sans lui, une personne en mouvement réduit verrait une fenêtre
// figée sur « Tâches » pour toujours, et le hero — dont le message entier est
// « quatre modules, une seule app » — ne dirait plus rien pour elle. WCAG
// 2.3.3 n'interdit pas le mouvement : il interdit le mouvement NON DEMANDÉ.
// Appuyer sur « lecture » est une demande.
//
// ⚠️ LA SUSPENSION N'EST PAS UN ÉTAT. Le survol et le focus suspendent la
// rotation sans rien changer à ce que l'utilisateur a demandé : relâcher le
// pointeur reprend là où on en était. Un survol n'est pas une décision, et
// c'est pour ça que `suspendu` vit dans le composant et pas ici.
//
// 🔴 POURQUOI CE MODULE EXISTE À PART. Une règle qui décide d'un comportement
// d'accessibilité doit être éprouvable sans monter un composant, sans
// `IntersectionObserver` et sans horloge. Témoin :
// `rotation-state.guard.test.ts`.
// ═══════════════════════════════════════════════════════════════════

export type EtatRotation = 'auto' | 'pause' | 'lecture';

/**
 * La rotation tournerait-elle, indépendamment de toute suspension passagère
 * (survol, focus) et de la visibilité à l'écran ?
 */
export function rotationDemandee(etat: EtatRotation, mouvementReduit: boolean): boolean {
  if (etat === 'pause') return false;
  if (etat === 'lecture') return true;
  // `auto` : on ne bouge que si personne n'a demandé le contraire au système.
  return !mouvementReduit;
}

/**
 * L'état que produit un appui sur le bouton.
 *
 * ⚠️ Il se décide sur `rotationDemandee`, JAMAIS sur « est-ce que ça tourne à
 * cet instant » : sinon survoler la fenêtre — ce qui suspend — retournerait le
 * bouton sous le curseur, et l'appui relancerait ce qu'on croyait arrêter.
 */
export function etatApresAppui(etat: EtatRotation, mouvementReduit: boolean): EtatRotation {
  return rotationDemandee(etat, mouvementReduit) ? 'pause' : 'lecture';
}
