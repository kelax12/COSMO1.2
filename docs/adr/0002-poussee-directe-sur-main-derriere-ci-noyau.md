# ADR 0002 · Poussée directe sur `main`, derrière le `CI noyau`

- **Statut** : acceptée
- **Date** : 2026-10-29, reconfirmée par Axel le 2026-11-06

## Contexte

Le développement est mené par une personne, avec des sessions d'agents de code qui travaillent en
parallèle, chacune dans son propre worktree. Les pull requests et les tests de bout en bout joués en
local coûtaient trop de temps et de jetons pour une file de revue qui n'a qu'un lecteur : l'auteur.

Un audit externe du 2026-11-06 a relevé l'absence de protection de branche. La décision a été
rouverte par Axel à cette occasion, et maintenue.

## Décision

- On **commit et on pousse sur `main`**, sans branche ni pull request, sauf demande explicite.
- La porte n'est pas une revue humaine mais un **contrôle automatique bloquant** : le workflow
  **`CI noyau`** (`.github/workflows/ci-noyau.yml`, cinq jobs en parallèle, verdict sous 5 minutes).
  Il joue lint, `tsc -b`, tests et couverture, gardes statiques, parité i18n, build et budget de
  bundle, fichiers sensibles, et la RLS sur une base vierge.
- Le hook `pre-push` (`.githooks/pre-push`) **refuse une poussée sur `main` tant que le dernier `CI
  noyau` de `main` est rouge**, ou illisible, sans variable de contournement. Pour réparer, on pousse
  le correctif sur `noyau/<nom>`, puis ce même commit sur `main` une fois son noyau vert.
- Une session, un worktree, une branche locale : jamais deux écrivains dans le même arbre. On pousse
  depuis le worktree par `git fetch origin && git rebase origin/main && git push origin HEAD:main`.
- `--no-verify` est interdit. Les E2E ne se lancent pas en local pour une retouche d'interface : la CI
  les joue après la poussée.

## Conséquences

- **Positives.** Un cycle court, une seule version de la vérité (`main`), un verdict de CI lisible
  par tous, sans file de revue.
- **Négatives.** Aucune seconde paire d'yeux avant qu'un changement atteigne `main`, donc la
  qualité repose sur les gardes et leurs témoins, pas sur la revue. Le hook est **local** (il
  s'installe par clone avec `git config core.hooksPath .githooks`) : seule une protection de branche
  côté GitHub, qui exigerait le statut `CI noyau`, fermerait ce chemin pour tout le monde. C'est un
  réglage du dépôt, non posé à ce jour.
- **Pour un contributeur externe.** Cette décision décrit le développement du mainteneur, pas un
  processus ouvert : on ouvre d'abord une issue (voir [`CONTRIBUTING.md`](../../CONTRIBUTING.md)).
- Le détail du hook et de la réparation d'un noyau rouge est dans
  [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md), section « Hook `pre-push` ».
