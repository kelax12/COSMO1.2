<!-- note-audit: note=90 -->
<!--
  🔴 C-109 · CE MARQUEUR EST LU PAR `npm run check:docs-scored`.
  Douze documents de fond n'étaient notés par RIEN : ils ne pouvaient ni monter
  ni baisser, donc **rien ne signalait qu'ils avaient vieilli**.
  Chaque document de `docs/` déclare donc soit sa note, soit la note qui le
  couvre, soit qu'il n'est pas noté ET pourquoi.
  ❌ Ne JAMAIS inventer une note sans avoir audité le domaine : `non-note` est
     une réponse honnête, un chiffre faux ne l'est pas.
-->
> **Note d'audit** — Note **90 / 100** au 2026-09-15, au tableau de bord de [`README.md`](./README.md).

# Architecture — invariants, dette et vérification

**Audit du 2026-08-14, invariants remesurés le 2026-08-24 puis le 2026-08-25** (colonne
« 2026-08-25 » du tableau §1), **budget de taille et suite unitaire remesurés le 2026-08-27**
(§3, 4ᵉ passe du cliquet). Le reste du tableau §1 n'a **pas** été revérifié le 27, sa colonne le
dit ligne par ligne. Mesuré contre le code de `main` et la prod. Remplace
[`archive/AUDIT-ARCHITECTURE-2026-08-07.md`](./archive/AUDIT-ARCHITECTURE-2026-08-07.md)
(20 correctifs, note 60→79), 77 commits plus tôt.

Ce document ne redécrit pas l'architecture — c'est le rôle de [`../CLAUDE.md`](../CLAUDE.md). Il
répond à une seule question : **les invariants qu'on s'est donnés tiennent-ils encore ?**

## Note d'architecture : 74 → 79 → 81 → 83 → 84 → 88 → 90 → **89 / 100** (2026-08-24 → 2026-08-25 → 2026-08-27 → 2026-08-29 → 2026-09-03 → 2026-09-14 soir → 2026-09-15 → 2026-09-16)

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
> ⚠️ Un transversal (T-1 à T-10 du [tableau de bord](./README.md)) est compté dans **chaque** audit
> qu'il touche, parce que chaque note prétend quelque chose de différent. Les 36 témoins jamais
> rejoués coûtent donc à la fois aux tests et à la sécurité, et ce n'est pas un double comptage.



### 🕳️ Angles morts · ce que cet audit NE mesure PAS (2026-09-16)

> **Pourquoi cette section existe.** Cette note est justifiée par des points **nommés** (« ce qui
> retient à N », suivi d'une liste). Une note construite ainsi ne peut baisser que sur un défaut
> que quelqu'un a d'abord nommé : **un angle mort ne pèse rien tant qu'il reste anonyme**, et ce
> n'est pas un oubli d'auditeur, c'est une propriété de la méthode de notation.
>
> Le prototype du problème est daté : `CLAUDE.md` a pesé 150 ko et ~43 000 tokens sans qu'aucune
> note ne bouge, alors qu'il est cité **13 fois** dans [`ARCHITECTURE.md`](./ARCHITECTURE.md), dont **9**
> dans la seule colonne « Où il est écrit » du tableau des invariants, et **jamais** dans ce
> qui est mesuré. Il était le mètre,
> jamais l'objet.
>
> Ces lignes entrent donc **dans ce qui est mesuré**. La prochaine passe les traite comme les
> invariants ci-dessus : chacune est soit comblée, soit reconduite avec sa date.

| # | Angle mort | Vérifié le 2026-09-16 | Outillable ? |
|---|---|---|---|
| AM-1 | ✅ **Le référentiel lui-même n'était mesuré par rien.** `CLAUDE.md` est la source citée par 8 des 16 invariants ci-dessous, et rien ne le jugeait | 2 070 lignes / 150 044 o / ~43 000 tokens chargés à chaque session, contre 17,8 ko le 2026-07-01. **78 commits en 30 jours**, jamais un raccourcissement | **Comblé le 2026-09-16** par `npm run check:docs` (gate CI) |
| AM-2 | **`e2e/**` et `src/components/showcase/**` sont hors de TOUS les invariants d'import.** Aucune des règles vérifiées dans le tableau ci-dessous ne s'y applique | `eslint.config.js:15` les liste dans `ignores`, avec `.agents/**`, `.claude/**`, `.worktrees/**` | oui : une passe ESLint dédiée, ou les retirer de `ignores` |
| AM-3 | **Aucune garde de dépendances circulaires.** Un cycle d'imports entre modules ne casse ni le build ni un test | aucun `madge`, `dpdm` ou règle `import/no-cycle` dans le dépôt | oui : `import/no-cycle` ou `madge --circular` |
| AM-4 | **Le nombre de lignes est le SEUL proxy de complexité.** Un fichier de 400 lignes à 20 imports croisés passe la garde de taille sans réserve | §3 ne mesure que `wc -l` | oui, mais l'arbitrage coût/valeur est à faire |
| AM-5 | **`supabase/functions/**` n'entre dans aucun invariant de ce document.** Les règles d'import, de taille et de couplage s'arrêtent à `src/` | les 16 invariants du §1 ne citent que `src/` et les migrations | oui |


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
>    [`PERFORMANCE.md`](./PERFORMANCE.md) § « okrTime ».
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
([`PERFORMANCE.md`](./PERFORMANCE.md), le seul budget sans garde, et le seul qui ait reculé).

---

## 1. Les invariants, vérifiés un par un

| Invariant | Où il est écrit | État au 2026-08-25 |
|---|---|---|
| Les lectures de liste de `tasks` passent par `get_my_tasks()` | CLAUDE.md ⚡ | ✅ **Tenu.** Les 4 `.from('tasks')` de `supabase.repository.ts` restent `getById` (exception légitime), `insert`, `update`, `delete` |
| Aucun import GSAP hors de la landing | CLAUDE.md | ✅ **Tenu.** 0 import direct de `'gsap'` |
| `useAuth` vient de `@/modules/auth/AuthContext` | CLAUDE.md | ✅ **Tenu.** 0 import depuis `@/modules/user` |
| Une seule policy PERMISSIVE par rôle + action | mig. 049 + `check:rls` | ✅ **Tenu.** **128** policies sur **81** migrations, 0 violation |
| La récurrence est générée côté serveur | mig. 086 | ✅ Tenu |
| Les canaux Realtime sont montés dans `App.tsx`, une seule fois | CLAUDE.md 📡 | ✅ **Tenu.** 3 `.channel()` dans `src/`, les trois montés au niveau App (`shared_tasks`, `org-inbox` mig. 118, `friends-inbox` mig. 120) |
| Toutes les tables `public` ont RLS activée | `SECURITY.md` | ✅ **Tenu**, vérifié en prod : 0 table avec `relrowsecurity = false` |
| **Jamais de `supabase.from()` hors d'un repository** | `SCALABILITY.md` §5 + garde | ✅ **Tenu** · invariant **outillé** (§2) |
| Imports toujours via l'alias `@/` | CLAUDE.md + ESLint | ✅ **Tenu** · outillé par `no-restricted-imports` (§2) |
| Aucun fichier source > 600 LOC | refactor de juin 2026 + cliquet | ❌ **Violé au 2026-08-27 · 14 fichiers**, budget 13 103 → 12 503 → 11 452 → **10 811**. → ✅ **TENU depuis le 2026-09-06** (`C-09`) : plus aucun fichier hors budget dans le périmètre audité, cliquet à **0** (§3) |
| **Les lectures de liste entreprise passent par une RPC indexable** | CLAUDE.md ⚡ + test | ✅ **Tenu** · `get_my_team_projects` / `get_my_team_tasks` (mig. 113), `get_my_team_task_dependencies` (mig. 117). Verrouillé par `team-projects/supabase.repository.test.ts` |
| **Un droit entreprise se lit dans `permissions.ts`, jamais recalculé** | CLAUDE.md 🔐 + garde | ✅ **Tenu depuis le 2026-08-25** : une seule source de vérité cliente (`useMyOrgPermissions`), miroir du SQL, 205 tests |
| **Aucune position d'arrivée portée par une animation de transform** | CLAUDE.md + garde | 🟠 **17 feuilles encore écrites à la main**, mais les 5 réellement cassées sont corrigées et un cliquet interdit toute nouvelle (cf. [`MOBILE.md`](./MOBILE.md) §1) |
| **Aucun `refetchInterval` permanent** | CLAUDE.md 📡 | ✅ **Tenu au 2026-08-25, mais au deuxième essai.** Annoncé acquis le matin alors que 3 subsistaient ; corrigés l'après-midi. Décompte nominatif dans [`SCALABILITY.md`](./SCALABILITY.md) §3 |
| Suite unitaire verte | `TESTING.md` | ✅ **1 802 / 1 802 au 2026-08-27** (1 736 au 08-25) |

Les invariants qui portent la **sécurité** tiennent tous. Celui qui porte le **coût de
lecture** aussi. Celui qui porte le **coût de sondage**, non (§7).

Au 2026-08-24, deux des quatre violations sont refermées — et c'est le **même** geste qui les a
refermées : leur donner un outil. La convention d'import est passée de 1 à 6 entorses en dix jours
tant qu'elle ne vivait que dans un Markdown ; elle est réglée en une règle ESLint. Restent
`supabase.from()` hors repository (§2, une seule page) et les fichiers > 600 LOC (§3) — les deux
seules dettes de ce tableau que **rien ne mesure encore**, et donc les deux seules qui continueront
de grandir. C'est le motif de fond de cet audit : *une règle qu'aucun script ne mesure recule à
chaque vague de features.*

### 1.1 Une divergence **GELÉE**, et c'est une décision (C-03, 2026-09-12)

Le dépôt porte deux découpages de la journée, et ils ne coïncident pas toujours. Ce n'est pas une
dette qui attend son tour : c'est un arbitrage rendu, qui doit se lire ici comme les invariants
ci-dessus se lisent — sinon il se représentera au prochain audit sous forme de « bug à corriger ».

| Ce qui découpe la journée | Source | Suit la préférence de fuseau ? |
|---|---|---|
| échéances de tâches, reports, listes « Aujourd'hui » | `src/lib/timezone.ts` → `dayKeyInTz` / `todayKeyInTz` | ✅ oui, depuis la revue R-01 |
| clés de `habits.completions`, séries, grilles d'habitudes | `toLocaleDateString('en-CA')` (fuseau de la **machine**) | ❌ **non, et c'est gelé** |

**Pourquoi le gel plutôt que la migration.** Convertir une clé de jour d'un fuseau vers un autre
demande de savoir dans quel fuseau était la personne **ce jour-là**. La base ne le sait pas : elle
ne stocke qu'une préférence *courante*, posée aujourd'hui, qui ne dit rien de l'historique derrière.
Migrer appliquerait donc le décalage d'aujourd'hui à des journées vécues ailleurs, et le prix se
paierait en **séries** : une seule journée décalée fait perdre la série entière, `streak_best`
compris. On casserait une donnée que les gens ont construite pour corriger une incohérence qu'ils
ne voient pas.

**Ce que la personne voit quand les deux divergent.** Uniquement en réglage `manual`, et uniquement
si le décalage choisi la fait changer de jour par rapport à sa machine — donc **jamais en
métropole**, où les deux coïncident. Dans ce cas : sur le même écran, une tâche peut être « due
aujourd'hui » pendant qu'une habitude cochée compte pour la veille, et la case du jour de la grille
d'habitudes ne correspond pas à la colonne « Aujourd'hui » de la liste de tâches. La série, elle,
reste **cohérente avec elle-même** — calculée de bout en bout en date machine, elle ne saute pas,
elle est seulement calée sur un autre jour.

- ❌ **Ne jamais corriger une seule des deux moitiés.** Basculer l'AFFICHAGE sur `dayKeyInTz` en
  laissant l'ÉCRITURE en date machine ferait apparaître les jours cochés décalés d'une case : un
  historique faux présenté comme juste, strictement pire que la divergence actuelle, qui est au
  moins interne à chaque module.
- ✅ **Ce qui rouvrirait la question** : une colonne qui enregistrerait le décalage AU MOMENT de la
  complétion. À partir de là, et seulement à partir de là, une migration saurait ce qu'elle
  convertit. Rien dans le produit ne l'écrit aujourd'hui.

La même décision est écrite dans `CLAUDE.md` § « Fuseau horaire », à côté de la règle qui interdit
`toLocaleDateString('en-CA')` seul dans un chemin d'échéance — les deux doivent se lire ensemble,
sinon la seconde donne l'impression que la première est un oubli.

## 2. ✅ Les deux entorses de `SettingsPage` — réglées, et outillées

**État au 2026-08-24 : les deux invariants sont tenus, et chacun a désormais un outil.**
C'est la seule partie qui compte : les deux avaient déjà été « corrigés » par le passé, et les
deux étaient revenus.

### 2.1 Imports relatifs

Le comptage du 2026-08-14 (« 1 entorse ») était faux **par sous-mesure** : il ne cherchait que
`../modules`. En élargissant à `../lib`, `../components`, `../pages`, `../i18n`, on trouvait
**74 imports relatifs dans 29 fichiers**.

Tous réécrits en `@/…` (résolution mécanique du chemin, `tsc -b` vert), puis la convention rendue
**exécutable** par une règle ESLint `no-restricted-imports` — périmètre volontairement étroit :
seuls les chemins qui *remontent* pour atteindre `src/` sont interdits ; les imports relatifs
internes à un module (`./constants`, `./types`) restent légitimes, ce sont eux qui rendent un
module déplaçable.

### 2.2 `supabase.from()` hors repository

Même histoire, en pire. Ce document affirmait « `SettingsPage.tsx` concentre les deux
violations ». **C'était faux** : il y en avait quatre, dans quatre modules différents. Les trois
autres avaient échappé au `grep` initial parce qu'il ne balayait que `src/pages` et
`src/components` — or les trois vivaient dans `src/modules`.

| Fichier | Ce qu'il faisait | Où c'est parti |
|---|---|---|
| `src/pages/SettingsPage.tsx` | 2 × `UPDATE profiles` (avatar) | `src/modules/user/profile.repository.ts` |
| `src/modules/billing/billing.context.tsx` | `SELECT` + `INSERT subscriptions` | `billing.repository.ts` → `fetchOwnSubscriptionRow()` |
| `src/modules/friends/share-link.hooks.ts` | get-or-create sur `share_links` | `share-link.repository.ts` |
| `src/modules/organizations/notifications.ts` | 3 requêtes sur `org_notifications` | `notifications.repository.ts` |

Deux choix méritent d'être relus avant d'être « simplifiés » :

- `fetchOwnSubscriptionRow()` **duplique** `getSubscription()` au lieu de l'appeler. Ce n'est pas
  un oubli : elle utilise `getSession()` (lecture locale) au lieu de `getCurrentUser()` (qui
  revalide le JWT auprès de Supabase, donc un RTT par appel), et renvoie `null` au lieu de lever.
  Ce provider est monté pour toute l'application — le coût y est payé sur chaque écran.
- Le branchement démo des notifications reste dans les hooks. Il ne lit pas une table mais
  `localStorage` ; le sortir imposerait une paire local/supabase complète pour trois fonctions,
  sans rien protéger de plus. Ce que l'invariant vise, c'est l'accès direct à une **table** depuis
  du code d'interface.

**Garde** : `src/architecture.guard.test.ts` échoue si un fichier hors `*.repository.ts` contient
`supabase.from(`. Les commentaires sont retirés avant la recherche — sans ça, la phrase qui
explique la règle déclenchait la règle.

## 3. ✅ L'objectif « aucun fichier > 600 LOC » · 17 → **0** fichier, 13 103 → **0** ligne

> ✅ **ATTEINT le 2026-09-06** (`7653d398`, item `C-09`), et **remesuré le 2026-09-20** :
> `KNOWN_OVERSIZED` est un `Set` **vide** et `OVERSIZED_BUDGET` vaut **0** dans
> `src/architecture.guard.test.ts`. Plus aucun fichier du périmètre audité ne dépasse 600 lignes,
> et le budget n'est plus « en baisse », il est **structurellement nul** : il n'y a plus de stock
> à autoriser. La constante reste à zéro pour que la garde échoue si quelqu'un rouvre la liste.
>
> 🔴 **Ce titre a annoncé « 🟠 14 fichiers, 10 811 lignes » pendant quatorze jours après la
> fermeture.** Le tableau des invariants du §1 porte la même phrase (« ❌ Toujours violé · 14
> fichiers au 2026-08-27 »), et le bilan du 2026-08-27 range encore cette dette parmi « les deux
> que rien ne mesure encore » — alors qu'elle est **outillée depuis le 2026-08-24** et **fermée
> depuis le 09-06**. Les deux passages sont datés, donc conservés tels quels ; c'est ce titre-ci,
> qui n'est daté de rien, qui les faisait lire comme l'état courant.
>
> ⚠️ **Un seul fichier du dépôt dépasse encore 600 lignes** : `components/showcase/MobileShowcases.tsx`,
> **623** au 2026-09-20 (« 613 » ailleurs dans ce document date du 08-25). Il est **hors périmètre
> de la garde** (`EXCLUDED_DIRS` y met `showcase`, comme ESLint), ce qui n'est pas un oubli mais
> **l'angle mort AM-2 de ce document**, nommé plus haut. ❌ Ne jamais lire « 0 fichier hors budget »
> comme « 0 fichier long » : la première phrase parle d'un périmètre, la seconde du dépôt.

### Historique de la fermeture · *conservé à sa date*

**Ce qui suit décrit la descente, pas l'état courant** (17 → 14 fichiers, 13 103 → 10 811 lignes).

> **Remesuré le 2026-08-25 : 15 fichiers, 11 452 lignes.** Le budget a baissé de **1 651 lignes
> en deux jours**, alors que ces deux jours ont livré sept migrations et un système de permissions
> complet. C'est le résultat le plus net de tout cet audit : **le cliquet ne coûte pas de la
> vitesse, il en achète.**
>
> Classement au 2026-08-25 : `TaskTable` 1 124 · `PyramidTab` 1 045 · `AgendaPage` 900 ·
> `SettingsPage` 852 · `InboxMenu` 802 · `useTaskModal` 719 · `TasksPage` 712 ·
> `team-projects/local.repository` 710 · `DesktopDetailsStep` 703 · `TaskModalMobileBody` 697 ·
> `TeamTaskModal` 692 · `TeamTasksTab` 642 · `AuthContext` 626 · `TaskListsBar` 615 ·
> `MobileShowcases` 613.
>
> ⚠️ **Le nouveau plus gros fichier est `TaskTable.tsx` (1 124), et il n'a pas bougé de la
> journée.** Tant qu'on découpe l'entreprise, la dette du socle reste où elle est. La prochaine
> coupe utile n'est plus dans `/entreprise`.

### 4ᵉ passe (2026-08-27) : `TeamTasksTab` sort de la liste, et c'est la garde qui l'a imposé

> **14 fichiers, budget de garde 11 454 → 10 811.** `TeamTasksTab.tsx` passe de **651 à 573**
> lignes par extraction de `TeamTasksToolbar.tsx` (recherche, tri, création, filtres de statut),
> composant **purement présentationnel** : aucun état de filtre n'a bougé, il reste dans l'onglet
> qui sait ce qu'il filtre.
>
> **Le déclencheur n'est pas une intention de refactor.** Le correctif d'états de chargement
> (`1d98f93`) ajoutait 9 lignes à ce fichier déjà hors budget, le total passait à 11 463, la garde
> a refusé. La découpe a suivi. C'est la **quatrième** fois de suite que la séquence est
> identique : une feature ajoute quelques lignes à un gros fichier, le cliquet refuse la
> croissance nette, un découpage réel se fait. La garde ne demande jamais de refactor, elle rend
> le refactor moins cher que le contournement.
>
> Classement au 2026-08-27, mesuré : `TaskTable` 1 124 · `PyramidTab` 1 045 · `AgendaPage` 900 ·
> `SettingsPage` 852 · `InboxMenu` 802 · `useTaskModal` 719 · `TasksPage` 712 ·
> `team-projects/local.repository` 710 · `DesktopDetailsStep` 703 · `TaskModalMobileBody` 697 ·
> `TeamTaskModal` 692 · `AuthContext` 626 · `TaskListsBar` 615 · `friends/supabase.repository` 600.
>
> ⚠️ **`TaskTable.tsx` (1 124) n'a toujours pas bougé**, troisième journée consécutive. Les quatre
> passes du cliquet ont toutes porté sur `/entreprise`, parce que c'est là que le travail a lieu.
> **La dette du socle ne baisse pas toute seule** : le cliquet empêche la croissance, il ne
> désigne pas la prochaine coupe utile. Celle-ci reste `TaskTable`.

### 3ᵉ passe (2026-08-24) : le plus gros fichier du dépôt n'est plus `PyramidTab`

> Ses 385 lignes
> de `NodeCard` (le rendu récursif d'une carte de l'organigramme) sont parties dans
> `PyramidNodeCard.tsx` : **1 506 → 1 046**. Budget total : 11 915 → **11 454**.
>
> La coupe suit une frontière réelle, pas un compte de lignes : d'un côté le rendu
> D'UNE carte, de l'autre l'orchestration de l'arbre (recherche, repli,
> glisser-déposer, sheets). Aucune logique n'a changé, et la pyramide a été vérifiée
> dans le navigateur après extraction (6 membres, pastilles d'équipe, non-placés).
>
> ⚠️ **Le découpage n'est pas fini, il est commencé.** `PyramidTab` reste hors budget
> à 1 046 lignes. La suite naturelle est d'extraire le glisser-déposer dans un hook —
> c'est la moitié de ce qui reste, et la seule partie qui décide vraiment quelque chose.

### Historique

> **Le cliquet a servi le jour même.** Le correctif de scalabilité (mig. 113) ajoutait du
> commentaire à `team-projects/supabase.repository.ts` (601 lignes, donc dans la liste) : le
> budget a refusé la croissance nette, et la découpe a suivi — les mappers de lignes brutes sont
> partis dans `supabase.mappers.ts`, le fichier est tombé à **483**. Nouveau total :
> **16 fichiers, 12 503 lignes** (contre 17 / 13 103).
>
> C'est exactement le comportement recherché : la garde ne demande pas de refactor, elle rend le
> refactor moins cher que le contournement. `PyramidTab.tsx` (1 507) reste entier.

### Le diagnostic d'origine

**Au 2026-08-24 : 15 fichiers dépassent 600 lignes** (13 au 2026-08-14), le plus gros à
**1 505** (`src/components/organization/PyramidTab.tsx`, +50 lignes en dix jours), suivi de
`TaskTable.tsx` (1 124, **+147**), `AgendaPage.tsx` (900) et `SettingsPage.tsx` (857).
La liste complète au 2026-08-24 compte quatre fichiers `src/components/organization/`
(`PyramidTab` 1 505, `TeamTaskModal` 672, `TeamProjectsTab` 602) et
`src/modules/team-projects/local.repository.ts` (706) : la croissance vient de la vague
entreprise.

Le refactor de juin 2026 avait ramené le maximum sous 600 et la règle avait été inscrite comme
acquise. Elle a cédé pendant la construction du mode entreprise, sans que rien ne le signale —
aucune garde automatique ne mesure la taille des fichiers.

Coût réel, mesuré ailleurs dans cette série d'audits : ces fichiers alimentent le chunk `index`
(438 kB, cf. [`PERFORMANCE.md`](./PERFORMANCE.md)) et rendent chaque intervention plus chère à
charger en contexte.

**Correction, moitié faite le 2026-08-24.** La garde CI demandée ici existe désormais
(`src/architecture.guard.test.ts`) et pose un **cliquet** en deux temps :

- aucun **nouveau** fichier ne dépasse 600 lignes ;
- le **total** des 17 fichiers déjà hors budget (13 103 lignes) ne remonte jamais.

Le budget en total plutôt que par fichier est délibéré : il autorise à déplacer du code entre deux
gros fichiers pendant un refactor, tout en interdisant la croissance nette. Un troisième test
interdit à la liste de garder un fichier assaini — sans lui, un découpage libérerait de la place
pour un futur dépassement, et le cliquet reprendrait du mou en silence.

Ce que la garde ne fait PAS : découper `PyramidTab.tsx`. C'est un chantier, pas un correctif, et
il reste entier. Mais l'hémorragie s'arrête ici — les 17 fichiers de la liste sont tous arrivés
« juste au-dessus ».

> Le comptage manuel s'est trompé une troisième fois dans cet audit : `friends/supabase.repository.ts`
> (601 lignes) manquait à la liste écrite à la main. C'est l'argument du fichier de garde, pas une
> anecdote — **une règle mesurée à la main mesure ce à quoi on a pensé.**

## 4. 🟡 Code livré sans consommateur — un motif récurrent

Le dépôt accumule des primitives et des hooks livrés puis jamais adoptés :

| Élément | Consommateurs |
|---|---|
| ~~`useMessages` (`src/modules/user`)~~ | ✅ **supprimé le 2026-08-24** — avec `useUser`, `useWatchAd` et `useUpdateUserSettings` : tout le module sauf le type `User` |
| ~~`useTasksInfinite`~~ | ✅ **supprimé le 2026-08-25** : la marche à suivre est restée en commentaire à sa place (cf. [`SCALABILITY.md`](./SCALABILITY.md) §5). `getPage()` est **conservé** : capacité d'interface implémentée et testée sur tous les modules |
| **`MobileHeader`** | ✅ **2 → 8 le 2026-08-25** : les 6 pages migrées (cf. [`MOBILE.md`](./MOBILE.md) §2) |
| ~~`MobileScreen`, `ListRow` (`src/components/mobile`)~~ | ✅ **supprimés le 2026-09-05** (C-10) — 0 consommateur en six semaines d'existence (cf. [`MOBILE.md`](./MOBILE.md)) |
| `TouchTarget` | 2 |
| `BottomSheet`, `Segmented` | 2 chacun, mais 16 fichiers importent une variante de feuille (cf. [`MOBILE.md`](./MOBILE.md) §3) |
| ~~49 hooks de `src/modules`~~ | ✅ **supprimés le 2026-09-05** (C-49) — dont trois `hooks.derived.ts` orphelins EN ENTIER. Le motif est désormais **outillé** : `src/modules/orphan-hooks.guard.test.ts` |

Ce n'est pas grave pris isolément, mais c'est un **motif** : on construit la brique générique, on
migre la première page en vitrine, et la migration s'arrête là. Le coût n'est pas le code mort
lui-même — c'est que la doc décrit alors une architecture qui n'existe pas.

> ✅ **Ce motif a un outil depuis le 2026-09-05** : `src/modules/orphan-hooks.guard.test.ts`. Il
> échoue dès qu'un hook exporté par `src/modules` n'est monté par rien. C'est la seule sortie
> durable — les trois relevés manuels (2026-08-24, 08-25, 09-03) ont chacun trouvé la même chose,
> parce qu'aucun d'eux ne laissait derrière lui de quoi la voir revenir.
>
> 🔴 **Deux angles morts, rencontrés POUR DE VRAI en écrivant cette garde**, et qui valent pour
> tout balayage de ce dépôt :
>
> 1. **Une mention en commentaire n'est pas un appel.** `useCreateKRCompletion` disparaissait de
>    la liste des orphelins parce que deux commentaires expliquant pourquoi il est dangereux le
>    nommaient. Même correctif que `architecture.guard.test.ts` pour `supabase.from(`.
> 2. **Un hook appelé par un autre hook du même fichier n'est pas orphelin.** `useFilteredTasks`
>    n'est importé par aucun écran, mais `usePendingTasks` l'appelle, et celui-là sert deux
>    composants vivants. La liste de C-49 demandait sa suppression : l'appliquer littéralement
>    cassait `DeadlineCalendar` et `TasksSummary`.
>
> **Une liste de « noms sans consommateur direct » n'est pas une liste de suppressions sûres.**

> ✅ **Le motif s'est inversé une fois, et il faut le noter parce que c'est la première.**
> `MobileHeader` a été **adopté** (2 → 8 consommateurs) au lieu d'être supprimé, et la migration
> a révélé que le composant **n'avait jamais fonctionné** sur la seule page qui l'utilisait
> (il écoutait `window.scroll` alors que c'est le `<main overflow-auto>` de `Layout` qui scrolle).
>
> **La leçon dépasse ce composant.** Un code sans consommateur n'est pas seulement inutile : il
> est **non éprouvé**. Personne ne peut dire s'il marche, parce que personne ne s'en sert. Le
> réflexe « on le garde, ça resservira » suppose qu'il fonctionne ; ici, il ne fonctionnait pas,
> et depuis un mois. Deux sorties seulement pour un code sans consommateur : **l'adopter ou le
> supprimer.** Le garder, c'est accumuler du code dont on ignore l'état.
>
> ✅ **`MobileScreen` et `ListRow` ont pris la seconde sortie le 2026-09-05** (C-10) : six semaines
> à 0 consommateur, ils sont supprimés. C'est le premier item de cette table à être fermé par la
> suppression plutôt que par l'adoption, et les deux issues comptent autant — ce que la règle
> interdit, c'est la troisième, « on garde, ça resservira ».
>
> ⚠️ **Ce que la suppression a confirmé, et qu'on ne voit qu'en la faisant** : les deux primitives
> étaient livrées AVEC leurs tests (67 lignes, tous verts). Un test vert sur un composant que rien
> ne monte ne prouve que sa propre cohérence, jamais son adéquation à un écran. C'est la même
> illusion que `MobileHeader`, qui ne fonctionnait pas pendant un mois : sa page l'utilisait, mais
> personne n'avait regardé le résultat. Livré ≠ éprouvé, et testé ≠ éprouvé non plus.

> **2026-08-27 · une troisième forme du motif, plus discrète : le hook existant mais non exporté.**
> `useUpcomingEvents` (module `events`) était écrit, testé par son module, et **absent du barrel**.
> La carte « Mon agenda » de l'aperçu entreprise (`3fbe2dc`) n'a eu qu'à l'exporter pour s'en
> servir. Ce n'est pas du code mort au sens des lignes ci-dessus, c'est du code **inatteignable
> depuis les zones qui en ont besoin**, et l'effet pratique est le même : la fonctionnalité se
> réécrit ailleurs, ou ne se fait pas. À surveiller à l'ajout d'un hook, la question n'est pas
> « existe-t-il ? » mais « une autre zone peut-elle l'importer ? ».

> ⚠️ La ligne `import { useMessages } from '@/modules/user'` de `CLAUDE.md` décrivait un hook que
> personne n'appelait. Elle a survécu à la réécriture documentaire du 2026-08-14 parce que j'ai
> vérifié que le fichier existait, pas qu'il servait. **Vérifier l'existence ne suffit pas ;
> il faut vérifier l'usage.**
>
> ✅ **Résolu le 2026-08-24, et la suite est plus intéressante que la ligne de doc.** En vérifiant
> l'usage, il s'est avéré que `src/modules/user` n'avait qu'UN seul consommateur — et que ce
> consommateur écrivait dans `cosmo_user`, une clé que plus rien ne relisait depuis que `useAuth`
> est devenu la source de vérité du type `User`. En mode démo, changer son nom, son email ou sa
> photo affichait « Profil mis à jour » et **ne changeait rien**, ni tout de suite ni après
> rechargement (faille B7, deuxième occurrence). Le code mort ne coûtait pas que de la place : il
> cachait un bug de parcours, sur le mode démo, qui est l'entonnoir d'acquisition.
>
> La mutation est remontée dans `AuthContext` (`updateDemoProfile`), la partie pure est isolée et
> testée (`src/modules/auth/demo-profile.ts` + 10 tests), et le reste du module a été supprimé.

## 5. ✅ Dérive repo ↔ prod — refermée

> **Vérifié en base le 2026-08-25 : la mig. `099` est appliquée**, ainsi que toutes les
> suivantes jusqu'à la `119`. Le ledger et le dépôt sont alignés, il ne reste aucune
> migration en attente.
>
> ⚠️ Ce paragraphe est resté marqué 🔴 pendant que le problème était déjà réglé. C'est le
> défaut classique d'un audit qu'on corrige sans rouvrir : **le titre survit au finding**.
> Avant de citer un marqueur de ce fichier, revérifier le fait.

### Le diagnostic d'origine

La migration **`099_admin_stats_v3.sql` n'est pas appliquée** en prod (dernière appliquée : `098`,
vérifié dans `supabase_migrations.schema_migrations`). Conséquence fonctionnelle détaillée dans
[`ACQUISITION.md`](./ACQUISITION.md) : la chaîne d'attribution `?ref=` est complète en base et
muette dans `/admin`.

C'est la seule dérive détectée. `npm run check:drift` reste l'outil de référence avant tout
déploiement comportant une migration.

## 6. ✅ Ce qui a tenu depuis l'audit du 2026-08-07

Les correctifs structurants de cet audit sont toujours en place et, pour deux d'entre eux,
**vérifiés par la mesure** dans cette série :

- `get_my_tasks()` planifie bien en `Index Scan` (mesuré à chaud, cf. `SCALABILITY.md` §6).
- Le passage du sondage au Realtime tient sur `tasks` — mais **seulement sur `tasks`** :
  8 `refetchInterval` subsistent ailleurs (`SCALABILITY.md` §3).
- `isDemoMode` / `setDemoMode` ne sont plus exportés (source unique `appModeStore`).
- Les gardes `check:rls` et `validate:migrations` tournent et sont vertes.

---

## Comment refaire cet audit

```bash
# Invariants (doivent tous renvoyer vide, sauf le premier)
grep -rn "from('tasks')" src/modules/tasks/supabase.repository.ts   # getById/insert/update/delete uniquement
grep -rln "supabase.from(" src --include="*.tsx" | grep -v repository
grep -rln "from 'gsap'" src | grep -v lib/gsap
grep -rn "useAuth.*from '@/modules/user'" src

# Dette de taille
git ls-files 'src/**/*.tsx' 'src/**/*.ts' | xargs wc -l | awk '$1>600 && $2!="total"'

# Code sans consommateur (remplacer <nom>)
grep -rl "<nom>" src --include="*.tsx" --include="*.ts" | grep -v "définition"

# Gardes
npm run check:rls && npm run validate:migrations && npm run check:drift
```
