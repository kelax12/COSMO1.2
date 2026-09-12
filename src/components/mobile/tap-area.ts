/**
 * Agrandir la zone tactile d'une commande SANS agrandir son dessin.
 *
 * 🔴 D'où ça vient (C-73, 2026-09-12). Le 2026-09-06, les pilules de listes de
 * `/tasks` sont passées de `h-11` à `h-9` — de 44 px à 36 — pour une raison
 * assumée et purement visuelle : « 44 px de haut faisait une pilule
 * disproportionnée une fois pleine au lieu de bordée ». Le dessin y a gagné, la
 * cible tactile y a perdu, et `docs/MOBILE.md` interdit justement les cibles
 * sous 44 × 44 (WCAG 2.5.5). La CI le disait tous les jours depuis, sur huit
 * routes, sans que personne ne relie les deux.
 *
 * Ce module refuse l'arbitrage « joli OU accessible » : le débord vit dans un
 * pseudo-élément absolu, donc il ne prend AUCUNE place dans le flux. La pilule
 * reste à 36 px, la cible en fait 44. C'est le contrat que le message d'échec
 * de `e2e/touch-targets.spec.ts` prescrit déjà mot pour mot (« l'ICÔNE reste
 * petite »), appliqué à une pilule au lieu d'une icône.
 *
 * ⚠️ Vertical UNIQUEMENT (`inset-x-0`). Le débord horizontal ferait se
 * chevaucher deux pilules voisines dans la rangée : on volerait un appui à la
 * chip d'à côté, ce qui est pire que la cible courte qu'on corrige.
 *
 * ⚠️ `sm:before:hidden` — au-delà de mobile la souris n'a pas besoin de 44 px,
 * et les chips y reprennent de toute façon leur forme d'origine.
 *
 * ❌ Ne jamais poser cette classe sur une commande qui n'a pas `relative` :
 * le pseudo-élément se positionnerait par rapport à un ancêtre quelconque et
 * couvrirait une zone qui n'a rien à voir. Elle porte donc `relative`.
 *
 * Mesuré par `e2e/touch-targets.spec.ts`, qui sait lire les pseudo-éléments
 * positionnés depuis la même passe — sans quoi ce correctif serait invisible à
 * la garde, et donc indistinguable d'un défaut non corrigé.
 */
export const TAP_AREA_44_Y =
  "relative before:absolute before:inset-x-0 before:top-1/2 before:h-11 "
  + "before:-translate-y-1/2 before:content-[''] sm:before:hidden";
