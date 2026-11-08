# ADR 0003 · Internationalisation maison, en catalogues JSON

- **Statut** : acceptée
- **Date** : socle posé le 2026-07-30

## Contexte

L'application est bilingue, français et anglais, et ses pages publiques sont prérendues par locale
pour le référencement (`prerender/`). Elle charge ses textes à la demande, par page, pour tenir un
budget de bundle strict (voir [`docs/PERFORMANCE.md`](../PERFORMANCE.md)).

## Décision

L'i18n est un **moteur maison**, sans `i18next` ni autre bibliothèque (`package.json` n'en contient
aucune).

- Les textes vivent dans des **catalogues JSON par namespace** : `src/locales/{fr,en}/*.json`
  (33 namespaces au 2026-10-20). Le socle est dans `src/i18n/`.
- Un composant lit ses textes par `useT('namespace')`, qui rend `t` et `tp` (pluriels, par
  `Intl.PluralRules`). Une clé est plate dans son namespace.
- **Le français est le catalogue de référence** : le moteur retombe clé par clé sur lui.
- Chaque route déclare les namespaces dont elle a besoin (`lazyWithRetry(import, [namespaces])`), et
  ils sont **attendus avant le rendu**.
- Les **slugs de routes sont localisés** (`src/i18n/routes.ts`), avec une seule URL canonique par
  langue et par page. Le préfixe de locale est porté par le `basename` du routeur, figé au montage :
  changer de langue recharge la page.
- Des gardes protègent ce que le moteur ne peut pas voir : parité des clés (`i18n:check`), chaînes
  d'interface en dur (`i18n:scan`), valeurs anglaises recopiées du français (`i18n:identical`),
  catalogues du shell (`i18n:namespaces`), corps des pages prérendues (`i18n:pages`), glossaire
  (`i18n:quality`). Elles bloquent la CI.

## Conséquences

- **Positives.** Aucune dépendance, un chargement paresseux exactement à la mesure de chaque route,
  et un prérendu qui connaît les catalogues. Le coût en octets de chaque namespace est visible et
  gardé.
- **Négatives.** Un moteur de plus à maintenir seul, sans la syntaxe ICU ni l'écosystème d'outils
  d'une bibliothèque. Changer de langue demande un rechargement.
- **Limite connue.** Les gardes comparent des clés, des copies, des volumes et des formes : elles ne
  mesurent **pas** la qualité d'une traduction. Une phrase fausse mais différente les passe toutes,
  et la relecture de l'anglais reste un geste humain.
- Règles de détail : [`src/i18n/CLAUDE.md`](../../src/i18n/CLAUDE.md) et [`docs/I18N.md`](../I18N.md).
