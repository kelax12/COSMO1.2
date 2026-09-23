<!-- note-audit: note=92 -->
<!--
  🔴 C-109 · CE MARQUEUR EST LU PAR `npm run check:docs-scored`.
  Douze documents de fond n'étaient notés par RIEN : ils ne pouvaient ni monter
  ni baisser, donc **rien ne signalait qu'ils avaient vieilli**.
  Chaque document de `docs/` déclare donc soit sa note, soit la note qui le
  couvre, soit qu'il n'est pas noté ET pourquoi.
  ❌ Ne JAMAIS inventer une note sans avoir audité le domaine : `non-note` est
     une réponse honnête, un chiffre faux ne l'est pas.
-->
> **Note d'audit** — Note **92 / 100** au 2026-09-22 (soir), au tableau de bord de [`README.md`](./README.md).

# Tests — COSMO

## Note de tests / CI : 80 → 83 → 88 → 89 → 93 → 94 → 95 → 97 → 94 → 95 → 91 → **92 / 100** (2026-08-24 → 2026-08-25 soir → 2026-08-27 soir → 2026-08-29 → 2026-09-02 → 2026-09-03 → 2026-09-14 → 2026-09-14 soir → 2026-09-15 → 2026-09-16 → 2026-09-22 soir)

> ### 🟠 2026-09-22 (soir) · +1 : remesure item par item, contre la CI réelle et la production
>
> **Règle appliquée**, déclarée au [tableau de bord](./README.md) : un angle mort payé le 2026-09-16
> n'est remboursé que si sa garde a rendu **au moins un verdict exploitable en CI** (vert, ou
> rouge sur un vrai défaut). Une garde posée mais jamais jouée, ou cassée, ne rembourse rien.
> Un défaut nommé ce soir coûte selon le barème du 09-16.
>
> | Item | Effet | Mesuré le 2026-09-22 |
> |---|---|---|
> | AM-2 · couverture des scripts et des fonctions | **+1** | `test:coverage:tooling` vert en CI à `HEAD` : **21 fichiers, 345 tests** ; `check:edge-coverage` vert |
> | AM-5 · plancher de tests | **+1** | `check:test-floor` vert en CI |
> | `C-78` · WebKit joué en CI | **+2** | `--project=mobile-safari` dans `ci.yml` et effectivement joué ; les 2 points dus depuis le 09-15 (« +1 et non +3 ») |
> | AM-1 · témoins jamais rejoués | **0** | **non remboursé** : `Sabotages` a tourné une fois (09-21), les **11** sabotages ont été vus, mais le job est **rouge** sur son propre contrôle « arbre restauré » : le `sabotages.log` qu'il écrit dans l'arbre le fait échouer. Couverture **9 témoins sur 47**. → `C-113` |
> | 🔴 **CI de `main` rouge depuis le 2026-09-16 07:11** | **−2** | **aucun des 60 runs suivants n'est vert.** `e2e` : 23 échecs, 13 instables, 214 passés (`806e7745`) ; `lint-test-build` : `check:bundle` à `HEAD`, `architecture.guard` à `806e7745`. Deux régressions sont entrées sans que personne ne les voie, alors que leurs gardes avaient mordu |
> | 🔴 Quatre gardes du 09-20 n'ont jamais rendu un verdict | **−1** | `Visual` (19 échecs sur 19), `check:edge-smoke` (jamais sondé, clé absente du job), `check:retention` (plante), `Sabotages` (voir AM-1). **Rien ne vérifie qu'une garde neuve a été verte une fois** |
> | AM-3 · force des assertions | **0** | toujours ouvert, aucun item |
>
> ✅ **Ce qui tient** : `npm test` en CI à `HEAD`, **243 fichiers, 2 790 tests**, tous verts ; 39 → **46**
> fichiers `*.guard.test.*` suivis par git (`git ls-files`, 2026-09-22).
> 🔴 **Ne pas relire « 5 jobs verts » dans ce document comme l'état courant** : c'est l'état du 09-16.
>
> **91 → 92.** Détail, règle et ordre de réparation : [tableau de bord](./README.md).

> ### 🟠 2026-09-16 · -4 : la note comptait ce qui était mesuré, jamais ce qui ne l'était pas
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
> | AM-1 · **les 36 témoins ne sont jamais rejoués**, aucun mutation testing | −2 | c'est le plus lourd du dépôt : la garde qui garde les gardes n'existe pas |
> | AM-2 · la couverture ignore `scripts/**` et `supabase/functions/**` | −1 | le code qui décide si la CI est verte, et celui qui déplace de l'argent |
> | AM-5 · aucun plancher sur le nombre de tests | −1 | un total qui baisse ne fait échouer aucun job |
> | AM-3 · la couverture ne dit rien de la force des assertions | 0 | couvert par AM-1 |
> | AM-4 · les 105 cas `mobile-safari` hors CI | 0 | déjà payé le 2026-09-14 (−3) |
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
> note ne bouge, alors qu'il est cité **13 fois** dans [`ARCHITECTURE.md`](./ARCHITECTURE.md), dont **9**
> dans la seule colonne « Où il est écrit » du tableau des invariants, et **jamais** dans ce
> qui est mesuré. Il était le mètre,
> jamais l'objet.
>
> Ces lignes entrent donc **dans ce qui est mesuré**. La prochaine passe les traite comme les
> invariants ci-dessus : chacune est soit comblée, soit reconduite avec sa date.

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | 🔴 **Les 39 témoins ne sont jamais rejoués** (« 36 » le 2026-09-16, **recomptés le 2026-09-20** : trois de plus en quatre jours, et aucun n'est rejoué davantage). Ce dépôt a une culture du témoin remarquable : chaque garde arrive avec un fichier `*.guard.test.*` **vu rouge sur des sabotages**. Mais ce sabotage est **manuel et unique**, joué le jour de sa création. Rien ne vérifie qu'un témoin détecte **encore** | `git ls-files` rend **39** fichiers `*.guard.test.{ts,tsx,mjs}` au 2026-09-20 (36 le 09-16). **Aucun mutation testing** : ni `stryker`, ni équivalent, dans `package.json` ni dans un workflow | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:sabotages` (`C-81`) — 🔴 ne prouve PAS : que les **39** témoins détectent ; le rapport couvert / total est imprimé exprès. À sa 1ʳᵉ exécution : `monitoring.guard.test.ts` ne détectait **plus rien** · 🔎 🔴 **2026-09-22 : job rouge**, 1 seul run (09-21) : les 11 sabotages vus, mais échec sur le contrôle « arbre restauré » (`sabotages.log` écrit dans l'arbre). Couverture **9 témoins sur 47**. → `C-113` |
| AM-2 | **La couverture ne porte que sur `src/**`.** En sont donc absents : `scripts/**` (les gardes elles-mêmes, c'est-à-dire le code qui décide si la CI est verte) et `supabase/functions/**` (le code qui déplace de l'argent) | `vitest.config.ts` : `include: ['src/**/*.{ts,tsx}']`. Les seuils par fichier ne visent que `src/` | ✅ **OUTILLÉ le 2026-09-20** · `npm run test:coverage:tooling` · `check:edge-coverage` (`C-82`) — 🔴 ne prouve PAS : `supabase/functions/**` en lignes — impossible (Deno, jamais importé) ; le plancher de témoins en tient lieu. 1ʳᵉ exécution : **3 scripts** sortaient du rapport en silence, à cause de leur shebang |
| AM-3 | **Un taux de couverture ne dit rien de la force des assertions.** Une ligne exécutée par un test qui n'assure rien compte comme couverte | par construction de la couverture v8 | 🟠 **TOUJOURS OUVERT** au 2026-09-21 · **aucun item ne le porte**, et c'est le dernier trou de ce tableau. `C-81` rejoue des témoins, ce qui n'est PAS du test de mutation : un témoin prouve qu'une garde mord, pas qu'une assertion est forte — *(jugé outillable le 09-16 : AM-1 y répond en partie : la mutation mesure ce que la couverture ne voit pas)* |
| AM-4 | ✅ **COMBLÉ le 2026-09-16, vérifié le 2026-09-20.** Était : « les 105 cas `mobile-safari` ne tournent dans aucun workflow » (item `C-78`) | 🔴 **Périmé le jour même où il a été écrit** : `git show HEAD:.github/workflows/ci.yml` lance `--project=chromium --project=supabase-stub --project=mobile-safari` depuis `af0190bd`, 2026-09-16, et `e2e/_warmup-mobile.spec.ts` est suivi par git | ✅ **FERMÉ le 2026-09-16** · `C-78`, `af0190bd` — `mobile-safari` est joué en CI. 🔴 ne prouve PAS : ni appareil réel, ni Android, ni réseau bridé (`C-97`, `M-25`) |
| AM-5 | **Aucune garde ne relie un test à sa raison d'être.** Un test supprimé avec le code qu'il gardait ne laisse aucune trace : le total baisse, et un total qui baisse ne fait échouer aucun job | il n'existe pas de plancher sur le nombre de fichiers ni de cas | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:test-floor` (`C-83`) — 🔴 ne prouve PAS : qu'un test teste quelque chose : un plancher interdit la disparition, pas la complaisance. 1ʳᵉ exécution : le plancher était posé **deux trop bas** (deux témoins portent un tiret) |


> ### 🟡 2026-09-15 · +1 sur les 3 retirés, et le reste attend d'être COMMITÉ
>
> **Ce qui revient, et c'est mesuré** : la boucle de `e2e/touch-targets.spec.ts` passe de 8 à
> **16 routes** (C-80, commit `ede8d7e6`), donc la suite E2E gagne de vrais cas sur de vraies pages
> publiques, et un job CI s'ajoute, `couverture` (C-79, commit `52d23937`), avec **16 cas de témoin
> vus rouges sur quatre sabotages** avant d'être commités.
>
> | | 09-14 soir | **09-15** |
> |---|---|---|
> | Fichiers de test unitaires, **en CI** | 228 | **229** |
> | Cas unitaires, **en CI** | 2 586 | **2 603** |
> | Couverture, en CI | 31,15 L · 30,73 S | **31,15 L · 30,73 S**, inchangée |
> | Cas Playwright listés | 220 / 26 fichiers | **237 / 27**, arbre de travail |
> | dont `chromium` | 107 | **115** |
> | dont `mobile-safari` | 96 | **105** |
> | dont `supabase-stub` | 17 | 17 |
> | Jobs CI | 5 | **6** (`couverture` s'ajoute) |
> | Dernier run vert | `34935509652` | **`34945082906`** sur `66c7d4ff`, les cinq jobs |
>
> ⚠️ **Le 237 est celui de l'ARBRE, pas du dépôt.** À `HEAD` le compte est **236 / 26** : le
> project `mobile-safari-warmup` et son fichier `e2e/_warmup-mobile.spec.ts` (1 cas) ne sont connus
> de git sur aucune branche. C'est une déduction, pas une mesure, et elle est écrite comme telle.
>
> ## 🔴 Le défaut trouvé en mesurant, et sa correction : un CONSEIL de `CLAUDE.md` désarmait C-47
>
> ⚠️ **Ce paragraphe a d'abord affirmé « `npm test` sort en exit 0 après avoir sauté des
> fichiers ». C'est FAUX, et la correction est ci-dessous.** L'affirmation a vécu quelques minutes
> dans trois documents avant que le code de sortie, pourtant imprimé par la commande elle-même, soit
> relu : **`EXIT=1`**. Vitest signale. C'est la lecture qui avait failli, sur la seule ligne de
> résumé.
>
> La suite lancée depuis ce poste ce jour a annoncé **« 225 passed (225) » et sorti en exit 1**.
> La CI, sur le même commit, en joue **229**. Quatre fichiers n'ont jamais démarré :
>
> ```
> Error: [vitest-pool]: Failed to start forks worker for test files
>   src/components/AuthForm.confirmation.test.tsx
>   src/components/onboarding/FirstRunSetup.test.tsx
>   src/components/organization/OrgBillingTab.refund.parcours.test.tsx
>   src/hooks/use-modal-a11y.guard.test.tsx
> Caused by: [vitest-pool-runner]: Timeout waiting for worker to respond
> ```
>
> ### La cause, et elle est dans la documentation de ce dépôt
>
> 🔴 **`CLAUDE.md` conseillait `--maxWorkers=4`**, et la session a suivi le conseil. Or
> `vitest.config.ts` fixe **`maxWorkers: 2`**, et le commentaire qui l'accompagne explique
> précisément pourquoi (finding **C-47**, 2026-09-03) : 4 cœurs et 8 Go, la majorité des fichiers
> montent jsdom, et **quatre jsdom concurrents saturent la RAM**. Un worker qui ne répond plus est
> alors compté comme un échec sans avoir exécuté un seul cas.
>
> Le conseil était **antérieur à C-47** et n'avait jamais été retiré. Un drapeau de ligne de
> commande écrase la config : **suivre la documentation désarmait la garde**. Corrigé le
> 2026-09-15, avec l'interdiction écrite à sa place.
>
> ### Ce qui reste vrai, et qui vaut d'être retenu
>
> ⚠️ **Le total affiché est celui des fichiers COLLECTÉS, pas des fichiers EXISTANTS.** « 225
> passed (225) » ne dit pas qu'il en manque quatre : c'est le **code de sortie** qui le dit, et le
> bloc `Unhandled Errors` plus haut. Un résumé ne remplace pas `$?`.
>
> ⚠️ **L'un des quatre fichiers sabordés est `use-modal-a11y.guard.test.tsx`**, qui porte les
> **trois témoins** de `C-53`. Une session qui n'aurait lu que le résumé aurait conclu « suite
> verte » sans avoir joué les témoins qui garantissent que la garde détecte encore quelque chose.
>
> ❌ **Ne jamais passer `--maxWorkers` en ligne de commande sur ce dépôt.** La borne est mesurée,
> elle est dans la config, et elle a une raison écrite. Si la durée devient le problème, la remonter
> **dans `vitest.config.ts` en remesurant la stabilité**, jamais par un drapeau.
>
> ✅ **La note s'appuie sur la CI** : run `34945082906`, 229 fichiers, 2 603 cas, couverture
> 31,15 L. Et la suite relancée ici **sans drapeau** est complète, cf. l'encadré de vérification
> ci-dessous.
>
> ### La preuve, avant et après, sur la même machine et le même arbre
>
> | | `npm test -- --maxWorkers=4` | **`npm test`** (borne de la config) |
> |---|---|---|
> | Code de sortie | **1** | **0** |
> | Fichiers joués | **225** | **229**, le périmètre entier |
> | Cas | 2 574 + 1 sauté | **2 603 + 1 sauté** |
> | Workers morts | **4** | **0** |
> | Blocs `Unhandled Errors` | 1 (« 4 unhandled errors ») | **0** |
> | Durée | ~5 min, incomplète | **576,6 s**, complète |
>
> ✅ **Le compte local sans drapeau est exactement celui de la CI** : 229 fichiers, 2 603 cas. Le
> seul écart restant est le cas POSIX de `check:edge`, sauté sur Windows par `it.skipIf(win32)` et
> joué sur le runner Linux.
>
> ⚠️ **Le drapeau ne rendait pas la suite plus rapide, il la rendait incomplète.** Un run de 5 min
> qui saute 4 fichiers n'est pas deux fois plus rapide qu'un run de 9,6 min : c'est un autre run.
>
> 🔴 **La leçon porte sur la méthode, pas sur vitest** : l'outil a signalé correctement, un
> conseil périmé a créé la panne, et une lecture pressée a produit un diagnostic faux publié dans
> trois documents. Les trois se corrigent ; le troisième est le plus coûteux, parce qu'il avait
> l'air d'une découverte.
>
> ## 🔴 Pourquoi seulement +1 : C-78 est écrit et n'est PAS dans le dépôt
>
> Le travail existe et il est sérieux : `--project=mobile-safari` ajouté au job `e2e`, `webkit`
> ajouté au `playwright install`, et un project de chauffe dédié (`mobile-safari-warmup`) qui
> répond au vrai problème mesuré la veille, à savoir que le coût de compilation à froid de Vite
> tombait entièrement sur le premier cas WebKit.
>
> **Mais `main` ne le portait pas au moment de la mesure.** Vérifié, pas déduit :
>
> ```
> git show HEAD:.github/workflows/ci.yml | grep -A1 "Run E2E"
>   run: npx playwright test --project=chromium --project=supabase-stub
>
> git ls-files --error-unmatch e2e/_warmup-mobile.spec.ts
>   error: pathspec ... did not match any file(s) known to git
> ```
>
> ⚠️ **ET LA MOITIÉ EN A ÉTÉ COMMITÉE PENDANT L'ÉCRITURE DE CE PARAGRAPHE**, par une autre
> session : `a71180a0`, « trois causes racines qui rendaient WebKit injouable, et aucune n'était le
> produit (**C-78, 1/2**) ». Remesuré immédiatement après :
>
> | | état |
> |---|---|
> | `e2e/_warmup-mobile.spec.ts` | ✅ **suivi par git** |
> | `playwright.config.ts`, `e2e/fixtures.ts` | ✅ **commités** |
> | `.github/workflows/ci.yml` | ❌ **toujours non commité** : `main` lance encore deux projects |
>
> **Le fond ne bouge pas, le détail si** : les 105 cas WebKit ne sont toujours joués par aucun
> workflow, donc la note ne peut rien créditer de plus. Mais la phrase « inconnu de git » est
> devenue fausse en une heure, et elle est corrigée plutôt que laissée. C'est la version dépôt de
> la règle que ce projet applique à la production : **l'état n'est jamais celui qu'on a laissé**,
> parce que plusieurs sessions travaillent dans le même arbre.
>
> ✅ **Ce que la moitié 1/2 a réellement résolu, et c'est important** : le project n'était pas
> seulement absent de la CI, **il était injouable**. Un cas mesuré à **54,7 minutes** tourne
> désormais en **3,4 s** (`navTo` 2 550 ms, `networkidle` 11 ms, `axe.analyze` 3 462 ms), et les
> trois causes sont nommées : un `page.goto` à 30 s pendant que Vite compile la landing, un
> `load` **qui n'arrive jamais** sous WebKit sur la landing, et le coût de chauffe non isolé.
> ⚠️ Le deuxième point recoupe la mesure du 09-14 depuis un autre angle : contre la
> **production**, `load` tombait en 2 159 ms. En **développement**, il n'arrive pas. La différence
> n'est pas le moteur, c'est Vite qui compile à la demande.
>
> 🔴 **C'est la deuxième fois en cinq jours que ce dépôt se fait la même chose.** `C-14` avait vécu
> trois jours dans un arbre non commité pendant que trois documents l'annonçaient acquis, et trois
> `fix(build)` d'autres sessions ont payé la facture. La règle qui en était sortie est la sixième du
> prompt de correction : **une preuve est opposable ou elle n'existe pas**. Elle vaut ici sans
> atténuation : tant que `ci.yml` n'est pas commité, C-78 n'a rien changé pour personne.
>
> ⚠️ **Ce n'est pas un reproche au travail, c'est un constat sur son état.** Rien n'indique qu'il
> soit fini : une session peut avoir été interrompue. Le point mesurable est que la note ne peut
> pas le créditer, et que le jour où le commit arrive, le +2 restant suit dans la même heure.
>
> ✅ **Ce qui a été revérifié inchangé** : run CI `34945082906` vert sur `lint-test-build`, `audit`,
> `e2e`, `rls-integration` et `lighthouse`. La boucle élargie de `touch-targets` passe donc bien en
> CI, sur Chromium au viewport 375 x 812.


> ### 🔴 2026-09-14 (soir) · −3 : 44 % des cas E2E ne tournent nulle part, et le commentaire qui l'acte contredit la règle écrite juste au-dessus
>
> **Tout ce que la note du matin affirme a d'abord été rejoué, et tient** :
>
> | Mesure | Résultat ce soir | Annoncé ce matin |
> |---|---|---|
> | `npm test` | **228 fichiers, 2 586 passés, 1 sauté**, exit 0, 305,65 s | 2 586 / 228 ✅ |
> | `npm run test:coverage` | verte, exit 0 : **31,15 L · 30,73 S · 24,48 F · 26,35 B** | 24,41 F · 26,31 B (deux valeurs légèrement décalées) |
> | `npx playwright test --list` | **220 cas / 26 fichiers** | 220 / 26 ✅ |
> | `npm run typecheck` · `lint` | 0 erreur · 0 erreur, 31 warnings | ✅ / 35 warnings |
> | `check:rls` · `validate:migrations` | 132 / 106, 0 violation · 152 fichiers, 0 erreur | ✅ |
>
> ⚠️ Le **1 test sauté** n'avait jamais été nommé : c'est le cas POSIX du témoin de `check:edge`
> (`scripts/check-edge-deploy.guard.test.mjs:364`, `it.skipIf(process.platform === 'win32')`), qui
> efface un arbre dont un sous-répertoire est en lecture seule. Il est justifié et commenté dans le
> code ; il reste que sur la machine de développement, **la suite annonce « zéro échec » en ne
> jouant pas le cas qui a effectivement échoué le 09-13**.
>
> ## 🔴 Le −3 : les 96 cas WebKit
>
> `playwright.config.ts` déclare quatre projects. Comptés un par un ce soir
> (`--list --project=…`) :
>
> | Project | Cas | Fichiers | Joué par la CI ? |
> |---|---|---|---|
> | `chromium` | 107 | 21 | ✅ |
> | `supabase-stub` (+ warmup) | 17 | 5 | ✅ |
> | **`mobile-safari`** (iPhone 12, **WebKit**) | **96** | **19** | ❌ **jamais** |
>
> Le job `e2e` de `.github/workflows/ci.yml` lance exactement
> `npx playwright test --project=chromium --project=supabase-stub`, soit **124 cas sur 220**.
> **96 cas, soit 44 % de la suite E2E, ne sont joués par aucun workflow** : ni `ci.yml`, ni
> `uptime`, ni `scalability-volume`, ni aucun autre (vérifié par `grep` sur
> `.github/workflows/`, seule occurrence : le commentaire qui les exclut).
>
> 🔴 **Et le motif est écrit dans le même commentaire que la règle qu'il enfreint.** Trois lignes
> plus haut, à propos de `supabase-stub` :
>
> > « le laisser hors de la CI reviendrait à poser sur `main` des gardes qui ne tournent nulle part
> > la faute que ce dépôt s'est déjà faite deux fois. »
>
> Puis, immédiatement après :
>
> > « `mobile-safari` reste hors CI (WebKit, ~1 min d'installation en plus). »
>
> Le raisonnement est juste, il est appliqué à un project et pas à l'autre, et le prix est
> **une minute d'installation** contre 96 cas. C'est la définition même du défaut que ce document
> traque depuis le 2026-09-03 : non pas une garde qui mesure à côté, mais **une zone que rien ne
> mesure**, sans run rouge pour la signaler.
>
> **Ce que ça laisse sans filet, nommément** : les 19 fichiers concernés portent les feuilles
> mobiles, les gestes tactiles, `reduced-motion-sheets`, les cibles tactiles WCAG 2.5.5, et les
> suites d'accessibilité au clavier, donc **tout le périmètre iOS Safari** que
> [`MOBILE.md`](./MOBILE.md) documente sur des dizaines de pages, et le moteur sur lequel tourne
> VoiceOver, plafond déclaré de [`ACCESSIBILITY.md`](./ACCESSIBILITY.md).
>
> ⚠️ **Rejoués depuis ce poste, et voici l'état HONNÊTE** : le run complet des 96 cas a été lancé
> puis **interrompu** après 5 cas (2 échecs, tous deux `page.goto` en timeout de 120 s au démarrage
> à froid du serveur Vite). **Ce n'est pas un défaut produit** : la même page, sur le même moteur
> WebKit / iPhone 12, chargée depuis la **production**, rend `load` en **2 159 ms avec zéro requête
> en vol** (sonde dédiée, `webkit.launch()` + `devices['iPhone 12']`). Le résultat utile est donc :
> **personne ne sait si ces 96 cas passent**, et les rejouer à la main bute sur un coût de
> démarrage que la CI, elle, absorberait sans s'en apercevoir.
>
> **Pourquoi −3 et pas −1** : ce n'est pas une lacune de couverture parmi d'autres, c'est la
> couverture d'un des deux moteurs de rendu du web et de la totalité du périmètre mobile, dans un
> produit dont la documentation mobile est le deuxième plus gros document du dépôt. Et c'est
> réparable en une ligne (`--project=mobile-safari` ajouté au job `e2e`, plus `webkit` dans le
> `playwright install`), donc le coût du défaut est très supérieur au coût du correctif.
>
> ✅ **Ce qui, en revanche, tourne vraiment et a été vu vert ce soir** : `a11y-audit`,
> `a11y-keyboard-audit` et `touch-targets` sur Chromium, **37 cas, 37 passés, 8,9 min, exit 0**.


> ### 🟢 2026-09-14 · +2 : une garde qui était écrite mais n'existait pas en CI y tourne enfin, et une autre a mordu SUR elle-même
>
> `src/lib/toast.guard.test.ts` (4 cas, dont un témoin) vivait depuis trois jours sur un disque,
> non suivi par git : elle **ne tournait jamais** en CI. Commitée avec la façade qu'elle garde
> (`7134d7fe`), elle tourne désormais à chaque run — et le job qu'elle protège (`Budget de bundle`)
> est passé du rouge (3 fois, par d'autres sessions) au vert opposable.
>
> **220 cas Playwright** (210 → 220, +10) : `e2e/stubbed/delete-org.spec.ts` (4 cas) prouve pour la
> première fois le parcours nominal « rembourser → résilier → supprimer » (C-39), en **retenant**
> la réponse de l'Edge Function pour distinguer « avant » de « en même temps ». Vu rouge sur une
> mutation du hook avant d'être commité.
>
> **`src/refund.guard.test.ts` a rougi SUR l'extraction du verrou anti-rejeu, et avait raison** : une
> garde textuelle qui cherche du code à son ancien emplacement doit échouer quand le code déménage,
> sinon elle passe au vert en ne regardant plus rien. Corrigée pour suivre le code — et
> **renforcée** : un cas neuf interdit désormais explicitement de recopier l'arithmétique dans
> l'entrypoint. Neuvième occurrence de cette classe de défaut en deux semaines, et la première où
> c'est MOI qui l'ai provoquée en développant.
>
> Coverage : **2 586 tests / 228 fichiers**, zéro échec, `exit 0` — 31,15 L / 30,73 S / 24,41 F /
> 26,31 B. ⚠️ Le pourcentage baisse légèrement malgré 116 tests de plus : le dénominateur a bougé
> aussi. Un taux ne se lit jamais seul.
>
> **Pourquoi +2 et pas plus** : rien de tout ça n'est une capacité neuve du harnais — c'est la
> correction d'une garde qui n'existait pas encore où on la croyait, et le comblement d'un trou de
> couverture sur un chemin qui déplace de l'argent. Le mérite structurel appartient aux gardes du
> 09-11/09-13 (`toast.guard`, `tracked-imports`), pas à cette passe.

> ### 2026-09-03 · +1, quatre cliquets de plus et quatre gardes prises en défaut
>
> Le 2026-09-02 avait porté la note à **94** (tableau de bord de [`README.md`](./README.md)) sans
> que ce fichier l'enregistre : 1 884 → 2 026 tests, `i18n:scan` devenu bloquant, et une garde
> interdisant `{var}` dans un catalogue. Ce bloc couvre les deux, et se lit contre la colonne
> 08-29.
>
> | | 08-29 | **09-03** |
> |---|---|---|
> | Suite unitaire | 1 836 / 166, verte | **2 051 / 179, verte** (mesurée le 2026-09-02) · ⚠️ **2 586 / 228 au 2026-09-14** — instantané daté, non réécrit |
> | Jobs CI verts sur `main` | 5 sur 5 | **5 sur 5**, une rougeur `e2e` du 08-30 au 09-01 refermée |
> | Fichiers de garde (`*guard*`, comptés dans l'arbre) | 6 | **9** |
>
> **Trois fichiers de garde nouveaux, plus deux gardes existantes durcies, et trois d'entre eux
> portent un témoin** (une sonde qui refuse un parseur ou un détecteur qui ne détecterait plus
> rien) :
>
> | Cliquet | Ce qu'il verrouille |
> |---|---|
> | `src/csp.guard.test.ts` | le schéma `wss:` dans `connect-src`, les directives de confinement, l'absence d'`unsafe-eval`, et `data:` dans `img-src` dont dépend le QR code TOTP. Vérifié rouge sans le correctif |
> | `src/modules/polling.guard.test.ts` | quatre fichiers nommés doivent garder leur `refetchInterval` **conditionnel**. Ce comptage a déjà été faux une fois (`useOrgJoinRequests`, monté par `Layout`, donc actif partout) : il cesse d'être un checkpoint qu'on rejoue à la main |
> | `scripts/migration-guards.test.mjs` (+3 cas) | le parseur de `check:drift` ne reconnaissait que `CREATE POLICY "nom" ON …`, jamais le **nom nu**, pourtant présent quatre fois dans le dépôt. Il réclamait donc la suppression d'une policy que le dépôt venait de créer |
> | `check:bundle` · `SENTRY_FLOOR` | refuse de valider un budget calculé sur un build sans Sentry, cf. [`PERFORMANCE.md`](./PERFORMANCE.md) |
> | `src/i18n/interpolation.guard.test.ts` | interdit la syntaxe `{var}` dans un catalogue, celle qui affichait « Étape {current} sur {total} » dans l'onboarding livré la veille |
>
> 🔴 **Ce qui empêche d'aller plus haut, et ce n'est toujours pas un nombre de tests : en cinq
> jours, QUATRE gardes ont été prises en train de répondre sans mesurer.** `check:bundle` pesait un
> artefact qui n'existe nulle part, la sonde `uptime.yml` sortait verte en ayant sauté toute sa
> moitié backend sur un secret inexistant, le contrôle d'isolation de `restore-drill.yml` capturait
> le mot `ROLLBACK` au lieu du compte et **ne pouvait pas échouer**, et `i18n:scan` certifiait
> « plus aucune chaîne d'interface en dur » avec une heuristique aveugle à quatre formes entières.
> Les quatre sont corrigées. La règle écrite le 08-29 (« une garde doit avoir tourné avant d'être
> invoquée comme preuve ») ne suffisait pas : elle demande maintenant **qu'on vérifie ce que la
> garde regarde**, pas seulement qu'elle tourne.
>
> ⚠️ Et une alerte qui fonctionne ne protège rien si personne ne l'ouvre : `vendor-watch.yml` a
> détecté une exfiltration réelle d'email et de nom, a échoué quatre jours d'affilée, a mis son
> issue à jour à chaque fois, et n'a été lue qu'au cinquième. Les échecs sont désormais **poussés**
> sur `OPS_ALERT_WEBHOOK_URL`, avec un exercice à blanc déclenchable à la main. Le canal reste
> **inerte** tant que ce secret n'est pas posé dans les secrets Actions.

> ### 2026-08-29 · +4, et le gain n'est pas un test de plus
>
> **Les cinq jobs CI sont verts sur `main` pour la première fois** (run de `493ccaf`), et
> `rls-integration` **ne l'avait jamais été depuis sa création** le 2026-06-21. C'est le point qui
> vaut les quatre points : la gate de déploiement mesure enfin quelque chose.
>
> | | 08-27 | **08-29** |
> |---|---|---|
> | Suite unitaire | 1 802 / 159, verte | **1 836 / 166, verte** |
> | Jobs CI verts sur `main` | **2 sur 5** | **5 sur 5** |
> | Couverture · statements / functions | 28,15 / 22,78 | **28,81 / 23,41** |
> | Couverture · branches / lines | 23,59 / 28,48 | **24,17 / 29,17** |
> | Fichiers d'intégration RLS verts | 6 sur 7 | **7 sur 7** |
>
> 🔴 **Ce qui empêche d'aller plus haut, et c'est un constat sur la méthode, pas sur le nombre de
> tests.** Aucun des cinq jobs n'était rouge à cause du produit. Cinq gardes en échec, cinq causes
> **dans les gardes elles-mêmes** : un test aux props inexistantes (vert en vitest, fatal à
> `tsc -b`), un titre renommé sans son test, Chrome qui ne démarrait pas, et **deux tests faux**
> dans le harnais RLS, dont un qui inventait une colonne `status` inexistante et un autre qui
> éprouvait une forme d'appel que l'application n'utilise nulle part.
>
> Deux de ces fichiers avaient été posés sur `main` **sans avoir jamais tourné**. La règle qui
> manquait est écrite ici : *une garde qui ne peut pas être exécutée localement doit l'être en CI
> avant d'être invoquée comme preuve, et son premier run doit être regardé.*

| Ce qui compose la note | 08-24 | 08-25 (16 h) | **08-25 (fin)** | **08-27** |
|---|---|---|---|---|
| Suite unitaire | 1 583 / 143, verte | 1 656 / 146, verte | **1 736 / 151, verte** | **1 802 / 159, verte** |
| Tests E2E Playwright | 41 × 2, 11 specs | **62 × 2 = 124, 15 specs** | inchangé | **16 specs** · +`reduced-motion-sheets` (3 cas, chromium) |
| Tests d'intégration RLS (base réelle) | 5 fichiers | **6** · dont `org-permissions.test.ts` | inchangé | **7** · `org-invitations.test.ts` couvre la mig. 130 |
| Jobs CI | 4 | **5** (+ `lighthouse`) | inchangé | 5 |
| Gardes-cliquets | 6 | 6 | 6 | **7** · le mouvement réduit est mesuré, plus seulement gardé statiquement |
| `npm run test:coverage` | ✅ verte | 🔴 **ROUGE**, 3 seuils | ✅ **VERTE**, `exit 0` | ✅ **VERTE**, relancée le soir · `exit 0` |
| Couverture · statements / functions | · | sous les seuils | 27,20 / 21,69 | **28,15 / 22,78** |
| Glob `supabase.repository.ts` (statements) | · | 63,74 % (seuil 65) | **76,79 %** (seuil remonté à 74) | non remesuré |

> ⚠️ **La ligne « Tests E2E Playwright » ci-dessus est périmée, et elle l'était déjà quand elle a
> été écrite le 2026-08-27.** Remesuré le 2026-09-05 : **190 cas, 23 specs, 3 projects** — et
> `reduced-motion-sheets` en porte 5, sur les DEUX projects, pas 3 sur chromium. Remesuré à
> nouveau le **2026-09-11** : **210 cas, 25 specs, 4 projects**. Le décompte à
> jour, avec sa méthode, est au § Playwright. Cette ligne n'est pas corrigée ici : c'est un
> instantané daté dans un tableau d'évolution, le réécrire falsifierait l'historique.

**+5 après la campagne de tests du soir.** La gate de couverture est repassée au vert **sans
qu'aucun seuil ne soit baissé**, ce qui était la seule sortie acceptable : 115 tests ajoutés, tous
sur la cible que la gate désignait elle-même.

Ce qui monte la note tient en deux points, et le second compte plus que le premier :

1. **Le chemin de déploiement est rouvert** : `lint-test-build` ne bloque plus.
2. **Le gain est verrouillé.** Le cliquet du glob `supabase.repository.ts` a été **remonté** de
   65 à 74 (statements) et de 55 à 90 (functions), à ~2 points sous le mesuré. Un repository livré
   sans test fera désormais tomber cette gate **bien avant** de bouger le plancher global : elle
   mord sur 1 663 statements, pas sur 21 557.

**Ce qui plafonne à 89, et pas plus haut** : la couverture absolue reste sous les 30 %, et les
seuils Lighthouse sont toujours provisoires.

### 2026-08-27 (soir) · +1, et la marge du plancher `functions` a doublé

**La gate de couverture avait été laissée non relancée**, alors que la journée avait livré
plusieurs centaines de lignes d'interface et que la marge du plancher `functions` n'était que de
**0,32 point**. C'était le scénario exact qui l'avait fait tomber le 2026-08-25 : le dénominateur
grossit plus vite que le numérateur, et personne ne regarde. Relancée : **verte, `exit 0`**,
1 802 tests sur 159 fichiers, et les quatre indicateurs **montent** par rapport au 08-25.

| | 08-25 (fin) | **08-27 (soir)** | Δ |
|---|---|---|---|
| Statements | 27,20 % | **28,15 %** | +0,95 |
| Branches | 22,86 % | **23,59 %** | +0,73 |
| Functions | 21,69 % | **22,78 %** | +1,09 |
| Lines | 27,20 % | **28,48 %** | +1,28 |

⚠️ **Ne pas lire ça comme « la vague de features était bien testée ».** Ce que ça dit est plus
étroit : elle n'a pas dégradé les ratios. La marge du plancher `functions` passe de 0,32 à environ
1,4 point, ce qui achète du temps, pas une garantie.

**+1 seulement, et le point ne vient pas de la couverture.** Il vient de la nature de deux tests
ajoutés le soir, tous deux construits autour d'un **témoin** :
- `e2e/reduced-motion-sheets.spec.ts` mesure qu'une feuille s'ouvre réellement sous
  `prefers-reduced-motion`, ce qu'aucune garde statique ne peut voir. Il refuse de conclure si son
  propre harnais ne peint pas, et il embarque une feuille de contrôle : si elle échoue aussi, le
  verdict est « le harnais ment », pas « le produit est cassé ». Les deux erreurs de mesure de la
  journée venaient précisément de conclusions sans témoin (cf. [`MOBILE.md`](./MOBILE.md) §1bis).
- `src/modules/team-projects/hooks.background.test.tsx` prouve un gain de performance par le
  comptage des appels, avec un **témoin négatif qui emprunte exactement le même chemin** que le
  cas testé. Sans lui, le test aurait constaté l'absence d'un rechargement que rien ne demandait.

C'est la leçon à retenir de la journée : **un test sans témoin peut passer au vert pour la mauvaise
raison**, et il est alors pire qu'absent, puisqu'il rassure.

Et l'acquis du milieu de journée tient toujours : pour la première fois, une brique entreprise
(les permissions, mig. 115) est arrivée **avec son test d'intégration contre une vraie base dans
le même commit**, 337 lignes qui vérifient la policy, pas la relecture de la policy. C'est le
standard à tenir pour toute nouvelle surface d'autorisation.

### 2026-08-27 · +66 tests, et la note ne bouge PAS

**Note inchangée à 88, délibérément.** Six fichiers de test sont arrivés (`inbox.hooks`,
`org-loading-states`, `agenda-events.helpers`, `org-events.helpers`, `MobileTabBar`,
`ActiveOrgContext`) et la suite passe de 1 736 / 151 à **1 802 / 159, verte**. Mais :

1. **`npm run test:coverage` n'a pas été relancée de la journée.** Or la journée a livré
   plusieurs centaines de lignes d'interface (frise, squelettes, barre d'outils extraite,
   contexte d'organisation). Le dénominateur a grossi et le numérateur aussi, dans des
   proportions **inconnues**. La marge du plancher global `functions` était de **0,32 point** le
   25 au soir. Tant que la commande n'a pas tourné, personne ne peut dire de quel côté on est,
   et un compte de tests n'est pas une couverture.
2. Aucune nouvelle gate, aucun nouveau job, aucun test d'intégration RLS : la **mig. 130** est
   écrite sans test de base réelle, alors que le standard posé le 2026-08-25 est
   « toute nouvelle surface d'autorisation arrive avec son test contre une vraie base ». Ici
   c'est un **rétrécissement** de policy, pas une nouvelle surface, mais le principe vaut :
   personne n'a prouvé en base qu'un membre simple ne lit plus rien.

**Ce que la journée prouve en revanche, et qui vaut plus qu'un point de note : le cliquet
d'architecture a attrapé une régression que son auteur niait.** Le correctif d'états de
chargement ajoutait 9 lignes à `TeamTasksTab.tsx`, `architecture.guard` est passée au rouge
(11 463 pour un plafond à 11 454), et elle a été déclarée **deux fois** « antérieure à ce
travail », sur la foi d'un `git stash` pris après le commit fautif. La vérification correcte,
restaurer `src/` à `4b91816`, la montre **verte** avant.

> ⚠️ **Une garde rouge est coupable jusqu'à preuve du contraire, et la preuve se prend à un commit
> nommé, jamais dans un stash.** C'est la deuxième fois en trois jours qu'une affirmation
> confiante sur un « avant » se révèle fausse (cf. les `refetchInterval` du 08-25). Les deux ont
> été rattrapées par une mesure, aucune par une relecture.

> ✅ **Deux tests de la journée ont été vérifiés en les faisant tomber**, ce qui est la règle
> maison et pas un supplément : `org-loading-states.test.tsx` en neutralisant le garde de
> l'Aperçu, et `ActiveOrgContext.test.tsx` en neutralisant tour à tour la **lecture** puis
> l'**écriture** de l'indice `wasOrgMember` (2 puis 1 test au rouge). Un test qu'on n'a jamais vu
> rouge ne prouve rien.

### ✅ `npm run test:coverage` · verte au 2026-08-25 (fin de journée)

```
lines      26,96 %  >= 26 %     functions   21,32 %  >= 21 %
statements 26,65 %  >= 26 %     branches    22,75 %  >= 22 %
glob src/modules/**/supabase.repository.ts : 90,55 L / 76,79 S / 93,00 F / 65,89 B
```

**Comment on y est arrivé : 115 tests, 5 fichiers, aucun seuil touché vers le bas.**

| Fichier ajouté | Ce qu'il couvre | Effet (statements) |
|---|---|---|
| `team-categories/supabase.repository.test.ts` | 13 tests · le SEUL repository du dépôt sans aucun test | **3 % → 88 %** |
| `friends/supabase.repository.sharing.test.ts` | 25 tests · les 12 méthodes non testées (retrait de demande, partage de listes, modèle de lecture) | **40 % → 76 %** |
| `organizations/supabase.repository.invitations.test.ts` | 19 tests · invitations nominatives, avis de retrait, opérations irréversibles | **64 % → 82 %** |
| `okrs/supabase.repository.read.test.ts` | 13 tests · lectures ciblées et repli JSONB | **49 % → 63 %** |
| `events/supabase.repository.window.test.ts` | 10 tests · lectures par fenêtre et agenda managérial (mig. 077) | **54 % → 83 %** |

**Ces tests n'ont pas été écrits pour le chiffre.** Chacun asserte la **chaîne envoyée à
PostgREST**, pas la valeur retournée : les colonnes du `select`, les `eq` de défense en
profondeur, les plafonds de lecture, la whitelist des `insert` et `update`. C'est ce qui en fait
des gardes de sécurité plutôt que des tests de mapping. Un mapping qui change en silence n'est pas
grave ; un filtre `user_id` qui disparaît en silence l'est.

Trois exemples de ce qui est désormais verrouillé, et ne l'était pas ce matin :

- **`cancelFriendRequest` fait un `DELETE`, jamais un `UPDATE`.** Le statut `rejected` est réservé
  au destinataire par le `WITH CHECK` de la mig. 049, et `cancelled` n'existe pas dans la
  contrainte `CHECK` de la table. C'est cette contradiction qui laissait la demande collée dans la
  liste. Le test échoue si quelqu'un « simplifie » en repassant à un statut.
- **`getWindowForUser` vise le `user_id` DEMANDÉ, pas celui de l'appelant.** C'est le seul chemin
  de lecture du dépôt qui cible volontairement les données de quelqu'un d'autre. La RLS refuserait
  une cible non gérée, mais elle ne peut pas rattraper un filtre qui vise la mauvaise personne
  **autorisée**.
- **Un rôle de partage inconnu retombe sur `viewer`.** Le défaut doit être le moins permissif ; un
  repli sur `editor` donnerait le droit d'écriture par accident.

**Les seuils ont été REMONTÉS, pas laissés en place.** C'est la règle du fichier
(`vitest.config.ts`) : on ne baisse jamais, et on remonte après un gain. Le glob
`supabase.repository.ts` passe de 65/55/65/35 à **88 L / 90 F / 74 S / 63 B**, soit ~2 points sous
le mesuré. Le plancher global `branches` passe de 21 à 22. Les trois autres planchers globaux
**n'ont pas bougé, et c'est délibéré** : leurs marges sont de 0,96 / 0,65 / 0,32 point. Les recaler
au mesuré réarmerait dès cette semaine le piège qu'on vient de désamorcer.

### Ce qu'était le problème (2026-08-25, milieu de journée)

```
functions  20,65 %  < 21 %      statements  25,65 %  < 26 %
src/modules/**/supabase.repository.ts  63,74 %  < 65 %
```

**Ce n'était pas une régression de qualité, c'était une régression de RATIO**, et la nuance a
décidé du correctif. La couverture absolue n'avait pas baissé : 73 tests avaient été ajoutés dans
la journée. C'est le dénominateur qui avait explosé, avec environ **2 000 lignes d'interface et de
hooks non testés** (`MemberPermissionsSheet` 310, `PyramidNodeCard` 516, `useOrgInboxRealtime` 131,
`useFriendsInboxRealtime` 123), pendant que les 205 tests de `permissions.ts` couvraient la partie
**pure**, la seule facile à tester.

Le seuil `lines` était d'ailleurs repassé au vert **tout seul** dans la soirée (25,94 % → 26,02 %),
grâce aux tests de tarification annuelle. C'était déjà l'argument contre la baisse de seuil : il a
suffi d'une soirée de travail normal pour en récupérer un.

**Deux sorties existaient, une seule était acceptable.** Baisser les seuils de 0,05 point remettait
au vert en trente secondes, et vidait le cliquet de son sens, puisque c'est précisément son rôle
d'attraper une vague de code non testé. C'est la seconde qui a été prise.

> ℹ️ **Trois mesures dans la journée, et c'est ce qui rend le constat solide** (lines /
> functions / statements / repository) :
>
> | Mesure | Contexte | Résultat |
> |---|---|---|
> | midi | une session concurrente modifiait `src/modules/habits/`, un test rouge | 25,95 / 20,50 / 25,58 / 63,71 |
> | après-midi | travail terminé, 1 621 tests verts | 25,94 / 20,53 / 25,59 / 63,74 |
> | soir | 1 656 tests verts, tarification annuelle livrée | 26,02 / 20,65 / 25,65 / 63,74 |
> | **fin de journée** | **1 736 tests verts, 115 tests de repository ajoutés** | ✅ **26,96 / 21,32 / 26,65 / 76,79** |
>
> Le rouge n'a jamais dépendu de l'état de l'arbre de travail. Le publier après une seule mesure
> aurait été un pari, pas une mesure, et la troisième a rapporté une information que les deux
> premières ne pouvaient pas donner : **le seuil `lines` se comble tout seul dès qu'on écrit des
> tests normaux.** La quatrième l'a confirmé à l'échelle : une campagne ciblée sur la frontière
> de sécurité a suffi, sans toucher un seul seuil vers le bas.

---

> **Gates ajoutées le 2026-08-07** (audit architecture) :
> - `npm run check:rls` — invariants RLS (`auth.uid()` wrappé, une seule policy
>   PERMISSIVE par rôle+action). **Bloquant en CI.** Cliquet : n'audite que les
>   migrations ≥ 043. A déjà trouvé une violation invisible aux advisors Supabase.
> - `npm run check:drift` — dérive repo ↔ prod. **Pas** une gate CI : demande une
>   introspection live (2 étapes, cf. `docs/DEPLOYMENT.md`). À exécuter avant
>   chaque déploiement comportant une migration.
> - `e2e/rls/get-my-tasks.test.ts` — isolation de la RPC `SECURITY DEFINER`
>   `get_my_tasks`. La RLS ne s'applique PAS dans le corps d'une telle fonction :
>   son périmètre ne tient qu'à sa logique, donc il doit être testé contre une
>   vraie base, pas mocké.
>
> ### ⚠️ La suite était ROUGE en arrivant sur cette passe (2026-08-24, 2ᵉ audit)
> `src/design-system.guard.test.ts` échouait sur `main` (203 > budget 202, et 83 tailles sous
> 11 px pour un plancher de 82). Cause : un badge `text-[10px]` entré dans
> `TeamProjectCard.tsx` APRÈS que le budget ait été posé le matin même. Corrigé (les quatre
> badges du fichier sont passés en `text-caption`, budget abaissé à 199 / 79).
>
> **C'est la deuxième fois dans la même journée que cette garde attrape la même chose au même
> endroit** : le mode entreprise n'a jamais été migré sur l'échelle typographique, il la contourne
> badge par badge. La garde fait son travail ; c'est la migration qui manque.
>
> Leçon opérationnelle : **ne jamais partir du principe que `main` est vert.** Le mesurer d'abord,
> sinon on attribue à ses propres changements un échec préexistant — ou pire, on baisse la garde
> pour « débloquer ».
>
> **Après correctifs : 1576 tests / 142 fichiers, tous verts** (`npm test`, mesuré en local).
>
> **Suite unitaire au 2026-08-24 (1ʳᵉ passe) : 1583 tests / 143 fichiers, tous verts** (`npm test`, mesuré en
> local, ~3 min 10 s — deux fois plus rapide qu'au 2026-08-14 à volume supérieur).
> Un échec est donc une vraie régression, pas un test pré-existant cassé.
>
> **Corrigé le 2026-08-24** — `src/design-system.guard.test.ts` était ROUGE (`205 > budget 203`) :
> la vague entreprise du 2026-08-23/24 avait introduit quatre tailles arbitraires, toutes SOUS le
> plancher de 11 px, dans des fichiers sans système typographique local à préserver
> (`TeamAssigneeGroups.tsx`, `TeamsSection.tsx`, `TeamTasksTab.tsx` ×2). Migrées en `text-caption`,
> puis budget abaissé à **202** et plancher sub-11px à **82** — la règle du fichier est que ces
> nombres ne remontent jamais. Remonter le budget aurait vidé la garde de son sens.
>
> ## Gardes d'architecture — `src/architecture.guard.test.ts` (2026-08-24)
>
> Deux invariants de [`ARCHITECTURE.md`](./ARCHITECTURE.md) n'avaient aucun outil, et les deux
> avaient reculé sans que personne le voie :
>
> | Garde | Forme |
> |---|---|
> | `supabase.from()` uniquement dans un `*.repository.ts` | binaire — 0 violation, et ça doit le rester |
> | Aucun fichier source > 600 lignes | **binaire depuis le 2026-09-05** — `KNOWN_OVERSIZED` est vide, `OVERSIZED_BUDGET` vaut 0 |
>
> Le cliquet plutôt qu'un seuil dur : rendre la règle rouge sur les 17 fichiers existants
> produirait une gate rouge en permanence, donc ignorée — exactement le travers que l'audit
> pointe. Un troisième test interdit à la liste `KNOWN_OVERSIZED` de garder un fichier déjà
> assaini, sans quoi un découpage libérerait de la place pour un futur dépassement.
>
> ✅ **Le cliquet a fini son office (C-09, 2026-09-05).** Les 17 fichiers de départ, puis les 15
> qui restaient, ont tous été découpés : la règle est redevenue binaire, et il n'y a plus de mou
> à distribuer. Le troisième test garde son sens — il empêche de rouvrir la liste.
>
> 🔴 **Ce que cette passe a appris, et qui vaut au-delà de la taille des fichiers** : la garde
> était **rouge depuis un moment sans que personne le sache**. Trois fichiers
> (`Layout`, `AuthContext`, `DashboardPage`) avaient franchi 600 lignes hors de la liste, donc en
> faisant échouer le test « aucun NOUVEAU fichier ». Une garde rouge dans une suite déjà rouge ne
> se distingue pas du bruit : c'est le pendant exact des quatre gardes du 2026-09-03 qui
> répondaient sans mesurer. Celle-ci mesurait, et personne ne la lisait.
>
> ⚠️ Les commentaires sont retirés avant la recherche de `supabase.from(`. Sans ça, la phrase qui
> **explique** la règle la déclenchait. Une garde qui se mord la queue finit désactivée.
>
> ## Gardes ajoutées par le 2ᵉ audit (2026-08-24)
>
> | Garde | Fichier | Ce qu'elle empêche |
> |---|---|---|
> | Effacement RGPD des tables symétriques | `src/rgpd-erasure.guard.test.ts` | Qu'une table où le compte supprimé apparaît dans une SECONDE colonne (`friends`, `friend_requests`, `shared_tasks`) retombe dans la boucle générique `user_id`. C'est arrivé trois fois, dont une avec l'email en clair |
> | Échelle z-index fermée | `src/design-system.guard.test.ts` | Qu'un composant réinvente sa valeur. La table publiée listait 7 paliers pendant que le code en utilisait 16 |
> | Mouvement des feuilles | `src/design-system.guard.test.ts` | Qu'une nouvelle feuille écrive `y: '100%'` à la main. Sous `prefers-reduced-motion`, ça peut l'ouvrir 100 % sous l'écran — mesuré, pas supposé |
> | Chemin d'accès entreprise | `src/modules/team-projects/supabase.repository.test.ts` | Un retour à `.from('team_tasks')`, qui réintroduirait le `Seq Scan` + CTE par ligne sans aucun symptôme avant la montée en charge |
> | Hooks de module sans consommateur | `src/modules/orphan-hooks.guard.test.ts` (2026-09-05, C-49) | Qu'un hook exporté par `src/modules` soit livré sans qu'aucun écran ne le monte. 49 s'étaient accumulés, dont trois fichiers `hooks.derived.ts` orphelins EN ENTIER. Un hook sans écran n'est pas du poids, il est **non éprouvé** |
>
> 🔴 **Ce que la garde des orphelins a appris sur les balayages textuels**, et qui vaut pour tous
> ceux de ce dépôt — les deux cas ont été rencontrés en l'écrivant, pas imaginés :
>
> 1. **Retirer les commentaires AVANT de chercher.** `useCreateKRCompletion` sortait de la liste
>    des orphelins parce que deux commentaires expliquant pourquoi il est dangereux le nommaient.
>    Une mention n'est pas un appel.
> 2. **Le fichier déclarant peut être son propre consommateur.** `useFilteredTasks` n'est importé
>    par aucun écran, mais `usePendingTasks` l'appelle dans le même fichier — et sert deux
>    composants vivants. Le compter orphelin aurait fait supprimer un hook dont dépendent
>    `DeadlineCalendar` et `TasksSummary`.
>
> Son **témoin** va plus loin que « le balayage voit des fichiers » : il exige que des hooks connus
> vivants rendent plus de trois consommateurs, **et** qu'un hook inexistant en rende zéro. Sans
> cette seconde sonde, une mesure qui répondrait toujours « consommé » passerait au vert en ne
> détectant plus rien. Les deux sabotages ont été **joués** avant de livrer.
>
> Les trois premières sont des **cliquets** : le stock existant est toléré et ne peut que baisser.
> Une gate rouge en permanence finit ignorée — c'est la règle du dossier.
>
> ## Gardes de migration — tester la garde, pas seulement le code (2026-08-24)
>
> `scripts/migration-guards.test.mjs` — **10 tests**. Deux findings sécurité du 2026-08-24 (B-1 et
> B-3 de [`../faille.md`](../faille.md)) sont passés parce que la règle qu'ils enfreignaient ne
> vivait que dans un Markdown. Les gardes ajoutées ce jour-là ne valent que si elles échouent
> vraiment sur la régression qu'elles prétendent attraper : **une garde qu'on n'a jamais vue rouge
> est une intention, pas une garde.**
>
> Chaque cas construit un jeu de migrations minimal dans un dossier temporaire et exécute le script
> réel avec ce dossier comme `cwd` — le script tel qu'il tourne en CI, ni mocké ni ré-implémenté.
>
> ## Tester ce que l'utilisateur obtient, pas ce que le code écrit (2026-08-24)
>
> `src/modules/auth/demo-profile.test.ts` — 10 tests. Ils existent à cause d'un bug qu'aucune
> suite ne pouvait attraper : en mode démo, modifier son profil écrivait dans une clé
> `localStorage` que plus rien ne relisait. Pas d'exception, pas de log — un **succès silencieux**.
> Le seul test qui existait alors vérifiait… que l'écriture atteignait bien cette clé morte.
>
> D'où la forme de ces tests : ils assertent sur `buildDemoUser()`, c'est-à-dire **la valeur que
> l'écran lit**, jamais sur le fait qu'un `setItem` a eu lieu. Un test qui vérifie l'écriture
> valide le mécanisme ; seul un test qui vérifie la lecture valide le résultat.
> Sont couverts, pour les deux sens : la régression détectée, le correctif accepté, le
> re-`GRANT` qui annule un `REVOKE`, le `REVOKE … FROM PUBLIC` qui **ne compte pas** (leçon de la
> mig. `094b`), la réparation par une migration ultérieure, et le cliquet qui ne juge pas
> l'historique.
>
> ## Audit de couverture — 2026-08-14 (⚠️ PÉRIMÉ, cf. encadré)
>
> > 🔴 **Rouverte le 2026-08-25** : la gate est de nouveau rouge, pour une raison **différente**,
> > non plus des seuils posés au-dessus du réel, mais une vague de code non testé qui a fait
> > baisser le ratio sous des seuils, eux, correctement calibrés. Cf. l'encadré en tête de fichier.
> > Le raisonnement ci-dessous reste valide et explique pourquoi on ne baisse PAS les seuils.
>
> > ✅ **Résolu au 2026-08-24 : `npm run test:coverage` ne signalait AUCUNE violation de
> > seuil.** La section ci-dessous décrit l'état d'AVANT la recalibration du 2026-08-18
> > (`functions` 45 → 21, `branches` 60 → 21, `lines`/`statements` 10 → 26, posés au réel mesuré).
> > Elle est conservée pour le raisonnement — « un seuil au-dessus du mesuré ne protège de rien, il
> > casse la CI en continu et rend muettes les gates utiles du même job » —, pas comme état courant.
> > **Ne pas la lire comme un problème ouvert.**
>
> **La gate était rouge par construction, pas par régression.** Les seuils globaux se donnent une
> règle explicite dans `vitest.config.ts` : « posé **sous** le réel mesuré […] à remonter au fil
> des phases (**jamais au-dessus du mesuré courant**) ». Deux d'entre eux la violent :
>
> | Seuil global | Valeur exigée | Réel mesuré | Verdict |
> |---|---|---|---|
> | `lines` | 10 % | **27,0 %** | ✅ conforme à la règle |
> | `statements` | 10 % | **26,4 %** | ✅ conforme |
> | `functions` | **45 %** | **21,4 %** | ❌ posé 2× au-dessus du réel |
> | `branches` | **60 %** | **21,6 %** | ❌ posé 3× au-dessus du réel |
>
> Les seuils par fichier, eux, sont proches de leur cible — sauf un décrochage net :
>
> | Fichier | Exigé | Mesuré |
> |---|---|---|
> | `src/modules/**/mappers.ts` | 95 % statements | 94 % (à 1 point) |
> | `src/modules/**/supabase.repository.ts` | 65 % statements | 58,7 % |
> | `src/lib/avatar-upload.ts` | **100 %** lines | **61 %** (fonctions : 40 %) |
> | `src/lib/hooks/useDebounce.ts` | 80 % branches | 41 % |
> | `src/modules/tasks/hooks.derived.ts` | 85 % branches | 56,5 % |
>
> **Diagnostic** : la couverture réelle (~26 %) n'a pas chuté ; ce sont `functions` et `branches`
> qui ont été fixés à un niveau ambitionné plutôt que mesuré, et `avatar-upload.ts` qui a perdu
> ses tests après la pose d'un seuil à 100 %.
>
> **Deux façons de repasser au vert, et elles ne se valent pas** :
> 1. **Aligner les deux seuils globaux sur le réel** (functions 20, branches 20) et les remonter
>    par paliers. Rétablit la CI en 5 minutes et respecte enfin la règle que le fichier énonce.
> 2. Écrire les tests manquants. C'est le bon objectif de fond, mais passer de 21 % à 45 % de
>    fonctions couvertes n'est pas un correctif de CI, c'est un chantier.
>
> Faire (1) maintenant et (2) ensuite. Une gate rouge en permanence ne protège plus de rien : elle
> apprend à ignorer le rouge.
>
> **Priorité de test, si on écrit des tests** : les repositories Supabase (frontière de sécurité
> anti-mass-assignment, à 58,7 %) et `avatar-upload.ts` (validation MIME + redimensionnement, qui
> neutralise les SVG piégés — à 40 % de fonctions couvertes).

> 🔴 **`npm run test:coverage` échoue (exit 1) sur `main`** — mesuré le 2026-08-14.
> Les tests unitaires passent (à l'exception du cliquet design-system ci-dessus) ; ce sont les **seuils** qui ne sont pas atteints : 13 erreurs,
> dont 2 globales (functions 21,43 % < 45 %, branches 21,62 % < 60 %) et 11 par fichier
> (`avatar-upload.ts`, `supabase.repository.ts`, `mappers.ts`, `hooks.derived.ts`,
> `app-mode.store.ts`, `useDebounce.ts`, `i18n/locale.ts`, `i18n/routes.ts`).
> Couverture globale réelle : **statements 26,4 % · branches 21,6 % · functions 21,4 % · lines 27,0 %**.
> Conséquence : le job CI `lint-test-build` est rouge tant que ce n'est pas traité —
> **ne pas conclure d'un échec de `test:coverage` que ta modification l'a cassé**, mesure la baseline d'abord.

## Vitest — tests unitaires de logique métier pure

Config `vitest.config.ts` (séparée de `vite.config.ts`), environnement `node`. Les tests vivent **à côté** du code testé (`*.test.ts`).

```bash
npm test           # run once (utilisé en CI, bloquant)
npm run test:watch # mode watch
npm run test:coverage # + couverture v8 (seuils par fichier — bloquant CI)
```

### Couverture · mesure du 2026-09-11

✅ **VERTE au 2026-09-14** : **2 586 tests / 228 fichiers**, zéro échec, `exit 0`, aucun seuil
franchi — 31,15 L · 30,73 S · 24,41 F · 26,31 B.

⚠️ **Les pourcentages BAISSENT alors que 116 tests ont été ajoutés** depuis le 09-11 (31,32 L pour
2 470 / 221). Ce n'est pas une régression : le **dénominateur** bouge aussi, du code neuf étant
arrivé avec. Un taux de couverture ne se lit jamais seul, toujours avec le nombre de lignes qu'il
rapporte — sans quoi on « corrige » une baisse qui n'en est pas une, ou on rate une vraie.

*Mesure précédente, conservée :* ✅ **VERTE** : 2 470 tests / 221 fichiers, zéro échec, aucun seuil franchi.

| | 2026-08-29 | **2026-09-11** | Seuil global |
|---|---|---|---|
| Lines | 29,17 | **31,32** | 26 |
| Statements | 28,81 | **30,91** | 26 |
| Functions | 23,41 | **24,56** | 21 |
| Branches | 24,17 | **26,37** | 22 |

🔴 **Le cliquet du glob `supabase.repository.ts` a MORDU le 2026-09-08.** `functions` est tombé
à **89,83 %**, sous son seuil de 90, et la gate est passée au rouge. C'est exactement ce pour quoi
ce cliquet-là existe : il mord avant le plancher global, qui, lui, montait tranquillement.

**Les fonctions manquantes n'étaient pas dispersées, elles étaient datées.** 24 fonctions non
couvertes sur 236, dont six livrées après la campagne de tests du 2026-08-25 :

| Repository | Fonctions non couvertes | Livrées par |
|---|---|---|
| `tasks` | `getDependencies` · `addDependency` · `removeDependency` | mig. **132**, le 2026-08-30 |
| `okrs` | `restoreCompletions` | contrat `useRestoreX` (R-08) |
| `organizations` | `getMyOrgInbox` | mig. **129** + **142** |
| `team-projects` | `addTaskDependency` · `removeTaskDependency` | mig. **108** + **117** |
| `tasks` | `getPendingSharedTasks` · `delete` | antérieures, jamais couvertes |
| `lists` | `getByTaskId` · `delete` | antérieures, jamais couvertes |
| `habits` | `updateHabit` | antérieure, jamais couverte |

❌ **Aucun seuil n'a été baissé.** 126 tests ont été écrits sur ces six fichiers, couvrant
13 fonctions. Le glob est passé de **89,83 → 95,34 %** de fonctions, et **six repositories sont
maintenant à 100 %** (`tasks`, `organizations`, `team-projects`, `habits`, `events`, `categories`).
Restent sous la barre : `lists` (9/12) et `okrs` (28/33).

Les seuils du glob sont **remontés** en conséquence (`vitest.config.ts`), à ~2 points sous le
mesuré, comme le veut la convention du fichier :

| | Avant | **Après** | Mesuré |
|---|---|---|---|
| lines | 88 | **90** | 92,99 |
| statements | 74 | **76** | 78,85 |
| functions | 90 | **93** | 95,34 |
| branches | 63 | **65** | 67,91 |

⚠️ **Les planchers GLOBAUX n'ont PAS été remontés**, et c'est une décision, pas un oubli : leurs
marges valent maintenant 5,32 / 4,91 / 3,56 / 4,37 points. La marge de `functions` était de
**0,32 point** le 2026-08-25 ; elle est confortable pour la première fois. À remonter à la
prochaine mesure verte, pas dans le même geste que celui qui vient de réparer la gate.

⚠️ **Comment mesurer sur cette machine.** Le run prend ~11 minutes, et il **meurt en silence** :
pas de résumé, pas de rapport, pas de message, si une autre session fait tourner sa suite en
parallèle (mesuré six fois le 2026-09-09 : workers qui ne démarrent pas, tests à 30 s de timeout,
processus tué sans trace). Mesurer machine libre, ou dans un worktree isolé, avec
`--maxWorkers=4`. ❌ **Ne jamais conclure d'un run mort que la couverture a baissé** : un run sans
bloc « Coverage summary » n'a rien mesuré du tout.

Couvre la logique pure et testable (pas de DOM, pas de réseau) :
- `src/modules/okrs/progress.test.ts` — `recalcProgress` (moyenne, plafond 100 %, garde anti division par zéro B17, complétion).
- `src/modules/lists/smart-rules.test.ts` — presets `overdue`/`this-week`/`high-priority`, `tasksInList`, `tasksDueToday`.
- `src/lib/pagination.types.test.ts` — `assertValidCursor` (UUID/ISO + rejet injection N6/H-1).
- `src/lib/fetch-all-pages.test.ts` — auto-pagination `getAll` (plafond, pages, erreurs).

Couvre aussi les **mappers de repository** (`src/modules/{tasks,habits,events}/mappers.ts` — frontière sécurité anti-mass-assignment, le `mapToDb` ne doit JAMAIS émettre `user_id`), les **hooks** React Query (jsdom + `@testing-library/react`, repos mockés) et quelques **composants** (`EmptyState`, `AppErrorBoundary`).

**Règles** :
- ✅ Tester en priorité les **fonctions pures** (extraire la logique d'un god component ou d'un repo dans un module pur, puis tester ce module — cf. `okrs/progress.ts`).
- ✅ Fixtures déterministes (`now` figé, pas de `Math.random()` non seedé).
- ❌ Ne pas mettre de test qui dépend du DOM sans `// @vitest-environment jsdom`.
- Cleanup auto via `src/test/setup.ts`. Ne pas remettre les mappers inline dans les repos.

## Playwright E2E — parcours critiques

Dossier `e2e/`, config `playwright.config.ts`.

```bash
npm run test:e2e         # run headless (2 projects : Desktop Chrome + iPhone 12)
npm run test:e2e:ui      # mode debug visuel
npm run test:e2e:report  # rapport HTML
```

**Avant le premier run** : `npx playwright install chromium webkit` (le project
`mobile-safari` utilise WebKit).

> 🔴 **WebKit n'était PAS installé sur le poste de développement** (constaté le
> 2026-09-05 : `Executable doesn't exist at …\webkit-2336`). Tout ce qui a été
> annoncé comme « joué localement » sur `mobile-safari` depuis la création de ce
> project ne l'avait donc **jamais** été — la moitié mobile de chaque chiffre de
> ce fichier venait de la CI, ou de nulle part. Installé depuis.

### Décompte réel — mesuré le 2026-09-14 (`npx playwright test --list`)

**220 cas, 26 specs, 4 projects.**

| Project | Cas | Ce qu'il joue |
|---|---|---|
| `chromium` | **107** | Desktop Chrome, mode démo |
| `mobile-safari` | **96** | iPhone 12 / WebKit, mode démo |
| `supabase-stub` | **16** | Desktop Chrome, **hors mode démo** (cf. plus bas) |
| `supabase-stub-warmup` | **1** | Préalable de chauffe, pas un parcours (cf. plus bas) |

**Ce que la passe du 2026-09-14 a ajouté** : `e2e/stubbed/delete-org.spec.ts`
(4 cas), le parcours nominal de suppression d'entreprise — rembourser, résilier,
supprimer — exigé par **C-39** et jamais joué jusque-là. Il prouve l'ordre en
**retenant la réponse** de l'Edge Function : tant qu'elle ne part pas, aucune
`rpc/delete_organization` ne doit exister. Vu ROUGE sur une mutation de
`useDeleteOrgFlow` avant d'être commité.

✅ **La sonde jetable `e2e/_tmp-probe.spec.ts` est SUPPRIMÉE** (2026-09-14). Elle
était non suivie par git, rouge, et faussait de 2 cas tout recomptage local : la
commande affichait 212 quand le dépôt en portait 210, et l'écart devait être
expliqué à chaque mesure. Local et dépôt disent désormais le même nombre.
⚠️ Ce que cet écart enseignait reste vrai : **un décompte local qu'on recopie
sans regarder ce qui est SUIVI** est exactement la façon dont le précédent est
devenu faux.

⚠️ **`supabase-stub-warmup` n'est pas un parcours** : il compile les deux écrans
du harnais avant que les douze autres cas ne commencent. Le compter avec eux
gonflerait le total d'un test qui ne mesure pas le produit ; le taire ferait
réapparaître un écart entre `--list` et ce fichier. Il est donc compté à part.

**Mesures précédentes**, conservées pour montrer la dérive et pas pour être
recopiées : **190 cas, 23 specs, 3 projects** le 2026-09-05 ; et avant cela
« 62 × 2 = 124, 15/16 specs », qui datait du **2026-08-25** et a été **recopié**
pendant onze jours au lieu d'être remesuré — il était déjà faux de 44 cas et de
2 specs avant tout ajout de septembre. Un total qu'on recopie n'est pas une
mesure.

**Ce que cette passe a ajoutée, et elle seule** : le parcours de remboursement
(C-65, 5 cas, cf. plus bas) et son préalable de chauffe (1). Le reste de l'écart
avec le 2026-09-05 vient des autres chantiers de la fenêtre, et n'a pas été
attribué ligne par ligne — l'attribuer de tête est précisément ce qui produit un
chiffre faux qu'on recopie ensuite.

❌ **Ne jamais écrire ce total sous la forme « N × 2 ».** Les projects ne jouent
plus le même ensemble : `demo-calendar` et `demo-task-dependencies` sont hors de
`mobile-safari` (raison mesurée, cf. ci-dessous), et `e2e/stubbed/**` n'est joué
que par `supabase-stub`. Une multiplication redonnerait un chiffre faux, et
c'est exactement comme ça que le précédent l'est devenu.

Les 3 tests de `demo-touch-gestures.spec.ts` sont `skip` sur chromium
(viewport ≥ 768 px). La CI joue `chromium` **et** `supabase-stub` (mêmes
binaires Chrome) ; `mobile-safari` reste hors CI, WebKit coûtant une minute
d'installation de plus.

🔴 **Un project hors CI est un project qui ne tourne nulle part.** `supabase-stub`
a été ajouté au job `e2e` le 2026-09-05 en même temps que les specs qu'il porte :
sans ça, `FirstRunSetup` et le retour OAuth seraient des gardes posées sur `main`
qui ne s'exécutent jamais — la faute déjà commise deux fois ici.

#### Le project `supabase-stub` — jouer ce que la démo ne peut pas atteindre

`e2e/fixtures.ts` ouvre le mode démo, et **toute garde qui commence par
`!isDemo` était donc structurellement hors de portée de la suite** : `.env` est
vide en local et absent en CI, donc `appModeStore` démarre `isDemo = true` sans
aucun chemin d'exécution pour en sortir depuis le navigateur. `FirstRunSetup`
n'était pas resté sans parcours par oubli — aucun test ne **pouvait** l'atteindre.

Le mode Vite `e2e-stub` (`.env.e2e-stub`, versionné, sans secret) sert l'app avec
deux variables Supabase non vides pointant `stub.cosmo.invalid`, un hôte qui ne
résout pas ; `e2e/supabase-stub.ts` pose une session dans `localStorage` et
intercepte tout ce qui part vers lui. Serveur dédié sur le port **3210**, avec
`reuseExistingServer: false` : réutiliser un serveur trouvé là ferait jouer ces
specs contre une app en mode démo, où l'écran testé ne monte jamais.

- ⚠️ Ce harnais prouve le **parcours client** (quel écran, dans quel ordre,
  quelle requête part avec quel corps). Il ne prouve **rien** du serveur : ni
  RLS, ni triggers, ni forme réelle des réponses PostgREST. Ces frontières-là
  restent celles de `npm run test:rls` et `npm run check:rls`.
- ⚠️ Les specs y ouvrent une page par **`gotoStubbed()`** (`e2e/supabase-stub.ts`),
  jamais par un `page.goto` nu. Trois pièges du serveur de développement y sont
  absorbés une fois pour toutes, et aucun n'est un comportement du produit :
  1. **`load` n'arrive jamais** — le canal Realtime rouvre en boucle un WebSocket
     vers l'hôte stub. Mesuré le 2026-09-05 : `page.goto` expirait à 120 s sur
     une page rendue depuis 25 s.
  2. **`domcontentloaded` non plus, au premier passage** — Vite découvre les
     dépendances de la page, les pré-empaquette et **recharge**, et l'événement
     se perd dans ce rechargement. Mesuré le 2026-09-08 : 240 s d'attente sur une
     page qui finissait par s'afficher. D'où `waitUntil: 'commit'`, qui rend la
     main dès la réponse — c'est ensuite l'attente d'une **ancre réelle** qui dit
     que la vue est là.
  3. **Un `import()` de route qui échoue pendant une re-optimisation** (« Failed
     to fetch dynamically imported module ») : l'`AppErrorBoundary` prend la main
     et la page reste vide, définitivement. Une nouvelle **tentative** la
     rattrape — ce n'est pas une attente plus longue qu'il faut.
  ❌ **Ne jamais transformer ce rattrapage en boucle illimitée** : il est borné
  (3 tentatives, 5 pour la chauffe), sans quoi il finirait par masquer une vraie
  panne du produit.

#### Le préalable de chauffe (`supabase-stub-warmup`)

Ce serveur a **son propre cache de dépendances** (`node_modules/.vite-e2e-stub`,
posé par `vite.config.ts`). Ce n'est pas un confort : partagé avec celui du
serveur du port 3000, dont le mode et les alias diffèrent, chacun invalidait le
cache de l'autre et se **redémarrait en boucle**, servant une page blanche
(« The server is being restarted or closed », mesuré le 2026-09-08).

Conséquence : en CI il démarre toujours à froid, et ce coût tombait entièrement
sur le **premier cas exécuté**. Mesuré, cache vide : onze cas verts, un rouge,
toujours le premier — tantôt une page restée vide plus de trois minutes, tantôt
deux mutations arrivées dans le désordre parce que la machine était saturée. Ce
n'était pas ce cas-là qui était fragile, c'était **la place qu'il occupait**.

Le project `supabase-stub-warmup` (`e2e/stubbed/_warmup.spec.ts`) compile les
deux écrans du harnais avant tout, et `supabase-stub` en **dépend** : si la
chauffe échoue, aucun parcours n'est joué. Coût mesuré le 2026-09-11, cache
vide : **3,5 min**, puis 6 à 45 s par parcours.

❌ **La mauvaise réponse aurait été de gonfler les tolérances du premier test**
jusqu'à ce qu'il passe : ça déplace le seuil sans nommer la cause, et ça rend le
détecteur muet le jour où l'écran est vraiment lent.

#### C-65 — le parcours de REMBOURSEMENT (`e2e/stubbed/refund.spec.ts`, 5 cas)

C-27 exigeait nommément ce parcours : « C-65 touche de l'argent, il ne part pas
sans son parcours E2E ». Il manquait pour une raison **structurelle** : le bouton
n'est monté nulle part tant que `ENTERPRISE_BILLING_ENFORCED` vaut `false`, et le
mode démo rend `null` pour tout abonnement d'organisation.

🔴 **Le drapeau est retourné par une substitution de MODULE, jamais par une
variable d'environnement.** `vite.config.ts` remplace
`@/modules/billing/premium-config` par `e2e/stubs/premium-config.e2e-stub.ts`
**dans le seul mode `e2e-stub`** ; ce module réexporte le produit (`export *`) et
ne change qu'un booléen. C'est le même geste que le `vi.mock(…, importOriginal)`
du test unitaire, au niveau du bundler. Faire dériver le drapeau d'un
`import.meta.env` aurait cassé la règle écrite du dépôt — « le flag est la SEULE
condition » — dans le produit livré, pas seulement dans les tests.

Ce que les 5 cas prouvent, sur l'app réelle, avec le vrai routage et le vrai
catalogue :

| Cas | Ce qu'il mesure |
|---|---|
| mensuel | un seul appel à `stripe-org-refund`, authentifié, corps `{ orgId }` **sans aucun montant** ; montant affiché = celui du serveur ; résiliation visible **sans rechargement** ; plus aucun bouton pour recommencer ; zéro écriture cliente dans `org_subscriptions` |
| annuel | même chose au **prorata des mois entiers** restants |
| échec Stripe | le message dit « rien n'a été résilié », **aucun montant** n'est annoncé, et l'écran reste dans l'état d'avant — donc on peut réessayer |
| non-propriétaire | `?tab=billing` tapé à la main retombe sur l'aperçu, aucun appel ne part |
| témoin | rien n'a quitté le stub vers un vrai projet Supabase |

⚠️ **Les deux montants ne sont pas écrits à la main** : la spec importe
`supabase/functions/_shared/refund-amount.ts` — le module que l'Edge Function
appelle — et vérifie que l'écran affiche exactement ce qu'il décide. Un montant
en dur dans le test ferait de lui une **seconde définition** de la règle de
remboursement, exactement le risque qui a imposé `org-tiers.parity.test.ts`.
La spec épingle aussi la `reason` rendue (`monthly_full`, `yearly_prorata`), sans
quoi les deux cas pourraient mesurer la même branche sans que rien ne le dise.

🔴 **Ce que ce parcours NE prouve PAS, et qu'aucun test de ce poste ne peut
prouver** : `refunds.create`, l'ordre « rembourser d'abord, résilier ensuite », la
clé d'idempotence dérivée de l'`invoice_id`, le pré-contrôle qui retranche, et la
ligne compensatoire écrite par `stripe-webhook`. La clé Stripe du projet est une
clé de **test**, `org_subscriptions` est vide, il n'existe aucune facture à
rembourser, et `APP_URL` épingle l'origine CORS sur la production.
❌ **Ne pas déployer C-65 en s'appuyant sur ce fichier seul.**

⚠️ Le cas d'échec se lit deux fois : c'est le **stub** qui décide de ne rien
résilier, donc il ne mesure pas le serveur. Ce qu'il mesure est une propriété du
**client**, et elle n'était pas acquise : sur un échec, l'écran ne doit pas
anticiper une résiliation qui n'a pas eu lieu.

#### Ce qui n'est PAS joué sur `mobile-safari`, et pourquoi

`demo-calendar` et `demo-task-dependencies` visent un DOM qui n'est pas forké par
viewport. Ce qui diffère, c'est la navigation pour l'atteindre : mesuré le
2026-09-05 sur `/tasks` en 390 px, ni « Tout replanifier » (bandeau des tâches en
retard) ni « Sélectionner » (barre d'actions groupées) n'existent, et la carte
mobile n'offre pas de menu de ligne équivalent. 🔴 **C'est un écart de produit,
pas un verdict de conformité mobile** — il est nommé dans `playwright.config.ts`
plutôt que caché derrière un `skip` silencieux.

🔴 **Depuis le 2026-09-23, `a11y-keyboard-audit` non plus** (`C-111`). Ses assertions encodent la
navigation séquentielle de **Chromium** : point de départ de la tabulation après un lien
d'évitement, entrée du focus dans une confirmation empilée. WebKit les implémente autrement :
**11 cas rouges** en CI depuis que `mobile-safari` y tourne (2026-09-16), dont des cas à 1 280 px,
donc sur l'interface de bureau. Et sur iPhone, Tab n'existe qu'avec « Accès complet au clavier »,
que Playwright n'émule pas. Ses cas à 375 px restent joués sous `chromium`.
❌ **Ce retrait ne dit PAS que Safari est accessible au clavier** : aucun audit clavier Safari
n'existe, et une partie de ces 11 échecs peut être un vrai défaut. C'est `C-118`.

⚠️ **Six autres specs supposaient le bureau, et ont été rendues adaptatives plutôt que retirées**
(2026-09-23) : le bouton « Créer » de l'en-tête mobile (`demo-create-task`), un pourcentage OKR
**visible** plutôt que le premier du DOM (`demo-journeys`), la liste de tâches repliée de l'agenda
d'un membre (`demo-entreprise-session-fixes`), le bouton flottant « Nouvelle habitude » et un
viewport de bureau porté par le test pour les deux déclencheurs qui n'existent qu'au-dessus de
768 px (`reduced-motion-sheets`). Et un vrai défaut en est sorti : les cases de la grille
d'habitudes mobile n'avaient **aucun nom accessible une fois cochées**, ni d'état exposé
(`HabitCard`, corrigé : `role="checkbox"`, `aria-checked`, nommées par l'habitude et le jour).

Les 4 specs de la vague entreprise couvrent le mode entreprise, arrivé jusque-là
sans E2E : `demo-entreprise-dependencies` (9), `demo-entreprise-tasks-tab` (5),
`demo-entreprise-session-fixes` (5), `demo-entreprise-okr-modal` (2).

#### Les parcours ajoutés le 2026-09-05 (C-27)

| Spec | Cas | Ce qu'elle ferme |
|---|---|---|
| `stubbed/first-run.spec.ts` | 5 | `FirstRunSetup` : la garde s'ouvre sur un compte vide, **chaque étape écrit au moment où elle est validée** (mesuré sur les requêtes parties, pas sur un état React), la première tâche part sans échéance, l'accueil ne revient pas |
| `demo-calendar.spec.ts` | 7 | Le calendrier COSMO sur ses **six** surfaces, plus `minDate` du report en masse et le focus au clavier dans la grille (défaut React 18 / `forwardRef`) |
| `demo-task-dependencies.spec.ts` | 2 | Graphe **personnel** (mig. 132) : poser une arête et la relire, refuser un cycle **indirect à trois maillons**, ne jamais se proposer soi-même, retirer ; « Créer et lier » |
| `demo-billing-disarmed.spec.ts` | 1 | Tant que `ENTERPRISE_BILLING_ENFORCED` est `false`, aucun CTA de paiement ni de remboursement n'est atteignable |

Les quatre premiers cas ont été **vus rouges avant d'être verts** : différer les
créations de `FirstRunSetup` à la dernière étape fait tomber le premier ; le
calcul du montant remboursé refait côté client fait tomber deux cas du parcours
de remboursement.

Les fichiers `e2e/rls/*.test.ts` ne sont **pas** des specs Playwright : ce sont
des tests Vitest d'intégration (`npm run test:rls`, job CI `rls-integration`,
stack Supabase locale). Ils sont **6** au 2026-08-25 : `tasks`, `get-my-tasks`,
`shared-tasks`, `org-helpers-not-exposed`, `org-subscriptions`, et
`org-permissions` (mig. 115).

**Architecture** :
- `e2e/fixtures.ts` : fixture `demoPage`. Clean localStorage/cookies → pose
  `cosmo_cookie_consent` → goto / → clic CTA « Essayer maintenant — sans
  inscription » → attend `/dashboard` → neutralise les flags
  `cosmo_tutorial_seen_*_(desktop|mobile)`.
- Tests smoke : `demo-create-task.spec.ts` (création réelle de bout en bout),
  `demo-toggle-habit.spec.ts`, `demo-create-okr.spec.ts` +
  `demo-journeys.spec.ts` (mutation + persistance SPA).

**Règles** :
- ✅ Naviguer via **clic sur les NavLink** (`navTo`) : ça teste au passage que le
  lien existe. `page.goto()` est néanmoins **sûr** — le mode démo est persisté
  (`cosmo_demo_active`, cf. `src/lib/app-mode.store.ts`) et `AuthContext` le
  restaure au reload. À utiliser pour une route sans lien de nav (ex. `/premium`
  quand `PREMIUM_ENFORCED=false`).
- ✅ `baseURL` aligné sur `npm start` (port **3000**). `reuseExistingServer: true`
  — ⚠️ **un serveur périmé qui squatte le port 3000 est réutilisé silencieusement**
  et fait échouer toute la suite. Vérifier le port avant d'incriminer une spec.
- ✅ Pas de sélecteur CSS `:has-text("..." i)` — utiliser `[data-sonner-toast][data-type="error"]`.
- ✅ **Toujours `filter({ visible: true })`** : desktop (`<table>`) et mobile
  (`TaskCard`) coexistent dans le DOM via `hidden md:block` / `md:hidden`, donc
  `.first()` résout volontiers un élément **caché**.
- ✅ `filter({ visible: true })` ≠ « dans le viewport ». Avant un geste
  `page.mouse` (qui ne scrolle PAS), appeler `scrollIntoViewIfNeeded()`.
- ✅ Cases de complétion de tâche : utiliser `TASK_TOGGLE*` de `fixtures.ts`.
  Desktop = `role="checkbox"`/`aria-checked`, mobile = `<button aria-pressed>` —
  **aucun rôle ARIA commun**, seul l'`aria-label` est partagé.
- ✅ Scoper au sheet (`[data-mobile-more-sheet]`) pour cliquer un item du menu
  « Plus » : la page reste montée derrière et ses contrôles matchent les mêmes noms.
- ⚠️ Le **toaster Sonner** (`z-index: 999999999`) couvre y≈16→90 sur mobile et le
  rappel « N en retard » ne se ferme pas seul : ne jamais cliquer un point fixe
  en haut de l'écran.

## i18n — gardes de catalogues

```bash
npm run i18n:check  # parité des clés fr ↔ en (bloquant CI). Manquante ET orpheline = erreur.
npm run i18n:scan   # détecte les chaînes en dur non externalisées
```

`fr` est le catalogue de référence : le moteur retombe clé par clé sur lui, donc
un catalogue traduit incomplet n'affiche jamais de clé brute — et ne se voit pas
non plus. `i18n:check` est la seule protection réelle contre un catalogue parti
en prod à moitié traduit. Locales présentes : **fr, en** (`src/locales/`).

## Playwright A11y — `e2e/a11y-audit.spec.ts`

Scan automatique `@axe-core/playwright` sur **11 routes** : `/`, `/login`,
`/dashboard`, `/tasks`, `/habits`, `/okr`, `/agenda`, `/entreprise`,
`/statistics`, `/settings`, `/premium`. Tags WCAG 2.0/2.1 A + AA + best-practice.

```bash
npx playwright test e2e/a11y-audit.spec.ts --project=chromium
```

- Dumpe les violations dans `test-results/a11y/<route>.json`.
- **Bloquant sur `impact: 'critical'`** (`assertNoCritical` → `toHaveLength(0)`).
  Les niveaux `serious`/`moderate`/`minor` sont dumpés mais non bloquants
  (roadmap A-7/A-8/A-10). Une régression `critical` casse donc la CI : c'est ce
  guard qui a détecté le `button-name` manquant sur l'avatar de `SettingsPage`.

## CI (`.github/workflows/ci.yml`, 5 jobs)

- `lint-test-build` — lint, `tsc -b`, `validate:migrations`, `check:rls`,
  `i18n:check`, `test:coverage` (seuils par fichier), build.
  🔴 **Rouge au 2026-08-25**, cf. l'encadré de couverture en tête de fichier.
- `audit` — `npm audit --omit=dev --audit-level=high` (bloque sur CVE prod)
- `e2e` — Playwright, project `chromium` uniquement
- `rls-integration` — stack Supabase locale (`supabase start`), rejoue **toutes**
  les migrations sur base vierge (`scripts/apply-migrations.mjs`) puis `npm run test:rls`
- `lighthouse` *(ajouté le 2026-08-25)*, `lighthouserc.json`, LCP / TBT / CLS / a11y / SEO sur
  les 4 routes **prérendues** (`/`, `/guide`, `/blog`, `/pour-freelances`). Bloquant sur a11y,
  SEO et CLS ; **avertissement** sur la performance, qui varie avec le runner.
  ⚠️ **Seuils provisoires** : Lighthouse a besoin d'un Chrome exécutable, absent de la machine de
  développement, ils n'ont donc pas pu être posés « au réel mesuré » comme tous les autres budgets
  du dépôt. **À resserrer après le premier run réel**, un budget très au-dessus du réel ne mesure
  rien.
- `concurrency` annule les runs obsolètes, `permissions: contents:read`. Dépendances : `.github/dependabot.yml`.

### `edge-deploy-drift.yml` · le code déployé contre le dépôt *(ajouté le 2026-09-04, finding C-35)*

`npm run check:edge` télécharge le bundle de **chaque Edge Function réellement déployée** et le
compare octet pour octet à `supabase/functions/`, dans les deux sens, modules `_shared/` importés
compris. Quotidien à 05:41 UTC **et** à chaque push touchant `supabase/functions/` : une dérive de
déploiement naît d'un déploiement, qui n'événemente rien ici, pas d'un commit.

Ce que ça a fermé : le 2026-09-03, les trois sources en ligne divergeaient toutes les trois de
`main`. Rien ne regardait, donc rien n'avait jamais rien dit.

- 🔴 **Secret absent = échec.** Pas de `if: secrets.X != ''`, pas de valeur de repli, pas de
  `continue-on-error`. La règle est écrite dans `CLAUDE.md` et a déjà été violée deux fois.
- `.github/edge-deploy.json` déclare quelle fonction du dépôt n'est **pas encore** en ligne, avec sa
  raison et sa date. ❌ Il ne couvre que l'existence : aucune divergence de contenu ne peut être
  éteinte depuis ce fichier, et une fonction qu'il dit non déployée alors qu'elle est en ligne fait
  échouer la garde.
- **Témoin** : `scripts/check-edge-deploy.guard.test.mjs`, 18 cas, ramassés par `npm test` et
  rejoués par le job en `always()`. Vérifiés en sabotant le comparateur **cinq fois** : comparateur
  qui ne trouve jamais rien (6 rouges), comparateur borgne (1), lecture vide acceptée comme
  « identique » (2), secret absent dégradé en `::warning::` + exit 0 (1), normalisation trop polie
  (2). Un témoin qu'on n'a pas vu échouer n'est pas un témoin.
- ⚠️ **Le lecteur n'a pas encore tourné** : `supabase functions download` exige un
  `SUPABASE_ACCESS_TOKEN`, absent de la machine de développement. Le premier run de CI est la
  vérification. `assertReadSomething()` refuse un bundle vide ou sans entrypoint reconnaissable :
  une lecture ratée est une **erreur**, jamais un « identique au dépôt ».
- Runbook deploy/rollback : [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Checklist avant push prod

Avant `git push` sur `main` (qui déclenche le deploy Vercel) :

1. ✅ `npm run lint` → **0 erreurs** (les warnings préexistants sont OK)
2. ✅ `npm test` → **tous les tests unitaires Vitest passent** (bloquant CI)
3. ✅ `npm run build` → succès. Aucun chunk first-paint > **150 kB gzip** (sauf `vendor-charts` lazy attendu).
4. ✅ `npm run test:e2e` → **190 tests** sur 23 specs et 3 projects (96 chromium,
   87 mobile-safari, 7 supabase-stub — mesure du 2026-09-05, cf. § Playwright),
   3 skip attendus (gestes tactiles sur chromium). Ports **3000** (démo) et
   **3210** (`e2e-stub`) — vérifier qu'aucun dev server périmé ne les squatte.
   ⚠️ Le 3210 refuse volontairement de réutiliser un serveur existant : une
   collision doit échouer, pas passer en mesurant la mauvaise app.
   ❌ Ne pas recopier ce nombre : le remesurer avec `npx playwright test --list`.
5. ✅ **Smoke test mobile preview** 375×812 : login démo → Dashboard, créer/compléter une tâche (clic + swipe droit), navigation Tab bar, rien caché derrière la MobileTabBar.
6. ✅ **Si touche `recordKRCompletion()`** : vérifier le graphique dashboard en démo ET en prod.
7. ✅ **Si touche un modal** : drag-to-close, ESC, clic backdrop.
8. ✅ **Si touche un popover** : clipping (overflow parents), z-index vs sidebar+tabbar, position au resize/scroll.
9. ✅ **Si touche un tutoriel** : desktop ET mobile (flags distincts), vérifier que les `data-tutorial-id` existent.
10. ✅ **Si touche une page nouvelle** : `min-h-[100dvh]` + `pb-[calc(...)]` + landmark `<main>` (A-5) + h1 visible.
11. ✅ **Si touche `supabase/migration/*.sql`** : checklist [`SECURITY.md`](./SECURITY.md). Vérifier `mcp__supabase__get_advisors`.
12. ✅ **Si touche `supabase/functions/*.ts`** : présence de `supabase/config.toml` (M-10), puis
    **déployer** (`supabase functions deploy <slug>`), car un correctif committé et non déployé est
    exactement le finding C-35. `npm run check:edge` le dira, mais après coup.
13. ✅ **Si touche un `<button>` icon-only, un `<input>`, ou ajoute une page publique** : relancer le scan a11y (Critical = 0).
14. ✅ **Si suspicion de bug iOS Safari** : tester avec `?debug=1` (Eruda).

---

## Vitest, couverture, RLS et Playwright · repris de `CLAUDE.md` (déplacé le 2026-09-16)

> Commentaires de la section `## Scripts` de `CLAUDE.md`, où ils étaient chargés à chaque
> session. Déplacés ici **sans une coupe**. La racine ne garde que la commande.

```bash
npm test           # Vitest (run once) — CHAQUE chiffre ci-dessous porte sa date.
                   # 🔴 2026-09-22 — LE PIEGE DU `$?` APRES UN PIPE A REJOUE,
                   #    et il a laisse partir un commit qui NE COMPILE PAS.
                   #    Forme fautive, repetee toute la session :
                   #        npx tsc -b 2>&1 | tail -3 ; echo "TSC=$?"
                   #    `$?` rend le code de sortie de `tail`, TOUJOURS 0.
                   #    Le commit a33005b9 annonce « tsc 0 » et portait deux
                   #    TS7006 dans design-system.guard.test.ts : le job CI
                   #    lint-test-build aurait ete ROUGE. Corrige apres coup.
                   #    ✅ La forme juste, et la seule :
                   #        npx tsc -b > t.log 2>&1 ; echo "EXIT=$?"
                   #    ⚠️ C'est la regle 1 de CLAUDE.md (« lire `$?` »), deja
                   #    ecrite, deja payee. Une regle connue ne protege pas
                   #    d'une COMMANDE qui la contourne sans en avoir l'air.
                   # 🔵 MESURE DU 2026-09-22 (545 s) :
                   #    243 fichiers, 2 789 cas + 1 saute, exit 0.
                   #    +3 fichiers / +30 cas depuis la veille, dont le temoin
                   #    de C-69 (rotation-state.guard.test.ts, 13 cas) et les
                   #    4 cas de la garde « poignee sans geste » (C-07).
                   #    ⚠️ Meme reserve qu au 09-21 : ARBRE SALE, cinq fichiers
                   #    d une session voisine. Ce n est pas une mesure de main.
                   # Mesure precedente : 2026-09-21, 09:44 -> 09:50 (379 s),
                   #    240 fichiers, 2 759 cas + 1 saute, exit 0.
                   #    ⚠️ MESUREE SUR UN ARBRE SALE, et ca compte : cinq fichiers d'une
                   #    session voisine etaient modifies et non commités (HabitActionsMenu,
                   #    les deux catalogues habits, demo-profile.test.ts, restore.hooks.ts,
                   #    restore-id.guard.test.ts). Ce n'est donc PAS une mesure de `main`,
                   #    et l'ecart avec les 239 / 2 720 annonces par 2b4c4304 s'explique
                   #    par la, pas par une regression. Une mesure avant/apres ne vaut que
                   #    si HEAD est identique aux deux bouts.
                   # Mesure precedente : **2 603 tests / 229 fichiers**, ZERO echec
                   # (mesure du 2026-09-15 EN CI, run 34945082906, job lint-test-build).
                   # 🔴 LE TOTAL AFFICHE EST CELUI DES FICHIERS COLLECTES, PAS DES
                   # FICHIERS EXISTANTS. Mesure du 2026-09-15 sur ce poste, avec un
                   # `--maxWorkers=4` qui ecrasait la borne de C-47 : « 225 passed
                   # (225) », **exit 1**, et QUATRE fichiers n'avaient jamais demarre :
                   #   Failed to start forks worker ... Timeout waiting for worker
                   #   AuthForm.confirmation · FirstRunSetup · OrgBillingTab.refund.parcours
                   #   · use-modal-a11y.guard  (ce dernier porte les TROIS temoins de C-53)
                   # ✅ VITEST FAIT SON TRAVAIL : il sort en **exit 1** et imprime un bloc
                   # `Unhandled Errors` (« this might cause false positive tests »). Ce qui
                   # a failli le 2026-09-15, c'est la LECTURE : la ligne de resume dit
                   # « 225 passed » et ne dit pas qu'il en manque quatre. La meme session a
                   # publie « exit 0 » dans trois documents avant de relire le `$?` qu'elle
                   # avait elle-meme imprime.
                   # ❌ NE JAMAIS conclure d'une ligne de resume. Lire `$?`, puis comparer
                   # le nombre annonce au perimetre du glob (src/** + scripts/** +
                   # eslint-rules/**), soit 229 a cette date.
                   # 🔴 LA CAUSE ETAIT UN CONSEIL DE CE FICHIER : `--maxWorkers=4`,
                   # ecrit plus bas, ecrasait le `maxWorkers: 2` que C-47 a pose exactement
                   # pour empecher ca. Corrige le 2026-09-15.
                   # Mesure precedente : 2 586 / 228, le 2026-09-14 au soir (suite complete).
                   # (mesure du 2026-09-14 au soir, machine libre, ~5 min).
                   # Mesure precedente : 2 051 / 179, le 2026-09-02.
npm run test:coverage       # + couverture v8, seuils globaux et par fichier
                            # ✅ VERTE au 2026-09-14 : 31,15 L · 30,73 S · 24,41 F · 26,31 B
                            # (2 586 tests / 228 fichiers, zero echec, exit 0).
                            # Mesures precedentes : 31,32 L le 2026-09-11 (2 470 / 221),
                            # 29,17 L le 2026-08-29.
                            # ⚠️ Les pourcentages BAISSENT legerement alors que 116 tests
                            # ont ete AJOUTES : le denominateur a bouge aussi (code neuf
                            # non couvert). Un taux de couverture ne se lit jamais seul,
                            # toujours avec le nombre de lignes qu'il rapporte.
                            # ❌ NE JAMAIS baisser un seuil pour repasser au vert.
                            # 🔴 Le cliquet du glob `supabase.repository.ts` A MORDU le
                            # 2026-09-08 : `functions` est tombe a 89,83 %, sous son seuil
                            # de 90. Il a fait son travail, et les fonctions manquantes
                            # etaient DATEES, pas dispersees : dependances de taches
                            # personnelles (mig. 132), `restoreCompletions` (R-08),
                            # `getMyOrgInbox` (mig. 129 + 142), et les deux ecritures de
                            # dependances d'equipe. Du code de septembre livre sans test
                            # de repository. 13 fonctions couvertes (126 tests), glob
                            # remonte a 95,34 % ; AUCUN seuil baisse.
                            # ⚠️ La marge la plus serree reste `functions`, mais elle n'est
                            # plus critique : 3,56 pt contre 0,32 le 2026-08-25. La relancer
                            # APRES chaque vague de features, pas quand on y pense.
                            # ⚠️ Sur cette machine le run prend ~11 min. Mesurer quand la
                            # machine est libre, ou dans un worktree isole.
                            # 🔴 NE JAMAIS PASSER `--maxWorkers` EN LIGNE DE COMMANDE.
                            # Cette ligne a conseille `--maxWorkers=4` jusqu'au 2026-09-15,
                            # et c'est un conseil ANTERIEUR au finding C-47 qui ECRASE la
                            # borne que C-47 a posee : `vitest.config.ts` fixe
                            # `maxWorkers: 2` parce que 4 jsdom concurrents saturent les
                            # 8 Go de cette machine, et qu'un worker qui ne repond plus est
                            # compte comme un echec sans avoir execute un seul cas.
                            # Le 2026-09-15, une session a suivi ce conseil : QUATRE fichiers
                            # n'ont jamais demarre (`Failed to start forks worker ... Timeout
                            # waiting for worker`), dont `use-modal-a11y.guard.test.tsx` qui
                            # porte trois TEMOINS. La suite a rendu « 225 passed (225) » et
                            # EXIT 1.
                            # ✅ Vitest a fait son travail : il SIGNALE (exit 1, et un bloc
                            # `Unhandled Errors`). C'est la lecture qui a failli, pas l'outil,
                            # et la meme session a d'abord publie « exit 0 » dans trois
                            # documents avant de relire le code de sortie qu'elle avait
                            # elle-meme imprime.
                            # ❌ Ne JAMAIS conclure d'une ligne de resume : lire `$?`.
                            # ✅ PREUVE, meme machine, meme arbre, le 2026-09-15 :
                            #   avec --maxWorkers=4 : exit 1, 225 fichiers, 4 workers morts
                            #   sans drapeau        : exit 0, 229 fichiers, 2 603 cas,
                            #                         0 unhandled error, 576,6 s
                            # Le drapeau ne rendait pas la suite plus rapide, il la rendait
                            # INCOMPLETE. Et le compte sans drapeau est exactement celui de
                            # la CI.
                            # Voir docs/TESTING.md
npm run test:rls   # Tests d'intégration RLS (stack Supabase locale), 7 fichiers verts
npm run test:e2e   # Playwright (+ :ui, :report)
                   # 236 cas / 26 specs a HEAD, 237 / 27 dans l'arbre (le project
                   # `mobile-safari-warmup` et son fichier ne sont pas suivis par git).
                   # RECOMPTE le 2026-09-15 : chromium 115, mobile-safari 105,
                   # supabase-stub 17. Les +16 viennent de C-80 : 8 pages publiques
                   # entrent dans `touch-targets.spec.ts`.
                   # 🔴 LES 105 CAS `mobile-safari` NE TOURNENT DANS AUCUN WORKFLOW a
                   # cette date. C-78 est ECRIT mais PAS COMMITE : `git show
                   # HEAD:.github/workflows/ci.yml` lance toujours
                   # `--project=chromium --project=supabase-stub`.
                   # Mesure precedente : 220 cas / 26 specs / 4 projects, RECOMPTE le 2026-09-14 par
                   # `npx playwright test --list`. Repartition : 107 chromium,
                   # 96 mobile-safari, 16 supabase-stub, 1 prealable de chauffe.
                   # Mesure precedente, le 2026-09-11 : 210 / 25 (103 / 94 / 12 / 1).
                   # ⚠️ La sonde jetable `e2e/_tmp-probe.spec.ts`, non suivie par
                   # git, a ete SUPPRIMEE le 2026-09-14 : elle faussait tout
                   # recomptage local de 2 cas, et elle etait rouge.
                   # ❌ Ne JAMAIS ecrire ce total en « N x 2 » : les projects ne
                   # jouent plus le meme ensemble. C'est exactement comme ca que le
                   # precedent (« 62 x 2 = 124 », du 2026-08-25) est devenu faux, et
                   # il a ete RECOPIE pendant onze jours au lieu d'etre remesure.
                   # Methode et detail par project : docs/TESTING.md § Playwright
```
