# À faire · CODE

> 🗂️ **Ce fichier n'est plus une liste.** Depuis le 2026-11-09 (vagues 6.2 et 6.4 du plan de reprise,
> constat d'audit `PRO-06`), le backlog vit dans les **issues GitHub** : chacune porte un type, une
> zone, une priorité, un propriétaire et une échéance. Un Markdown ne se filtre pas, ne s'assigne pas
> et ne se date pas.
>
> **Le fichier tel qu'il était** (430 lignes, récits compris) est archivé à l'identique :
> [`docs/archive/a-faire-code-jusqua-2026-11-09.md`](./docs/archive/a-faire-code-jusqua-2026-11-09.md).
> Pour l'historique d'un item `C-NN` : y chercher `### C-NN`.

## Où est le backlog

- **Toutes les tâches ouvertes** : [issues étiquetées `backlog`](https://github.com/kelax12/COSMO1.2/issues?q=is%3Aissue+is%3Aopen+label%3Abacklog).
- **Ajouter une tâche** : ouvrir une issue avec le gabarit « Tâche de backlog »
  ([`.github/ISSUE_TEMPLATE/tache-de-backlog.md`](./.github/ISSUE_TEMPLATE/tache-de-backlog.md)). Les
  identifiants `C-NN` sont terminés (le dernier est `C-121`) : le numéro d'issue les remplace.
- **Étiquettes** : un `type:` (`bug`, `dette`, `epreuve`, `amelioration`, `doc`), une `zone:`
  (`facturation`, `entreprise`, `accessibilite`, `mobile`, `base`, `ci`, `i18n`, `seo`, `interface`,
  `docs`) et une `priorite:` (`P1` avant le premier encaissement ou le prochain déploiement, `P2` dans
  le trimestre, `P3` quand il y a de la place).
- **Propriétaire et échéance** : l'assigné de l'issue, et son milestone `Echeance AAAA-MM-JJ`.
- **Fermer une tâche** : suivre la Definition of Done de
  [`CONTRIBUTING.md`](./CONTRIBUTING.md) (ADR [0020](./docs/adr/0020-definition-of-done-et-gel-fonctionnel.md)).
  Une tâche qui se ferme se ferme par l'issue (`Closes #N` dans le commit), pas par une ligne retirée
  d'ici.

## Ouvert au 2026-11-09

| Issue | Sujet | Priorité | Échéance |
|---|---|---|---|
| [#182](https://github.com/kelax12/COSMO1.2/issues/182) | Facturation : jouer sur une vraie carte la rétractation, le remboursement admin et la suppression d'entreprise (`C-65`, `C-39`) | P1 | 2026-11-30 |
| [#183](https://github.com/kelax12/COSMO1.2/issues/183) | Accessibilité : audit VoiceOver sur un iPhone réel (`C-24`) | P2 | 2026-12-31 |
| [#184](https://github.com/kelax12/COSMO1.2/issues/184) | Mobile : audit sur appareils réels, iPhone et Android (`A-4`) | P2 | 2026-12-31 |

Les échéances sont proposées, Axel les ajuste. Ce tableau est un instantané : l'état courant est dans les
issues.

## Ce qui n'est pas une issue

Le dépôt est **public**. Restent hors des issues, et hors de ce fichier : les faiblesses de sécurité,
les gestes de production qui touchent un secret, une console ou une donnée personnelle, et tout détail
d'incident. Ils vivent dans le dossier privé d'Axel (voir [`docs/README.md`](./docs/README.md)). Une
faille se signale par [`SECURITY.md`](./SECURITY.md), jamais par une issue.

## Règles de traitement (elles viennent de défauts réels de ce dépôt)

Leurs récits sont dans l'archive ci-dessus (§ « Règles de traitement »).

1. ❌ Ne jamais relever un plafond ni baisser un seuil pour faire passer une garde (`check:bundle`,
   `architecture.guard`, `i18n:scan`, `test:coverage`).
2. ✅ Mesurer avant, mesurer après, et publier les deux chiffres.
3. ✅ Tout correctif de garde repart avec un témoin : une sonde qui refuse un détecteur qui ne
   détecterait plus rien.
4. ✅ Un défaut d'interface se vérifie en ouvrant l'écran, pas en relisant le code.
5. ⚠️ Ce dépôt a plusieurs sessions actives : relire le ledger avant d'appliquer une migration, et
   `git status` avant de commiter.
6. ❌ Ne jamais attribuer un delta à son propre geste sans revérifier `HEAD` aux deux bouts de la mesure.

## Items clos

Index et détail : [`docs/archive/a-faire-code-jusqua-2026-10-11.md`](./docs/archive/a-faire-code-jusqua-2026-10-11.md)
(`C-01` à `C-120`, audits `A-1` à `A-8` sauf `A-4`), [`docs/archive/a-faire-code-clos-2026-11-05.md`](./docs/archive/a-faire-code-clos-2026-11-05.md)
(`C-58`) et l'archive du 2026-11-09 (`C-121`, et le détail de `C-65`, `C-39`, `C-45`, `C-24`, `A-4`).
