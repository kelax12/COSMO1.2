> ⚠️ **ARCHIVE : journal des notes SEO (2026-01-10 → 2026-11-06), extrait de `docs/SEO.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/SEO.md`](../SEO.md). Les notes /100 ont cessé (ADR 0012) : l'état de santé se lit dans [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

## Note SEO : 73 → 73 → 75 → 80 → 75 → 78 → 78 → 78 → 79 → 78 → 79 → 79 → 79 → 79 → **78 / 100** (2026-08-25 → 2026-08-27 → 2026-08-29 → 2026-09-14 → 2026-09-16 → 2026-09-22 soir → 2026-10-01 → 2026-10-02 soir → 2026-10-15 → 2026-10-16 → 2026-10-16 (soir) → 2026-10-18 → 2026-10-20 → 2026-10-22 → **2026-11-06**) · inchangée au 2026-09-03, **VÉRIFIÉE inchangée le 2026-09-14 au soir**

> ### 🟠 2026-11-06 · −1 : les deux régressions du 2026-11-05 débitées, `Signaux SEO` crédité
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-11-06 : CI de `main` du 2026-10-26 au 2026-11-06 (75 runs, dernier `e2e` complet vert à `ba169ba1`), workflows planifiés relus run par run, production (advisors par l'API, catalogue, Edge Functions), alertes GitHub, dépôt à `c3294936` puis `d938bc6e`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-11-06 |
> |---|---|---|
> | 🔴 Articles du blog rendus deux fois (2 `<h1>` servis) | **−1** | constat remesuré le 2026-11-05 (entrée ci-dessous) ; session dédiée lancée le 2026-11-06 |
> | 🔴 `/guide/` à 682 mots servis (1 932 le 2026-10-22) | **−1** | idem |
> | 🟠 JSON-LD de l'accueil (offre « via publicité », `screenshot` en double) | 0 | faux, sans effet de classement mesuré ; confié à la même session |
> | ✅ AM-4 · `Signaux SEO` posé mais jamais joué (non crédité le 2026-10-25) | **+1** | `seo-signals.yml` vert les 2026-10-26 et 2026-11-02, points hebdomadaires commités (`ec52a3dc`, `e3f0644f`) |
>
> **79 → 78.**

> ### 🟠 2026-11-05 · note maison NON rejouée : deux régressions trouvées par un audit externe
>
> Audit du skill `seo-audit` (bibliothèque d'Axel) : **75 / 100 à son propre barème**, qui ne se
> compare pas à cette note. Rapport : [`archive/AUDIT-SEO-SKILL-2026-11-05.md`](../AUDIT-SEO-SKILL-2026-11-05.md).
> Ne sont repris ici que les constats **remesurés** le 2026-11-05 par `curl` sur la production.
>
> | Item | État | Mesuré le 2026-11-05 |
> |---|---|---|
> | Articles du blog | 🔴 nouveau | `/blog/tableau-de-bord-productivite` : **2** `<h1>` dans le HTML servi, l'article est rendu deux fois (régression attribuée à `66f76355`, 2026-10-24, par l'audit). ✅ corrigé, `fe752e89` : 2 → 1 `<h1>` sur les 50 pages prérendues du build local, build qui échoue au-delà |
> | `/guide/` | 🔴 nouveau | **682 mots** dans le `<body>` servi (scripts et styles retirés), contre 1 932 le 2026-10-22. ✅ corrigé, `fe752e89` : 723 → 2 935 mots (fr), 699 → 2 720 (en) sur le build local ; le 1 932 ne s'est pas reproduit |
> | Accueil, contenu sous la ligne de flottaison | ⚠️ à confirmer | HTML servi : 761 mots et 8 `<h2>`. Selon l'audit, le DOM hydraté retombe à 123 mots sans `<h2>` tant qu'aucun geste n'a lieu (`BelowFold.tsx`). Ce que Google retient : inspection d'URL Search Console |
> | JSON-LD de `index.html` | 🟠 | l'offre annonce un « Accès Premium gratuit via publicité » (contredit « Aucune publicité ») ; clé `screenshot` en double. ✅ corrigé, `fe752e89` |
> | Autorité | inchangé | 0 domaine référent (Bing, 2026-11-02), `sameAs` vide |
>
> **79, en attente de renotation** : les deux 🔴 seront débités à la prochaine passe complète,
> contre la CI et la production.

> ### ⚪ 2026-10-22 · 0 : la première visite venue de Google
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-10-22 : CI de `main` à `d16de29a` (run `39843255180`, cinq jobs verts ; `main` rouge du 10-20 à 22:03 au 10-22 à 14:39, 19 runs), `Visual` vert à `fb83cd60`, production (advisors par l'API, catalogue, ledger, cron, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-22 |
> |---|---|---|
> | Production | 0 | `/`, `/en/`, `/entreprise-presentation/`, `/blog/`, `/guide/`, `sitemap.xml`, `robots.txt` en 200 ; canonical de la page entreprise identique au `sitemap.xml` ; `/guide/` sert 1 932 mots dans le HTML |
> | Lighthouse SEO | 0 | **100** sur les 8 URLs, bureau et mobile, à `d16de29a` |
> | Trafic | 0 | `traffic_hits` : une arrivée de `google.com` sur `/en/` le 10-22, la première mesurée |
> | LCP mobile des pages de contenu | 0 | 4,5 à 5,6 s (guide, blog, article, `/pour-*`), signal de classement : débité une fois en [`PERFORMANCE.md`](../PERFORMANCE.md) et en [`MOBILE.md`](../MOBILE.md) |
>
> **79 → 79.**

> ### ⚪ 2026-10-20 · 0 : aucune page publique touchée
>
> Mesures du 2026-10-20 : CI de `main` à `86ea357f` (run `39408311331` : `lint-test-build` et `e2e` rouges, trois jobs verts ; **29 runs rouges de suite** depuis `a9db6f2c`), `Visual` rouge, production (advisors par l'API, catalogue, ledger, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](README.md).
>
> | Item | Effet | Mesuré le 2026-10-20 |
> |---|---|---|
> | Pages publiques | 0 | `/` et `/entreprise-presentation/` en 200 ; aucun commit n'a touché la landing, le blog ou le prérendu ; l'autorité de domaine reste le seul levier |
>
> **79 → 79.**

> ### ⚪ 2026-10-18 · 0 : production relue, rien n'a bougé
>
> Dernière passe avant l'acquisition. Mesures du 2026-10-18 : CI de `main` à `e69cb729` (run `39139204925`, cinq jobs verts) et à `15d40bea` (`lint-test-build` vert, run `39156293593`), production (advisors par l'API, catalogue, cron, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-18 |
> |---|---|---|
> | Production | 0 | `/`, `/entreprise-presentation/`, `/en/`, `/blog/`, `sitemap.xml`, `robots.txt` en 200 ; la page entreprise sert son titre et sa canonical (`https://thecosmo.app/entreprise-presentation`) dès le HTML servi |
> | Lighthouse SEO | 0 | **100** sur les 8 URLs, desktop et mobile |
> | Autorité de domaine | 0 | rien de neuf mesuré : `M-23` et `M-24` restent le seul levier, cf. [`ACQUISITION-BACKLINKS.md`](../ACQUISITION-BACKLINKS.md) |
>
> **79 → 79.**

> ### 🟢 2026-10-16 (soir) · +1 : la page entreprise sert de nouveau la page entreprise
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vérifié**. Mesures du 2026-10-16 au
> soir : CI de `main` (runs `38907264016` à `38941369233`, tous complets et verts), production au
> navigateur. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-16 (soir) |
> |---|---|---|
> | ✅ `/entreprise-presentation/` servait l'accueil perso (−1 le matin) | **+1** | `9dcaf94b` (détection tolérante à la barre oblique, avec tests). Relu en production après hydratation : `h1` « Qui fait quoi. Où on en est. », titre entreprise, canonical `https://thecosmo.app/entreprise-presentation` |
> | SEO Lighthouse | 0 | 100 sur les 8 URLs, la page entreprise désormais mesurée sur son vrai parcours |
>
> **78 → 79.**

> ### 🟠 2026-10-16 · −1 : `/entreprise-presentation/` sert l'accueil perso, canonical compris
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du
> 2026-10-16 : CI de `main` à `a4878cab`, production (curl et navigateur). Tableau de bord :
> [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-16 |
> |---|---|---|
> | 🔴 La variante avec barre oblique de la page entreprise | **−1** | `https://thecosmo.app/entreprise-presentation/` répond en **200** (variantes à slash final servies volontairement) et, une fois React chargé, affiche le **parcours perso** : `h1` « Toute votre productivité… », titre de l'accueil, **canonical réécrit vers `https://thecosmo.app/`**. Cause : `useLandingTrack` compare le chemin sans tolérer la barre oblique. Le sitemap porte la forme sans barre, mais un lien externe ou une saisie mènent un prospect entreprise sur la mauvaise page, et le « SEO 100 » mesuré sur cette URL en CI était celui de l'accueil. **Corrigé sur `main` par `9dcaf94b` pendant la passe**, ni vu en CI ni relu en production à son écriture : remboursable à la prochaine |
> | SEO Lighthouse | 0 | 100 sur les 8 URLs, desktop et mobile (en notant la réserve ci-dessus) |
> | `check:seo` | 0 | vert à `HEAD` : 50 pages prérendues, 40 URLs au sitemap, 150 `hreflang` réciproques |
> | AM-4 · le résultat n'est pas mesuré | 0 | toujours vrai, `M-24` et `M-55` |
>
> **79 → 78.**

> ### 🟢 2026-10-15 · +1 : le LCP mobile sort de « mauvais »
>
> **Même règle** : un angle mort ne se rembourse que sur un verdict rendu en CI, un défaut que
> lorsqu'il est corrigé et vérifié. Mesures de la nuit du 14 au 15 : CI de `main` à `6847bbf3`,
> production (curl sur le HTML servi), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-15 |
> |---|---|---|
> | ✅ LCP mobile « mauvais » sur 8 URLs sur 8 (−1 le 09-22) | **+1** | **3,26 à 3,40 s** sur les 8 URLs, Lighthouse mobile en CI à `HEAD` (cf. [`PERFORMANCE.md`](../PERFORMANCE.md)). Signal *page experience* toujours sans donnée terrain |
> | SEO Lighthouse | 0 | **100 sur les 8 URLs**, desktop et mobile. `/en/` passe de 92 à 100 (lien du bandeau cookies, `dc243383`) |
> | Coquille `app.html` indexable ; canonical de `/entreprise-presentation` réécrit vers `/` par React | 0 | trouvés par l'audit externe du 2026-10-09 ([`archive/AUDIT-SEO-EXTERNE-2026-10-09/`](../AUDIT-SEO-EXTERNE-2026-10-09/FULL-AUDIT-REPORT.md)), refermés le 10-09 (`69a972d0`) et le 10-12 (`dc243383`), **relus en production** ce soir : `noindex` servi par `app.html`, canonical et `og:image` propres à la page entreprise. Trouvés et refermés entre deux passes : ni débit ni crédit |
> | `check:seo` | 0 | vert en local à `HEAD` : 50 pages prérendues, 40 URLs au sitemap, 150 `hreflang` réciproques |
> | AM-4 · le résultat n'est pas mesuré | 0 | toujours vrai, `M-24` et `M-55` |
>
> **78 → 79.**

> ### ⚪ 2026-10-02 (soir) · 0 : vérifiée inchangée
>
> **Même règle que le 2026-09-22** : un angle mort ne se rembourse que sur un verdict rendu en CI, un
> défaut que lorsqu'il est corrigé et vérifié. Mesures du soir : CI de `main` à `9ea33927` (dernier
> `e2e` complet : `f301f0bf`, run `37019682064`), production (advisors par l'API, catalogue, ledger),
> dépôt à `HEAD`.
>
> | Item | Effet | Mesuré le 2026-10-02 (soir) |
> |---|---|---|
> | SEO Lighthouse | 0 | **100** sur sept URLs, **92** sur `/en/`, desktop et mobile, à `9ea33927` |
> | `check:seo` | 0 | vert en CI : **40** URLs au sitemap, prérendu et balises par page. Parcours entreprise de la landing refait le soir même : `/entreprise-presentation/` à **881** mots en `fr`, **842** en `en` |
> | LCP mobile (−1 le 09-22) | 0 | `/entreprise-presentation/` 8,4 s, `/` 8,1 s : déjà payé (cf. [`PERFORMANCE.md`](../PERFORMANCE.md)) |
> | Résultat | 0 | **2** comptes créés sur 30 jours (`auth.users`, relu en base). Search Console non remesurée |
>
> **78 → 78.** Détail : [tableau de bord](../README.md).

> ### ⚪ 2026-10-01 · 0 : vérifiée inchangée
>
> **Même règle que le 2026-09-22** : un angle mort ne se rembourse que sur un verdict rendu en CI, un
> défaut que lorsqu'il est corrigé et vérifié. Mesures du jour : CI de `main` (`43fed445` à
> `7cd73d24`), production (catalogue, advisors), dépôt à `HEAD`.
>
> | Item | Effet | Mesuré le 2026-10-01 |
> |---|---|---|
> | SEO Lighthouse | 0 | **100** sur sept URLs, **92** sur `/en/`, desktop et mobile (`43fed445`) |
> | LCP mobile (−1 le 09-22) | 0 | toujours 5,4 à 8,1 s en CI malgré `C-116` (cf. `PERFORMANCE.md`). Déjà payé |
>
> **78 → 78.** Détail : [tableau de bord](../README.md).

> ### 🟢 2026-09-22 (soir) · +3 : remesure item par item, contre la CI réelle et la production
>
> **Règle appliquée**, déclarée au [tableau de bord](../README.md) : un angle mort payé le 2026-09-16
> n'est remboursé que si sa garde a rendu **au moins un verdict exploitable en CI** (vert, ou
> rouge sur un vrai défaut). Une garde posée mais jamais jouée, ou cassée, ne rembourse rien.
> Un défaut nommé ce soir coûte selon le barème du 09-16.
>
> | Item | Effet | Mesuré le 2026-09-22 |
> |---|---|---|
> | AM-2 · sitemap ↔ prérendu | **+2** | `check:seo` vert à `HEAD` : **50 pages, 150 `hreflang` réciproques**, sitemap et prérendu se correspondent |
> | AM-1 · 4 URLs sur 40 | **+1** | 8 URLs ; SEO Lighthouse **100** sur 7, **92** sur `/en/`, soit exactement le seuil bloquant |
> | AM-3 · balises par page | **+1** | même garde |
> | 🔴 LCP mobile « mauvais » sur 8 URLs sur 8 | **−1** | 5,6 à 8,3 s en labo (cf. `PERFORMANCE.md`). Signal *page experience*, sans donnée terrain pour le confirmer |
> | AM-4 · le résultat n'est pas mesuré | **0** | toujours vrai, `M-24` / `M-55` |
>
> **75 → 78.** Détail, règle et ordre de réparation : [tableau de bord](../README.md).

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
> | AM-2 · **rien ne relie le SITEMAP aux pages réellement prérendues** | −2 | les 10 pages hors sitemap ont dû être expliquées à la main |
> | AM-1 · Lighthouse note le SEO de 4 URLs sur 45 | −1 | `lighthouserc.json` |
> | AM-3 · aucune garde sur les balises par page | −1 | `title`, `canonical`, `hreflang` vérifiés à la main |
> | AM-4 · le RÉSULTAT n'est pas mesuré, seulement la conformité | −1 | note 80 et **0 clic non marqué** coexistent depuis le 2026-08-19 |
> | AM-5 · `robots.txt` et les `noindex` entre deux passes | 0 | portée limitée |
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
| AM-1 | **Lighthouse note le SEO de 4 URLs sur les 40 du sitemap** | `lighthouserc.json` (4 URLs, `preset: desktop`) vs le sitemap : 🔴 **40 `<loc>`, pas 45**, recomptés le 2026-09-20 **sur la production** (`https://thecosmo.app/sitemap.xml`) **et** sur le build local du 09-17, qui donnaient déjà 40. Aucune source du sitemap n'a bougé depuis le 2026-09-10 : **« 45 » n'a jamais été mesuré**, c'est un chiffre estimé le 09-16, dans la passe même qui interdit de recopier un « avant ». La proportion, elle, ne change pas | ✅ **OUTILLÉ le 2026-09-20** · passe mobile Lighthouse, 4 → **8 URLs** (`C-84`) — 🔴 ne prouve PAS : la couverture : 8 sur 40 restent 8 sur 40 |
| AM-2 | 🔴 **Rien ne relie le SITEMAP aux pages réellement prérendues.** Une route ajoutée à l'un sans l'autre ne fait échouer aucun job, et les 10 pages prérendues hors sitemap ont dû être expliquées à la main le 2026-09-14 | aucun script ne compare `dist/sitemap.xml` à la sortie de `prerender.mjs` | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:seo` (`C-98`) — 🔴 ne prouve PAS : rien ici : chaque page prérendue est au sitemap ou **déclarée hors sitemap avec sa raison** |
| AM-3 | **Aucune garde sur les balises par page.** `title`, `description`, `canonical` et `hreflang` sont vérifiés lors des passes manuelles, pas en CI (Lighthouse n'en voit que 4) | 40 `hreflang` recomptés à la main le 2026-09-14 | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:seo` · les 4 balises par page (`C-98`) — 🔴 ne prouve PAS : la **qualité** d'un `title` ; ici, présence et cohérence. Mesuré à la pose : 50 pages, 150 `hreflang` réciproques |
| AM-4 | **Le résultat n'est pas mesuré, seulement la conformité.** Position, impressions et clics viennent de la Search Console, à la main. Un audit peut donc monter pendant que le trafic reste nul, ce qui est l'état constaté depuis le 2026-08-19 | note 80 et 0 clic non marqué coexistent | 🟡 **OUTILLÉ le 2026-10-23, rouge jusqu'au secret** · `scripts/seo-signals.mjs`, chaque lundi (`seo-signals.yml`, relié à `ci-alert.yml`) : clics, impressions et position des requêtes **non marque** (sans « cosmo ») et de toutes les requêtes, sur 28 jours, par l'API Search Console, en série datée `docs/seo-signals-series.json`. **Propriété interrogée : `sc-domain:thecosmo.app`** (type domaine), à remplacer par la variable Actions `GSC_SITE_URL` si la propriété est un préfixe d'URL. Témoin `seo-signals.guard.test.mjs`, vu rouge au rejeu. 🔴 ne prouve PAS : rien tant que `GSC_SERVICE_ACCOUNT_JSON` n'est pas posé (geste d'Axel, le job est rouge d'ici là) ; ensuite, le total non marque est un **plancher**, Google excluant les requêtes anonymisées |
| AM-5 | **`robots.txt` et les `noindex` ne sont vérifiés qu'au moment où on ouvre une locale.** Entre deux passes, rien ne signale un `Disallow` devenu trop large | aucune garde | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:seo` · `robots.txt` et les `noindex` relus à chaque build (`C-98`) — 🔴 ne prouve PAS : qu'un `Disallow` soit *pertinent* : la garde voit qu'il a changé, pas qu'il a raison |


> ### ⚪ 2026-09-14 (soir) · 0 : l'infrastructure tient, et le seul chiffre de RÉSULTAT disponible est mauvais
>
> **Rejoué sur un build neuf de ce soir**, et complété par ce que l'entrée du matin n'avait pas
> regardé : le rapport entre les pages prérendues et le sitemap, et la production elle-même.
>
> | Contrôle | Résultat |
> |---|---|
> | Pages HTML prérendues dans `dist/` | **50** |
> | URLs déclarées au sitemap | **40** |
> | Écart, page par page | **exactement 10** : les 6 pages contractuelles (CGU, confidentialité, mentions légales × 2 locales) et les 4 pages d'authentification (`/login`, `/signup` × 2 locales) |
> | Pages prérendues portant `noindex` | **0** |
> | Production : `/`, `/entreprise-presentation`, `/en`, `/blog`, `/sitemap.xml` | **200** sur les cinq |
>
> ✅ **L'écart de 10 est cohérent et voulu** : ces pages sont désindexées par en-tête
> (`X-Robots-Tag` dans `vercel.json`) et non par `robots.txt`, précisément pour que Google puisse
> les crawler et LIRE le `noindex`. La vérification manquait : compter 40 URLs ne dit rien tant
> qu'on n'a pas expliqué les 10 qui n'y sont pas.
>
> 🔴 **Ce que ce document doit maintenant porter, parce que la question se pose cette semaine.**
> Mesuré en base ce soir, sur `auth.users` : **28 comptes au total, 1 seule inscription sur les 30
> derniers jours, 0 sur les 7 derniers**, et **2 connexions** sur 7 jours. Le plan d'acquisition du
> 2026-08-13 mesurait 27 comptes lifetime. **Un mois de travail SEO, d'i18n et de produit a produit
> un inscrit.**
>
> ⚠️ **Ce n'est pas une baisse de note, et il faut dire pourquoi**, sinon c'est de la complaisance.
> Cette note mesure ce que le dépôt contrôle : le prérendu, le sitemap, les `hreflang`,
> `robots.txt`, la structure éditoriale. Tout cela est mesuré et tenu. Le facteur limitant est
> nommé depuis le 2026-08-19 et il est **hors du dépôt** : l'autorité de domaine, donc les
> backlinks, donc [`ACQUISITION-BACKLINKS.md`](../ACQUISITION-BACKLINKS.md) et des gestes manuels
> d'Axel. Faire payer ce chiffre à la note SEO reviendrait à noter le travail par un levier qu'il
> ne tient pas.
>
> **Mais l'inscrire ici est nécessaire** : un 80/100 sur un domaine qui rend un inscrit par mois
> doit se lire avec son résultat à côté, sans quoi la note dit « tout va bien » à qui s'apprête à
> lancer une campagne. *Une note d'infrastructure n'est pas une note d'audience.*
>
> ⚠️ **Deux comptes sur 28 ne sont pas des utilisateurs** : `demo@cosmo.app`
> (`aaaaaaaa-aaaa-…`, créé le 2026-01-10, **jamais connecté**, et pourtant porteur de 120 tâches,
> 67 événements, 6 habitudes et 4 OKR en PRODUCTION) et `testemail@gmail.com`. La base compte donc
> **26 comptes réels**, et **16 % des tâches de la plateforme appartiennent au compte de
> démonstration**. Toute statistique tirée de `/admin` ou d'un comptage brut avant une campagne doit
> retrancher ces deux lignes, sous peine de mesurer un fantôme.
>
> 🟠 **Angle mort · les onze articles anglais portent des slugs français**
> (`/en/blog/combien-de-temps-prendre-habitude`, …). C'est un arbitrage écrit et défendable, posé
> dans `src/content/blog/*.mjs` (« une seule publication traduite, pas deux articles »), mais il
> n'était consigné dans **aucun audit**. Un slug est un signal de pertinence : la décision est sans
> coût tant que l'anglais n'a pas de trafic, et doit être rouverte le jour où il en a. Le prix d'un
> changement ultérieur est une table de redirections 301. Même constat côté
> [`I18N.md`](../I18N.md).


> ### 🟢 2026-09-14 · +5, et c'est un rattrapage : la bascule C-20 (09-08) n'avait jamais été notée
>
> La § 2 de ce document décrit une bascule technique majeure — l'anglais ouvert à l'indexation, et
> trois vrais défauts trouvés au passage (sitemap muet sur `/` et `/guide`, `robots.txt` aveugle
> aux routes applicatives sous `/en`, et surtout `Disallow: /entreprise` qui bloquait par PRÉFIXE
> la page publique payante `/entreprise-presentation`). Elle est datée du **2026-09-08** et n'a
> **jamais reçu de point** : le score est resté « inchangée » pendant six jours sur un domaine qui
> venait de doubler de taille.
>
> **Revérifié aujourd'hui sur un build réel** (`npm run build`, `dist/`, pas déduit de la lecture
> de `prerender.mjs`), et c'est tenu, pas seulement écrit :
>
> | Contrôle | Résultat le 2026-09-14 |
> |---|---|
> | URLs au sitemap | **40**, dont 61 occurrences `/en/` (URLs + alternates) |
> | Entrées `hreflang` dans le sitemap | **80** |
> | Pages prérendues portant `noindex` | **0** |
> | `robots.txt` : `/entreprise-presentation` | déclarée au sitemap, **hors** de toute règle `Disallow` — vérifié, `/entreprise$` et `/entreprise/` ne la couvrent pas |
>
> **Pourquoi +5 et pas plus** : ce que ce domaine ne peut toujours pas mesurer reste le facteur
> limitant, et il n'a pas bougé — position moyenne, clics non-marque et domaines référents vivent
> dans Search Console, lue pour la dernière fois le **2026-08-19**. Ouvrir une locale à
> l'indexation crée l'OPPORTUNITÉ d'un classement, elle ne le prouve pas. C'est le même écart que
> l'accessibilité pose entre « câblé » et « annoncé ».

> ### 2026-09-03 · toujours 75, et la raison n'a pas changé depuis le 2026-08-19
>
> Les 71 commits des 08-30 au 09-03 ne produisent **aucun contenu indexable** et ne touchent ni au
> prérendu, ni au `sitemap.xml`, ni aux canonicals, ni aux `hreflang`. Deux mouvements les
> effleurent sans rien changer au référencement :
>
> - les trois pages contractuelles existent désormais en anglais, mais `en` **n'est toujours pas
>   dans `INDEXABLE_LOCALES`** : servie aux utilisateurs, fermée à Google, exactement comme prévu
>   tant que le corps des pages reste français ;
> - quatre liens vers ces pages rendaient une **404 en anglais** (slug localisé écrit en dur dans
>   un `to=`, alors que le préfixe de locale est porté par le `basename`). Corrigé. C'est un défaut
>   d'expérience et de liens internes, sur des pages **non indexables** : il ne rapporte pas de
>   point SEO.
>
> **Ce qui décide de la note n'a pas été remesuré** : la position moyenne, les clics non-marque et
> les domaines référents vivent dans Search Console, et la dernière lecture date du **2026-08-19**.
> Le facteur limitant reste l'autorité de domaine, et le seul levier reste
> [`ACQUISITION-BACKLINKS.md`](../ACQUISITION-BACKLINKS.md), intégralement manuel.

> ### 2026-08-29 · +2, et le gain vient d'un défaut trouvé, pas d'un contenu écrit
>
> **Une barre finale renvoyait quatre pages vers l'accueil.** Vérifié en production, pas déduit :
> `thecosmo.app/pour-freelances/` servait le fichier prérendu, puis l'application redirigeait vers
> `/`. Le visiteur atterrissait sur la page d'accueil, sans erreur, sans 404, sans trace. Quatre
> pages concernées : freelances, étudiants, managers, équipes.
>
> 🔴 **Pourquoi ça vaut deux points maintenant et pas dans six mois** : les annuaires normalisent
> presque tous les URL avec une barre finale, et leurs soumissions (T-21) sont **le seul levier
> d'acquisition** de ces 60 jours. Chaque backlink obtenu à la main aurait envoyé son visiteur
> ailleurs que sur la page qui le concerne.
>
> Second acquis, plus discret : les pages prérendues sont désormais **mesurées** en CI, et elles
> sortent à **100 de SEO** (`/`, `/blog/`, `/guide/`, `/pour-freelances/`). Le job Lighthouse
> mesurait jusqu'ici la page 404 de la SPA, qui se marque `noindex` : il annonçait 0,66 sur des
> pages dont le fichier prérendu porte `index, follow`.
>
> **Ce qui ne bouge pas, et qui décide de la note** : toujours aucun domaine référent, et la
> position moyenne n'a pas été remesurée depuis le 2026-08-19. Le facteur limitant reste
> l'autorité de domaine, pas le contenu ni la technique.

> **2026-08-27 · toujours 73, pour la même raison.** Les dix-neuf commits de la journée sont tous
> dans le produit connecté (mode entreprise, navigation, accessibilité) ou sur la landing **derrière le
> clic** (confirmation de démo, popup d'inscription). Aucun n'ajoute de contenu indexable, aucun
> ne touche au prérendu, au `sitemap.xml`, aux canonicals ni aux `hreflang`. La position moyenne
> et les clics non-marque **n'ont pas été remesurés** depuis le 2026-08-19 : ces chiffres vivent
> dans Search Console, pas dans le dépôt. Le seul levier reste
> [`ACQUISITION-BACKLINKS.md`](../ACQUISITION-BACKLINKS.md), intégralement manuel.

**Aucun travail SEO n'a eu lieu entre le 2026-08-24 et le 2026-08-25**, et la note ne bouge donc
pas. C'est une information, pas un trou dans l'audit.

| Ce qui compose la note | 08-24 | 08-25 |
|---|---|---|
| Technique (prérendu, sitemap, canonical, JSON-LD, `robots.txt`) | ✅ 24/24 pages propres | ✅ inchangé |
| Profondeur éditoriale | 🟠 deux fois sous la cible (§3) | 🟠 inchangée |
| Position moyenne Google, requêtes non-marque | **88** | non remesurée |
| Clics non-marque | **0** | · |
| Backlinks (le seul levier) | ❌ chantier manuel non entamé | ❌ **non entamé** |

**La seule chose qui déplacerait cette note ne se trouve pas dans le dépôt.** Ce que le site
**émet** est propre, c'est mesuré, page par page, et c'est ce que la note de 73 récompense. Ce
qu'il **obtient** est nul, et la cause est l'autorité de domaine. Sept migrations et un système de
permissions n'y changent rien, par construction.

> ⚠️ **À ne pas confondre avec un audit « à jour ».** Une note qui ne bouge pas parce que rien n'a
> été mesuré et une note qui ne bouge pas parce que rien n'a été fait sont deux états différents.
> Ici c'est le second : la partie code a été vérifiée, la partie terrain (position, indexation)
> date du **2026-08-19** et demande une relecture de Search Console, trente minutes, côté Axel.
>
> Une nouveauté du 2026-08-25 mérite d'être notée : le job CI `lighthouse` rend le score **SEO
> bloquant** sur les 4 routes prérendues. C'est la première garde automatique côté SEO ; elle
> protège l'acquis technique, elle ne crée pas d'audience.

Le plan d'action reste [`ACQUISITION-BACKLINKS.md`](../ACQUISITION-BACKLINKS.md), intégralement
manuel.

---
