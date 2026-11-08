# ADR 0017 · lucide-react 0.563, tant que la 1.x alourdit le chemin critique

- **Statut** : acceptée
- **Date** : 2026-11-08 (vague 18.2 du plan de reprise, constat DEP-01)

## Contexte

L'audit externe du 2026-11-06 relève `lucide-react` 0.563 avec une majeure de retard (`npm outdated`
du 2026-11-08 : 1.70.0). Le guide de l'éditeur annonce trois ruptures : icônes de marque retirées,
build UMD retiré, `aria-hidden` posé par défaut.

Essai fait le 2026-11-08 dans le dépôt :

- **Aucune rupture ne nous touche.** Aucune icône de marque n'est importée (`tsc -b` vert), le
  dépôt ne charge pas l'UMD, et la 0.563 masquait déjà les icônes décoratives : sur `/tasks`,
  101 icônes sur 102 portaient `aria-hidden="true"` avant la montée. La règle est la même dans les
  deux versions : une icône munie d'un `aria-*`, d'un `role` ou d'un `title` reste exposée.
- **Le poids, lui, monte.** Les 203 icônes importées par `src/`, empaquetées seules et minifiées :
  **13 967 octets gzip en 0.563, 17 306 en 1.70**, soit +3,3 ko. La hausse vient du nouveau moteur
  de rendu commun (`buildLucideIconNode`, `Icon`, contexte de configuration), pas des icônes.
- Ce moteur vit dans `vendor-utils`, préchargé pour tout visiteur : le chemin critique passe de
  305,4 à 308,5 ko, et `vendor-utils` dépasse son cliquet (33,7 ko pour 33,0). `check:bundle` est
  rouge.

## Décision

**`lucide-react` 1.x est écarté.** Le dépôt reste en 0.563. La montée coûterait 3,3 ko gzip sur
le chemin critique de chaque visiteur pour aucun changement visible ni accessible. Le cliquet de
`vendor-utils` ne se relève pas, et déplacer `lucide-react` dans un autre chunk pour passer sous
ce cliquet ne retirerait rien du chemin critique : ce serait contourner la mesure.

## Conséquences

- **Positives.** Chemin critique et rendu inchangés.
- **Négatives.** Les icônes **nouvelles** ne sont publiées qu'en 1.x : une icône absente de la
  0.563 demandera soit cette montée, soit un SVG local.
- **Ce qui rouvre la décision.** Une version 1.x dont le moteur ramène l'écart sous le kilo-octet
  (même mesure : nos icônes, empaquetées seules), ou un besoin produit d'une icône publiée en 1.x
  seulement. Alors : remesurer, et si le chemin critique monte encore, retirer d'abord du poids
  ailleurs dans `vendor-utils`.
- **À ne pas faire.** Ne pas relever le plafond de `vendor-utils` ni sortir `lucide-react` de ce
  chunk pour faire passer la montée.
