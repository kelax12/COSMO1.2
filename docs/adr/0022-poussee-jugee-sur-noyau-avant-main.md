# ADR 0022 · Poussée jugée sur `noyau/` avant `main`, rien de lourd en local

- **Statut** : acceptée
- **Date** : 2026-11-19, décision d'Axel
- **Remplace** : [ADR 0002](./0002-poussee-directe-sur-main-derriere-ci-noyau.md)

## Contexte

L'ADR 0002 faisait juger `main` par le `CI noyau` après la poussée. Pour ne pas rougir `main`, chaque
session rejouait avant de pousser une partie du noyau sur le poste (4 cœurs, 8 Go). Mesures du
2026-11-19 sur ce poste :

- `tsc -b` : 3 min 23 s (cache chaud) ;
- `eslint .` : 5 min 37 s sans cache, 27 s avec ;
- la suite Vitest complète : 54 min. `test:changed` la déclenche entière dès qu'un fichier importé
  partout bouge (`translate.ts`, et 46 fichiers de test pour `src/lib/utils.ts`) ;
- `CI noyau` sur un runner GitHub : 4 à 7 min.

Avec plusieurs sessions à la fois, la mémoire saturait : un correctif d'interface coûtait jusqu'à
40 min et ne laissait tourner qu'une session.

## Décision

- On commit sur la branche locale du worktree, sans pull request, et on pousse par
  **`npm run pousser`**. Le commit part sur `noyau/<session>-<sha>`, où le `CI noyau` le juge en
  entier. S'il est vert, la branche est supprimée et **ce même SHA** part sur `main`, après la fin
  d'un éventuel run de `main` (`garde-noyau-en-cours.sh`). S'il est rouge, rien ne part sur `main`.
  Si `main` a bougé pendant ce temps, le commit est rebasé et le noyau de `main` le rejuge.
- La boucle locale est **`npm run verif:rapide`** : ESLint en cache sur les fichiers modifiés, la
  sélection de `test:changed` et six gardes transverses d'interface. ❌ Pas de `tsc -b`, de lint
  complet, de suite complète ni de `build` en local pour une retouche : le noyau les joue.
- `test:changed` ne joue pas une sélection de plus de 40 fichiers de test (sortie 2) : le verdict
  revient au noyau. `--tout` la force.
- Le hook `pre-push` ne change pas : il refuse une poussée sur `main` tant que le dernier
  `CI noyau` de `main` est rouge ou illisible, sans contournement, sauf pour un SHA que le noyau a
  déjà jugé vert. `--no-verify` reste interdit.
- Une session, un worktree, une branche locale : jamais deux écrivains dans le même arbre. Les
  E2E ne se lancent pas en local pour une retouche d'interface.

## Conséquences

- **Positives.** La partie locale d'un correctif d'interface passe sous 2 min (60 s mesurées sur un
  diff de quatre fichiers). Le poste reste libre pendant le verdict, donc plusieurs sessions
  tournent ensemble. `main` ne reçoit qu'un SHA déjà jugé vert, donc il rougit moins souvent.
- **Négatives.** 4 à 7 min d'attente du verdict avant `main`, et deux runs du noyau par commit (la
  branche, puis `main`). Une erreur de type se voit au noyau, pas sur le poste. Une branche
  `noyau/…` vit le temps du verdict. Un rebase pendant l'attente pousse un SHA que le noyau de
  `main` est seul à juger.
- **Inchangé.** Aucune seconde paire d'yeux hors critère 5 de la Definition of Done (ADR 0020), et
  le hook reste local : seule une protection de branche GitHub fermerait ce chemin pour tout le
  monde.
- Détail du hook et de la poussée : [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md), section « Hook
  `pre-push` » ; boucle locale : [`docs/TESTING.md`](../TESTING.md).
