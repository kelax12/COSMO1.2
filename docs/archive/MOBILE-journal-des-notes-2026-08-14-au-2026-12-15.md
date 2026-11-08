> ⚠️ **ARCHIVE : journal des notes mobile / DA, rétractations et mesures (2026-08-14 → 2026-12-15), extrait de `docs/MOBILE.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/MOBILE.md`](../MOBILE.md). Les notes /100 ont cessé (ADR 0012) : l'état de santé se lit dans [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

## Note mobile / DA : 62 → 72 → 74 → 76 → 79 → 76 → 78 → 73 → 75 → 74 → 74 → 75 → 76 → 78 → 78 → 78 → 77 → 78 → **78 / 100** (2026-08-24 → 2026-08-25 → 2026-08-27 → 2026-08-29 → 2026-09-14 → 2026-09-14 soir → 2026-09-15 → 2026-09-16 → 2026-09-22 soir → 2026-10-01 → 2026-10-02 soir → 2026-10-03 → 2026-10-15 → 2026-10-16 → 2026-10-18 → 2026-10-20 → 2026-10-22 → 2026-10-25 → **2026-11-06**)

> ### ⚪ 2026-11-06 · 0 : vérifiée inchangée
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-11-06 : CI de `main` du 2026-10-26 au 2026-11-06 (75 runs, dernier `e2e` complet vert à `ba169ba1`), workflows planifiés relus run par run, production (advisors par l'API, catalogue, Edge Functions), alertes GitHub, dépôt à `c3294936` puis `d938bc6e`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-11-06 |
> |---|---|---|
> | `e2e` mobile (`mobile-safari`, Android) | 0 | vert à `ba169ba1` |
> | Appareil réel | 0 | toujours aucune mesure (A-4, `C-24`) ; séance VoiceOver attendue avant le 2026-12-15 |
> | `Visual` rouge huit jours | 0 | débité une fois, dans [`UI-PATTERNS.md`](../UI-PATTERNS.md) |
>
> **78 → 78.**

> ### 🟠 2026-10-22 (passe) · −1 : le LCP mobile crédité le 10-16 est perdu
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-10-22 : CI de `main` à `d16de29a` (run `39843255180`, cinq jobs verts ; `main` rouge du 10-20 à 22:03 au 10-22 à 14:39, 19 runs), `Visual` vert à `fb83cd60`, production (advisors par l'API, catalogue, ledger, cron, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-22 |
> |---|---|---|
> | 🔴 LCP mobile de 4,5 à 6,0 s sur six URLs sur huit | **−1** | le +1 « LCP mobile » du 2026-10-16 repris : 1,36 à 1,52 s le 10-18, **`/guide/` 5,4 à 5,6 s, `/en/` 5,9 à 6,0 s** le 10-22. Détail et cause dans [`PERFORMANCE.md`](../PERFORMANCE.md), débité là aussi |
> | ✅ WebKit | 0 | trois instables triés et corrigés (PR n° 94 : un produit, deux harnais) ; **aucun** instable `mobile-safari` au run `39843255180`. Les instables n'avaient pas été débités |
> | ✅ Agenda en paysage, « Filtres » à 44 px | 0 | 447 → 0 px, plafond abaissé à 0 ; `MobileFiltersButton` 44 × 44. Jamais débités, comme les 11 commandes sous 44 px de `/entreprise/projects`, trouvées ce jour et laissées hors spec |
>
> **78 → 77.**

> ### 🟡 2026-10-22 · instables WebKit triés : un produit, deux harnais
>
> Les cinq derniers runs `CI` de `main` (`311fa8a3` → `5eaa8b8c`, job `e2e`, logs et rapports Playwright) portent **quatre** cas `mobile-safari` instables, en trois familles. Chacune ouverte à l'écran (capture et instantané d'accessibilité du rapport CI, code du composant), pas lue sur son délai. PR [#94](https://github.com/kelax12/COSMO1.2/pull/94).
>
> | Cas | Runs | Verdict | Cause mesurée | Correctif |
> |---|---|---|---|---|
> | `expectOrgSectionOffered` (`fixtures.ts`) : `demo-entreprise › Aperçu`, `demo-entreprise-okr-modal › Organigramme` (la « modale OKR » des notes précédentes : c'est la feuille de section qui restait ouverte, pas la modale) | 2 / 5 | **PRODUIT** | `useModalA11y` posait son écouteur d'Échap dans un effet **passif**, qui tourne après la peinture : `OrgSectionSheet` (lazy) était à l'écran, le focus bientôt dedans, et Échap perdu. Instantané CI : bouton de section `expanded`, donc `onClose` jamais appelé | `useLayoutEffect` (les 58 surfaces du hook en profitent). Garde jsdom déterministe dans `use-modal-a11y.guard.test.tsx` : **rouge sous `useEffect`** (12 / 13, mesuré), verte après (13 / 13), avec son témoin |
> | `demo-touch-gestures › swipe droit` | 1 / 5 (et les 10-09, 10-18, 10-20) | HARNAIS | Framer Motion 12 (`PanSession`) ne reconnaît le glissé qu'à la frame **suivant** le mouvement, et `pointerup` annule cette frame. `down`, 12 `move` et `up` traités par WebKit chargé sans frame rendue comptent pour un appui : le second glissé échouait donc aussi. Un doigt reste au moins une frame sur l'écran | le geste attend deux frames rendues ; la seconde tentative est **retirée** |
> | `demo-journeys › compléter une tâche` (fixture `demoPage`) | 1 / 5 | HARNAIS | `dispatchEvent` sans délai propre attendait un CTA démo déjà démonté jusqu'au délai du **test** (3 min) ; le retry passait en 2,6 s | attentes bornées, URL relue après 5 s |
> | `demo-touch-gestures › sheet « Plus », tap sur le fond` | 1, sur la CI de la PR (`e058ee65`) | HARNAIS | même famille que le swipe : la boîte du sheet lue pendant sa montée en ressort plaçait le tap sur le sheet une fois posé | position stable avant mesure, point vérifié sur le fond dans la page |
> | `demo-billing-disarmed` | 5 / 5 | hors périmètre | rouge sur `chromium` **et** WebKit, déterministe : PR #87 | — |
>
> ⚠️ Aucun écart Safari à déclarer : aucun des trois n'était un comportement propre à Safari, seulement un moteur plus lent qui ouvrait plus grand deux fenêtres de course. Aucune assertion relâchée, aucun retry ajouté.
> ❌ Rejeu local WebKit **non concluant** (machine à ~600 Mo libres : CTA démo à 30 s dans la fixture). La preuve est la CI de la PR, les quatre cas joués ×5 sans retry.

> ### 🔧 2026-10-22 · `/agenda` en paysage : 447 → 0 px (note non touchée)
>
> Le dernier cliquet non nul du paysage (`PLAFOND_PAYSAGE`, `e2e/mobile-android.spec.ts`). Mesuré sur `main` à `5eaa8b8c`, Pixel 7 tourné (863 × 360), démo, vues jour, semaine et mois.
>
> | | Avant | Après |
> |---|---|---|
> | Débordement de page, 863 × 360 (jour / semaine / mois) | **447 / 447 / 445 px** | **0 / 0 / 0 px** |
> | Ce qui sortait | la barre d'outils de `AgendaDesktopHeader` (en `md:` et plus) : une rangée sans retour à la ligne, ~1 100 px de contenu dans une colonne de 434 px. « Mois » rogné ; flèches, « Récurrences » et « Nouveau » invisibles, sans trace | tout visible, sur 2 rangées (115 px de haut) |
> | Même barre à 1 024 / 1 280 / 1 600 px de large | **386 / 130 / 0 px** coupés (« Nouveau » perdu sur un portable) | 0 / 0 / 0 px ; 1 600 px inchangé, sur une ligne |
>
> Pas la grille FullCalendar : elle tenait déjà dans sa colonne. Correctif : la rangée se replie (`flex-wrap`, groupe central en `contents`, deux `ml-auto` qui rendent l'ancien `justify-between` sur une ligne) ; sous `lg`, « Tâches », « Récurrences » et « Nouveau » passent en icône, le nom restant dans `aria-label`. Plafond `/agenda` abaissé à **0**. La note n'est pas recalculée ici : le remboursement attend la CI verte de la PR, puis la prochaine passe d'audit.

> ### ⚪ 2026-10-22 · remesure de C-57, note non rejouée (elle se rejoue à la passe d'audit)
>
> Le −1 « cibles tactiles sous 44 px » des 10-01 et 10-02 est déjà remboursé (+1 le 10-02 au soir, +1 le 10-03). Remesuré à `5eaa8b8c`, mode démo, 375 px : `touch-targets` **19/19 sur `chromium`, 20/20 sur `mobile-safari`** ; « Valider » **82 × 44**, « Renvoyer » **97 × 44**, rendus. Un défaut neuf, même classe, hors de la spec : « Filtres » (`MobileFiltersButton`, onglets Tâches, Projets, Membres de l'entreprise) à **42 × 40**, porté à 44 × 40 avec une zone de 44 × 44 ; `/entreprise/tasks` entre dans la spec. Spec modifiée : 20/20 et 21/21 en local. Reste hors spec : `/entreprise/projects`, tableau de bureau à 375 px, 11 commandes sous 44 px. Détail : [`ACCESSIBILITY.md`](../ACCESSIBILITY.md).

> ### ⚪ 2026-10-20 · 0 : inchangée
>
> Mesures du 2026-10-20 : CI de `main` à `86ea357f` (run `39408311331` : `lint-test-build` et `e2e` rouges, trois jobs verts ; **29 runs rouges de suite** depuis `a9db6f2c`), `Visual` rouge, production (advisors par l'API, catalogue, ledger, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](README.md).
>
> | Item | Effet | Mesuré le 2026-10-20 |
> |---|---|---|
> | WebKit | 0 | 2 instables `mobile-safari` (modal OKR, swipe de TaskCard), comme au 10-18 ; le débordement C-97 de `mobile-chrome` est débité une fois, en Accessibilité |
>
> **78 → 78.**

> ### ⚪ 2026-10-18 · 0 : vérifiée inchangée
>
> Dernière passe avant l'acquisition. Mesures du 2026-10-18 : CI de `main` à `e69cb729` (run `39139204925`, cinq jobs verts) et à `15d40bea` (`lint-test-build` vert, run `39156293593`), production (advisors par l'API, catalogue, cron, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-18 |
> |---|---|---|
> | WebKit | 0 | `e2e` à `e69cb729` : 2 instables sur 255 verts, deux parcours démo `mobile-safari` de 3 min, comme au 10-16 |
> | LCP mobile | 0 | **1,36 à 1,52 s** sur les 8 URLs |
>
> **78 → 78.**

> ### 🟢 2026-10-16 · +2 : LCP mobile sous 1,6 s, et WebKit vert de bout en bout
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du
> 2026-10-16 : CI de `main` à `a4878cab` (run `38902071817`). Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-16 |
> |---|---|---|
> | ✅ LCP mobile, point retenu le 10-15 (−2 le 09-22) | **+1** | LCP **1,22 à 1,52 s** sur les 8 URLs, TBT 90 à 300 ms (cf. [`PERFORMANCE.md`](../PERFORMANCE.md)) |
> | ✅ Parcours rouges sur WebKit (−1 le 09-22, jamais remboursé) | **+1** | `e2e` vert en CI sur `mobile-safari` et `mobile-chrome` (`38870561074`, puis `38902071817` : 0 échec), et l'audit clavier y joue désormais (`C-118`) |
> | `M-25` · essai sur un vrai téléphone | 0 | fermé le 2026-10-16 sur la parole d'Axel, sans modèle, OS ni navigateur relevé : `C-56` et `C-57` ne sont ni confirmés ni infirmés au doigt. Un constat, pas une mesure |
>
> **76 → 78.**

> ### 🟢 2026-10-15 · +1 : le LCP mobile sort de « mauvais »
>
> **Même règle** : un angle mort ne se rembourse que sur un verdict rendu en CI, un défaut que
> lorsqu'il est corrigé et vérifié. Mesures de la nuit du 14 au 15 : CI de `main` à `6847bbf3`,
> dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-15 |
> |---|---|---|
> | ✅ LCP mobile (−2 le 09-22) | **+1** | **3,26 à 3,40 s** sur les 8 URLs, Lighthouse mobile en CI à `HEAD` (5,6 à 8,4 s le 10-02). **Un point retenu** : au-dessus de 2,5 s, et le fil principal reste chargé sur les pages animées (TBT 878 à 1 049 ms sur `/`, `/en/`, `/entreprise-presentation/`) |
> | Refonte « Une seule lumière » (maquettes 129 à 374, 10-10 et 10-11) | 0 | ses quatre rouges réparés (`8079039c`). À `HEAD`, aucun échec sur `mobile-safari` ni `mobile-chrome`, deux cas instables sur WebKit. `C-97` (texte à 200 % sur `/dashboard`), rouge sur `mobile-chrome` les 10-12 et 10-13, est absent des échecs à `HEAD` |
>
> **75 → 76.**

> ### 🟢 2026-10-03 · +1 : les cibles de l'Aperçu à 44 px, vues vertes en CI
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Verdict : run `CI`
> `37109937640` sur `c7fb936c`, **les cinq jobs verts**, le premier `CI` entièrement vert sur `main`
> depuis le 2026-09-23 (`869fb05a`). Correctifs : `d8b1584b`, `16fbaae9`, `ac1e8c40`, `59aa4fd8`,
> `315804df` (autres sessions) et `d8c215ad`, `290d6f51`, `c7fb936c` (celle-ci).
>
> | Item | Effet | Mesuré le 2026-10-03 |
> |---|---|---|
> | ✅ Trois commandes de l'Aperçu à 36 px (−1 le 10-02) | **+1** | `16fbaae9`, verts en CI sur WebKit (`mobile-safari`) |
> | Specs WebKit en retard sur le mobile | 0 | trois tests réécrits (`315804df`) : ils supposaient un compteur de liste que le mobile masque, et un survol qui n'existe pas au doigt. Le produit, lui, était juste |
>
> **74 → 75.**

> ### ⚪ 2026-10-02 (soir) · 0 : les cibles tactiles vérifiées en CI, puis une nouvelle rangée sous 44 px
>
> **Même règle que le 2026-09-22** : un angle mort ne se rembourse que sur un verdict rendu en CI, un
> défaut que lorsqu'il est corrigé et vérifié. Mesures du soir : CI de `main` à `9ea33927` (dernier
> `e2e` complet : `f301f0bf`, run `37019682064`), production (advisors par l'API, catalogue, ledger),
> dépôt à `HEAD`.
>
> | Item | Effet | Mesuré le 2026-10-02 (soir) |
> |---|---|---|
> | ✅ Cibles tactiles du 2026-10-01 | **+1** | vérifié en CI (`f301f0bf`) : les quatre commandes corrigées sortent des listes de `touch-targets`. Le bloc 🟡 du matin, juste en dessous, est soldé |
> | 🔴 « Valider », « Renvoyer », « Voir le détail » à 36 px de haut | **−1** | refonte de l'Aperçu (`3609210c`) : `/entreprise` et la modale de tâche d'équipe rouges en chromium **et** en WebKit, pour ces cinq commandes seulement. Détail : [`ACCESSIBILITY.md`](../ACCESSIBILITY.md) |
> | WebKit : `/` et `/entreprise-presentation` | 0 | navigation interrompue avant toute mesure : harnais, pas un verdict |
>
> **74 → 74.** Détail : [tableau de bord](../README.md).

> ### 🟡 2026-10-02 · 0 : cibles tactiles corrigées, remboursement en attente de la CI
>
> | Item | Effet | Mesuré le 2026-10-02 |
> |---|---|---|
> | Cibles tactiles sous 44 px | **0** (+1 au verdict CI) | `TAP_AREA_44_Y` sur « Sélectionner plusieurs tâches » (106 × 32), « Suivre cette tâche » (149 × 36), « Gérer les cookies » (115 × 20, pied de page de la landing) et les pastilles de listes de la fiche de tâche d'équipe (36 px de haut, rangée passée à `gap-y-2` : 6 px entre rangées aurait fait chevaucher deux débords de 4 px). Le dessin ne bouge pas. `touch-targets` vert en local sous chromium à 375 px. Détail : `ACCESSIBILITY.md` |
>
> **74 → 74**, en attente de la CI.

> ### 🟠 2026-10-01 · −1
>
> **Même règle que le 2026-09-22** : un angle mort ne se rembourse que sur un verdict rendu en CI, un
> défaut que lorsqu'il est corrigé et vérifié. Mesures du jour : CI de `main` (`43fed445` à
> `7cd73d24`), production (catalogue, advisors), dépôt à `HEAD`.
>
> | Item | Effet | Mesuré le 2026-10-01 |
> |---|---|---|
> | 🔴 Cibles tactiles sous 44 px | **−1** | « Sélectionner plusieurs tâches » 106 × 32, « Suivre cette tâche » 149 × 36 (cf. `ACCESSIBILITY.md`). Compté ici aussi : c'est un défaut au doigt |
> | LCP mobile, parcours WebKit | 0 | déjà payés ; les échecs `mobile-safari` du jour sont ceux de chromium (suite entreprise en retard sur l'écran), comptés dans `TESTING.md` |
>
> **75 → 74.** Détail : [tableau de bord](../README.md).

> ### 🟢 2026-09-22 (soir) · +2 : remesure item par item, contre la CI réelle et la production
>
> **Règle appliquée**, déclarée au [tableau de bord](../README.md) : un angle mort payé le 2026-09-16
> n'est remboursé que si sa garde a rendu **au moins un verdict exploitable en CI** (vert, ou
> rouge sur un vrai défaut). Une garde posée mais jamais jouée, ou cassée, ne rembourse rien.
> Un défaut nommé ce soir coûte selon le barème du 09-16.
>
> | Item | Effet | Mesuré le 2026-09-22 |
> |---|---|---|
> | `C-78` · WebKit en CI | **+1** | le point laissé le 09-15 (« +2 et non +3 ») |
> | AM-2 · aucun Android | **+2** | project `mobile-chrome` (Pixel 7) joué dans le job `e2e` |
> | AM-3 · perf mobile | **+1** | Lighthouse mobile joué (et il mesure mal, ligne suivante) |
> | AM-4 · réseau / CPU bridés | **+1** | CPU ×4 par CDP, joué dans `mobile-android.spec.ts` |
> | AM-5 · paysage et police 200 % | **+1** | joués |
> | 🔴 LCP mobile « mauvais » sur 8 URLs sur 8 | **−2** | 5,6 à 8,3 s ; `/entreprise-presentation/` **8,3 s** |
> | 🔴 Texte à 200 % : trois cas ROUGES, pas des cliquets | **−1** | `/dashboard` déborde de **12 px**, `/settings` de **649 px**, `/tasks` de **1 182 px**. Ce document les disait « cliquets posés au mesuré » : ils **échouent** en CI (WCAG 1.4.4) |
> | 🔴 Parcours rouges sur WebKit | **−1** | **20** échecs `mobile-safari` à `806e7745`, dont créer une tâche, persistance d'une habitude, carte OKR, 3 `reduced-motion-sheets`. Part produit / harnais non triée, d'où −1 et non −2 |
>
> **73 → 75.** Détail, règle et ordre de réparation : [tableau de bord](../README.md).

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
> | AM-2 · **un seul téléphone, un seul moteur, aucun Android** | −2 | Chrome Android est le premier navigateur mobile du marché |
> | AM-3 · la performance mobile n'est mesurée par rien | −1 | Lighthouse est en preset `desktop` |
> | AM-4 · aucune mesure sur appareil réel ni réseau bridé | −1 | c'est la classe de défaut de `C-68`, trouvé en bridant à la main |
> | AM-5 · ni paysage, ni grandes polices système | −1 | aucun cas ne change d'orientation |
> | AM-1 · les 105 cas `mobile-safari` hors CI | 0 | déjà payé le 2026-09-14 (−3) |
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
| AM-1 | ✅ **COMBLÉ le 2026-09-16, vérifié le 2026-09-20.** Était : « les 105 cas `mobile-safari` ne tournent dans aucun workflow » (item `C-78`), le seul project qui mesure WebKit, donc iOS | 🔴 **Cet énoncé était périmé le jour où il a été écrit.** `git show HEAD:.github/workflows/ci.yml` lance `--project=chromium --project=supabase-stub --project=mobile-safari`, et `e2e/_warmup-mobile.spec.ts` est suivi par git : entré avec `af0190bd`, **le 2026-09-16**. ⚠️ Un moteur mobile joué en CI n'est ni un appareil réel, ni Android, ni un réseau bridé : cf. AM-2 et AM-4, ouverts | ✅ **FERMÉ le 2026-09-16** · `C-78`, `af0190bd`. ⚠️ L'énoncé « écrit, non commité » était périmé **le jour même de sa publication** |
| AM-2 | **Un seul modèle de téléphone, un seul moteur.** Tout est mesuré sur iPhone 12 / WebKit. **Aucun Android réel**, alors que Chrome Android est le premier navigateur mobile du marché | `playwright.config.ts` : un seul device mobile | ✅ **OUTILLÉ le 2026-09-20** · project `mobile-chrome` (Pixel 7) + `e2e/mobile-android.spec.ts` (`C-97`) — 🔴 ne prouve PAS : un appareil **émulé** sur un runner : ni thermique, ni GPU mobile |
| AM-3 | **La performance mobile n'est mesurée par rien en continu.** Lighthouse tourne en preset **desktop** (cf. [`PERFORMANCE.md`](../PERFORMANCE.md) AM-1) | `lighthouserc.json` : `"preset": "desktop"` | ✅ **OUTILLÉ le 2026-09-20** · `lighthouserc.mobile.json` (`C-84`) — 🔴 ne prouve PAS : que les seuils soient justes : première pose, à rabaisser au mesuré · 🔎 🔴 **2026-09-22 : il mesure, et c'est mauvais** : LCP 5,6 à 8,3 s sur les 8 URLs (cf. `PERFORMANCE.md`) · 🔎 **2026-09-24 : cause trouvée** (le HTML prérendu n'est jamais peint, le premier rendu attend React), cf. [`PERFORMANCE.md`](../PERFORMANCE.md) § « C-116 » |
| AM-4 | **Aucune mesure sur appareil réel ni sur réseau bridé.** Un émulateur de bureau ne reproduit ni le GPU d'un téléphone d'entrée de gamme, ni la 4G. C'est précisément la classe de défaut de `C-68` (le shader qui saturait le tampon GPU) | `C-68` n'a été trouvé qu'en bridant le CPU à la main | ✅ **OUTILLÉ le 2026-09-20** · CPU bridé **×4 par CDP**, avec son témoin qui vérifie que le bridage s'applique (`C-97`) — 🔴 ne prouve PAS : l'appareil réel, qui reste **`M-25`** — un bridage n'est pas un téléphone |
| AM-5 | **Le mode paysage et les grandes tailles de police système ne sont testés nulle part** | aucun cas ne change d'orientation ni de `font-size` racine | ✅ **OUTILLÉ le 2026-09-20** · paysage et police à **200 %** mesurés dans `e2e/mobile-android.spec.ts` (`C-97`) — 🔴 ne prouve PAS : rien de plus que ce qu'il mesure : 2 routes débordent en paysage et 3 à 200 %, cliquets posés **au mesuré**, ils ne peuvent que descendre · 🔎 🔴 **2026-09-22 : les trois cas « 200 % » sont ROUGES en CI**, pas des cliquets verts : débordement de 12 px (`/dashboard`), 649 px (`/settings`), 1 182 px (`/tasks`) |


> ### 🟢 2026-09-15 · +2 sur les 3 retirés : le périmètre est élargi, le moteur mobile ne l'est pas encore
>
> **Deux des trois points reviennent, pas les trois**, et la différence se lit dans l'entrée
> d'hier : elle retirait 3 points pour DEUX défauts distincts, le périmètre de la garde et le fait
> qu'aucune suite mobile ne tourne sur un moteur mobile. Le premier est refermé (C-80), le second
> ne l'est pas a cette date (C-78, en cours).
>
> `e2e/touch-targets.spec.ts` couvre désormais **8 pages publiques** en plus de ses 8 routes
> protégées : `/`, `/entreprise-presentation`, `/guide`, `/blog` et les quatre pages cas d'usage.
> **18 cas sur 18 verts** sur Chromium, contre 15 verts / 3 rouges au premier passage de la boucle
> élargie.
>
> 🔴 **Le curseur de forfait est le correctif qui comptait, et il est MESURÉ dans WebKit / iPhone
> 12, pas dans un Chrome rétréci** : `{"w":308,"h":6}` avant, `{"w":308,"h":44,"appearance":"none"}`
> après. C'est l'outil avec lequel un prospect choisit son palier, sur la page qui vend l'offre.
>
> ✅ **La réserve d'hier est levée dans le sens qu'elle redoutait** : « la zone tactile réelle du
> curseur peut excéder la piste selon le moteur, à vérifier avant de conclure ». Vérifié : elle ne
> l'excédait pas.
>
> ❌ **La piste visuelle n'a PAS grossi**, et ne doit jamais grossir : c'est la hauteur de
> l'ÉLÉMENT qui monte à 44 px, fond transparent, la piste descendant dans
> `::-webkit-slider-runnable-track` / `::-moz-range-track` où elle garde ses 6 px. Capture WebKit à
> l'appui.
>
> ⚠️ **Trois des huit défauts n'étaient pas des cibles trop petites, c'étaient de FAUSSES
> COMMANDES** : un `button` de maquette à `tabIndex={-1}` sans `onClick`, et deux flèches « Semaine
> (démo) » du `/guide`, dans des dessins de téléphone dont tous les autres éléments sont des `div`.
> ❌ Ne jamais « corriger » ce cas-la en agrandissant a 44 px : ce serait poser une cible tactile
> sur une image, donc promettre un appui qui ne fait rien. Un élément non interactif se retire de
> l'arbre d'accessibilité, il ne se met pas aux normes.
>
> 🔴 **Ce qui NE bouge pas** : aucune de ces mesures n'est rejouée par la CI sur WebKit. Le project
> `mobile-safari` reste hors CI à cette date. Le troisieme point ne reviendra qu'avec C-78.


> ### 🔴 2026-09-14 (soir) · −3 : « 0 cible tactile trop petite » ne vaut que des 8 routes protégées, et les pages publiques en portent 24
>
> L'entrée de ce matin inscrit « **Cibles tactiles < 44×44 px : 0**, 10/10 cas E2E verts ». La
> mesure est juste. **Ce qu'elle couvre ne l'est pas.** `e2e/touch-targets.spec.ts` boucle sur une
> liste écrite en clair : `/dashboard`, `/entreprise`, `/okr`, `/tasks`, `/habits`, `/settings`,
> `/agenda`, `/statistics`, soit **huit routes protégées, et aucune page publique**.
>
> **Mesuré ce soir contre la PRODUCTION**, WebKit / iPhone 12, bandeau cookies refusé, après
> stabilisation :
>
> | Page publique | Cibles sous 44 × 44 px |
> |---|---|
> | `/` (landing, parcours perso) | **24** |
> | `/entreprise-presentation` | **23** |
> | `/blog` | 2 |
>
> ⚠️ **Toutes ne se valent pas, et il faut les trier au lieu d'agiter le total** :
>
> - **Les liens de pied de page** (~20 px de haut : « Guide d'utilisation », « Pour les
>   freelances », « FAQ », …) représentent la majorité du compte. Ils échouent au critère AAA
>   (2.5.5, 44 px) mais relèvent d'un usage courant et passent le critère AA (2.5.8, 24 px) sur leur
>   largeur. C'est une dette de confort, pas un blocage.
> - 🔴 **Le bouton « Commencer » du header fait 115 × 36 px**, et « Cosmo » 116 × 36. Ce sont les
>   deux commandes les plus en vue de la page la plus visitée du produit, et elles sont **8 px sous
>   le plancher** que le reste de l'application respecte partout.
> - 🔴 **Le curseur « Nombre de membres de votre organisation » de `/entreprise-presentation` fait
>   308 × 6 px** : `input[type=range]`, `appearance: none`, `height: 6px` en CSS calculé. Il est
>   **stylé par l'auteur**, donc l'exemption « contrôle du navigateur » de WCAG 2.5.8 ne le couvre
>   pas. ⚠️ Non mesuré : la zone tactile réelle du curseur peut excéder la piste selon le moteur.
>   **À vérifier avant de conclure**, mais une piste de 6 px sur l'outil qui sert à choisir un
>   forfait est au minimum un défaut d'ergonomie tactile.
> - `16 × 24 px` pour un bouton « Plus d'options (démonstration) » : sous 24 px en largeur, donc
>   sous le critère **AA**.
>
> 🔴 **Ce qui coûte les 3 points, ce n'est pas le nombre, c'est le périmètre.** La garde a été
> élargie de six à huit routes le 2026-09-04, et son propre commentaire dit alors : « en couvrir six
> et parler des routes protégées, c'est le même écart de langage que les énoncés que cette passe a
> trouvés faux ». Le raisonnement a été appliqué **à l'intérieur** du périmètre et jamais **au
> périmètre lui-même** : le tableau de bord lit « cibles tactiles : 0 » comme une propriété du
> produit, alors que c'est une propriété de huit routes derrière authentification. Les pages non
> couvertes sont exactement celles qui reçoivent le trafic d'acquisition.
>
> ### Et les cas mobiles, joués sur le moteur mobile, échouent à moitié
>
> Les trois specs les plus mobiles du dépôt rejouées sur le project `mobile-safari` (iPhone 12,
> WebKit), dev-server chaud, 2 workers : **9 passés, 9 échoués, 11,4 min.**
>
> | Spec | Cas |
> |---|---|
> | `touch-targets.spec.ts` | 3 échecs (`/dashboard`, `/entreprise`, `/habits`) |
> | `reduced-motion-sheets.spec.ts` | 4 échecs, dont le **TÉMOIN** de la suite |
> | `demo-touch-gestures.spec.ts` | 2 échecs (swipe sur une TaskCard, bottom-sheet « Plus ») |
>
> ⚠️ **Ce ne sont pas des défauts produit démontrés, et il serait malhonnête de les présenter
> ainsi.** Sept des neuf sont des attentes de fixture qui expirent : le CTA « Essayer la démo
> gratuite » de la landing n'est pas visible dans les 30 s contre un serveur Vite de développement
> sur WebKit. **Vérifié en contre-épreuve** : la même page, même moteur, même appareil émulé, mais
> chargée depuis la **production**, rend ce CTA **visible, 358 × 56 px, en moins de 6 s**, et son
> événement `load` tombe à **2 159 ms** avec zéro requête en vol.
>
> **Le fait établi est donc celui-ci, et il suffit** : ces cas ne sont joués par personne (cf.
> [`TESTING.md`](../TESTING.md), les 96 cas hors CI), et dans leur état actuel ils ne peuvent pas
> l'être sans travail. Une suite mobile qu'on ne peut pas lancer ne protège rien.
>
> ✅ **Ce qui reste vrai et vérifié ce soir** : `KNOWN_SUB_11PX = 69` et `ARBITRARY_BUDGET = 192`
> sont bien les valeurs en vigueur dans `src/design-system.guard.test.ts`, et la suite unitaire
> complète (2 586 cas) est verte, cliquets compris.

> ### 🟢 2026-09-14 (matin) · +3, sur des métriques REJOUÉES, pas des affirmations
>
> Trois choses mesurées ce jour, sur le code réel, aucune sur un appareil (la limite « aucun
> appareil réel accessible » reste entière, cf. A-4 / M-25) :
>
> | Métrique | 08-27 (dernière mesure) | **09-14** |
> |---|---|---|
> | Libellés sous le plancher de 11 px | 75 | **69** |
> | Stock de tailles arbitraires | 196 | **192** |
> | Cibles tactiles < 44×44 px (8 routes protégées + modale d'équipe) | — | **0**, 10/10 cas E2E verts |
> | Consommateurs réels de `MobileHeader` (imports, pas mentions) | « 8 » (non recompté depuis) | **7**, recompté par import statement |
>
> Les deux premières viennent de **C-75** (fermé le 2026-09-14 au matin, avant cette passe) :
> `src/design-system.guard.test.ts` porte désormais ces plafonds en dur (`KNOWN_SUB_11PX = 69`,
> `ARBITRARY_BUDGET = 192`) et refuse toute remontée. Ce document ne les avait jamais absorbés —
> sa dernière table de métriques s'arrêtait au 08-27. Les deux dernières sont une remesure propre
> à cette passe : `e2e/touch-targets.spec.ts` rejoué en entier (10 cas, dont le témoin), et le
> compte de `MobileHeader` refait par `import { MobileHeader } from` plutôt que par mention.
>
> ⚠️ **Le 7 n'est pas une régression du 8** : c'est un recomptage plus strict (imports réels, pas
> `grep` sur le nom), et personne n'avait revérifié depuis le 2026-08-25. Sept pages : Dashboard,
> Habitudes, OKR, Entreprise, Réglages, Statistiques, Tâches (via `TasksHeader`).
>
> 🔴 **Ce qui N'ENTRE PAS dans ce +3, et pourquoi** : un fichier non commité d'une autre session
> (`OverdueQuickActions.tsx`) retire le report rapide « Aujourd'hui » du menu de retard, en
> tension directe avec la conclusion de C-72 (« le produit est juste »). Tant qu'il n'est pas
> commité, il n'existe pas pour ce document — ni en positif, ni en négatif. Décision suivie :
> `a-faire-manuel.md` **M-44**.
>
> **Ce qui reste hors de portée d'ici, inchangé depuis le 08-27** : aucun appareil réel n'a été
> ouvert. L'adhérence à l'échelle typographique (dernière mesure : 13 %, le 08-25) n'a pas été
> recomptée — le script qui la produit n'a pas tourné aujourd'hui, faute de temps, pas faute
> d'outil.

> ### 2026-09-03 · note inchangée, et rien de mobile n'a été mesuré
>
> Les 71 commits des 08-30 au 09-03 touchent le socle, la CI, la sécurité et la landing desktop.
> Trois choses seulement concernent cette note, et aucune ne rapporte de point :
>
> - **Les deux `input[type=date]` natifs qui restent sont ASSUMÉS**, et ce sont des champs mobiles :
>   ceux d'`EventModalForm` (desktop en `md:hidden`, plus l'overlay mobile). Le calendrier COSMO a
>   remplacé le picker natif sur les six surfaces où il était visible, mais **pas** sur téléphone :
>   la roue système vaut mieux que n'importe quel calendrier maison. C'est un arbitrage écrit, pas
>   un oubli, cf. [`UI-PATTERNS.md`](../UI-PATTERNS.md) ;
> - `FirstRunSetup` est monté dans `Layout`, donc il s'affiche aussi sur mobile. **Son rendu
>   téléphone n'a pas été vérifié écran par écran** ;
> - l'entrée du hero de la landing est passée en CSS. Le gain mesuré (deux secondes d'écran blanc à
>   4× de bridage CPU) profite d'abord aux appareils lents, donc aux mobiles, mais il a été mesuré
>   **au bureau, avec un bridage simulé**, jamais sur un vrai téléphone.
>
> ⚠️ **Ni l'adhérence à l'échelle typographique fermée, ni les libellés sous le plancher de 11 px,
> ni les cibles tactiles n'ont été recomptés** depuis le 2026-08-27. Les lignes correspondantes du
> tableau ci-dessous portent donc toujours leur date d'origine.

> ### 2026-08-29 · +2, sept onglets qui tenaient dans 335 px visibles
>
> Mesuré à 375 px : le rail de l'espace entreprise fait **832 px pour 335 visibles**, soit quatre
> destinations sur sept hors champ, dans un conteneur `hide-scrollbar`, donc sans barre de
> défilement ni le moindre indice qu'il y a autre chose.
>
> Le défaut qui comptait n'était pas le confort : ouvrir un lien profond `?tab=members` laissait
> l'onglet **actif** hors de l'écran. L'utilisateur voyait le contenu de Membres avec « Aperçu »
> comme seul onglet visible, sans pouvoir dire où il se trouvait.
>
> `OrgTabsBar` ramène l'onglet actif dans le champ et pose des dégradés de continuation. Deux
> mesures ont été nécessaires pour le faire tenir : la `ResizeObserver` observe le conteneur **et**
> le rail, parce que la boîte du conteneur ne bouge pas quand son contenu s'élargit (l'arrivée
> d'une pastille de compteur décalait l'onglet actif de 27 px hors champ, ce qui se lisait comme
> de la flakiness) ; et le premier positionnement est **instantané**, parce qu'un
> `behavior: smooth` est annulable et s'arrête en chemin.
>
> Vérifié dans le navigateur et par deux tests Playwright, **avec témoin** : les deux échouent
> contre l'ancienne barre.
>
> ⚠️ **Remplacé le 2026-09-23** : `OrgTabsBar` n'existe plus. Sur mobile, la section courante est
> un bouton (`OrgSectionSwitcher`) qui ouvre une feuille en grille ; le défaut ci-dessus disparaît
> par construction, puisque le libellé du bouton EST la section active. Sur desktop, la navigation
> vit à droite (`OrgSideNav`). Détail : `src/modules/organizations/CLAUDE.md` § Navigation.

| Ce qui compose la note | 08-24 | 08-25 | **08-27** |
|---|---|---|---|
| Feuilles cassées sous `prefers-reduced-motion` | 0 (corrigées le 24) | **0** | **0**, et pour la première fois **mesuré** sur 3 feuilles (cf. §1bis) |
| Consommateurs de `MobileHeader` | 2 sur 7 pages | **8** | 8, non remesuré |
| Pages avec un titre mobile hors échelle | 6 | **0** | 0 |
| Poignées de glissement qui ne font rien | 3 | **0** · retirées | 0 |
| Adhérence à l'échelle typographique fermée | 169 / 1 656 = **10 %** | 243 / 1 927 = **13 %** | **non remesurée** · le stock de tailles arbitraires passe de 202 à **196** |
| Libellés sous le plancher de 11 px | · | 79 | **75** |
| Niveau de navigation de l'espace entreprise | 3ᵉ (Plus → feuille → Entreprise) | 3ᵉ | ✅ **1ᵉʳ** · onglet de la barre du bas |
| Primitives à 0 consommateur | `MobileScreen`, `ListRow` | **inchangé** | ✅ **0** · supprimées le 2026-09-05 (C-10) |

### 2026-08-27 · +2, un point de navigation et une rétractation

> **Note inchangée à 74 après la rétractation du soir** (§1bis). Le +2 était porté par B2 et F3,
> deux points de navigation mesurés ; la « rechute » annoncée le matin n'a jamais existé. Une
> feuille qu'on croyait cassée puis qui ne l'est pas ne rend aucun point : elle en avait été
> retirée zéro, la ligne du tableau valant déjà 0.

**B2 · « Entreprise » entre dans la barre d'onglets, et REMPLACE « Habitudes ».** L'espace
collaboratif était au **troisième** niveau de navigation sur mobile (Plus → feuille →
Entreprise), alors que c'est la seule zone multi-utilisateurs du produit.

Le remplacement plutôt que l'ajout est **mesuré, pas supposé** : à 375 px la barre porte 5
éléments de **75 × 64 px**. Un sixième les ramène à ~62 px et tronque les libellés. « Habitudes »
est un module **optionnel** (`RequireModule`), donc déjà absent pour une partie des comptes, et il
reste listé dans « Plus » ; l'onglet n'apparaît que pour un membre d'une organisation.
Vérifié dans le navigateur sur le build de production, démo neuve : 5 éléments de 75 × 64.

**F3 · l'onglet ne change plus d'identité pendant le chargement** (commit `f32d080`). L'entrée
entreprise était montée sur `{myOrg && …}` : la barre du bas affichait « Habitudes » le temps de
la requête d'organisations, puis la remplaçait par « Entreprise ». *Un onglet qui change
d'identité pendant qu'on le vise est pire qu'un onglet qui manque*, et sur mobile la cible est
tactile, donc le doigt est déjà parti. Correctif : `ActiveOrgContext` expose `wasOrgMember`, lu
une fois au montage depuis la préférence d'organisation déjà persistée, et les deux barres
réservent la place tant que la requête vole.

> ⚠️ **Honnêteté sur la mesure de F3** : le décalage **n'est pas reproductible en mode démo**, le
> repository local lisant `localStorage` de façon synchrone. CLS mesuré à **0 avant comme après**,
> indice posé comme effacé : cela prouve l'absence de régression, **pas** la présence d'un gain.
> La preuve du correctif est dans les tests, qui exercent l'état transitoire directement
> (`ActiveOrgContext.test.tsx`, 5 cas, + 3 sur `MobileTabBar`), eux-mêmes vérifiés en neutralisant
> tour à tour la lecture puis l'écriture de l'indice. Aucun point n'est attribué pour un gain non
> mesuré.

### 1bis. La feuille « cassée » ne l'était pas · rétractation mesurée (2026-08-27, soir)

`LoginModal` écrivait son mouvement de feuille à la main (`initial={{ y: '100%', opacity: 0 }}`)
et est passé par `useSheetMotion()` (commit `a1debe3`). **La migration reste juste** : c'est la
convention du dossier, et un chemin par défaut vaut mieux que dix-sept variantes.

🔴 **En revanche la justification était fausse, et elle est rétractée ici.** Le commit affirmait
que « sous `prefers-reduced-motion` la valeur initiale reste appliquée et le modal s'ouvrait
entièrement hors écran ». Ce n'était pas une mesure, c'était une déduction depuis la règle.
L'expérience a été faite le soir même : `LoginModal` **remis dans sa forme exacte d'avant le
correctif**, puis ouvert sous `reducedMotion: 'reduce'` réellement émulé, dans un navigateur qui
composite. Résultat : **il s'ouvre normalement**, opacité 1, entièrement à l'écran.

La raison tient à la forme de l'`initial`, et c'est ce que le cliquet de
`src/design-system.guard.test.ts` disait déjà : un `initial` **mixte**, qui contient une clé
non-transform (`opacity`) à côté du `y`, se résout ; c'est l'`initial` **transform seul** de
`MobileMoreSheet` qui restait coincé le 2026-08-24. Les dix-sept feuilles écrites à la main sont
toutes mixtes.

> ⚠️ **Et une mesure de la même journée avait été fausse aussi, dans l'autre sens.** Une première
> tentative, faite dans un panneau navigateur **non affiché**, avait conclu que `HabitModal`
> s'ouvrait à `opacity: 0` et 379 px trop bas. C'était un artefact : dans un onglet
> `document.visibilityState === 'hidden'`, `requestAnimationFrame` ne tourne pas et **tout** reste
> sur `initial`, y compris le voile d'une feuille saine. Le harnais gelait la page et rendait un
> rapport parfaitement convaincant.
>
> Les deux erreurs de la journée, celle du commit et celle-ci, sont la même : **conclure sans
> témoin**. D'où la forme du test qui referme le sujet.

Au passage, la popup d'inscription **tient sans scroll** : largeur desktop 28rem → 33,6rem et
formulaire resserré. Mesuré dans le navigateur, viewport 1000 × 760, inscription, mot de passe
saisi : `scrollHeight` **699 → 675 = clientHeight**, le bouton « Se connecter » finit à 691 px
pour 760 px de hauteur. Mobile 375 × 812 : **694 = clientHeight**.

> ✅ **La ligne « 0 feuille cassée » cesse d'être une présomption** (2026-08-27, soir).
> `e2e/reduced-motion-sheets.spec.ts` ouvre des feuilles sous `reducedMotion: 'reduce'` réellement
> émulé et **mesure** l'état peint : opacité calculée, et hauteur effectivement dans le viewport.
> Ni `toBeVisible()` ni une garde statique ne voient ces deux défauts, l'un considérant visible un
> élément à `opacity: 0`, l'autre ne comptant que des chaînes dans des fichiers.
>
> Le fichier porte **deux protections contre lui-même**, parce que les deux erreurs de la journée
> venaient du harnais et pas du produit :
> 1. il refuse de tourner si la page se déclare `hidden` (l'artefact de l'onglet non composité) ;
> 2. il embarque un **témoin positif** ; si la feuille de contrôle ne s'ouvre pas non plus, le
>    verdict n'est pas « le produit est cassé » mais « le harnais ment », et le message le dit.
>
> ⚠️ **Périmètre honnête : 2 feuilles écrites à la main sur 16**, plus le témoin. `HabitModal` et
> `CompletedOKRsModal` s'ouvrent, mesurées. Les 14 autres partagent le même `initial` mixte au
> caractère près, ce qui rend leur bon fonctionnement très probable, **mais probable n'est pas
> mesuré** : les ajouter au fichier est la dette ouverte de ce point.

### 🔴 2026-09-22 · C-07 était clos à moitié, et l'autre moitié n'avait AUCUNE garde

`C-07` annonçait « 17 feuilles n'utilisent toujours pas `useSheetMotion()` / `useSheetDrag()` ».
**Remesuré avant d'écrire une ligne** : le volet `useSheetMotion` était fermé depuis le
**2026-09-04** — cliquet à zéro, 23 fichiers consommateurs, la garde jouée et verte. L'énoncé
était donc faux de moitié, et le rester lui donnait une taille qu'il n'avait pas.

**Le défaut réel était l'autre helper.** `useSheetDrag` n'était mesuré nulle part, et l'audit
mobile du 2026-08-14 avait pourtant compté **cinq feuilles affichant une poignée qui ne faisait
rien**. Balayage du 2026-09-22 : **trois** l'avaient reconstitué.

| Surface | Traitement |
|---|---|
| `task-modal/MobileActionSheet` | ✅ câblée sur `useSheetDrag(onClose)` |
| `OKRDeadlineReviewModal` | ✅ câblée, **en phase `edit` seulement** : pendant l'animation de validation la carte porte un `animate`, et deux sources pour un même transform laisseraient interrompre une validation décidée |
| `RemoveFriendConfirm` | 🗑️ poignée **RETIRÉE** : c'est un `alertdialog` de suppression, une poignée y présente une décision comme une feuille qu'on chasse au pouce |

⚠️ **Deux faux positifs écartés à la mesure** : les « poignées » de `PyramidNodeCard` et
`TeamProjectCard` sont des **barres de progression**, même forme, `overflow-hidden` en plus. La
première écriture de la garde les accusait — une garde qui accuse deux fichiers justes est une
garde qu'on finit par ignorer. Le détecteur raisonne désormais **par élément**, jamais par fichier.

**Cliquet** : `src/design-system.guard.test.ts`, 4 témoins, **vu rouge sur les trois sabotages**.

### 🔴 2026-09-22 · `/habits` ne peut PAS atteindre 44 px de large, et c'est de l'arithmétique

Mesuré **dans le navigateur** (viewport 375 × 812, mode démo, dix cartes) : la grille des 7 jours
de `HabitCard` fait **301,6 px**, gap de 6 px, donc des cellules de **37,94 × 37,94**.

Sept cellules de 44 px en exigeraient **7 × 44 + 6 × 6 = 344 px**. Même avec un gap NUL, il en
faudrait **308**. La largeur ne peut donc pas atteindre la cible sans refaire la carte.

✅ Ce qui était récupérable l'est : `min-h-11` porte la **hauteur** à 44, la cible passe de 1 444
à 1 672 px². L'écart restant est sur la seule largeur, **déclaré et daté** dans
`e2e/touch-targets.spec.ts` avec son critère : échoue **2.5.5 (AAA)**, tient **2.5.8 (AA, 24 px)**.

⚠️ **Ce n'est pas une allowlist** : la dispense porte sur la largeur SEULE, un témoin vérifie
qu'une cellule perdant sa hauteur redevient un échec, et elle **doit tomber** si la carte gagne
45 px de large.
❌ **Ne pas « corriger » par un débord de `tap-area`** : sept cellules voisines agrandies chacune
se chevaucheraient, et le dernier dans l'ordre du DOM volerait l'appui de son voisin. Une grille
se corrige par sa taille, jamais par du débord.

### « 0 feuille cassée » : ce que dit la MESURE, et à quelle date (C-07, 2026-09-06)

🔴 **La phrase ne s'appuie plus sur le cliquet statique, et il faut dire pourquoi.** Depuis C-07,
`KNOWN_HANDROLLED_SHEETS` est **vide** dans `src/design-system.guard.test.ts` : les 16 feuilles
écrites à la main passent par `useSheetMotion()`. C'est un bon résultat, mais **ce n'est pas une
preuve qu'une feuille s'ouvre** : cette garde compte des chaînes de caractères dans des fichiers.
Un cliquet à zéro et une feuille hors écran sont parfaitement compatibles.

**L'énoncé vérifiable est donc celui-ci, et rien de plus large :**

> Le 2026-09-06, sur `chromium`, framer-motion 12.43.0, `reducedMotion: 'reduce'` réellement
> émulé, **cinq surfaces ont été ouvertes et mesurées peintes** par
> `e2e/reduced-motion-sheets.spec.ts` : le témoin `LoginModal`, `HabitModal`,
> `CompletedOKRsModal`, `DeleteObjectiveConfirm` et `MobileMoreSheet`. Cinq tests verts.

Ce qui a changé ce jour-là, au-delà du chiffre :

- ✅ **`MobileMoreSheet` est mesurée pour la première fois.** C'est la feuille du 2026-08-24, celle
  dont on sait qu'elle a vraiment été cassée, et **elle n'était mesurée nulle part** : le test se
  `skip`ait sur le project `chromium` (viewport 1280 px, or la feuille n'est montée que sous
  768 px) et n'atteignait jamais son corps sur `mobile-safari`. Un `skip` d'un côté, un échec de
  fixture de l'autre, et le rapport se lit comme « rien à signaler ». Le test porte désormais son
  propre viewport (390 × 844), donc la mesure ne dépend plus du project qui la lance.
- 🔴 **La fixture E2E supposait le desktop, ce qui rendait TOUT viewport mobile rouge.**
  `e2e/fixtures.ts` attendait un `h1` contenant « Bonjour », or ce titre est écrit
  `hidden md:block` dans `DashboardPage.tsx` : sous 768 px le `h1` est la date (mesuré :
  « dimanche 6 sept. »). L'attente était donc structurellement intenable, et une spec ancienne et
  sans rapport (`demo-toggle-habit`) échouait au même endroit. La fixture attend maintenant le
  titre que la taille courante rend réellement.
- ✅ **Le témoin négatif a été rejoué, pas recopié.** `MobileMoreSheet` a été cassée pour de vrai,
  deux fois, puis restaurée (empreinte md5 revérifiée identique) :
  - `initial={{ y: '100%' }}` **avec** `animate={{ y: 0 }}`, écrit à la main sans le helper : le
    test **passe**. Sur framer-motion 12.43.0, une clé de transform reçoit `{ type: false }` en
    mouvement réduit, c'est-à-dire une transition instantanée vers la cible ; la forme exacte du
    2026-08-24 ne se reproduit donc plus.
  - le même `initial` **privé de son `animate`** : le test **échoue**, sur « 0 px visibles sur
    582 px de hauteur, transform `matrix(1, 0, 0, 1, 0, 582)` », la signature exacte du défaut
    d'origine.
- ⚠️ **Le second contrôle est ce qui valide le premier.** Un « ça passe » obtenu sur une mutation
  que Vite n'aurait pas servie ne vaudrait rien. Les deux contrôles portent sur le même fichier :
  le second vire au rouge, donc le serveur servait bien les mutations, donc le vert du premier
  parle du produit et pas du harnais.

⚠️ **Conséquence à écrire noir sur blanc : ce fichier ne peut pas échouer sur le défaut de
2026-08-24 tant que cette version de framer-motion est installée.** L'appeler « non-régression »
sans cette phrase serait exactement la faute cataloguée le 2026-09-03, une garde qui répond sans
mesurer. Ce qu'il prouve, c'est qu'il **sait dire non** à une feuille hors écran, et que cinq
surfaces nommées s'ouvrent réellement.

⚠️ **Et la migration reste juste indépendamment de ce résultat** : une seule écriture au lieu de
seize, et une app qui ne dépend plus du détail d'implémentation d'une dépendance. Ce qui a changé
une fois entre deux versions peut rechanger ; `useSheetMotion` n'émet aucune clé de transform en
mouvement réduit, donc la question ne se pose plus.

🔴 **Dette ouverte, et elle n'a pas disparu avec C-07** : 5 surfaces mesurées, pas 16. Les onze
autres partagent maintenant **un seul chemin de code**, ce qui porte plus loin que seize littéraux
identiques, mais partager un chemin de code n'est pas la même chose qu'avoir été ouvert.

🔴 **Le project `mobile-safari` n'a PAS été remis au vert par cette passe.** Le correctif de
fixture lève la cause qui touchait tous les viewports mobiles, mais un second mode d'échec propre à
WebKit subsiste : `page.goto('/')` n'atteint pas `load`. Non traité ici, hors du périmètre de
C-07, et à ne pas confondre avec « mobile-safari est vert ».

**+10, le deuxième plus gros mouvement.** Le finding structurel de cet audit, « le design system
mobile n'a jamais été adopté », a reculé pour la première fois depuis sa création en juillet :
six pages migrées, et surtout **le composant qui portait la migration s'est révélé cassé depuis le
début** (§2). Un mois de « il suffit de finir la migration » reposait sur une brique qui ne
fonctionnait pas.

**Ce qui plafonne la note :** l'adhérence typographique est passée de 10 % à 13 %, ce qui veut
dire que **1 684 usages de Tailwind brut subsistent**, le chiffre absolu a même augmenté. Migrer
les titres de page était le geste le plus visible, pas le plus large. Et il y a toujours deux
langages visuels mobiles, pas un.

---
