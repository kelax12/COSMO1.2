# Contribuer à COSMO

Merci de l'intérêt. Ce document dit comment le dépôt fonctionne **vraiment** aujourd'hui, pas
comment il fonctionnerait dans un projet idéal.

## Avant tout : ouvrez une issue

COSMO est développé par une seule personne, par poussée directe sur `main` (voir plus bas). Il n'y a
pas de file de revue de pull requests. Si vous voulez corriger un bug ou proposer un changement :

1. **Ouvrez d'abord une issue** qui décrit le problème ou la proposition, avant d'écrire du code.
2. Attendez une réponse. Une issue sert à éviter que vous perdiez du temps sur un changement qui
   serait refusé ou déjà en cours.
3. Une pull request peut ensuite être ouverte, mais elle n'est pas le canal normal : elle sera
   relue et, si elle est retenue, portée sur `main` par le mainteneur.

Les failles de sécurité ne passent **pas** par une issue : voir [`SECURITY.md`](./SECURITY.md).

Le backlog du projet vit dans les issues étiquetées `backlog` (type, zone, priorité, propriétaire,
échéance), plus dans un fichier Markdown : gabarit « Tâche de backlog »,
[`a-faire-code.md`](./a-faire-code.md) pour le détail. Dépôt public : jamais de faiblesse
exploitable, de donnée personnelle, de secret ni de détail d'incident dans une issue.

## Proposer une fonctionnalité de plus d'une semaine

Décision du 2026-11-08 ([ADR 0013](./docs/adr/0013-validation-d-usage-avant-toute-fonctionnalite-longue.md)) :
une fonctionnalité qui demande **plus d'une semaine de travail** (une personne, agents compris) se
valide par l'usage **avant** le premier commit. Un bug, un correctif de sécurité, une obligation
légale ou de l'outillage n'ont pas besoin de cette étape.

La proposition suit le gabarit [`docs/propositions/GABARIT.md`](./docs/propositions/GABARIT.md), ou
l'issue « Proposition de fonctionnalité » qui en reprend les rubriques :

1. **Le problème**, pour qui, et ce que la personne fait aujourd'hui à la place.
2. **La preuve d'usage** : ce qui existe déjà (demandes, abandons, contournements), pas ce qu'on suppose.
3. **La maquette** : un écran visible, pas une description.
4. **Le test auprès de N utilisateurs** (N au moins 5) : la tâche donnée, combien l'ont réussie sans aide.
5. **La mesure d'activation** : l'action clé, la part visée, la date de lecture, fixées avant le code.
6. **Le critère d'abandon** : le seuil et la date sous lesquels on retire, et ce que le retrait emporte.

Sans résultat de test, la fonctionnalité est proposée, pas validée : le code ne commence pas. Ni nom
ni capture d'utilisateur dans la proposition (le dépôt est public).

## Gel fonctionnel

Décision du 2026-11-09 ([ADR 0020](./docs/adr/0020-definition-of-done-et-gel-fonctionnel.md)), qui
complète la règle précédente :

- **Pas de nouvelle fonctionnalité de plus d'une semaine sans proposition validée.** Validée veut dire
  que les six rubriques sont remplies et que le test auprès d'au moins 5 utilisateurs a eu lieu.
  Dans le doute sur la durée, on écrit la proposition.
- **Une fonctionnalité à la fois.** Une seule proposition au statut « en cours » à un instant donné.
  Les autres attendent, même validées : mieux vaut finir une fonctionnalité, tests, doc et mesure
  d'activation compris, que d'en ouvrir une deuxième.
- **Ce que le gel ne touche pas** : bugs, sécurité, obligations légales, outillage et CI, dette
  technique, et les tâches du backlog qui ne sont pas des fonctionnalités.
- Le gel n'a pas de date de fin. Il se lève fonctionnalité par fonctionnalité, par une proposition
  validée, jamais en bloc.

Aucune licence de réutilisation n'est accordée à ce jour (voir [`README.md`](./README.md#licence)) :
proposer du code ne vaut pas cession de droits, et le mainteneur peut vous demander de le préciser
avant de l'intégrer.

## Mise en route

```bash
npm ci
npm run dev
git config core.hooksPath .githooks   # une fois par clone
```

Sans variables `VITE_SUPABASE_*`, l'application tourne en démo sur `localStorage` : c'est suffisant
pour la plupart des changements d'interface. Le lancement contre un Supabase local est décrit dans
[`README.md`](./README.md#lancer-contre-un-supabase-local).

Les hooks de `.githooks/` font deux choses : `pre-commit` refuse l'indexation d'un fichier qui n'a
rien à faire dans un dépôt public (documents, exports, `.env`, dossier privé), `pre-push` refuse une
poussée sur `main` tant que le dernier `CI noyau` de `main` est rouge.

## Les conventions du dépôt

- **Imports par l'alias `@/`**, jamais en chemin relatif :
  `import { supabase } from '@/lib/supabase'`. Seule exception : `api/`, où l'alias ne résout pas.
- **TypeScript strict** : pas de `as any`, `noUnusedLocals` et `noUnusedParameters` actifs
  (préfixer par `_` ce qui est inutilisé exprès). `interface` pour les objets, `type` pour les unions.
- **Deux backends, une interface.** Chaque module expose un `repository.ts` servi par
  `supabase.repository.ts` ou `local.repository.ts`. Une fonctionnalité qui ne marche que dans l'un
  des deux modes, démo ou Supabase, n'est pas finie. `supabase.from()` ne sort pas d'un repository
  (garde `src/architecture.guard.test.ts`).
- **Les modules entreprise ont leurs propres tables** (`team_*`, `org_*`) : on ne réutilise jamais un
  module perso pour le monde entreprise. Voir [`docs/adr/`](./docs/adr/README.md).
- **La RLS est la vraie frontière de sécurité.** La validation zod côté client ne l'est pas. Avant de
  toucher `supabase/`, un repository ou la facturation, lire [`docs/SECURITY.md`](./docs/SECURITY.md).
- **Les tests vivent à côté du code** : `monmodule.ts` a son `monmodule.test.ts`. Un correctif de bug
  arrive avec le test qui l'aurait attrapé, vu rouge avant le correctif.
- **Les textes de l'interface passent par l'i18n maison** (`useT`, catalogues `src/locales/{fr,en}/*.json`),
  jamais en dur, et chaque clé existe en français **et** en anglais (`npm run i18n:check`).
- **Pas de tiret cadratin** (le caractère long, « em dash ») dans un texte livré, en français comme en
  anglais : ni dans l'interface, ni dans les catalogues, ni dans les docs. Utilisez une virgule, deux
  points ou un point.
- Imports **nominaux** pour `lucide-react` ; `toast` seulement depuis `@/lib/toast` ; `gsap`
  seulement depuis `@/lib/gsap`, et seulement dans la landing.
- Les gardes qui existent ne se contournent pas : jamais relever un seuil, ni ajouter une entrée
  d'allowlist, pour faire passer la CI. Un dépassement dit qu'un contenu doit bouger.

Le détail par dossier est dans les `CLAUDE.md` (par exemple [`src/modules/CLAUDE.md`](./src/modules/CLAUDE.md)) :
écrits pour un agent de code, ils servent aussi d'aide-mémoire à un humain.

## Avant de pousser

```bash
npm run lint           # 0 erreur
npm run typecheck      # 0 erreur
npm run test:changed   # les tests liés à votre diff
```

Évitez de lancer toute la suite et les tests E2E en local : ils sont longs et la CI les joue.
Détail : [`docs/TESTING.md`](./docs/TESTING.md).

Les migrations SQL (`supabase/migration/`) ont leur propre règle : numérotées, appliquées à la main,
et **prouvées avant application**. Ne lancez jamais `supabase db push` ici. Lire
[`supabase/migration/CLAUDE.md`](./supabase/migration/CLAUDE.md) avant d'écrire du SQL.

## Comment le code arrive sur `main`

Décision du 2026-10-29 ([ADR 0002](./docs/adr/0002-poussee-directe-sur-main-derriere-ci-noyau.md)) : le
mainteneur **pousse directement sur `main`**, sans branche ni pull request, derrière un contrôle
automatique.

- Le workflow **`CI noyau`** (`.github/workflows/ci-noyau.yml`, environ 5 minutes) est le verdict
  **bloquant** : lint, `tsc -b`, tests et couverture, gardes statiques, parité i18n, build et budget
  de bundle, fichiers sensibles, RLS sur base vierge.
- Un `CI noyau` rouge sur `main` bloque toute nouvelle poussée sur `main` (hook `pre-push`), sans
  contournement. Pour réparer, on pousse le correctif sur `noyau/<nom>`, puis le même commit sur
  `main` une fois son noyau vert ([`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md), section sur le hook).
- `--no-verify` est interdit.

Si vous contribuez de l'extérieur, rien de tout cela ne vous est demandé : proposez, le mainteneur
porte.

## Definition of Done

Une tâche est **terminée** quand les cinq critères ci-dessous sont vrais, pas quand le code est
écrit ([ADR 0020](./docs/adr/0020-definition-of-done-et-gel-fonctionnel.md)). Ils valent pour toute
issue de backlog et toute poussée sur `main`. Le mainteneur les relit à la clôture de l'issue.

1. **`CI noyau` vert sur le SHA exact poussé.** Pas sur le commit d'avant, ni sur une branche
   voisine : le verdict se lit sur le SHA livré
   (`gh run list --workflow ci-noyau.yml --commit <sha>` rend `success`). Rouge, on répare tout de
   suite, car le hook `pre-push` refuse toute autre poussée sur `main`.
2. **Tests du parcours touché.** Le parcours de la personne qui utilise la chose, pas seulement
   l'unité : un correctif de bug a le test qui l'aurait attrapé, vu rouge avant le correctif, et un
   parcours d'écran a sa spec `e2e/` jouée par la CI (en local, seule la spec modifiée se lance).
   `lint`, `typecheck` et `test:changed` à zéro erreur avant de pousser.
3. **Double mode, démo et Supabase.** Le changement marche dans les deux backends, derrière la même
   interface de repository. Ce qui touche le schéma suit la règle des migrations (numérotée,
   prouvée avant application) et garde les données de démo alignées sur la base.
4. **Doc d'état à jour dans le même commit.** Le `CLAUDE.md` du dossier, `docs/MODULES.md` ou le doc
   de domaine qui décrivait l'ancien état. Les chiffres se génèrent (`npm run faits:generer`), ils ne
   se recopient pas ; `npm run check:docs` reste vert. L'issue se ferme par le commit
   (`Closes #N`), pas par une ligne retirée d'un fichier.
5. **Revue pour tout changement de base ou de sécurité.** Migration SQL, policy RLS, repository
   Supabase, Edge Function, authentification, facturation, CSP, secrets, workflows : une seconde
   paire d'yeux avant `main`, soit **une seconde session** (pas celle qui a écrit le changement),
   soit **Axel**. Le changement se pousse d'abord sur `noyau/<nom>`, `main` n'avance à ce même SHA
   qu'une fois le noyau vert et la revue faite, et le message du commit la nomme
   (`Revu-par : Axel` ou `Revu-par : session <nom>`). Les autres changements gardent la poussée
   directe de l'ADR 0002, sans revue.

Aucun de ces critères n'est une garde de CI en soi, à l'exception du critère 1 et de ce que le noyau
joue déjà : ils se contrôlent à la clôture, comme la poussée directe se contrôle par ses gardes et
non par une revue.
