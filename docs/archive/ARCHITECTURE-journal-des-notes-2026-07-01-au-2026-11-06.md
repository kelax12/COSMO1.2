> ⚠️ **ARCHIVE : journal des notes d'architecture et angles morts (2026-07-01 → 2026-11-06), extrait de `docs/ARCHITECTURE.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md). Les notes /100 ont cessé (ADR 0012) : l'état de santé se lit dans [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

## Note d'architecture : 74 → 79 → 81 → 83 → 84 → 88 → 90 → 89 → 93 → 93 → 92 → 93 → 90 → 93 → 93 → 93 → 93 → 94 → **94 / 100** (2026-08-24 → 2026-08-25 → 2026-08-27 → 2026-08-29 → 2026-09-03 → 2026-09-14 soir → 2026-09-15 → 2026-09-16 → 2026-09-22 soir → 2026-10-01 → 2026-10-02 soir → 2026-10-03 → 2026-10-15 → 2026-10-16 → 2026-10-18 → 2026-10-20 → 2026-10-22 → 2026-10-25 → **2026-11-06**)

> ### ⚪ 2026-11-06 · 0 : gardes de structure vertes, un module neuf déclaré
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-11-06 : CI de `main` du 2026-10-26 au 2026-11-06 (75 runs, dernier `e2e` complet vert à `ba169ba1`), workflows planifiés relus run par run, production (advisors par l'API, catalogue, Edge Functions), alertes GitHub, dépôt à `c3294936` puis `d938bc6e`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-11-06 |
> |---|---|---|
> | `architecture.guard`, `check:docs`, `check:docs-scored` | 0 | verts à `074aa8c8` (`lint-test-build`) ; `check:docs-scored` rejoué en local : 32 documents, chacun déclare sa note |
> | Module `affiliation` (mig. `236`, Edge Function `affiliation-api`) | 0 | déclaré dans [`MODULES.md`](../MODULES.md) (`762c3295`) ; calcul et routage en modules purs testés (`_shared/affiliation-math.ts`, `_shared/affiliation-api.ts`) |
> | 188 commits depuis le 2026-10-25 | 0 | deux vagues d'interface entreprise, trois lots de facturation, l'affiliation : aucune garde de structure rouge au dernier vert |
>
> **94 → 94.**

> ### ⚪ 2026-10-22 · 0 : gardes de structure vertes
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-10-22 : CI de `main` à `d16de29a` (run `39843255180`, cinq jobs verts ; `main` rouge du 10-20 à 22:03 au 10-22 à 14:39, 19 runs), `Visual` vert à `fb83cd60`, production (advisors par l'API, catalogue, ledger, cron, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-22 |
> |---|---|---|
> | Hook orphelin `useSharesByTask` | 0 | rouge dans l'épisode du 10-21 (la rangée commune des widgets, `80321312`, avait retiré son dernier consommateur), supprimé avec son test par `806efae6`. `orphan-hooks.guard` vert en CI |
> | Widgets du mode perso | 0 | même composant que l'Aperçu entreprise (`ApercuWidgetGrid`), pas de copie ; gardes `architecture.guard`, cycles, `tsc`, lint vertes à `d16de29a` |
>
> **93 → 93.**

> ### ⚪ 2026-10-20 · 0 : 33 fichiers neufs, aucune garde d'architecture rouge
>
> Mesures du 2026-10-20 : CI de `main` à `86ea357f` (run `39408311331` : `lint-test-build` et `e2e` rouges, trois jobs verts ; **29 runs rouges de suite** depuis `a9db6f2c`), `Visual` rouge, production (advisors par l'API, catalogue, ledger, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](README.md).
>
> | Item | Effet | Mesuré le 2026-10-20 |
> |---|---|---|
> | Aperçu en widgets | 0 | le plus gros fichier neuf fait 530 lignes (`ApercuWidgetGrid.tsx`), helpers séparés et testés (`apercu-*.helpers.ts`) ; `OrgGuideHost.tsx` −180 lignes au profit de `use-guide-demo.tsx` |
> | Gardes | 0 | toutes les étapes de `lint-test-build` vertes sauf le budget de bundle (débité en Performance) |
>
> **93 → 93.**

> ### ⚪ 2026-10-18 · 0 : un dossier neuf, `api/`, à déclarer
>
> Dernière passe avant l'acquisition. Mesures du 2026-10-18 : CI de `main` à `e69cb729` (run `39139204925`, cinq jobs verts) et à `15d40bea` (`lint-test-build` vert, run `39156293593`), production (advisors par l'API, catalogue, cron, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-18 |
> |---|---|---|
> | 🟠 `api/` · premier arbre de code serveur hors `src/` (`57c7fa88`) | 0 | hors des deux `tsconfig`, donc hors de `tsc -b`. Débité **une fois**, dans [`TESTING.md`](../TESTING.md). Un `tsconfig.api.json` référencé par `tsconfig.json` le ferait entrer |
> | Gardes de structure | 0 | `architecture.guard`, `orphan-hooks`, cycles : vertes en CI à `e69cb729` et `15d40bea` |
> | `src/lib/traffic.ts` (218 l.) remplace `src/lib/audience.ts` (200 l.) | 0 | même point de montage (`main.tsx`), mêmes quatre conditions, relues avant **chaque** envoi |
>
> **93 → 93.**

> ### 🟢 2026-10-16 · +3 : les trois gardes de structure de nouveau vertes
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du
> 2026-10-16 : CI de `main` à `a4878cab` (run `38902071817`, cinq jobs verts), dépôt à `HEAD` rejoué
> étape par étape. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-16 |
> |---|---|---|
> | ✅ `organizations/CLAUDE.md` au-delà de son plafond (−1) | **+1** | **11 992 o** pour 14 000 (15 378 le 10-15) : contenu descendu d'un cran, borne intacte (`c791eb55`). `check:docs` vert en CI et en local |
> | ✅ `organizations/supabase.repository.ts` à 602 lignes (−1) | **+1** | **544** lignes ; `architecture.guard` vert, `OVERSIZED_BUDGET` toujours à 0 |
> | ✅ Hook orphelin `useRemoveProjectTeam` (−1) | **+1** | `orphan-hooks.guard` vert en CI et en local |
> | Cycles, `tsc`, lint | 0 | verts à `HEAD` |
>
> **90 → 93.**

> ### 🟠 2026-10-15 · −3 : trois gardes de structure rouges, aucune vue par la CI
>
> **Même règle** : un angle mort ne se rembourse que sur un verdict rendu en CI, un défaut que
> lorsqu'il est corrigé et vérifié. Mesures de la nuit du 14 au 15 : CI de `main` à `6847bbf3`,
> dépôt à `HEAD` rejoué étape par étape dans un worktree propre. Tableau de bord :
> [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-15 |
> |---|---|---|
> | 🔴 Le référentiel au-delà de son plafond (AM-1, remboursé le 09-16 par `check:docs`) | **−1** | `src/modules/organizations/CLAUDE.md` à **15 378 o** pour 14 000 depuis `a6562733` (2026-10-12, rôles personnalisés). `check:docs` rouge en CI depuis, et c'est cette garde, en tête du job, qui a coupé tout le reste (cf. [`TESTING.md`](../TESTING.md)). Le remède est dans son message : faire descendre un contenu d'un cran, jamais relever la borne |
> | 🔴 `organizations/supabase.repository.ts` à **602** lignes | **−1** | même commit (599 avant). `architecture.guard` rouge en local à `HEAD`, jamais en CI. `OVERSIZED_BUDGET` toujours à 0 |
> | 🔴 Hook orphelin `useRemoveProjectTeam` (`team-projects/portfolio.hooks.ts`) | **−1** | son dernier consommateur est parti avec la refonte de la page projet (`35942a7d`, 10-13). `orphan-hooks.guard` (C-49) rouge en local. Deux sorties : le rebrancher, ou le supprimer |
> | Cycles d'imports, `tsc`, lint | 0 | verts à `HEAD` (lint : 0 erreur, 34 avertissements). [`MODULES.md`](../MODULES.md) relu : chat de projet et rôles personnalisés y sont, l'import de tâches (`src/lib/task-import/`) y est ajouté ce jour |
>
> **93 → 90.** Les trois viennent de deux commits des 12 et 13 octobre, poussés pendant que la CI
> ne pouvait plus les voir.

> ### 🟢 2026-10-03 · +1 : `OKRPage.tsx` sous 600 lignes, vu vert en CI
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Verdict : run `CI`
> `37109937640` sur `c7fb936c`, **les cinq jobs verts**, le premier `CI` entièrement vert sur `main`
> depuis le 2026-09-23 (`869fb05a`). Correctifs : `d8b1584b`, `16fbaae9`, `ac1e8c40`, `59aa4fd8`,
> `315804df` (autres sessions) et `d8c215ad`, `290d6f51`, `c7fb936c` (celle-ci).
>
> | Item | Effet | Mesuré le 2026-10-03 |
> |---|---|---|
> | ✅ `OKRPage.tsx` à 617 lignes (−1 le 10-02) | **+1** | **579** lignes à `c7fb936c` : la section OKR pro et l'édition de catégorie sorties dans `ProOKRBlock` et `useInlineCategoryEdit` (`d8b1584b`). `architecture.guard` vert en CI ; `OVERSIZED_BUDGET` toujours à 0 |
>
> **92 → 93.**

> ### 🟠 2026-10-02 (soir) · −1 : `OKRPage.tsx` franchit 600 lignes, et la garde mord en CI
>
> **Même règle que le 2026-09-22** : un angle mort ne se rembourse que sur un verdict rendu en CI, un
> défaut que lorsqu'il est corrigé et vérifié. Mesures du soir : CI de `main` à `9ea33927` (dernier
> `e2e` complet : `f301f0bf`, run `37019682064`), production (advisors par l'API, catalogue, ledger),
> dépôt à `HEAD`.
>
> | Item | Effet | Mesuré le 2026-10-02 (soir) |
> |---|---|---|
> | 🔴 `src/pages/OKRPage.tsx` à **617 lignes** | **−1** | ce que la passe du 10-01 avait vu « en local, sur le travail non commité d'une autre session » est entré dans `main` avec `05ddf746` (les OKR d'entreprise en mode perso). `architecture.guard` **rouge en CI** sur `f301f0bf`, puis sur `9ea33927`. L'objectif du § 3, « aucun fichier > 600 LOC », repasse de 0 à **1** |
> | `tsc -b`, `check:cycles`, `Validate RLS invariants` | 0 | verts en CI à `9ea33927` |
> | AM-4, `MobileShowcases` hors garde | 0 | inchangés, déjà payés |
>
> **93 → 92.** Le point revient à la découpe, vue verte en CI. ❌ Pas de relèvement du seuil.

> ### ⚪ 2026-10-01 · 0 : vérifiée inchangée
>
> **Même règle que le 2026-09-22** : un angle mort ne se rembourse que sur un verdict rendu en CI, un
> défaut que lorsqu'il est corrigé et vérifié. Mesures du jour : CI de `main` (`43fed445` à
> `7cd73d24`), production (catalogue, advisors), dépôt à `HEAD`.
>
> | Item | Effet | Mesuré le 2026-10-01 |
> |---|---|---|
> | `tsc -b`, `check:cycles`, `architecture.guard` | 0 | verts en CI à `7cd73d24` (`architecture.guard` est dans la suite unitaire, verte). Le dépassement de 600 lignes vu en local (`OKRPage.tsx`, 617) est le travail NON commité d'une autre session |
> | AM-4, `MobileShowcases` hors garde | 0 | inchangés, déjà payés |
>
> **93 → 93.** Détail : [tableau de bord](../README.md).

> ### 🟢 2026-09-22 (soir) · +4 : remesure item par item, contre la CI réelle et la production
>
> **Règle appliquée**, déclarée au [tableau de bord](../README.md) : un angle mort payé le 2026-09-16
> n'est remboursé que si sa garde a rendu **au moins un verdict exploitable en CI** (vert, ou
> rouge sur un vrai défaut). Une garde posée mais jamais jouée, ou cassée, ne rembourse rien.
> Un défaut nommé ce soir coûte selon le barème du 09-16.
>
> | Item | Effet | Mesuré le 2026-09-22 |
> |---|---|---|
> | AM-2 · `e2e/` et `showcase/` dans ESLint | **+1** | `eslint.config.js` ne les ignore plus ; `npm run lint` 0 erreur en CI à `HEAD` |
> | AM-3 · cycles d'import | **+1** | `check:cycles` dans `ci.yml`, vert à `HEAD`, avec son témoin `check-import-cycles.guard.test.mjs` |
> | AM-5 · `supabase/functions/` dans ESLint | **+1** | idem AM-2 |
> | `C-77`, un des deux motifs qui retenaient à 90 | **+1** | fermé **par ce que la RPC rend** : sous le rôle `authenticated` d'un compte réel, `get_work_time_stats` rend `okrTime = 480`, et sa définition lit `kr_completions` |
> | AM-4 · lignes comme seul proxy de complexité | **0** | couplage rapporté par `check:cycles`, plafond toujours non arbitré |
> | `MobileShowcases.tsx` (623 lignes) hors garde de taille | **0** | toujours vrai : `EXCLUDED_DIRS` contient `showcase`. Déjà payé |
>
> ✅ **Invariants rejoués ce soir, tous tenus** : `get_my_tasks()` pour les listes (4 `.from('tasks')` =
> `getById` / `insert` / `update` / `delete`), 0 `supabase.from(` hors repository (la seule occurrence
> de `billing.context.tsx` est un commentaire), 0 import `gsap` direct, 3 canaux Realtime, aucun
> `refetchInterval` inconditionnel, **51 tables sur 51** sous RLS en production, `architecture.guard`
> 5/5. ⚠️ Cette garde a été **rouge** en CI à `806e7745` (un fichier > 600 lignes) : elle a mordu, et
> personne ne l'a vu parce que la CI de `main` était déjà rouge pour d'autres raisons depuis le 09-16.
>
> **89 → 93.** Détail, règle et ordre de réparation : [tableau de bord](../README.md).

> ### 🟠 2026-09-16 · -1 : la note comptait ce qui était mesuré, jamais ce qui ne l'était pas
>
> **Ce n'est pas une régression.** Rien n'a cassé depuis la dernière passe. Les angles morts
> listés juste en dessous **existaient tous** pendant que cette note montait : elle était
> surévaluée parce qu'elle ne comptait que ce que les gardes regardent. C'est exactement ce qui
> s'est produit le 2026-09-14, où cinq notes ont baissé sans qu'aucun défaut ne soit récent.
>
> **Barème, déclaré pour être contestable ligne par ligne :**
>
> | Situation | Effet |
> |---|---|
> | angle mort **structurel**, de portée large, qu'aucun outil ne regarde | −2 |
> | angle mort réel mais de portée limitée, ou partiellement couvert | −1 |
> | angle mort **assumé** (arbitrage documenté), ou déjà compté dans une passe antérieure | 0 |
> | angle mort **comblé** le jour même, avec garde **et** témoin | +1 |
>
> **Le calcul pour cette note :**
>
> | Angle mort | Effet | Pourquoi |
> |---|---|---|
> | AM-1 · le référentiel (`CLAUDE.md`, 150 ko) n'était mesuré par rien | **+1** | comblé ce jour par `check:docs`, avec témoin vu rouge sur 5 sabotages |
> | T-8 · rien ne comparait le commit déployé au dépôt | **+1** | comblé ce jour par `check:deploy`, cycle complet observé en production |
> | AM-2 · `e2e/**` et `showcase/**` hors de TOUS les invariants d'import | −1 | `eslint.config.js:15` |
> | AM-3 · aucune garde de dépendances circulaires | −1 | ni `madge`, ni `import/no-cycle` |
> | AM-5 · `supabase/functions/**` n'entre dans aucun invariant | −1 | les 16 invariants du §1 ne citent que `src/` et les migrations |
> | AM-4 · le nombre de lignes est le seul proxy de complexité | 0 | arbitrage coût/valeur à rendre, pas un oubli |
>
> 🔴 **Une note baisse UNE FOIS, quand l'angle mort est nommé ; elle remonte quand il est
> outillé.** Sans cette règle, nommer un angle mort deviendrait punitif, et la passe du
> 2026-09-16 serait la dernière à en chercher. Un angle mort reconduit sans être comblé ne
> re-coûte rien : il est **déjà payé**.
>
> ⚠️ Un transversal (T-1 à T-10 du [tableau de bord](../README.md)) est compté dans **chaque** audit
> qu'il touche, parce que chaque note prétend quelque chose de différent. Les 36 témoins jamais
> rejoués coûtent donc à la fois aux tests et à la sécurité, et ce n'est pas un double comptage.



### 🕳️ Angles morts · ce que cet audit NE mesure PAS (2026-09-16)

> 🔎 **Colonne « État » réécrite le 2026-09-21.** La quatrième colonne posait « Outillable ? »,
> c'est-à-dire une **prédiction** faite le 2026-09-16. La passe du 2026-09-20 au soir (`2b4c4304`)
> y a répondu : elle porte donc maintenant l'**état réel**, la garde qui couvre la ligne, et
> 🔴 **ce que cette garde ne prouve pas** — la moitié qui manque d'habitude.
>
> ❌ **La colonne « Angle mort » n'est PAS touchée.** C'est l'énoncé, daté du 2026-09-16, et
> c'est lui qui, nommé, a permis d'outiller : le réécrire effacerait la seule chose qui explique
> pourquoi la garde existe. Un seul endroit porte l'état, et c'est la colonne de droite.
>
> ⚠️ **Une garde posée n'est pas un angle mort fermé**, et `M-56` (« ce que chaque angle mort
> coûte en points ») ne change rien ici : **aucune note ne bouge** sur cette base.



> **Pourquoi cette section existe.** Cette note est justifiée par des points **nommés** (« ce qui
> retient à N », suivi d'une liste). Une note construite ainsi ne peut baisser que sur un défaut
> que quelqu'un a d'abord nommé : **un angle mort ne pèse rien tant qu'il reste anonyme**, et ce
> n'est pas un oubli d'auditeur, c'est une propriété de la méthode de notation.
>
> Le prototype du problème est daté : `CLAUDE.md` a pesé 150 ko et ~43 000 tokens sans qu'aucune
> note ne bouge, alors qu'il est cité **13 fois** dans [`ARCHITECTURE.md`](../ARCHITECTURE.md), dont **9**
> dans la seule colonne « Où il est écrit » du tableau des invariants, et **jamais** dans ce
> qui est mesuré. Il était le mètre,
> jamais l'objet.
>
> Ces lignes entrent donc **dans ce qui est mesuré**. La prochaine passe les traite comme les
> invariants ci-dessus : chacune est soit comblée, soit reconduite avec sa date.

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | ✅ **Le référentiel lui-même n'était mesuré par rien.** `CLAUDE.md` est la source citée par 8 des 16 invariants ci-dessous, et rien ne le jugeait | 2 070 lignes / 150 044 o / ~43 000 tokens chargés à chaque session, contre 17,8 ko le 2026-07-01. **78 commits en 30 jours**, jamais un raccourcissement | ✅ **COMBLÉ le 2026-09-16** · `npm run check:docs` (gate CI) — le référentiel est enfin mesuré au lieu d'être seulement cité |
| AM-2 | **`e2e/**` et `src/components/showcase/**` sont hors de TOUS les invariants d'import.** Aucune des règles vérifiées dans le tableau ci-dessous ne s'y applique | `eslint.config.js:15` les liste dans `ignores`, avec `.agents/**`, `.claude/**`, `.worktrees/**` | ✅ **OUTILLÉ le 2026-09-20** · `e2e/`, `showcase/` et `supabase/functions/` **entrent** dans ESLint (`C-102`) — 🔴 ne prouve PAS : rien : la dette a été mesurée **avant** de les faire entrer — 1 erreur (faux positif React sur une fixture Playwright), 1 avertissement |
| AM-3 | **Aucune garde de dépendances circulaires.** Un cycle d'imports entre modules ne casse ni le build ni un test | aucun `madge`, `dpdm` ou règle `import/no-cycle` dans le dépôt | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:cycles`, sans dépendance externe (`C-103`) — 🔴 ne prouve PAS : rien sur les cycles. 1ʳᵉ exécution : **sept**, tous par `workTimeCalculator` important quatre barils **en valeur** là où seuls les types servaient — `import type` : 7 → 0 |
| AM-4 | **Le nombre de lignes est le SEUL proxy de complexité.** Un fichier de 400 lignes à 20 imports croisés passe la garde de taille sans réserve | §3 ne mesure que `wc -l` | ✅ **OUTILLÉ le 2026-09-20** · couplage **rapporté** par `npm run check:cycles`, non bloquant (`C-103`) — 🔴 ne prouve PAS : 🔴 le plafond de couplage reste un **arbitrage non rendu** : le chiffre est imprimé pour être lu deux fois d'abord |
| AM-5 | **`supabase/functions/**` n'entre dans aucun invariant de ce document.** Les règles d'import, de taille et de couplage s'arrêtent à `src/` | les 16 invariants du §1 ne citent que `src/` et les migrations | ✅ **OUTILLÉ le 2026-09-20** · périmètre ESLint élargi (`C-102`) — 🔴 ne prouve PAS : idem AM-2 |


> ### 🟢 2026-09-15 · +2 : le premier des trois points qui retenaient à 88 est refermé, et par une garde
>
> L'entrée d'hier nommait trois choses. La première, mot pour mot : « **aucune garde ne relie les
> migrations du dépôt à la base** ». Elle existe depuis aujourd'hui.
>
> `npm run check:migration-coverage` (item **C-79**, commit `52d23937`) interroge le CATALOGUE sur
> l'objet que chaque migration prétend créer, exactement ce que le paragraphe d'hier prescrivait, et
> refuse de conclure d'un comptage. Chaque fichier reçoit un verdict, et **un seul fait échouer** :
>
> | Verdict | Fichiers |
> |---|---|
> | AU LEDGER | 118 |
> | OBJET EN BASE (migration précoce, hors ledger) | 27 |
> | OBJET RETIRÉ DEPUIS (les `013` / `015` / `016`, vidées par la `141`) | 3 |
> | SUPPRESSION VÉRIFIÉE (la `090`, purement suppressive) | 1 |
> | SANS OBJET VÉRIFIABLE, déclaré | 2 |
> | NON APPLIQUÉE, déclarée | 1 |
> | **ABSENT DES DEUX** | **0** |
>
> Premier run CI **`34941970659`**, job `couverture` vert, sur **152 fichiers et les 138 entrées de
> ledger lues en production**. Elle tourne aussi quotidiennement à 05:17 UTC et à chaque push
> touchant `supabase/migration/`, branchée sur `ci-alert.yml`.
>
> ✅ **Deux verdicts sont MESURÉS et non déclarés, et sans eux la garde réclamait quatre migrations
> bel et bien appliquées.** C'est la différence entre une garde et une liste de dispenses : les
> `013` / `015` / `016` ont été VIDÉES par la `141` (suppression du système de jetons), et la `090`
> ne fait que supprimer, donc son effet se prouve par l'absence de ses cibles. Une garde qui aurait
> traité ces quatre cas par une allowlist aurait été verte sans rien établir.
>
> ✅ **Les témoins ont été vus rouges sur quatre sabotages** avant d'être commités, dont une
> dispense périmée tolérée. C'est la règle du dépôt appliquée à la lettre.
>
> 🔴 **Et la garde trouve immédiatement quelque chose que personne ne lui avait demandé** : elle
> liste **9 fichiers PARTIELS**, dont la `136`, à laquelle manque l'index
> `idx_kr_completions_user_completed_at`. C'est exactement `C-77`, vu depuis un autre angle. Une
> garde utile est une garde qui rend un verdict qu'on n'avait pas anticipé.
>
> ⚠️ **Elle reste modeste et le dit à chaque exécution** : une ligne au ledger ne prouve toujours
> pas qu'un `CREATE OR REPLACE` a remplacé le corps vivant, et « objet en base » ne prouve pas que
> tout le fichier est passé. C'est la leçon de la `144`, rejouée par la `147`, et la garde ne
> prétend pas la couvrir.
>
> 🔴 **Ce qui retient encore à 90, et ce sont les deux autres points d'hier, inchangés :**
>
> 1. **Le même calcul vit toujours en trois endroits, et le correctif du 09-02 n'en a touché que
>    deux.** Vérifié en base ce jour par `pg_get_functiondef` : `get_work_time_stats` lit
>    **toujours** `kr.elem->'history'` et **jamais** `kr_completions`. La migration qui répare est
>    commitée depuis le 2026-09-03 et **n'est toujours pas appliquée** : le ledger porte 138
>    entrées, la dernière est la `148`. `C-77` est ouvert.
> 2. **Un fichier source de 613 lignes vit hors de tout périmètre** :
>    `src/components/showcase/MobileShowcases.tsx`, exclu d'ESLint et de la garde de taille.


> ### 🟢 2026-09-14 (soir) · +4 : le motif qui plafonnait cette note est mort le 2026-09-05, et personne n'était revenu le constater
>
> **Ce que la note du 09-03 donnait comme plafond, mot pour mot** : « ce qui plafonne à 84, et n'a
> pas bougé d'un pouce : aucun god component n'a disparu. Le plus gros fichier du dépôt est le même
> qu'au 08-29, et les extractions sont des compensations, pas un assainissement. »
>
> **Mesuré ce soir, sur l'arbre de travail, fichier par fichier** (`wc -l` sur tout `src`, hors
> tests) :
>
> | | 09-03 | **09-14 (soir)** |
> |---|---|---|
> | Fichiers hors budget (`KNOWN_OVERSIZED`) | 12 | **0**, la liste est vide |
> | Stock de lignes hors budget (`OVERSIZED_BUDGET`) | 9 190 | **0**, structurellement |
> | Plus gros fichier du périmètre gardé | `PyramidTab` **1 046** | `PersoTrack.tsx` **598** |
>
> C'est **C-09**, livré le 2026-09-05 en dix commits (`a6dfd85a` → `7653d398`), qui a fait tomber
> les douze derniers : `PyramidTab` 1 045 → 573, `AgendaPage` 867 → 584, `InboxMenu` 805 → 565,
> `SettingsPage` 756 → 508, et huit autres. **Neuf jours plus tard, aucune note ne l'avait vu** :
> l'entrée du 09-14 (matin) de ce fichier écrivait « la métrique ne bouge pas, vérifié pas supposé »
> à propos de la suppression d'un fichier de 452 lignes, sans regarder que la métrique VOISINE,
> celle qui portait explicitement le plafond, était passée de 9 190 à 0.
>
> ⚠️ **La leçon porte sur la forme de la vérification, pas sur le chiffre.** Rejouer la garde
> (`OVERSIZED_BUDGET` toujours à 0, test vert) était juste et ne pouvait rien apprendre : un
> cliquet à zéro rend le même vert qu'il reste zéro fichier ou douze qu'on vient de retirer de la
> liste. **Une garde dit si l'invariant tient ; elle ne dit jamais ce qu'il a coûté de le tenir.**
> Le delta ne se lit que dans la valeur précédente, ici `KNOWN_OVERSIZED` et son commentaire daté.
>
> 🔴 **Ce qui retient à 88, et chaque point est mesuré :**
>
> 1. **Aucune garde ne relie les migrations du dépôt à la base.** Comparé nom à nom ce soir : les
>    152 fichiers du dépôt contre les **138** entrées du ledger prod, **32 fichiers sans aucune
>    correspondance** et **17 entrées sans fichier**. Les 32 sont bien appliquées (vérifié objet par
>    objet sur un échantillon : `events.exceptions`, `team_task_comments`, `tasks.recurrence*`,
>    `events.is_private`), mais ce n'est pas le ledger qui le prouve, et cinq énoncés « tout le
>    dépôt est appliqué, ledger relu » reposaient sur ce recouvrement partiel. `check:drift` compare
>    le schéma, jamais le recouvrement, et demande deux étapes manuelles.
> 2. **Le même calcul vit toujours en trois endroits, et le correctif du 09-02 n'en a touché que
>    deux.** `okrTime` (temps passé sur les OKR) est dérivé par `src/lib/workTimeCalculator.ts`
>    (corrigé), par les deux graphiques du tableau de bord (justes depuis toujours) et par la RPC
>    `get_work_time_stats` (mig. 127). **Cette dernière sert la production, et elle lit encore le
>    champ mort.** Vérifié en base ce soir par `pg_get_functiondef` : sa CTE `okr_days` fait toujours
>    `jsonb_array_elements(COALESCE(kr.elem->'history', '[]'))`. Détail et conséquence produit dans
>    [`PERFORMANCE.md`](../PERFORMANCE.md) § « okrTime ».
> 3. **Un fichier source de 613 lignes vit hors de tout périmètre** :
>    `src/components/showcase/MobileShowcases.tsx`, exclu à la fois d'ESLint (`eslint.config.js`) et
>    de la garde de taille (`EXCLUDED_DIRS` contient `showcase`). C'est un arbitrage défendable, une
>    vitrine n'est pas du produit ; ce qui ne l'est pas, c'est que l'énoncé « aucun fichier source
>    au-dessus de 600 lignes » soit écrit sans dire de quel périmètre il parle.
>
> ✅ **Ce qui a été vérifié inchangé, et l'est vraiment** : `npm run typecheck` 0 erreur,
> `npm run lint` 0 erreur (31 warnings Fast-refresh tolérés, contre 35 avant la suppression de
> `CategoryManager`), `npm test` 228 fichiers / 2 586 passés, `npm run validate:migrations`
> 152 fichiers / 0 erreur / 6 avertissements (les mêmes six depuis le 08-24).


> ### ⚪ 2026-09-14 · 0 : `CategoryManager` (452 lignes) supprimée, la garde reste à zéro sans bouger
>
> `src/architecture.guard.test.ts` rejouée : `OVERSIZED_BUDGET` reste à **0**, aucun fichier
> au-dessus de 600 lignes, le stock hors budget ne remonte pas. Le fichier supprimé faisait 452
> lignes — déjà sous le seuil — donc sa disparition ne déplace pas la métrique que ce cliquet garde.
> ⚠️ **La note reste inchangée parce qu'elle a été VÉRIFIÉE inchangée, pas parce qu'elle n'a pas été
> regardée** : c'est la distinction que ce document exige de tout autre domaine.

> ### 2026-09-03 · +1, le cliquet a mordu quatre fois et a été resserré quatre fois
>
> | | 08-29 | **09-03** (valeurs lues dans `src/architecture.guard.test.ts` à `HEAD`) |
> |---|---|---|
> | Fichiers hors budget | 13 | **12** |
> | Budget du cliquet | 9 949 | **9 190** |
> | Plus gros fichier | `PyramidTab` 1 046 · `TaskTable` 890 | `PyramidTab` **1 046** · `TaskTable` **890** |
>
> Quatre resserrages, tous **imposés** par la garde alors que le travail portait ailleurs :
> `OverdueBanner` extrait de `TaskTable` (9 949 → 9 905), `useOverdueSlotReview` extrait
> d'`AgendaPage` (9 905 → 9 903), la revue de `src/components` (9 903 → 9 791), puis la sortie de
> `friends/supabase.repository.ts` de la liste des fichiers hors budget (9 791 → 9 190).
>
> **Le point vient de la manière, pas du nombre.** `friends/supabase.repository.ts` est passé sous
> 600 lignes **sans découpe** : l'externalisation i18n a remplacé des littéraux par des appels plus
> courts. Le budget a donc été baissé de ses 592 lignes en même temps que le fichier sortait de la
> liste. Sans ce geste, ces 592 lignes seraient devenues du **mou distribué aux douze autres**, et
> le cliquet aurait reculé sans que personne ne le voie.
>
> 🔴 **Ce qui plafonne à 84, et n'a pas bougé d'un pouce** : aucun god component n'a disparu. Le
> plus gros fichier du dépôt est le même qu'au 08-29, et les extractions sont des compensations,
> pas un assainissement. Le critère de la tâche T-45 a d'ailleurs été trouvé **faux** le 09-02 : il
> promettait « plus aucun fichier au-dessus de 900 lignes » alors que `PyramidTab.tsx` en fait
> 1 045 et `AgendaPage.tsx` 919 ; la tâche ne portait que `TaskTable.tsx`.
>
> ⚠️ Les autres critères du tableau §1 (invariants tenus, primitives sans consommateur, invariants
> outillés) **n'ont pas été remesurés** ce jour-là.

> ### 2026-08-29 · +2, la première coupe volontaire du socle
>
> | | 08-27 | **08-29** |
> |---|---|---|
> | Fichiers hors budget | 14 | **13** |
> | Budget du cliquet | 10 811 | **9 949** |
> | Plus gros fichier | `TaskTable` 1 124 | `PyramidTab` 1 046 · `TaskTable` **890** |
>
> Les quatre passes précédentes du cliquet avaient toutes été **imposées** par la garde, et toutes
> portaient sur `/entreprise`, parce que c'est là qu'avait lieu le travail. Celle-ci est la
> première coupe volontaire, et elle porte sur le socle.
>
> La frontière est réelle, pas un compte de lignes : `TaskQuickFilters` et `TaskBulkActionsBar` ne
> connaissent **aucune tâche**. Un vrai défaut part avec : l'état du menu « ⋯ » vivait dans
> `TaskTable`, ce qui obligeait **cinq** gestionnaires métier à le refermer à la main.

| Ce qui compose la note | 08-24 | 08-25 | **08-27** |
|---|---|---|---|
| Invariants tenus | 10 / 13 | **12 / 14** | **12 / 14**, inchangé |
| Fichiers > 600 LOC | 16 · 12 503 lignes | 15 · 11 452 lignes (−1 051) | **14 · budget de garde 10 811** (−643) |
| Plus gros fichier | `PyramidTab` 1 506 | **`TaskTable` 1 124** (PyramidTab tombé à 1 045) | `TaskTable` **1 124**, inchangé |
| Primitives livrées sans consommateur | 3 | **2** (`MobileHeader` passe de 2 à **8** consommateurs) | 2, non remesuré |
| Invariants **outillés** (une garde, pas un Markdown) | 6 | 6 | 6 |
| Suite unitaire | 1 583 / 143, verte | 1 736 / 151, verte | **1 802 / 159, verte** |

### 2026-08-27 · +2, et un seul critère les porte

**Deux critères bougent, les quatre autres sont explicitement inchangés** (colonne ci-dessus) :
le budget de taille, quatrième passe du cliquet, et la suite unitaire, +66 tests. Rien d'autre
n'a été remesuré ce jour-là, et rien d'autre ne prend de point.

**Ce qui vaut plus que les deux points : le cliquet a attrapé une régression que son auteur
niait.** Le correctif d'états de chargement (`1d98f93`) ajoutait 9 lignes à `TeamTasksTab.tsx`,
déjà hors budget : le total est passé à 11 463 pour un plafond à 11 454, et la garde
`architecture.guard` est passée au rouge. Elle a été déclarée **deux fois** « antérieure à ce
travail », sur la foi d'un `git stash` pris à un moment où le commit fautif était déjà en place.
La vérification correcte, restaurer `src/` à `4b91816` et relancer, montre la garde **verte**
avant. Le commit `180fba1` porte cette correction en tête de son propre message.

> ⚠️ **La leçon est méthodologique, et elle est la même que celle du 2026-08-25 sur les
> `refetchInterval`** : un « avant » ne se lit pas dans un stash, il se reconstruit à un commit
> nommé. Une garde rouge est coupable jusqu'à preuve du contraire, et la preuve est une mesure au
> commit précédent, pas un souvenir de l'état de l'arbre de travail.

**+5.** Le cliquet de taille a joué deux fois en deux jours et le budget a baissé de 1 051 lignes
sans qu'aucune fonctionnalité ne soit reportée : c'est la démonstration que la garde rend le
refactor moins cher que le contournement. Et pour la première fois, une primitive livrée puis
abandonnée (§4) a été **adoptée** au lieu d'être supprimée.

**Ce qui empêche de monter plus haut est un incident de méthode, pas un défaut de code.**
`CLAUDE.md` a affirmé le matin du 2026-08-25 qu'il ne restait « aucun `refetchInterval`
permanent », il en restait **trois**, dont un monté à l'échelle de l'application. Ils ont été
trouvés par recomptage nominatif et corrigés dans la journée. L'invariant tient donc, mais il a
été **déclaré acquis avant de l'être**, sur la règle la plus récemment écrite du dossier. C'est le
motif de fond de cet audit, appliqué à lui-même : *une règle qu'aucun script ne mesure ne devient
jamais un acquis, quelle que soit la conviction de celui qui l'écrit.*

Les deux dettes que rien ne mesure encore restent donc les mêmes : les fichiers > 600 LOC (§3,
mais le cliquet les fait baisser) et la taille du chunk `index`
([`PERFORMANCE.md`](../PERFORMANCE.md), le seul budget sans garde, et le seul qui ait reculé).

---
