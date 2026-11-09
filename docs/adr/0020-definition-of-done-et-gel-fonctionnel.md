# ADR 0020 · Definition of Done, backlog en issues et gel fonctionnel

- **Statut** : acceptée
- **Date** : 2026-11-09, décision d'Axel (vagues 6.2 et 6.4 du plan de reprise)

## Contexte

L'audit externe du 2026-11-06 a relevé trois constats liés :

- **PRO-06** : le backlog vivait dans deux fichiers Markdown (`a-faire-code.md`, `a-faire-manuel.md`),
  lisibles seulement en entier, sans propriétaire, sans échéance, sans filtre. Une seule issue était
  ouverte sur le dépôt. Au 2026-11-09, le fichier de code ne portait plus que cinq entrées ouvertes
  noyées dans 430 lignes de récits clos.
- **PRD-01** : un gros effort de construction, sans signal d'usage proportionné.
- **PRO-02** : un taux de reprise élevé, c'est-à-dire du travail rouvert après avoir été déclaré
  fini. Le dépôt en a la trace : des constats « fermés » rouverts, des rouges de CI attribués à la
  mesure et non au produit, des correctifs sans test du parcours.

Dans les trois cas, la cause est la même : « fini » n'avait pas de définition écrite, donc chaque
session le définissait à sa manière, et rien ne bornait le nombre de chantiers ouverts à la fois.

## Décision

**1. Le backlog vit dans des issues GitHub.** Étiquette `backlog`, plus un `type:`, une `zone:` et une
`priorite:` (`P1`, `P2`, `P3`), un assigné (le propriétaire) et un milestone `Echeance AAAA-MM-JJ`.
Gabarit : `.github/ISSUE_TEMPLATE/tache-de-backlog.md`. `a-faire-code.md` devient un renvoi, son
ancien contenu est archivé à l'identique. Les identifiants `C-NN` s'arrêtent (dernier : `C-121`).
Le dépôt est public (ADR 0008) : **aucune issue ne porte de faiblesse de sécurité exploitable, de
donnée personnelle, de secret ni de détail d'incident**. Ces sujets restent dans le dossier privé
d'Axel, et une faille se signale par `SECURITY.md`.

**2. Une Definition of Done, en cinq critères** (texte complet dans
[`CONTRIBUTING.md`](../../CONTRIBUTING.md), § « Definition of Done ») :

1. `CI noyau` vert sur le **SHA exact** poussé, pas sur un commit voisin ;
2. tests du **parcours** touché, pas seulement de l'unité (correctif de bug : le test vu rouge avant) ;
3. **double mode** démo et Supabase, derrière la même interface de repository ;
4. **doc d'état à jour dans le même commit**, chiffres générés et non recopiés ;
5. **revue** par une seconde session ou par Axel pour tout changement de base ou de sécurité, poussé
   d'abord sur `noyau/<nom>`, avec la revue nommée dans le message du commit.

**3. Une règle de gel.** Pas de nouvelle fonctionnalité de plus d'une semaine sans proposition
validée (ADR 0013, gabarit [`docs/propositions/GABARIT.md`](../propositions/GABARIT.md)), et **une
fonctionnalité à la fois** : une seule proposition au statut « en cours ». Le gel ne touche ni les
bugs, ni la sécurité, ni le légal, ni l'outillage, ni la dette. Il n'a pas de date de fin : il se lève
fonctionnalité par fonctionnalité.

## Conséquences

- **Positives.** Une tâche a un propriétaire, une priorité et une date, et se filtre. « Fini » a un
  sens commun à toutes les sessions et à Axel. Le travail en cours se compte sur les doigts d'une main,
  ce qui borne le taux de reprise : on finit avant d'ouvrir.
- **Négatives.** Le critère 5 ralentit les changements de base et de sécurité : un aller-retour par
  `noyau/<nom>` et une seconde lecture. C'est voulu, ce sont ceux où une erreur coûte le plus cher. Le
  gel retarde une idée neuve d'au moins le temps de la proposition et d'un test à cinq utilisateurs.
  Une issue demande de la discipline de tri, que le fichier unique ne demandait pas.
- **Ce n'est pas une garde de CI**, sauf le critère 1 (le hook `pre-push` lit le noyau de `main`) et
  ce que le noyau joue déjà. La règle vit dans `CONTRIBUTING.md` et se contrôle à la clôture de
  l'issue. Un témoin protège seulement le texte (`scripts/definition-of-done.guard.test.mjs`) : les
  cinq critères restent nommés dans `CONTRIBUTING.md`, le gabarit d'issue existe, `a-faire-code.md`
  reste un renvoi et ne redevient pas une liste.
- Cet ADR **complète** l'[ADR 0013](./0013-validation-d-usage-avant-toute-fonctionnalite-longue.md) et
  l'[ADR 0002](./0002-poussee-directe-sur-main-derriere-ci-noyau.md), il ne les remplace pas.
