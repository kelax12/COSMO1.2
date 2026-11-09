# ADR 0018 · Framer Motion 12, tant que la 14 alourdit le chemin critique

- **Statut** : acceptée
- **Date** : 2026-11-09 (vague 18.2 du plan de reprise, constat DEP-01)

## Contexte

L'audit externe du 2026-11-06 relève Framer Motion 12 avec deux majeures de retard (`npm outdated`
du 2026-11-08 : 14.10, installée le 2026-11-09 en 14.11.0). Le guide de l'éditeur
([upgrade guide](https://motion.dev/docs/react-upgrade-guide)) annonce :

- **13** : `@emotion/is-prop-valid` n'est plus une dépendance optionnelle. Ne touche que les
  composants stylés par Emotion ou Styled Components : le dépôt n'en a aucun.
- **14** : aucune rupture pour React, des API internes dépréciées et des versions internes liées
  plus strictement.

Essai fait le 2026-11-09 dans le dépôt : `tsc -b` et `lint` verts sans changer une ligne de
`src/`. Mais le poids :

- **Build réel** : `vendor-animation`, chunk du chemin critique, passe de **47 867 à 59 740
  octets gzip** (+11,9 ko, plafond 52,0 ko) ; le chemin critique passe de 307,0 à 318,8 ko.
  `check:bundle` est rouge.
- **Mesure isolée** (les 15 noms que `src/` importe, empaquetés seuls et minifiés) :
  **48 397 octets en 12.43, 61 434 en 14.11**. La hausse vient du cœur du composant `motion` :
  `TransformAnimation` (animations de transformation en WAAPI, nouveau), `animation/timeline`,
  et `Reorder/Board`.
- Sans `animate` ni `Reorder` (que le produit utilise pour de vrai : listes réordonnables,
  couleurs, catégories), l'écart reste de **44 732 à 51 119 octets** : il n'y a pas d'import à
  retirer qui le comblerait.

## Décision

**Framer Motion 13 et 14 sont écartés.** Le dépôt reste en 12.43. La montée coûterait de 6 à
13 ko gzip sur le chemin critique de chaque visiteur, pour aucune différence visible : les
animations du produit n'ont besoin d'aucune fonction de la 14. Le cliquet de `vendor-animation`
ne se relève pas.

## Conséquences

- **Positives.** Chemin critique et animations inchangés.
- **Négatives.** Deux majeures de retard sur une bibliothèque présente sur presque tous les écrans ;
  les correctifs de la 12 cesseront un jour.
- **Ce qui rouvre la décision.** Une version dont le cœur revient au poids de la 12 (même mesure :
  nos imports, empaquetés seuls), ou le passage du produit à `LazyMotion` et aux composants `m`
  (fonctions d'animation chargées à la demande), qui retirerait l'essentiel du moteur du chemin
  critique quelle que soit la version. Ce passage touche les 119 fichiers qui importent
  `framer-motion` : c'est un chantier à part, pas une montée de dépendance.
- **À ne pas faire.** Ne pas relever le plafond de `vendor-animation` ni découper ce chunk pour
  faire passer la montée.
