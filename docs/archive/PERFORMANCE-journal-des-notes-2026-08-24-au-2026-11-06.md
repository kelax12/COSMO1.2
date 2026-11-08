> ⚠️ **ARCHIVE : journal des notes de performance, mesures LCP/TBT et récits d'incident (2026-08-24 → 2026-11-06), extrait de `docs/PERFORMANCE.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/PERFORMANCE.md`](../PERFORMANCE.md). Les notes /100 ont cessé (ADR 0012) : l'état de santé se lit dans [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

## Note de performance : 68 → 64 → 88 → 91 → 94 → 92 → 97 → 95 → 90 → 93 → 93 → 92 → 94 → 95 → 96 → 96 → 96 → 95 → 95 → 97 → **97 / 100** (2026-08-24 → 2026-08-27 → 2026-08-29 → 2026-09-03 → 2026-09-14 → 2026-09-14 soir → 2026-09-16 → 2026-09-22 soir → 2026-10-01 → 2026-10-02 soir → 2026-10-03 → 2026-10-15 → 2026-10-16 → 2026-10-16 (soir) → 2026-10-18 → 2026-10-20 → 2026-10-22 → 2026-10-25 → **2026-11-06**)

> ### ⚪ 2026-11-06 · 0 : deux plafonds relevés, sur arbitrage écrit
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-11-06 : CI de `main` du 2026-10-26 au 2026-11-06 (75 runs, dernier `e2e` complet vert à `ba169ba1`), workflows planifiés relus run par run, production (advisors par l'API, catalogue, Edge Functions), alertes GitHub, dépôt à `c3294936` puis `d938bc6e`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-11-06 |
> |---|---|---|
> | `legalTerms` 10 300 → 11 000 (2026-10-25) → **14 000** (2026-11-02, `79b92335`) ; `legal` 3 500 → 3 800 (2026-10-25, `4464e917`) | 0 | relevés sur décision d'Axel écrite au-dessus de la constante dans `scripts/check-bundle-budget.mjs` : texte légal obligatoire (CGV de vente du 2026-11-01, médiation L616-1), chargé par la seule page CGU, 13,4 ko sur deux chunks. Un arbitrage motivé et daté sur un chunk paresseux, pas un plafond déplacé en silence. ⚠️ Le cliquet ne dira plus rien d'une croissance de ces chunks sous 14 000 |
> | `check:bundle` | 0 | vert à `074aa8c8` (étape de `lint-test-build`) |
> | `lighthouse` | 0 | rouge à `ba169ba1` (code de sortie seul, aucune annotation), vert à `074aa8c8`, `c3294936` et `d938bc6e`. LCP non relu URL par URL par cette passe |
>
> **97 → 97.**

> ### ⚪ 2026-10-22 · 0 : deux rouges réparés, le LCP mobile perdu sur six URLs
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-10-22 : CI de `main` à `d16de29a` (run `39843255180`, cinq jobs verts ; `main` rouge du 10-20 à 22:03 au 10-22 à 14:39, 19 runs), `Visual` vert à `fb83cd60`, production (advisors par l'API, catalogue, ledger, cron, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-22 |
> |---|---|---|
> | ✅ `OrganizationPage` au-dessus de son cliquet (−1 le 10-20) | **+1** | `e4369b70` : ce qui ne sert qu'en mode édition chargé en `lazy`. **16,8 / 18,0 ko** à `d16de29a`, budget vert en CI |
> | ✅ TBT mobile de la page entreprise (−1 le 2026-10-16 au soir, 350 à 934 ms) | **+1** | PR n° 91 (`263154b6`, bas du parcours monté au premier geste) : **30, 200 et 152 ms** sur les trois runs de `main` qui la portent (`c2959ded`, `1db47acf`, `d16de29a`), **927 ms** au dernier run sans elle (`1234f807`). Perf mobile 95 à 97 |
> | 🔴 LCP mobile de 4,5 à 6,0 s sur six URLs sur huit | **−2** | **1,36 à 1,52 s sur les 8 URLs** le 2026-10-18 ; le 2026-10-22, quatre runs concordants : `/guide/` 5,4 à 5,6 s, `/blog/` 5,0, article OKR 5,3 à 5,4, `/pour-freelances/` et `/a-propos/` 4,5 à 4,6, **`/en/` 5,9 à 6,0 s** ; `/` 1,6 s, page entreprise 2,3 à 2,4 s. Cause : `26a0faac` remplace le texte peint des pages de contenu par un spinner, arbitré par Axel sur une mesure **locale** (« 2,4 à 3,4 s, 4,8 sur `/guide/` ») que la CI dément. `/en/` n'est couverte par aucun arbitrage : même copie `#lp-hero` que `/`, LCP ×4. La garde ne fait qu'**avertir** (`largest-contentful-paint` en `warn` à 4 500 ms), et cinq URLs dépassent même ce seuil. Le +1 « LCP mobile » du 10-16 est repris ici et dans [`MOBILE.md`](../MOBILE.md) |
> | Marges serrées | 0 | `vendor-utils` 0,4 % ; la PR n° 113 les rouvre en **allégeant** les chunks (`StatisticsPage`, `AgendaPage`) et en **abaissant** deux cliquets, non fusionnée |
>
> **95 → 95.**

> ### 🟠 2026-10-20 · −1 : le cliquet de `OrganizationPage` dépassé depuis 26 h
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-10-20 : CI de `main` à `86ea357f` (run `39408311331` : `lint-test-build` et `e2e` rouges, trois jobs verts ; **29 runs rouges de suite** depuis `a9db6f2c`), `Visual` rouge, production (advisors par l'API, catalogue, ledger, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](README.md).
>
> | Item | Effet | Mesuré le 2026-10-20 |
> |---|---|---|
> | 🔴 `OrganizationPage` au-dessus de son cliquet | **−1** | **18,2 ko** à `08bce3d4` (Aperçu en widgets), **19,1 ko** à `86ea357f`, pour un plafond de 18,0 ko posé au poids du 2026-09-20 (16,7 ko). Le chunk a continué de grossir sur 22 commits après le premier rouge. Levier : `AddWidgetPage`, `TemplatePicker` et le carrousel des formats ne servent qu'en mode édition, les charger en `lazy` |
> | ✅ `vendor-pdf` (jsPDF) | 0 | **126,3 ko**, chargé par `import()` au clic sur « Exporter en PDF », jamais au chargement ; exempté **et** borné (133,0 ko), comme l'exige C-85 |
> | Lighthouse | 0 | job vert à `86ea357f` ; TBT mobile de la page entreprise (399 ms le 10-18) toujours ouvert |
> | Marges serrées | 0 | `vendor-utils` 0,5 %, `StatisticsPage` 0,2 %, `AgendaPage` 1,7 % : le prochain ajout dans l'un d'eux rougira la garde |
>
> **96 → 95.**

> ### ⚪ 2026-10-18 · 0 : rien n'a bougé, la page entreprise reste le chantier
>
> Dernière passe avant l'acquisition. Mesures du 2026-10-18 : CI de `main` à `e69cb729` (run `39139204925`, cinq jobs verts) et à `15d40bea` (`lint-test-build` vert, run `39156293593`), production (advisors par l'API, catalogue, cron, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-18 |
> |---|---|---|
> | Chemin critique | 0 | **305,4 ko** pour 323 (304,5 le 10-16) : +0,9 ko, `traffic.ts` monté par `main.tsx`. Entrée 67,7 / 70,5. En échange, plus aucune origine tierce de mesure à résoudre au chargement |
> | Lighthouse mobile (`e69cb729`) | 0 | LCP **1,36 à 1,52 s** sur les 8 URLs. 🟠 `/entreprise-presentation/` : perf **86**, TBT **399 ms** (350 à 934 le 10-16). La page où arrivent les prospects reste la seule sous 97 |
> | Lighthouse desktop | 0 | LCP 0,33 s partout, 1,1 s sur l'article OKR |
>
> **96 → 96.**

> ### ⚪ 2026-10-16 (soir) · 0 : la page entreprise enfin mesurée, et son TBT est trop haut
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-10-16
> au soir : Lighthouse mobile des runs `38907264016` (`9dcaf94b`, première mesure du vrai parcours)
> et `38941369233` (`4e6f4293`). Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-16 (soir) |
> |---|---|---|
> | ✅ La page entreprise n'était mesurée par rien (−1 le matin) | **+1** | `9dcaf94b` : `/entreprise-presentation/` sert le parcours entreprise, Lighthouse le mesure enfin |
> | 🔴 TBT mobile du parcours entreprise au-dessus de la cible | **−1** | LCP **1,36 à 1,52 s** (bon), mais TBT **350 ms** puis **934 ms**, perf mobile **88** puis **75**, sur deux runs. La cible fixée le 2026-10-15 (TBT sous 300 ms) n'est tenue que sur le parcours perso : le gain de `c8591450` et suivants a été mesuré sur la mauvaise page pour celle-ci |
>
> **96 → 96.**

> ### 🟢 2026-10-16 · +1 : LCP mobile sous 1,6 s partout, mais la page entreprise n'a jamais été mesurée
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du
> 2026-10-16 : Lighthouse mobile du run `38902071817` (`a4878cab`), build local à `HEAD` avec Sentry
> comme en CI, production au navigateur. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-16 |
> |---|---|---|
> | ✅ LCP mobile, troisième point retenu le 10-15 | **+1** | à `HEAD` : LCP **1,22 à 1,52 s** sur les 8 URLs, TBT **90 à 300 ms**, perf **93 à 100** (le 10-15 : 3,26 à 3,40 s, TBT jusqu'à 1 049 ms, perf 62). Correctifs `c8591450`, `4eb34cb2`, `89ddecb9`, `65b8c87a` ; gain confirmé sur deux runs consécutifs (`38899945555`, `38901051072`) |
> | ✅ Budget de bundle rouge sur deux cliquets (−1) | **+1** | `check:bundle` vert en CI et en local : `OrganizationPage` **17,6 / 18,0 ko** ; `TeamTaskModal` n'apparaît plus comme chunk propre au rapport. Chemin critique **304,5 ko** (plafond 323,0), entrée **66,8 / 70,5**. Marge sous 1 % : `StatisticsPage` 13,0 / 13,0 |
> | 🔴 La page entreprise n'est mesurée par rien | **−1** | `lighthouserc.json` et `lighthouserc.mobile.json` mesurent `/entreprise-presentation/` **avec** barre oblique finale. À cette URL l'application sert le parcours **perso** (vérifié en production le 2026-10-16 : `h1` et titre de l'accueil perso, canonical réécrit vers `/`). Tous les chiffres « entreprise » de Lighthouse depuis l'origine sont donc ceux du parcours perso : le parcours entreprise, celui des prospects, n'a jamais été mesuré. Détection corrigée par `9dcaf94b` pendant la passe : le point revient quand un Lighthouse en CI aura mesuré le vrai parcours |
>
> **95 → 96.**

> ### 🟢 2026-10-15 · +1 : le LCP mobile enfin crédité, le budget de nouveau rouge
>
> **Même règle** : un angle mort ne se rembourse que sur un verdict rendu en CI, un défaut que
> lorsqu'il est corrigé et vérifié. Mesures de la nuit du 14 au 15 : CI de `main` à `6847bbf3`
> (Lighthouse du run `38476034238`), build local à `HEAD` avec Sentry comme en CI. Tableau de
> bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-15 |
> |---|---|---|
> | ✅ LCP mobile « mauvais » sur 8 URLs sur 8 (−3 le 09-22) | **+2** | `C-116` fermé le 2026-10-10 (run `38056459284`) et **jamais crédité depuis**. Relu à `HEAD`, Lighthouse mobile en CI : `/` **3,27 s** · `/guide/` 3,40 · `/blog/` 3,29 · article 3,31 · `/pour-freelances/` 3,39 · `/entreprise-presentation/` 3,26 · `/a-propos/` 3,37 · `/en/` 3,26. Tout sous 4 s : plus rien de « mauvais » |
> | Le troisième point, retenu | 0 | 3,3 s reste au-dessus de 2,5 s (« à améliorer »), et le fil principal est chargé sur les pages animées : perf mobile **65** sur `/` (TBT 878 ms), **62** sur `/entreprise-presentation/` (1 049 ms), **64** sur `/en/` (949 ms). Desktop : LCP 0,65 à 1,34 s, perf 83 à 100 |
> | 🔴 Budget de bundle rouge sur deux cliquets | **−1** | `OrganizationPage` **18,4 / 18,0 ko**, `TeamTaskModal` **12,3 / 12,0**. La CI n'atteint plus l'étape depuis le 2026-10-12 (cf. [`TESTING.md`](../TESTING.md)). Chemin critique **303,9 ko** (302,6 le 10-03, plafond 323,0), entrée 69,2 / 70,5. Marge sous 1 % : `StatisticsPage` 12,9 / 13,0 |
>
> **94 → 95.**

> ### 🟢 2026-10-03 · +2 : budget de bundle vert en CI, sans remonter un plafond
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Verdict : run `CI`
> `37109937640` sur `c7fb936c`, **les cinq jobs verts**, le premier `CI` entièrement vert sur `main`
> depuis le 2026-09-23 (`869fb05a`). Correctifs : `d8b1584b`, `16fbaae9`, `ac1e8c40`, `59aa4fd8`,
> `315804df` (autres sessions) et `d8c215ad`, `290d6f51`, `c7fb936c` (celle-ci).
>
> | Item | Effet | Mesuré le 2026-10-03 |
> |---|---|---|
> | ✅ Budget dépassé sur quatre cliquets (−1 le 10-02) | **+1** | `check:bundle` **vert en CI**. `OKRPage` 17,0 → **14,0** (deux modales rares à leur première ouverture), `landing` 25,4 → **13,1** (parcours entreprise dans `landingEnterprise`), `vendor-query` 18,9 → **12,1** (`@tanstack/virtual` dans `vendor-virtual`, lazy), `vendor-utils` 33,3 → **32,0** (locale `date-fns` `es` retirée, langue ni servie ni traduite). Cliquets **abaissés**. Chemin critique **310,6 → 302,6 ko** gzip, pour tout visiteur. `useTeamOKRsAcrossOrgs` sans `useQueries` (`d8c215ad`) : `QueriesObserver` hors du chemin critique |
> | ✅ `TasksPage` au-delà de son cliquet (−1 le 09-22) | **+1** | non remboursé depuis le 09-22 faute de verdict CI sur l'étape ; le budget est atteint et vert, `TasksPage` à **29,8 / 37,0** |
> | 🔴 `C-116` · LCP mobile | 0 | le bandeau cookies n'est plus l'élément LCP (texte coupé en deux paragraphes, `290d6f51`), mais le chiffre ne bouge presque pas : `/` **7,8 s** (8,1), `/guide/` **6,3** (6,6), le reste inchangé. L'élément LCP devient le paragraphe animé du héros (`data-hero-fade`, GSAP depuis l'opacité 0) ou un paragraphe rendu par React, plus grand que sa version prérendue. **La cause est une seule** : ce que React peint remplace un prérendu qui n'a pas sa mise en page. Déjà payé |
>
> **92 → 94.**

> ### 🟠 2026-10-02 (soir) · −1 : le budget de bundle repasse au rouge, quatre cliquets
>
> **Même règle que le 2026-09-22** : un angle mort ne se rembourse que sur un verdict rendu en CI, un
> défaut que lorsqu'il est corrigé et vérifié. Mesures du soir : CI de `main` à `9ea33927` (dernier
> `e2e` complet : `f301f0bf`, run `37019682064`), production (advisors par l'API, catalogue, ledger),
> dépôt à `HEAD`.
>
> | Item | Effet | Mesuré le 2026-10-02 (soir) |
> |---|---|---|
> | 🔴 Budget de bundle | **−1** | **vu rouge en CI** le 2026-10-02 au matin (run `36985012405`, `OKRPage` 16,1 / 15,0), la CI n'atteint plus l'étape depuis (tests unitaires rouges, cf. [`TESTING.md`](../TESTING.md)). Remesuré en local à `HEAD`, build **avec** Sentry comme en CI : **quatre** cliquets dépassés, `OKRPage` **17,0 / 15,0**, `landing` **25,4 / 24,0** (parcours entreprise de la landing, le soir même), `vendor-query` **18,9 / 18,5**, `vendor-utils` **33,3 / 33,0**. Chemin critique **310,6 ko** (plafond 323,0), entrée **67,1 ko** (70,5) : intacts |
> | `TasksPage` au-delà de son cliquet (−1 le 09-22) | 0 | **29,8 / 37,0** en local à `HEAD`, mais aucun verdict CI sur l'étape depuis le 09-28 : non remboursé |
> | `C-116` · LCP mobile | 0 | Lighthouse mobile en CI à `9ea33927` : `/` **8,1 s** (perf 50), `/guide/` 6,6, `/blog/` 6,1, article 5,9, `/pour-freelances/` 5,7, `/entreprise-presentation/` **8,4** (perf 47), `/a-propos/` 5,6, `/en/` 3,6. *Render Delay* de 5,1 à 7,9 s sur chaque URL : l'élément LCP est là, il attend le rendu. Inchangé depuis le 10-01, déjà payé |
> | Desktop | 0 | LCP **0,7 à 1,8 s**, perf 91 à 99 sur les 8 URLs |
> | AM-5 · coût serveur | 0 | `cout-db` vert le 2026-10-02 |
>
> ⚠️ Un premier relevé de ce soir montrait d'autres chiffres (`org` 37,3, `legal` 18,5) : c'était un
> `bundle.log` du **2026-09-26**, laissé par une autre session dans le dossier temporaire commun.
> Écarté avant toute conclusion ; les chiffres ci-dessus viennent du build de ce soir.
>
> **93 → 92.** ❌ Aucun cliquet remonté : ce sont les chunks qui doivent maigrir.

> ### ⚪ 2026-10-01 · 0 : inchangée : le correctif LCP ne se voit pas en CI
>
> **Même règle que le 2026-09-22** : un angle mort ne se rembourse que sur un verdict rendu en CI, un
> défaut que lorsqu'il est corrigé et vérifié. Mesures du jour : CI de `main` (`43fed445` à
> `7cd73d24`), production (catalogue, advisors), dépôt à `HEAD`.
>
> | Item | Effet | Mesuré le 2026-10-01 |
> |---|---|---|
> | `C-116` · peindre le prérendu (`cf1cf753`, 2026-09-29) | 0 | annoncé **1,8 à 2,0 s** en mesure locale ; **Lighthouse mobile en CI, `43fed445`** : `/guide/` 6,6 s · `/blog/` 5,9 · article 5,9 · `/pour-freelances/` 5,7 · `/entreprise-presentation/` **8,1** · `/a-propos/` 5,4 · `/en/` 3,6. L'élément LCP reste un paragraphe du hero animé (`data-hero-fade`). Déjà payé (−3), rien de remboursé |
> | `TasksPage` au-delà de son cliquet (−1 le 09-22) | 0 | le budget est dit respecté par `af622168` (mesure locale), mais **la CI n'a plus atteint `check:bundle` depuis le 2026-09-28** : non remboursé. ⚠️ En local, `OKRPage` (17,0 / 15,0) et `vendor-query` (18,9 / 18,5) débordent, sur le travail non commité d'une autre session |
> | AM-5 · coût serveur | 0 | `cout-db` vert le 2026-10-01 |
>
> **93 → 93.** Détail : [tableau de bord](../README.md).

> ### 🟠 2026-09-22 (soir) · +3 : remesure item par item, contre la CI réelle et la production
>
> **Règle appliquée**, déclarée au [tableau de bord](../README.md) : un angle mort payé le 2026-09-16
> n'est remboursé que si sa garde a rendu **au moins un verdict exploitable en CI** (vert, ou
> rouge sur un vrai défaut). Une garde posée mais jamais jouée, ou cassée, ne rembourse rien.
> Un défaut nommé ce soir coûte selon le barème du 09-16.
>
> | Item | Effet | Mesuré le 2026-09-22 |
> |---|---|---|
> | AM-1 · aucune mesure mobile | **+2** | `lighthouserc.mobile.json` joué dans le job `lighthouse`, 8 URLs, verdicts produits |
> | AM-3 · plafonds par chunk | **+1** | **il a mordu** : voir la ligne `TasksPage` |
> | AM-4 · 4 URLs sur 40 | **+1** | 8 URLs, une par gabarit, desktop et mobile |
> | AM-5 · coût serveur en continu | **+1** | `check:db-cost`, job `cout-db` de `posture.yml`, vert le 09-21 et le 09-22 |
> | `C-77` (−2 le 09-14 soir) | **+2** | fermé et vérifié par sa sortie : `okrTime = 480` pour un compte réel |
> | 🔴 **LCP mobile « mauvais » sur 8 URLs sur 8** | **−3** | `/` **6,5 s** · `/guide/` 6,7 · `/blog/` 6,0 · article 6,0 · `/pour-freelances/` 5,6 · `/entreprise-presentation/` **8,3** · `/a-propos/` 5,7 · `/en/` 7,3. Seuil Google « mauvais » : 4 s. En `warn`, donc job vert, et le résumé écrit « aucun rapport mobile produit » : **mesuré depuis le 09-20, lu par personne**. → `C-116` |
> | 🔴 `TasksPage` au-delà de son cliquet, sur `main` | **−1** | **37,7 ko** pour 37,0 (posé au poids du 09-20). → `C-117` |
> | AM-2 · performance non bloquante | **0** | arbitrage toujours non rendu |
>
> ✅ Desktop, à `HEAD` : performance **92 à 97**, LCP **1,1 à 1,6 s**, TBT ≤ 131 ms, CLS 0. Chemin
> critique **307,0 / 323,0 ko**, entrée **67,0 / 71,0 ko**. 🔴 L'écart desktop / mobile est le
> renseignement de la passe : **la même page fait 1,4 s sur l'un et 6,5 s sur l'autre**.
>
> **90 → 93.** Détail, règle et ordre de réparation : [tableau de bord](../README.md).

> ### 🟠 2026-09-16 · -5 : la note comptait ce qui était mesuré, jamais ce qui ne l'était pas
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
> | AM-1 · **aucune mesure de performance MOBILE en continu** | −2 | `lighthouserc.json` est en preset `desktop`, et le trafic visé est mobile |
> | AM-3 · les chunks lazy n'ont aucun plafond | −1 | `BUDGETS` ne porte que `critical` et `entry` |
> | AM-4 · 4 URLs mesurées sur les 45 du sitemap | −1 | `lighthouserc.json` vs `dist/sitemap.xml` |
> | AM-5 · aucune mesure du coût SERVEUR en continu | −1 | les plans sont rejoués à la main, à chaque passe |
> | AM-2 · `categories:performance` en `warn` | 0 | arbitrage assumé : le runner varie |
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
| AM-1 | 🔴 **Lighthouse tourne en preset DESKTOP uniquement.** Aucune mesure de performance **mobile** en continu, alors que c'est le terminal du trafic visé et que [`MOBILE.md`](../MOBILE.md) est le document le moins bien noté du dépôt | `lighthouserc.json` : `"preset": "desktop"` | ✅ **OUTILLÉ le 2026-09-20** · `lighthouserc.mobile.json` + passe mobile de `ci.yml` (`C-84`) — 🔴 ne prouve PAS : que les seuils soient justes : **première pose**, prudente faute de Chrome sur le poste, à rabaisser au mesuré dès le 1ᵉʳ run réel · 🔎 🔴 **2026-09-22 : LCP mobile 5,6 à 8,3 s sur 8 URLs sur 8**, en `warn` donc job vert, et le résumé CI écrit « aucun rapport mobile produit » : jamais lu. → `C-116` · 🔎 ✅ **2026-09-24 : cause trouvée**, cf. § « C-116 » juste sous ce tableau. Le résumé lisait un dossier jamais écrit, et l'artefact ignorait un dossier caché : corrigés |
| AM-2 | **La performance n'est PAS bloquante, et LCP / TBT non plus.** Seuls `accessibility`, `seo` et `cumulative-layout-shift` sont en `error` | `lighthouserc.json` : `"categories:performance": ["warn", …]`, `largest-contentful-paint` et `total-blocking-time` en `warn` | ✅ **LCP OUTILLÉ le 2026-10-25** (PR #149) · `largest-contentful-paint` en `error` sur les 8 URLs mobiles : 2 000 ms sur `/`, `/en/` et les pages de contenu, 3 000 ms partout ailleurs (plafond de l'entreprise). Les pages de contenu peignent leur propre rendu React, produit au build (`prerender.mjs`, `injectContentCopy`, `src/prerender/content-copy.tsx`) : CI mobile `/guide/` **5,6 → 1,67 s**, `/blog/` 5,0 → 1,51 s, article 5,4 → 1,74 s, `/pour-freelances/` et `/a-propos/` 4,5 → 1,66 s, `/en/` 6,0 → 1,67 s (run `40099712405`, `66f76355`, contre les runs de `main` du 2026-10-22) · 🔴 ne prouve PAS : TBT et `categories:performance` restent en `warn` (le runner varie, TBT 16 à 202 ms au même run) ; une seule passe par URL · 🔎 **2026-10-25 : TROIS mesures par URL, verdict sur la MÉDIANE** (`numberOfRuns` 1 → 3, `aggregationMethod: "median"` sur les neuf assertions `error`). Une seule mesure laissait le runner trancher : la PR n° 139, qui n'ajoute que des tests, a mesuré 2 268 ms contre un plafond de 2 000 alors que `main` passait. ⚠️ La médiane est posée **explicitement** : l'agrégation par défaut de Lighthouse CI est `optimistic` (la MEILLEURE des trois), qui aurait rendu chaque gate plus indulgente qu'avec une seule mesure. Seuils inchangés · 🔎 **2026-10-26 : le LCP de `/blog/methode-okr-exemples/` en deux paquets était SIMULÉ, pas réel.** LCP observé 80 ms (la copie peint tout de suite) ; LCP simulé 1,6 ou 2,1 à 2,3 s selon que la capture `okr.webp` (120 ko, visible dès l ouverture) partait avant ou après lui, Lighthouse comptant toute ressource lancée avant le LCP observé sur sa 4G lente. Les captures des articles sont proposées en 800 px par `srcset` (25 ko, −79 %), la grande image reste servie aux écrans larges : aucun changement visuel, seuil inchangé |
| AM-3 | **Les chunks LAZY n'ont aucun plafond.** Le budget ne couvre que le chemin critique et l'entrée. Une page lazy peut grossir sans limite | `scripts/check-bundle-budget.mjs` : « Les chunks lazy ne sont payés que par ceux qui ouvrent l'écran correspondant ». `BUDGETS` ne porte que `critical` et `entry` | ✅ **OUTILLÉ le 2026-09-20** · **30 plafonds par chunk**, posés au poids du jour (`C-85`) — 🔴 ne prouve PAS : rien — mais ⚠️ **l'énoncé du 09-16 était périmé** : un plafond générique de 70 ko existait ; ce qui manquait était un plafond **par chunk** · 🔎 ✅ **2026-09-22 : il a mordu** : `TasksPage` 37,7 ko > 37,0 à `HEAD`. → `C-117` |
| AM-4 | **4 URLs mesurées sur les 45 du sitemap** | `lighthouserc.json` : `/`, `/guide/`, `/blog/`, `/pour-freelances/`. `dist/sitemap.xml` en porte **45** | ✅ **OUTILLÉ le 2026-09-20** · passe mobile Lighthouse, 4 → **8 URLs** (`C-84`) — 🔴 ne prouve PAS : la couverture : 8 URLs restent 8 URLs, la proportion s'améliore sans se fermer |
| AM-5 | **Aucune mesure du coût SERVEUR en continu.** Les plans d'exécution et les temps de RPC sont rejoués à la main, à chaque passe | aucun workflow ne joue d'`EXPLAIN` | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:db-cost` · EXPLAIN sous RLS, rôle `authenticated`, transaction annulée (`C-87`) — 🔴 ne prouve PAS : le coût **facturé** (Supabase ne l'expose pas) ni la charge réelle (c'est `scalability-volume`) |
| AM-6 | **`vendor-utils` est repassé sous sa marge cible un jour après la PR qui l'en sortait** (31,4 / 33,0 ko, 4,8 %). La marge n'est pas gardée, seul le plafond l'est | `check:bundle` | 🟠 **OUVERT le 2026-10-23** · session dédiée, avec le LCP mobile des pages de contenu (AM-2) |

### 🔎 C-116 · pourquoi le LCP mobile est lent (mesuré le 2026-09-24)

**Mesuré sur la PRODUCTION** (`https://thecosmo.app`, Brotli, CDN Vercel) avec Chromium bridé par
CDP comme Lighthouse (4G lente : 150 ms RTT, 1,6 Mbit/s ; CPU ×4), viewport 412 px :

| Page | FCP | LCP | Élément LCP |
|---|---|---|---|
| `/guide/` | 5 784 ms | **5 784 ms** | un paragraphe du guide, rendu par React |
| `/` | 5 372 ms | **5 372 ms** | 🔴 le paragraphe du **bandeau cookies** |

🔴 **FCP = LCP partout : le contenu prérendu n'est JAMAIS peint.** Ce n'est pas un poids de
contenu, c'est un choix de conception : `index.html` masque `#seo-fallback` (`display:none`) et
n'affiche que `#boot-screen`, un spinner. Chrome ne compte pas une bordure animée comme du contenu,
donc le premier rendu « contentful » attend le premier commit de React, et le LCP avec lui. Le
bloc prérendu ne sert qu'aux robots qui n'appliquent pas la CSS.

**La chaîne mesurée sur `/guide/`** (cascade réseau CDP) :

| Instant | Ce qui se passe |
|---|---|
| 0,56 s | HTML reçu |
| 2,3 s | CSS bloquante reçue (39 ko br), police à 2,5 s |
| 2,8 s | les sept JS du chemin critique reçus, **dont `vendor-supabase` (56 ko br) et `vendor-animation` (51 ko br) sur une page de texte**, tous en priorité *High*, en concurrence avec la CSS sur le même lien |
| 3,1 à 3,8 s | **seconde vague** : environ 25 petits chunks découverts seulement après l'exécution de l'entrée (`GuidePage`, `demo-seed`, `local.repository`, sept `hooks-*`…), plus `sentry-client` (50 ko) et deux requêtes Supabase (`/auth/v1/health`, `/rest/v1/`) |
| 4,7 à 5,8 s | premier rendu React = FCP = LCP |

**Trois leviers, par ordre de gain attendu, et le premier est une décision, pas un correctif :**

1. **Peindre le prérendu.** Le rendre visible (et stylé) jusqu'au montage de React ramènerait le
   premier rendu vers 2,5 s. ⚠️ Deux risques à peser : un saut visuel quand React remplace le bloc,
   et un LCP qui peut **se redéclarer** plus tard si React peint un élément plus grand. Le masquage
   actuel a une raison écrite dans `index.html` (la CSP interdit le script inline, donc tout doit
   rester en CSS) ; peindre le prérendu reste faisable en CSS seul. ✅ **Arbitré par Axel et fait le 2026-09-29** :
   `html[data-prerendered]` peint `#seo-fallback` ; le rewrite SPA sert `app.html` (coquille vierge),
   pour que `/dashboard` n'hérite pas de la home prérendue. Mesuré en local (Brotli, même bridage) :
   FCP 4,4-4,8 → 1,7-2,6 s, LCP médian → 1,8-2,0 s. Le bandeau cookies reprend le LCP une passe
   sur trois (4,2-4,8 s) : c'est le reste de C-116.
2. **Supprimer la seconde vague** : précharger (`modulepreload`) le chunk de la route prérendue dans
   son HTML, et sortir `demo-seed` / `local.repository` du chemin d'une page publique. Environ un
   aller-retour et demi gagné.
3. **Alléger le chemin critique des pages publiques** : ni Supabase ni Framer Motion ne sont
   nécessaires pour peindre un guide. Gain réseau d'environ 0,7 s, mais c'est l'architecture des
   providers (`AuthProvider` à la racine) qui est en jeu.

#### 🔴 2026-10-21 · la home peint une copie de la landing, plus le texte SEO

Le levier 1 avait un coût que personne n'avait mis en face du gain : sur `/`, le « prérendu
peint » était le **texte SEO brut**, sans mise en page. Filmé en local (412 et 1 440 px, CPU ×4,
4G lente) : **mur de texte** de 0 à 1,7 s, puis **squelette gris** (`LandingSkeleton`) jusqu'à
3,2 s, puis la landing. Signalé par Axel comme un bug « corrigé huit fois » : chaque correctif
traitait un cas (CSP, personne connectée le 10-16) sans toucher la décision de C-116, qui le
recréait pour tout visiteur sans session. Trois issues proposées (spinner partout, LCP mobile
rendu ; copie habillée ; statu quo), **Axel a choisi la copie**.

- `/` et `/en/` peignent `#lp-hero` : le header et le hero **capturés sur le rendu React**
  (`npm run capture:landing-hero`), avec leur CSS sortie de la feuille buildée et confinée
  (`scripts/landing-hero-css.mjs`). Calque fixe **hors de `#root`** : `createRoot` ne l'efface pas,
  l'attente de l'auth et le squelette passent dessous. `PersoTrack` le retire dans un
  `useLayoutEffect`, sans rejouer les entrées du titre, du header ni le voile de `#track`.
  Mécanique et sorties : `src/lib/prerender-hero.ts`.
- **Le LCP aurait régressé sans `font-display: block` sur la copie.** En `swap`, elle se peignait
  en police système, plus étroite : un bloc de 55 024 px² contre 57 195 pour le même bloc React
  en Inter, qui **reprenait le LCP** à la relève (412 px, 3 passes : 4,6 à 5,9 s). En `block`
  (Inter est préchargée) : LCP **1,17 à 1,42 s**, sur la copie, à FCP inchangé (1,0 à 1,2 s).
- ⚠️ La copie est un **instantané**. `src/prerender-hero.guard.test.ts` compare l'empreinte des
  sources du header et du hero à celle de la capture : il échoue dès que l'une bouge sans nouvelle
  capture (vu rouge sur la modification de `LandingPage.tsx` du jour).
- **Même jour, les autres pages prérendues.** Filmé à 412 px : le guide, le blog, les articles,
  les `/pour-*`, l'à-propos, les pages légales et la connexion peignaient le texte SEO **sur fond
  blanc**, puis le `PageLoader` (un autre spinner, sombre, centré dans 60vh), puis la page sombre.
  L'entreprise, texte blanc puis squelette blanc puis landing noire.
  - `/entreprise-presentation/` (et `/en/for-companies/`) : même copie que la home, en **deux
    vues** (bureau 1 440 px, mobile 412 px, media query au seuil de `useIsMobile`) parce que la
    pile du hero s'y rend autrement. La pile garde son image dans la copie : masquée, React la
    peignait plus grande et **reprenait le LCP à 6,4 s** ; visible, LCP **0,9 à 1,6 s** sur la copie.
    `useIsMobile` calcule désormais son état au premier rendu (il rendait la version bureau une
    image avant de basculer, sur toutes les pages qui l'utilisent).
  - **Pages de contenu : spinner, arbitré par Axel** (le texte habillé gardait un saut, le vrai
    prérendu React est un chantier à part). `prerender.mjs` ne leur pose plus `data-prerendered` :
    spinner de démarrage, puis `BootScreen` (même classe, même CSS, plein écran) jusqu'à la page.
    Le spinner prend les couleurs **exactes** du thème : `html[data-boot-theme]`, posé par le
    script inline (thème enregistré) puis par `applyTheme()`.
  - ⚠️ **Le LCP mobile de ces pages est rendu en connaissance de cause** : il n'est plus un
    texte peint avant React. Mesuré en local (412 px, CPU ×4, 4G lente) : 2,4 à 3,4 s, **4,8 s sur
    `/guide/`**, contre 0,6 à 1,2 s pour le texte brut. Moins que redouté, parce que l'app se charge
    désormais sans attendre une peinture. À relire au prochain Lighthouse CI mobile.

✅ **Corrigé le même jour, côté mesure** : le résumé CI mobile lisait `.lighthouseci-mobile`, un
dossier jamais écrit (aucun `lhci upload` mobile), et `upload-artifact` ignorait `.lighthouseci/`
parce que c'est un dossier caché (`include-hidden-files`). Aucun rapport Lighthouse, desktop ou
mobile, n'avait donc jamais été archivé. Le résumé imprime désormais l'élément LCP et ses phases.
❌ **Ne pas remonter le seuil de 4 500 ms** : il est dépassé pour une raison nommée.

#### 🔴 2026-10-22 · `/en/` reprise par le bandeau cookies, pages de contenu à 4,5-5,6 s

Lu dans l'**artefact** `lighthouse-mobile` de quatre runs de `main` (`39797625778`,
`39810347890`, `39834230611`, `39843255180`), pas dans les annotations : GitHub n'en garde que
dix par étape, et le résumé en écrivait trois par URL. L'élément LCP de `/en/` n'y figurait
pas. ✅ Une ligne par URL depuis ce jour (`ci.yml`, « Scores mesures (mobile) »).

**`/en/` ne perd pas la copie : le bandeau cookies passe devant.** Sur les quatre runs, l'élément
LCP est le premier paragraphe du bandeau (`aside.fixed > … > p.text-[13px]`, 346 × 127 px),
peint 1,2 s après le montage de React (*Render Delay* simulé de 4,9 à 5,5 s). La copie
`#lp-hero` est bien peinte à 0,9 s (FCP), mais son plus grand bloc est plus petit que ce
paragraphe. Mesuré sur la production, Chromium headless à 412 px (entrées
`largest-contentful-paint` et surfaces de texte de la copie servie sans script) :

| 412 px | Plus grand bloc de la copie | 1er paragraphe du bandeau |
|---|---|---|
| `/` | **57 195 px²** (titre sur quatre lignes) | 41 628 px² |
| `/en/` | **28 700 px²** (titre sur deux lignes) | **42 004 px²** |

Le titre anglais tient en deux lignes dès ~400 px, le français en quatre : `/` ne garde son LCP
que parce que son titre est long. Le 2026-10-18, ce qui se peignait avant React était le texte
SEO, plus grand que le bandeau : rien ne le montrait. Le 2026-10-21, la mesure locale de
`3cce0b05` (« LCP 1,17 à 1,42 s ») portait sur `/` seule.

❌ **Couper le paragraphe en trois, sans changer un mot (le geste de `290d6f51`), ne corrige
pas.** À 412 px, le plus grand morceau (26 872 px²) passe sous le titre (29 157) avec 8 % de
marge : Lighthouse passerait au vert. Mais la marge tombe à 1 % à 430 px, et le bandeau repasse
devant de 440 à 639 px. Ce serait faire passer la mesure, pas corriger la page.

**Les options pour `/en/` touchent toutes la surface de recueil du consentement : à arbitrer.**

| Option | LCP `/en/` attendu | Coût |
|---|---|---|
| 1. Bandeau **au premier geste** (`pointerdown`, `keydown`, `wheel`, `touchstart`) au lieu de 1,2 s après le montage | la copie, ~1,5 s comme `/` (chiffre CI : PR empilée) | Chrome cesse de mesurer le LCP au premier geste : le bandeau ne peut plus l'être, à aucune largeur. Un visiteur qui ne touche pas la page n'est pas sollicité, et rien n'est déposé (`null` n'est pas une acceptation). Lighthouse n'audite plus le bandeau |
| 2. Bandeau **peint par le prérendu**, relevé par React | ≈ FCP, ~0,9 s | le bandeau couvre le hero dès la première image ; ses boutons sont inertes jusqu'au montage (4 à 5 s sur mobile lent) ; le script inline doit relire l'expiration à six mois (empreinte CSP) ; une capture et une garde de plus |
| 3. **Texte plus court**, chaque paragraphe sous ~20 000 px² (trois lignes à 412 px) | la copie, ~1,5 s | relecture juridique de la surface de recueil (A4 de `LEGAL.md`, `LEGAL-JOURNAL.md`) ; reste lié à la longueur du titre |
| 4. Couper en trois | vert en CI seulement | rejeté ci-dessus |

**Option 1, appliquée en attendant l'arbitrage** (`CookieBanner.tsx`) : plus de minuterie, le
bandeau se monte au premier `click`, `keydown`, `wheel` ou `touchmove`. Pas `scroll`, qu'un
défilement programmatique émet sans geste. 🔴 **Un geste RÉSOLU, jamais son début** (2026-10-25) :
monté au `pointerdown` ou au `touchstart`, le bandeau glissait sous le doigt avant le `click`, qui
tombait sur lui, et le premier tap sur le CTA de la landing ne menait nulle part (e2e C-97, CPU ×4,
rouge sur ses trois essais dans les PR #116 et #149). `largest-contentful-paint` passe en `error` à
2 000 ms sur `/en/`, comme sur `/`. La garde visuelle des pages publiques émet une touche neutre
avant de chercher le bandeau. `/en/` : **1 671 ms** en CI mobile (run `40099712405`, `66f76355`),
élément LCP dans la copie, contre 5 857 à 6 006 ms. Pour revenir à l'option 2 ou 3, retirer aussi
le cliquet `/en/` le temps de la mesure.

**Pages de contenu : l'arbitrage de `26a0faac` reposait sur 2,4 à 3,4 s mesurés en local, la CI
mesure 4,5 à 5,6 s.** Même bridage (412 px, CPU ×4, 4G lente simulée), quatre runs concordants.
Le spinner fait demander **531 à 720 ko avant le LCP**, contre **84 à 88 ko** quand le texte
était peint : toute l'application doit arriver avant la première phrase.

| Option | LCP mobile en CI | Ce que voit le visiteur | Coût |
|---|---|---|---|
| A. Statu quo, spinner (`26a0faac`) | **4,45 à 5,61 s**, perf 66 à 81, FCP 2,4 à 2,9 s (quatre runs du 10-22) | spinner, puis la page | rien |
| B. Revenir au texte SEO peint | **1,36 à 1,52 s**, perf 97 à 100, FCP 0,76 s (run `39139204925`, `e69cb729`, 10-18) | texte brut sans mise en page, puis spinner, puis la page : le défaut signalé par Axel | annuler la part « contenu » de `26a0faac` |
| C. Copie habillée par gabarit, comme la home | non mesuré ; par analogie `/` 1,6 s et entreprise 2,3 à 2,4 s en CI | la page dès la première image | une capture et une garde par gabarit (guide, index du blog, article, `/pour-*`, à-propos, légales). La copie doit égaler le rendu React, sinon React reprend le LCP (6,4 s sur l'entreprise le 10-21) |
| D. Garder le spinner, alléger ce qui précède le contenu | **estimé 3,4 à 3,8 s** | spinner plus court | estimation : pente de 5,35 ms simulées par ko (20 points, r² 0,86) appliquée au plancher de 318 à 384 ko (document, police, entrée, React, routeur, Query, utilitaires, CSS), sans `vendor-supabase` (55 ko), `vendor-animation` (50), `sentry-client` (49), `vendor-charts` (112, sur `/guide/`). Reste au-dessus de 2,5 s, et c'est l'architecture des providers (leviers 2 et 3 plus haut) |

**Cliquet posé le même jour** (`lighthouserc.mobile.json`) : `largest-contentful-paint` passe en
`error` sur `/` (2 000 ms, pour 1 592 à 1 666 mesurés) et `/entreprise-presentation/` (3 000 ms,
pour 2 264 à 2 435). `/en/` suivra son correctif : la poser rouge ferait une gate rouge en
permanence. Les 4 500 ms globaux restent en `warn` tant que les pages de contenu attendent leur
arbitrage.

✅ **2026-10-16 · LCP sous 2,5 s et TBT sous 300 ms sur les trois pages animées, Lighthouse mobile en CI** (artefact `lighthouse-mobile`). Avant, run `38476034238` (`6847bbf3`) : `/` LCP 3,27 s, TBT 878 ms, perf 65 · `/en/` 3,26 s, 949 ms, 64 · `/entreprise-presentation/` 3,26 s, 1 049 ms, 62. Après, run `38899945555` (`65b8c87a`) : `/` **1,37 s, 54 ms, 100** · `/en/` **1,36 s, 77 ms, 100** · `/entreprise-presentation/` **1,51 s, 65 ms, 99** ; les 8 URLs sous 1,52 s et 182 ms. Confirmé au run suivant, `38901051072` (`93f6a035`) : `/` 1,22 s, 66 ms · `/en/` 1,52 s, 66 ms · `/entreprise-presentation/` 1,37 s, 111 ms. Quatre leviers : l'app chargée après la peinture du prérendu (`src/boot.ts`, son JS et sa CSS sortent du chemin du LCP), l'icône du manifeste à sa taille (`logo.png` de 255 ko, téléchargée pendant le chargement, ajoutait 1,3 s au LCP une passe sur deux), la rotation du hero qui ne re-rend plus le parcours (`hero-module-actif.ts`), le bas de la landing monté au premier geste (`BelowFold.tsx`, une tâche de ~1 s à CPU ×4). 🔴 **Les chiffres « entreprise » ci-dessus, et tous ceux de ce document jusqu'à `9dcaf94b`, mesurent le parcours PERSO.** `/entreprise-presentation/` (l'URL de `lighthouserc.mobile.json`, que Vercel sert aussi en 200 sans rediriger) gardait sa barre oblique finale dans `stripLocalePrefix`, et `useLandingTrack` ratait le slug : le prérendu était entreprise, l'hydratation rendait le perso, titre et canonical de l'accueil compris. Vu en production le 2026-10-16, en fr comme sur `/en/for-companies/`. Corrigé dans `normalizePath` (`src/i18n/routes.ts`), témoin `use-landing-track.test.ts`.

📏 **2026-10-16 · première mesure du parcours ENTREPRISE, Lighthouse mobile en CI**, run `38907264016` (`9dcaf94b`), élément LCP vérifié dans l'artefact (H1 « Qui fait quoi. ») : perf **88**, LCP **1,36 s**, TBT **350 ms**, Speed Index 4,9 s, CLS 0,040, a11y **93**. Le LCP tient ; le TBT est le seul au-dessus de la cible des pages animées (300 ms). Fil principal : `styleLayout` 2,4 s, `vendor-react` 966 ms, `vendor-gsap` 936 ms, `vendor-animation` 666 ms ; tâches longues de 70 à 151 ms entre 8,2 et 10,6 s (sections épinglées, shader). Accessibilité : trois audits en échec, absents du parcours perso (`aria-prohibited-attr` sur les `ent-hero-line` du H1, `color-contrast` sur des `text-slate-500/600`, `label-content-name-mismatch` sur deux boutons). Seuils de `lighthouserc.mobile.json` inchangés.

### ⚡ TBT mobile de `/` : l'amorçage en plusieurs tâches (2026-10-22, PR #103)

**Avant**, Lighthouse CI mobile : `/` à **309 ms** (run `39704928952`, `263154b6`, branche de #91), 282 ms sur `main` à `5eaa8b8c`, 114 ms à `23882c89`. Une passe par URL : au bord du seuil de 300 ms, au gré du runner. Tâches longues du rapport (temps simulé) : `main.js` **221 ms** (171 ms de TBT à elle seule), `vendor-react` 114 et 69, `vendor-animation` 104, 54 et 53, une non attribuée de 60.

**Profil** (`npm run profile:landing`, puis trace CDP par tâche longue, 412 px, CPU ×4, machine saturée donc absolus gonflés) : la tâche `main.js` est l'ÉVALUATION du graphe de l'application d'un bloc (icônes lucide créées par `vendor-utils` ~35 %, code propre de `main` ~35 % dont la première lecture de `localStorage`, supabase ~20 %) ; puis le premier rendu React d'un bloc ; puis l'évaluation du chunk `LandingPage` (130 à 210 ms), dont le bas de page qu'il importait en statique ; puis des frames GSAP / Framer (style et mise en page). Ni le shader (parcours entreprise seulement) ni les entrées CSS du hero n'y figurent.

| Commit | Changement | `/` mobile en CI |
|---|---|---|
| `183a88f3` | Bas du parcours perso dans son chunk (`PersoBelowFold`, chargé au premier geste) | **316 ms** : aucun effet sur Lighthouse, qui ne fait aucun geste. Gardé pour l'utilisateur réel : `LandingPage` passe de 68,7 à 38,6 ko bruts |
| `bb16c86b` | `boot.ts` : sur page prérendue, six chunks vendor importés à part avant `main` ; `main.tsx` : premier rendu sous `startTransition` | **0 ms**, perf 100, TTI 6,0 → 1,7 s, **aucune tâche au-dessus de 25 ms** (run `39823183565`) ; `/entreprise-presentation/` 0 ms, `/guide/` 400 → 106 ms |
| `cb05329f` | Trois de ces chunks seulement (cf. ci-dessous) | **49 ms**, perf 100, LCP 1,68 s (run `39829118507`) ; `/en/` 58 ms, `/entreprise-presentation/` 37 ms. Octets : `vendor-animation` revenu à 49,2 ko (marge 5,3 %, comme `main`), chemin critique 307,0 ko contre 306,3 sur `main` |

- **Pourquoi ça marche.** Un `import()` lancé à part est évalué dans SA tâche, à l'arrivée de son chunk ; `main` n'évalue plus que le reste. En transition, React rend par tranches et rend la main entre elles. Réservé aux pages prérendues : le visiteur y voit déjà la page, rien n'attend ces tâches. La coquille `app.html` charge et rend comme avant.
- **Le prix.** `main` part une fois ces chunks évalués : un aller-retour de plus avant le montage, sans effet sur le LCP (la copie prérendue est peinte avant).
- 🔴 **Un `import()` de paquet coûte des octets.** Vite le réécrit en accès à l'espace de noms du paquet, qui garde TOUTES ses exportations vivantes, déstructuration ou pas. Mesuré contre `main` (`c2959ded`) : `framer-motion` ajoutait **2,4 ko gzip** à `vendor-animation` (marge 5,3 % → 0,8 %), `react-router` 0,3, `react-query` 0,2, `supabase-js` 0,4. Seuls restent `react-dom/client`, `clsx` (qui évalue tout `vendor-utils`) et `supabase-js`. ❌ Ne pas allonger la liste de `boot.ts` sans `npm run check:bundle` avant/après.
- ⚠️ **Mesurer en local ne tranche rien sur ce poste** : Lighthouse en local (API Node, mêmes réglages que `lighthouserc.mobile.json`) rendait 4 845 à 9 607 ms de TBT, `benchmarkIndex` 573 à 899, et `lhci` échoue sous Windows (`EPERM` au nettoyage de son dossier temporaire). Le verdict est le job `lighthouse` de la PR.


> ### 🔴 2026-09-14 (soir) · −2 : une RPC créditée d'un gain de 71× rend un chiffre faux en production
>
> **Le budget de bundle est revérifié et il tient** : `npm run check:bundle` rejoué ce soir sur un
> build neuf (`npm run build`, exit 0, `VITE_SENTRY_DSN` posée, `vendor-sentry` à 49,3 ko donc
> au-dessus du `SENTRY_FLOOR`) rend **306,6 ko de chemin critique pour 323,0 de plafond** et
> **66,9 ko d'entrée pour 71,0**. Les marges annoncées ce matin sont exactes. Le −2 ne vient pas de
> là.
>
> **Il vient de ce que cet audit a crédité sans jamais le vérifier.** La migration `127` a été
> portée à cette note le 2026-08-27 pour avoir ramené la page Statistiques de **854 ms à 12,0 ms**.
> Ce gain est réel. Ce que personne n'a mesuré, c'est si la fonction accélérée rendait des chiffres
> justes : **elle en rend un faux, sur une de ses quatre colonnes, pour 100 % des comptes réels.**
>
> Mesuré ce soir directement en base, par `pg_get_functiondef` sur la fonction VIVANTE, pas par
> lecture du dépôt :
>
> ```sql
> okr_days AS MATERIALIZED (
>   SELECT ... FROM okrs o
>   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(kr.elem->'history', '[]'::jsonb)) AS hist(elem)
> ```
>
> Le champ `history` n'est écrit par aucun écrivain du produit : il est absent de l'interface
> `KeyResult`, absent des mappers. `okr_days` est donc toujours vide et **`okrTime` vaut
> structurellement 0** sur `/statistics` en production.
>
> 🔴 **Ce qui rend ce point coûteux, c'est qu'il a DÉJÀ été corrigé, à moitié.** La revue du
> 2026-09-02 a trouvé ce défaut, l'a réparé côté client (`src/lib/workTimeCalculator.ts` lit
> désormais `kr_completions`) et a écrit le constat **au passé** : « la page Statistiques affichait 0
> pour les OKR en démo COMME en production ». La moitié production est restée vraie. Conséquence
> exacte, et elle est la pire des deux :
>
> | Mode | Source de `okrTime` | État |
> |---|---|---|
> | **Démo** (ce que voit un visiteur) | `workTimeCalculator.ts` → `kr_completions` | ✅ juste depuis le 09-02 |
> | **Production** (ce que voit un inscrit) | RPC `get_work_time_stats` (mig. 127) | 🔴 **0, toujours** |
>
> La vitrine montre le bon chiffre, le produit montre zéro. C'est littéralement la règle que
> `CLAUDE.md` écrit pour les fuseaux des habitudes : *ne jamais corriger une seule des deux
> moitiés*.
>
> ⚠️ **La migration qui répare est dans le dépôt et n'a jamais été appliquée** :
> `136_work_time_stats_okr_from_completions.sql` est **commitée** (`31482a3f`, 2026-09-03) et présente
> à `HEAD`, mais elle n'a jamais été jouée contre la base. Elle est décrite partout comme « travail
> en cours d'une autre session », jamais comme **un défaut ouvert en production**, et aucun des onze
> audits ne la portait.
>
> 🔴 **Correction du 2026-09-15 : ce paragraphe a d'abord écrit « ni versionnée ni appliquée »**,
> en recopiant `CLAUDE.md` § Base de données au lieu de lancer `git ls-files`. La moitié « non
> versionnée » était fausse. **C'est la même faute que celle que cette passe documente**, commise
> pendant qu'elle la documentait : un fait repris d'un document voisin plutôt que mesuré à sa
> source. La bonne nouvelle est pratique : le SQL est relu et dans le dépôt, fermer `C-77` ne
> demande que de l'appliquer et de vérifier ce qu'elle rend.
>
> ⚠️ **Et sa propre prémisse est fausse d'un mot, ce qui ne change pas sa conclusion.** Son en-tête
> affirme « ce champ n'existe pas », vérifié par `grep` dans `src` et jamais en base. Mesuré ce
> soir : **12 Key Results sur 28 portent bien un `history` non vide**, avec exactement la forme
> `{date, increment}` attendue. Ils appartiennent tous au compte de seed
> `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`, donc aucun compte réel n'est concerné et le verdict tient.
> Mais l'argument « le champ n'existe pas » est un argument de code présenté comme un argument de
> données, et il aurait suffi d'une requête pour le formuler juste.
>
> ❌ **Ne jamais créditer une RPC d'un gain de temps sans avoir comparé ce qu'elle REND.** La
> mig. `127` a été mesurée sur son plan d'exécution et sur son temps, jamais sur ses valeurs. Une
> fonction qui rend zéro très vite est la plus rapide de toutes.


> ### 🟢 2026-09-14 · +5 : le défaut qui avait fait perdre les 2 points du 09-03 est refermé, et COMMITÉ
>
> Le 09-03, la note perdait 2 points parce que la marge réelle sous les deux plafonds n'était pas
> celle annoncée : l'entrée était **ROUGE** (78,1 ko pour un plafond de 78,0), et le chemin
> critique n'avait que 3,2 ko de marge. C'est exactement ce point qui se referme aujourd'hui :
>
> | | 09-03 | **09-14** | Plafond |
> |---|---|---|---|
> | Chunk d'entrée | **78,1 ko, ROUGE** (−0,1 ko) | **66,9 ko** (marge **5,78 %**) | 78 000 → **71 000** |
> | Chemin critique | 366,8 ko (marge 3,2 ko) | **306,6 ko** (marge **5,16 %**) | 370 000 → **323 000** |
>
> Le levier n'est pas celui qui était prévu (scinder un catalogue i18n) : c'est `sonner`
> (10,1 ko gzip) qui sort intégralement du chemin critique, derrière une façade `@/lib/toast` au
> seul `import()` dynamique du dépôt. **Les deux plafonds ont été ABAISSÉS**, jamais relevés — le
> critère de sortie (5 % de marge sur les deux) est tenu, pas contourné.
>
> ⚠️ **Ce gain a failli ne jamais compter.** Le travail a vécu **trois jours dans un arbre non
> commité** : ce document l'annonçait comme acquis pendant que `main` portait encore 78 000 /
> 370 000, et une branche entière (`feat/react-19`) a été arbitrée contre un plafond fictif. La note
> ne monte qu'à partir du commit **`7134d7fe`** et du run CI **`34846164939`** (cinq jobs verts,
> `Budget de bundle` compris) — la seule chose qui rend +5 opposable plutôt que déclaré.
>
> **Pourquoi +5 et pas seulement +2** (l'inverse exact de la baisse du 09-03) : la marge de sortie
> n'est pas revenue au niveau d'avant, elle le dépasse — 5,78 % contre 0 (rouge) sur l'entrée, et le
> défaut structurel (`sonner` statique dans des pages lazy, qui avait déjà produit un premier
> « faux vert » à 66,9 ko d'entrée mais 316,2 ko de critique) est fermé par une garde dédiée
> (`src/lib/toast.guard.test.ts`, vue rouge sur un import fautif) et non par une mesure ponctuelle.
>
> **Ce qui reste hors de portée d'une note** : les dépôts locaux/Supabase de quinze modules tirés
> statiquement par `repository.factory.ts` (269 ko bruts dans l'entrée, ~72 ko de seeds démo jamais
> exécutés en prod). C'est un chantier, pas un geste — non pris en compte dans ce +5.

> ### 🟠 2026-09-03 · la note BAISSE de 2 : la garde mesurait un artefact qui n'existe nulle part
>
> Le +3 du 2026-08-29 ci-dessous s'intitulait « la mesure existe enfin ». Elle existait, et **elle
> pesait le mauvais build**. `main.tsx` garde son `Sentry.init` derrière `if (sentryDsn)` ; sans
> `VITE_SENTRY_DSN`, Vite remplace la variable **à la compilation**, la branche devient du code
> mort et Rollup jette presque tout `@sentry/react`. La CI construisait sans la variable, Vercel
> l'a posée.
>
> | Même arbre, mêmes `node_modules`, seule la variable change | brut | gzip |
> |---|---|---|
> | `vendor-sentry` **sans** DSN (ce que la CI pesait) | 11 633 o | **3 818 o** |
> | `vendor-sentry` **avec** DSN (ce qui part en production) | 145 740 o | **49 276 o** |
>
> Deux conséquences, et la seconde est la pire :
>
> - `check:bundle` **sous-estimait le chemin critique d'environ 45 ko gzip** : il affichait
>   321,2 ko là où le bundle livré en pèse 367,1. La marge annoncée sous le plafond de 379,0 était
>   de 57,8 ko ; **il en reste 11,9**, soit quatre fois moins ;
> - les attributions de bootup du job `lighthouse` étaient **structurellement aveugles à Sentry**.
>   La conclusion T-47 « `vendor-sentry` n'apparaît dans aucun top 3, donc le différer ne rendrait
>   rien » a été **rétractée** : elle était tirée d'une mesure qui ne pouvait pas le voir.
>
> **Les deux points retirés ne sanctionnent aucune régression du produit.** Ils rendent un crédit
> versé sur une mesure fausse : la marge réelle a toujours été de 11,9 ko, on l'a seulement crue
> quatre fois plus grande pendant quatre jours. *Une garde qui mesure le mauvais artefact est pire
> qu'une garde absente : elle donne une réponse, et on la croit.*
>
> Ce que la fenêtre a rendu, en revanche :
>
> - les deux étapes de build de `ci.yml` posent la variable, et `check:bundle` **refuse désormais
>   de valider un budget** calculé sur un build dont `vendor-sentry` pèse moins de 20 ko gzip
>   (`SENTRY_FLOOR`), vérifié dans les deux sens ;
> - l'asymétrie est écrite : un job qui **pèse** un artefact et un job qui l'**exécute** n'ont pas
>   les mêmes besoins. Le faux DSN faisait s'initialiser Sentry pour de bon, qui émettait vers un
>   hôte inexistant, et `best-practices` tombait de 100 à 96 sur les quatre pages. `lighthouse` ne
>   prend donc que le vrai secret, sans repli ;
> - **T-51 corrigée par la mesure** : `vendor-animation` (11 675 à 11 992 ms) et `vendor-gsap`
>   (10 727 à 11 679 ms) sont **à égalité** sur `/`, et le MÊME `vendor-animation` ne coûte que
>   228 à 270 ms sur `/guide/`, **40× moins**. Le chunk n'est pas cher : c'est la quantité de
>   travail que la landing lui demande. Le correctif est dans la page, pas dans le découpage ;
> - l'entrée du hero de la landing est **en CSS**, plus en GSAP : elle ne dépend plus ni du chunk
>   de page ni des fontes, et la route `/` a son propre squelette sombre. Mesuré à 4× de bridage
>   CPU, la page affichait **deux secondes d'écran blanc** avec un spinner clair sur fond sombre.
>
> ⚠️ **Chiffres non remesurés ici** : le chunk d'entrée et le chemin critique n'ont pas été rebâtis
> le 2026-09-03. Les valeurs de référence sont celles du run vert du 2026-09-02, entrée **78,4 ko**
> sous un plafond de 79,0 et chemin critique **367,1 ko** sous 379,0.

> ### 2026-08-29 · +3, et la mesure existe enfin
>
> | | 08-27 | **08-29** |
> |---|---|---|
> | Chunk d'entrée | 106,9 ko | **75,5 ko** (plafond redescendu 112 000 → 79 000) |
> | Chemin critique | 393,9 ko | **364,3 ko** |
> | Octets au chargement de la landing | 2 530 ko bruts | **2 123 ko** · recharts n'arrive plus qu'à l'approche |
> | Job `lighthouse` | rouge depuis sa création | **vert**, seuils posés sur le premier run réel |
>
> Deux points viennent du poids, un vient du fait qu'**on mesure enfin**. Le job Lighthouse
> n'avait jamais produit un rapport : Chrome ne démarrait pas, puis la configuration mesurait la
> page 404 de la SPA au lieu des pages prérendues.
>
> 🔴 **Ce qui plafonne à 94, et c'est nommé** : la landing est à **55 de performance** avec jusqu'à
> 1,5 s de blocage du fil principal, quand le blog et le guide sont à 96-97 **sur le même build**.
> Suivi en T-51.

| Ce qui compose la note | 08-24 | 08-25 (16 h) | 08-25 (fin) | **08-27** |
|---|---|---|---|---|
| Chunk `index` (critical path) | 134 kB gzip | 139,0 kB gzip | 87,2 kB gzip | 🔴 **106,9 kB gzip** |
| Plafond du chunk d'entrée | aucun | aucun | 92 kB | 🔴 **112 kB** (relevé le 08-26) |
| **Chemin critique JS** (entrée + preloads) | non mesuré | 580,5 kB gzip | 420,1 kB gzip | **395,7 kB gzip** (plafond 400) |
| `vendor-charts` préchargé pour TOUS les visiteurs | oui, invisible | oui, invisible | non | non |
| **Ouvrir `/entreprise`** | 64,1 kB gzip | 64,1 kB gzip | 64,1 kB gzip | ✅ **12,2 kB gzip** |
| Lecture org-wide des tâches d'équipe au retour d'onglet | oui, depuis toute page | idem | idem | ✅ **non** |
| **Images servies sur `/`** | **1 046 kB** | 1 046 kB | **2,7 kB** | 2,7 kB |
| **Polices servies** | 133 kB | 133 kB | **48 kB** | 48 kB |
| Garde automatique sur le budget | ❌ aucune | ❌ aucune | ✅ `npm run check:bundle`, bloquante en CI | ✅ idem |
| Levier i18n (~104 ko de JSON hors chemin critique) | non appliqué | non appliqué | ✅ **appliqué** | ✅ appliqué |
| Lighthouse CI | câblé, seuils provisoires | idem | idem | idem |
| Mesure côté terrain (ms chez un utilisateur) | ❌ | ❌ | ❌ | ❌ |

**+24 en fin de journée, après être descendu à 64.** La page d'accueil passe de **~1,6 Mo à
749 ko** : le JavaScript perd 160 ko gzip, et les images passent de 1 046 ko à 2,7 ko.

Le plus instructif est la proportion : après une journée entière passée sur le JavaScript, **le
poste le plus lourd restait les images**, et personne ne l'avait jamais pesé.

### 2026-08-27 (soir) · note inchangée à 91, et pourquoi

Les deux derniers commits de la journée (`180fba1`, découpage de `TeamTasksTab` et correctifs
d'accessibilité ; `f32d080`, réservation de l'entrée de navigation) **ne touchent pas au budget** :
`npm run check:bundle` est vert avant comme après, et aucune des deux mesures du tableau ci-dessus
n'a été refaite. Le chunk d'entrée reste à **106,9 ko gzip** pour un plafond de 112, c'est-à-dire
que la dérive inscrite plus bas n'a **pas** été remboursée.

⚠️ Un correctif de **stabilité visuelle** est arrivé ce soir-là (la barre latérale ne se
réordonnait plus après la réponse réseau) : il appartient à l'expérience perçue, pas à ce
document, et **son gain n'est pas mesurable en CLS** dans les conditions disponibles (mesuré à 0
avant comme après, en mode démo, où la lecture est synchrone). Il est décrit dans
[`UI-PATTERNS.md`](../UI-PATTERNS.md) et [`MOBILE.md`](../MOBILE.md). *Ne pas le compter comme un
gain de performance : rien n'a été pesé.*

### 2026-08-27 · +3, tirés d'une seule page, et une dérive à inscrire

**Le gain.** `/entreprise` tenait dans un chunk unique de **279,0 ko bruts / 64,1 ko gzip**, le
4ᵉ du build, plus lourd que `vendor-react`. Ouvrir l'Aperçu téléchargeait donc aussi la pyramide,
le kanban, la frise des projets et les graphiques des statistiques, que la plupart des visites
n'ouvrent jamais. Les six onglets non-défaut, les cinq blocs de l'onglet Membres et les quatre
dialogues sont passés en import paresseux.

| Mesuré sur le build réel | Avant | Après |
|---|---|---|
| **Ouvrir `/entreprise`** | 279,0 ko bruts · **64,1 ko gzip** | 44,3 ko bruts · **12,2 ko gzip** |
| Ouvrir les 7 onglets **et** tous les dialogues | 279,0 ko bruts · 64,1 ko gzip | 257,1 ko bruts · **73,2 ko gzip** |
| Chunks du build | 160 · 1 242,3 ko gzip | 185 · 1 267,7 ko gzip |

⚠️ **Le découpage n'est pas gratuit et la ligne 2 le dit.** Qui ouvre TOUT paie 9 ko gzip de plus,
gzip compressant mieux un gros fichier que seize petits. Le compromis est assumé : le cas courant
coûte 5 fois moins, et c'est le premier écran qui décide de la perception. Ne pas découper plus
finement sans remesurer cette ligne-là, pas seulement la première.

`MyWorkTab` reste **eager** : c'est l'onglet par défaut, le rendre paresseux remplacerait l'écran
d'arrivée par un squelette à chaque ouverture pour n'économiser que ce qu'on va charger dans la
seconde. `lazyWithRetry` est sorti de `src/App.tsx` vers `src/lib/lazy-with-retry.ts` pour être
utilisable à l'intérieur d'une page ; la logique n'a pas changé, seul le type s'est ouvert aux
composants à props.

**Côté serveur, une lecture permanente en moins.** `useOrgBadges` est monté par `Layout`, donc sur
TOUTES les pages protégées, pour tout membre d'une organisation. Il montait `useTeamTasks` avec la
politique par défaut du hook — `staleTime` 30 s et `refetchOnWindowFocus` — alors qu'il n'affiche
pas la liste, il en dérive un chiffre. Chaque retour d'onglet et chaque navigation espacée de plus
de 30 s relançait donc `get_my_team_tasks`, la lecture la plus chère du produit
([SCALABILITY.md](../SCALABILITY.md) §2), pour repeindre une pastille. `useTeamTasks` gagne
`background`, symétrique de `live` : 5 min de fraîcheur et pas de refetch au retour d'onglet.

> ⚠️ **Gain toujours non chiffré en requêtes**, et il le restera jusqu'au déploiement : le mode
> démo est en `localStorage`, il n'y a aucune requête à compter, et les `edge_logs` ne peuvent
> montrer un « après » d'un correctif qui n'est pas encore en production. À ventiler par session
> le jour du déploiement, comme
> [le correctif des onglets zombies](#-le-correctif-que-personne-ne-reçoit--les-onglets-jamais-rechargés).
>
> ✅ **Mais le COMPORTEMENT dont ce gain découle est désormais vérifié** (2026-08-27, soir) :
> `src/modules/team-projects/hooks.background.test.tsx` compte les appels au repository. Avec
> `background`, un retour d'onglet horloge avancée n'en déclenche **aucun** ; sans lui, le **même**
> retour d'onglet en déclenche un.
>
> 🔴 **Le témoin négatif EST le test.** Une première version périmait la donnée par
> `invalidateQueries` : elle prouvait que l'invalidation marche, pas que le retour d'onglet
> déclenche quoi que ce soit dans ce harnais. Le test principal aurait alors constaté l'absence
> d'un rechargement que rien ne demandait, et serait passé au vert pour rien. Un troisième cas
> monte les deux observateurs sur la même clé et vérifie que `background` **ne gèle pas** l'écran
> qui, lui, affiche la liste. Un chiffre d'egress viendra confirmer une mécanique déjà prouvée ;
> il ne la remplace pas.

**La dérive qu'il faut inscrire, sinon elle disparaît.** Le chunk d'entrée mesurait **87,2 ko
gzip** le 2026-08-25 au soir. Il est à **106,9 ko** aujourd'hui, soit **+19,7 ko en deux jours**,
sans qu'aucune passe ne l'ait noté, et le plafond est passé de 92 à 112 ko le 2026-08-26 pour
l'absorber. C'est la seule remontée de plafond du dépôt, et elle est documentée dans
`scripts/check-bundle-budget.mjs` — mais un plafond relevé une fois est un plafond qu'on relèvera
deux fois. **C'est ce point qui empêche la note d'aller plus haut que 91**, pas le travail de la
journée.

| Chemin critique au 2026-08-27 | Valeur | Plafond |
|---|---|---|
| 8 chunks | 395,7 ko gzip | 400,0 ko |
| Chunk d'entrée | **106,9 ko gzip** | 112,0 ko (relevé de 92 le 08-26) |

### 2026-08-26 · ce qui a été mesuré depuis, et pourquoi la note ne bouge pas

La note ci-dessus mesure **le poids envoyé au navigateur**. La journée du 2026-08-26 a mesuré un
autre axe, jamais chiffré jusque-là : **ce que l'application demande au serveur une fois
chargée**. Rien n'a changé dans le bundle, donc la note reste à 88, mais trois chiffres sont
désormais connus et ils vivent dans les sections
[Ce que coûte une ouverture d'application](#ce-que-coûte-une-ouverture-dapplication) et
[Limites de requêtes](#limites-de-requêtes) :

| Ce qui a été mesuré | Résultat | Statut |
|---|---|---|
| Requêtes REST au chargement de l'application | **29 → 21** | ✅ 8 retirées le 2026-08-27 (4 sans migration, 4 par la mig. 129) |
| Part du trafic Supabase du jour venant d'onglets non rechargés | **91,5 %** | 🔴 aucun mécanisme de mise à jour |
| Lecture d'agenda hiérarchique (`events`) | **17,19 ms → 0,61 ms** | ✅ mig. `128`, **appliquée en prod le 2026-08-27** |
| Statistiques, 32 plages (`get_work_time_stats`) | **854 ms → 12,0 ms**, 21 762 → 23 blocs lus | ✅ mig. `127`, **appliquée en prod le 2026-08-27** |

⚠️ **Une note de performance front ne dit rien du coût serveur.** Les deux axes ont été confondus
jusqu'ici : le bundle a été divisé par deux le 2026-08-25 alors que l'ouverture coûtait déjà
32 requêtes, et personne ne le savait.

### Ce qui a produit le gain, dans l'ordre

1. **Les catalogues i18n suivent leur page** (−42,9 kB gzip sur l'entrée, 139,0 → 96,1).
   Le catalogue `fr` était importé statiquement dans son intégralité : 178 ko de JSON brut dans le
   chunk d'entrée, dont `org` 50 ko, `landing` 34 ko et `guide` 14 ko, des pages que la plupart
   des sessions n'ouvrent jamais. Seuls `common` et `errors` restent eager ; les 17 autres sont
   chargés par le gate de route.
2. **`clsx` sortait `vendor-charts` du lazy** (−8,9 kB sur l'entrée, et surtout **−117,5 kB de
   préchargement pour tout visiteur**). Détail ci-dessous : c'est le finding le plus rentable du
   fichier, et il était invisible.

### 🔴 Le finding qui ne se voyait pas : recharts était sur le chemin critique

Ce document affirmait depuis des semaines que `vendor-charts` était **lazy**. Il ne l'était pas.

`dist/index.html` portait `<link rel="modulepreload" href="…/vendor-charts-….js">`, donc
**117,5 kB gzip de recharts + d3 étaient téléchargés par chaque visiteur**, sur la landing, sur
`/login`, partout —, sans jamais être exécutés hors des trois écrans qui font des graphiques.

**La cause tient en une ligne de `manualChunks`.** `cn()` (`src/lib/utils.ts`) appelle `clsx`,
donc `clsx` est dans le graphe de l'entrée. Mais recharts importe `clsx` lui aussi, et un module
partagé entre l'entrée et un **chunk manuel** est absorbé par le chunk manuel. `clsx` atterrissait
donc dans `vendor-charts`, ce qui en faisait un import **statique** de l'entrée, ce qui déclenchait
le `modulepreload`. Une fonction utilitaire de 500 octets traînait 117 kB derrière elle.

**Correctif** : assigner explicitement `clsx`, `tailwind-merge` et `class-variance-authority` à
`vendor-utils`. Trois lignes.

> ⚠️ **La leçon vaut plus que le correctif.** Cette phrase, « `vendor-charts` est lazy », était
> écrite ici, relue plusieurs fois, et fausse. Personne ne l'a vue parce que **le tableau des
> chunks mesure les tailles, pas le graphe de chargement**. Un chunk peut être « lazy » au sens de
> Rollup et préchargé au sens du navigateur. Vérifier `dist/index.html`, pas seulement `dist/assets`.

### 🔴 La MÊME affirmation, fausse une seconde fois, pour une autre raison (2026-08-29)

Le finding ci-dessus a retiré le `modulepreload`. Mesuré dans le navigateur trois semaines plus
tard, requêtes réseau à l'appui : **`vendor-charts` partait toujours au chargement de la landing**,
413 ko bruts. Plus par préchargement, cette fois, mais par rendu.

`FeaturesSection` déclare `const StatsShowcase = lazy(() => import(...))`, et le rend
**immédiatement**, dans la liste des cinq panneaux. Or `React.lazy` **découpe** le code, il ne le
**diffère** pas : un composant `lazy` monté tout de suite déclenche son import tout de suite. Le
chunk part au chargement de la page, comme s'il était statique, à un aller-retour près.

**Correctif** : `src/components/showcase/WhenVisible.tsx`, un `IntersectionObserver` avec 600 px de
marge, qui ne monte le panneau qu'à son approche. Le repli, sans `IntersectionObserver`, rend le
contenu plutôt que rien : une optimisation ne doit jamais pouvoir faire disparaître du contenu.

| Landing, même machine, même serveur statique | avant | après |
|---|---|---|
| octets au chargement | 2 530 ko | **2 123 ko** |
| LCP | 3,3 s | **2,7 s** |
| TTI | 3,4 s | **2,8 s** |
| performance Lighthouse | 63 | 65 |

Les deux moitiés vérifiées dans le navigateur : le chunk n'est **pas** demandé au chargement, et il
l'est bien quand on fait défiler vers la section, où le graphique s'affiche.

> ⚠️ **La leçon complète la précédente, et elle est plus gênante.** La première fois, la phrase
> « `vendor-charts` est lazy » était fausse et se prouvait dans `dist/index.html`. La seconde fois,
> elle était fausse **alors que `dist/index.html` était propre** : ni le tableau des chunks, ni le
> graphe de préchargement ne la contredisaient. Seule la **liste des requêtes réelles** d'un
> chargement de page la contredisait.
>
> *Un chunk peut être lazy pour Rollup, absent du préchargement, et téléchargé quand même.* La
> seule preuve qui vaut est ce que le navigateur demande.

### Ce qui plafonne encore à 91

- ✅ **Refermé le 2026-08-28 : le chunk d'entrée passe de 106,9 à 75,5 ko gzip**, et le plafond
  REDESCEND de 112 000 à 79 000 o. Le chemin critique, la mesure qui compte, tombe de 393,9 à
  **364,3 ko** — pour tout visiteur, y compris celui qui rebondit.

  Deux leviers, trouvés en écrivant l'outil qui manquait (`npm run analyze:entry`, qui dit enfin
  ce que l'entrée CONTIENT et pas seulement combien elle pèse) :

  1. **`zod` (131,8 ko bruts) n'a rien à faire à l'ouverture.** C'est une garde UX, explicitement
     pas la frontière de sécurité, et ses 17 points d'appel sont tous dans une `mutationFn`, donc
     déjà asynchrones et derrière un geste. Elle se charge désormais à la première écriture
     (`src/lib/validation/lazy.ts`). Les trois barrels qui réexportaient des schémas sans aucun
     consommateur ont été nettoyés : un export mort suffisait à rattacher zod à tout fichier
     important le barrel pour une autre raison.
  2. **Le `<TooltipProvider>` d'`App.tsx` était REDONDANT.** Le composant `Tooltip` de
     `ui/tooltip.tsx` fournit déjà le sien, avec le même `delayDuration`. Celui du shell traînait
     `@radix-ui/react-tooltip` **et tout `floating-ui`** — 113 ko bruts — pour **un seul**
     consommateur réel, `OrgTabBadge`, déjà dans un chunk lazy.

  ⚠️ La leçon est celle de recharts, à l'identique : *le plus gros poste du chemin critique était
  là par accident, et personne ne pouvait le nommer faute d'outil pour regarder dedans.*

- **Les seuils Lighthouse restent provisoires**, jamais posés au réel : la moitié de la mesure
  côté navigateur (LCP, TBT, CLS) n'est donc toujours pas gardée.
- **`vendor-sentry` (49,2 kB gzip) reste sur le chemin critique.** Le différer est techniquement
  simple, mais ce n'est pas un arbitrage de performance : ça revient à ne plus capturer les
  erreurs du démarrage, celles qui blanchissent l'écran. **Non fait volontairement**, à trancher.
- **Rien n'est mesuré côté terrain.** Tous les chiffres ci-dessus sont des octets, pas des
  millisecondes chez un utilisateur.

---
