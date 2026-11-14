# À faire · CODE

> **Quand lire** : pour trouver, ouvrir ou fermer une tâche de code.
> **Fait foi** : les [issues GitHub étiquetées `backlog`](https://github.com/kelax12/COSMO1.2/issues?q=is%3Aissue+is%3Aopen+label%3Abacklog) (ADR 0020) ; ce fichier n'est qu'un renvoi.

## Backlog

- ✅ Ajouter une tâche : une issue avec le gabarit « Tâche de backlog » ([`.github/ISSUE_TEMPLATE/tache-de-backlog.md`](./.github/ISSUE_TEMPLATE/tache-de-backlog.md)). Les identifiants `C-NN` sont terminés : le numéro d'issue les remplace.
- ✅ Étiquettes : un `type:` (`bug`, `dette`, `epreuve`, `amelioration`, `doc`), une `zone:` (`facturation`, `entreprise`, `accessibilite`, `mobile`, `base`, `ci`, `i18n`, `seo`, `interface`, `docs`) et une `priorite:` (`P1` avant le premier encaissement ou le prochain déploiement, `P2` dans le trimestre, `P3` quand il y a de la place).
- ✅ Propriétaire et échéance : l'assigné de l'issue, et son milestone `Echeance AAAA-MM-JJ`. Les échéances sont proposées, Axel les ajuste.
- ✅ Fermer une tâche : la Definition of Done de [`CONTRIBUTING.md`](./CONTRIBUTING.md) ([ADR 0020](./docs/adr/0020-definition-of-done-et-gel-fonctionnel.md)), par l'issue (`Closes #N` dans le commit).
- ❌ Jamais un item ouvert écrit ici : le détail va dans l'issue.

## Ce qui n'est pas une issue

- ❌ Le dépôt est public : jamais dans une issue ni ici une faiblesse de sécurité, un geste de production qui touche un secret, une console ou une donnée personnelle, un détail d'incident. Ils vivent dans le dossier privé d'Axel (`CLAUDE.md` § Documentation et hors dépôt).
- ❌ Une faille se signale par [`SECURITY.md`](./SECURITY.md), jamais par une issue.

## Règles de traitement

Récits : [`docs/archive/a-faire-code-jusqua-2026-11-09.md`](./docs/archive/a-faire-code-jusqua-2026-11-09.md) § « Règles de traitement ».

1. ❌ Ne jamais relever un plafond ni baisser un seuil pour faire passer une garde (`check:bundle`, `architecture.guard`, `i18n:scan`, `test:coverage`).
2. ✅ Mesurer avant, mesurer après, et publier les deux chiffres.
3. ✅ Tout correctif de garde repart avec un témoin : une sonde qui refuse un détecteur qui ne détecterait plus rien.
4. ✅ Un défaut d'interface se vérifie en ouvrant l'écran, pas en relisant le code.
5. ⚠️ Plusieurs sessions sont actives : relire le ledger avant d'appliquer une migration, et `git status` avant de commiter.
6. ❌ Ne jamais attribuer un delta à son propre geste sans revérifier `HEAD` aux deux bouts de la mesure.

## Items clos

`C-01` à `C-120` et audits `A-1` à `A-8` sauf `A-4` : [`docs/archive/a-faire-code-jusqua-2026-10-11.md`](./docs/archive/a-faire-code-jusqua-2026-10-11.md). `C-58` : [`docs/archive/a-faire-code-clos-2026-11-05.md`](./docs/archive/a-faire-code-clos-2026-11-05.md). `C-121` et le détail de `C-65`, `C-39`, `C-45`, `C-24`, `A-4` : l'archive citée en § Règles de traitement.
