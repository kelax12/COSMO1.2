> ⚠️ **ARCHIVE : journal des notes i18n (2026-08-14 → 2026-11-06), extrait de `docs/I18N.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/I18N.md`](../I18N.md). Les notes /100 ont cessé (ADR 0012) : l'état de santé se lit dans [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

## Note i18n : 90 → 86 → 88 → 88 → 87 → 88 → 87 → 88 → 88 → 88 → 88 → 90 → **89 / 100** (2026-09-14, première note attribuée · puis 2026-09-16 → 2026-09-22 soir → 2026-10-01 → 2026-10-02 soir → 2026-10-03 → 2026-10-15 → 2026-10-16 → 2026-10-18 → 2026-10-20 → 2026-10-22 → 2026-10-25 → **2026-11-06**) · **VÉRIFIÉE inchangée le 2026-09-14 au soir**

> ### 🟠 2026-11-06 · −1 : la garde des chaînes en dur rouge à `HEAD`
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-11-06 : CI de `main` du 2026-10-26 au 2026-11-06 (75 runs, dernier `e2e` complet vert à `ba169ba1`), workflows planifiés relus run par run, production (advisors par l'API, catalogue, Edge Functions), alertes GitHub, dépôt à `c3294936` puis `d938bc6e`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-11-06 |
> |---|---|---|
> | 🔴 `No new hardcoded strings` rouge à `c3294936` et `d938bc6e` | **−1** | chaînes de l'écran de démarrage (`src/boot.ts`, sortie du spinner quand React ne monte pas), poussées par une session voisine encore au travail, prévenue. Verte au commit précédent `074aa8c8`. L'écran tourne avant React et l'i18n : catalogue ou exception motivée, à trancher par cette session |
> | Pluriels morts en `en` | 0 | réparés par `074aa8c8` |
> | Parcours de facturation | 0 | libellés fr et en livrés ensemble (`7d3a36b3`) |
>
> **90 → 89.**

> ### ⚪ 2026-10-22 · 0 : une garde des formats de date, cinq défauts corrigés
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-10-22 : CI de `main` à `d16de29a` (run `39843255180`, cinq jobs verts ; `main` rouge du 10-20 à 22:03 au 10-22 à 14:39, 19 runs), `Visual` vert à `fb83cd60`, production (advisors par l'API, catalogue, ledger, cron, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-22 |
> |---|---|---|
> | AM-3 · formats de date | 0 | `src/i18n/date-format.guard.test.ts` (`5890779a`) refuse tout formatage qui contourne `@/i18n/format`. Vue rouge sur cinq défauts, tous corrigés : jours de la récurrence en français en dur, FullCalendar en `fr` pour tout le monde dans l'agenda d'un membre, bilan partagé daté en `fr-FR`, infobulle des graphiques et repli du calendrier. AM-3 crédité le 09-22 : rien à rembourser, mais ces cinq défauts existaient sous ce crédit |
> | Catalogues | 0 | quatre pluriels `_many` morts retirés (`806efae6`) ; catalogues légaux modifiés en `fr` et `en` ensemble ; gardes `i18n:*` vertes en CI. PR n° 105 (`i18n:quality`, AM-1) ouverte |
>
> **88 → 88.**

> ### ⚪ 2026-10-20 · 0 : vérifiée inchangée
>
> Mesures du 2026-10-20 : CI de `main` à `86ea357f` (run `39408311331` : `lint-test-build` et `e2e` rouges, trois jobs verts ; **29 runs rouges de suite** depuis `a9db6f2c`), `Visual` rouge, production (advisors par l'API, catalogue, ledger, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](README.md).
>
> | Item | Effet | Mesuré le 2026-10-20 |
> |---|---|---|
> | Catalogues | 0 | +249 lignes `orgAdmin` et +103 `persoGuide`, en `fr` **et** en `en` dans les mêmes commits ; toutes les gardes i18n vertes à `86ea357f` |
>
> **88 → 88.**

> ### ⚪ 2026-10-18 · 0 : vérifiée inchangée
>
> Dernière passe avant l'acquisition. Mesures du 2026-10-18 : CI de `main` à `e69cb729` (run `39139204925`, cinq jobs verts) et à `15d40bea` (`lint-test-build` vert, run `39156293593`), production (advisors par l'API, catalogue, cron, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-18 |
> |---|---|---|
> | Catalogues légaux | 0 | `legal.json` et `legalPrivacy.json` modifiés en `fr` **et** `en` dans les mêmes commits (`23a12fdb`, `ab0ad655`, `3438ff7e`) ; gardes `i18n:*` vertes en CI |
> | Qualité de l'anglais | 0 | non relue (`M-50`), comme avant |
>
> **88 → 88.**

> ### 🟢 2026-10-16 · +1 : plus de phrase anglaise en dur dans le chat de projet
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du
> 2026-10-16 : CI de `main` à `a4878cab`, dépôt à `HEAD` rejoué étape par étape. Tableau de bord :
> [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-16 |
> |---|---|---|
> | ✅ « Empty message » lancé en dur (−1) | **+1** | remplacé par un code catalogué dans `errors.json` fr et en (`c791eb55`) ; `error-messages.guard` vert en CI et en local |
> | AM-1 · la qualité des traductions | 0 | relecture des catalogues anglais faite le 2026-10-16 (`108c1fee`, `M-50`). Une relecture n'est pas une garde : l'angle mort reste ouvert, rien ne la rejoue |
> | Catalogues | 0 | `i18n:check`, `i18n:scan`, `i18n:identical`, `i18n:pages` verts à `HEAD` ; `i18n-routing.spec` vert en CI après la régression du 10-16 matin (`89ddecb9`) |
>
> **87 → 88.**

> ### 🟠 2026-10-15 · −1 : une phrase anglaise en dur dans le chat de projet
>
> **Même règle** : un angle mort ne se rembourse que sur un verdict rendu en CI, un défaut que
> lorsqu'il est corrigé et vérifié. Mesures de la nuit du 14 au 15 : CI de `main` à `6847bbf3`,
> dépôt à `HEAD` rejoué étape par étape. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-15 |
> |---|---|---|
> | 🔴 « Empty message » lancé en dur | **−1** | `team-projects/messages.repository.ts` : `throw new Error('Empty message')`, que `useAddProjectMessage` affiche par la clé `mutation.addComment` : la phrase anglaise sort telle quelle dans l'interface française (`000eeedd`, 10-13). `error-messages.guard` (C-62) rouge en local, jamais en CI. Remède écrit dans la garde : `makeApiError(<code>)`, et le code catalogué dans `errors.json` |
> | Catalogues | 0 | `i18n:check`, `i18n:scan`, `i18n:identical`, `i18n:pages` et `lazy-namespaces.guard` verts à `HEAD`. Nouveau namespace `orgGuide` (fr, en, `abac93a1`) ; pluriels `_many` et identité des rôles personnalisés déclarés (`b76515e6`) |
>
> **88 → 87.**

> ### 🟢 2026-10-03 · +1 : `/okr` charge ce qu'il traduit, et la landing ne charge plus ce qu'elle ne montre pas
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Verdict : run `CI`
> `37109937640` sur `c7fb936c`, **les cinq jobs verts**, le premier `CI` entièrement vert sur `main`
> depuis le 2026-09-23 (`869fb05a`). Correctifs : `d8b1584b`, `16fbaae9`, `ac1e8c40`, `59aa4fd8`,
> `315804df` (autres sessions) et `d8c215ad`, `290d6f51`, `c7fb936c` (celle-ci).
>
> | Item | Effet | Mesuré le 2026-10-03 |
> |---|---|---|
> | ✅ `/okr` utilisait `org` sans le déclarer (−1 le 10-02) | **+1** | la section OKR pro est chargée à la demande avec `['okr', 'org']` (`d8b1584b`) ; `lazy-namespaces.guard` vert en CI |
> | Nouveau catalogue `landingEnterprise` | 0 | le texte du parcours entreprise sort de `landing`, chargé par le seul `EnterpriseTrack` (`59aa4fd8`) : 30 namespaces. `i18n:check`, `i18n:pages` (881 / 842 mots sur `/entreprise-presentation/`), `i18n:identical` verts |
>
> **87 → 88.**

> ### 🟠 2026-10-02 (soir) · −1 : `/okr` traduit dans un catalogue qu'il ne charge pas
>
> **Même règle que le 2026-09-22** : un angle mort ne se rembourse que sur un verdict rendu en CI, un
> défaut que lorsqu'il est corrigé et vérifié. Mesures du soir : CI de `main` à `9ea33927` (dernier
> `e2e` complet : `f301f0bf`, run `37019682064`), production (advisors par l'API, catalogue, ledger),
> dépôt à `HEAD`.
>
> | Item | Effet | Mesuré le 2026-10-02 (soir) |
> |---|---|---|
> | 🔴 `/okr` utilise `org` sans le déclarer | **−1** | `lazy-namespaces.guard` **rouge en CI** sur `f301f0bf` puis `9ea33927`, depuis `05ddf746`. La page atteint désormais `modules/organizations/hooks.ts`, `team-projects/hooks.ts`, `portfolio.hooks.ts` et `follows.hooks.ts`, qui traduisent dans `org`. Effet attendu : une clé brute là où ces hooks parlent, si `/okr` est la première page chargée. **Non observé à l'écran** : c'est le contrat que la garde protège qui est rompu |
> | `i18n:check`, `i18n:scan`, `i18n:identical`, `i18n:pages` | 0 | verts en CI à `9ea33927`. Le parcours entreprise de la landing **retire** deux entrées de l'allowlist `i18n:identical` et n'en ajoute aucune ; ratio `en / fr` des pages prérendues de 0,91 à 1,06 |
>
> **88 → 87.** Deux issues : déclarer `org` pour `OKRPage` dans `src/App.tsx` (c'est un catalogue de
> plus au chargement de `/okr`, à peser contre `check:bundle`), ou ne plus tirer ces hooks depuis la page.

> ### ⚪ 2026-10-01 · 0 : vérifiée inchangée
>
> **Même règle que le 2026-09-22** : un angle mort ne se rembourse que sur un verdict rendu en CI, un
> défaut que lorsqu'il est corrigé et vérifié. Mesures du jour : CI de `main` (`43fed445` à
> `7cd73d24`), production (catalogue, advisors), dépôt à `HEAD`.
>
> | Item | Effet | Mesuré le 2026-10-01 |
> |---|---|---|
> | `i18n:pages`, `i18n:check`, `i18n:scan`, `i18n:identical` | 0 | verts en CI à `7cd73d24`. Nouvelles clés du jour (`open_link_not_allowed`, textes de G-3) présentes en `fr` et `en` |
>
> **88 → 88.** Détail : [tableau de bord](../README.md).

> ### 🟢 2026-09-22 (soir) · +2 : remesure item par item, contre la CI réelle et la production
>
> **Règle appliquée**, déclarée au [tableau de bord](../README.md) : un angle mort payé le 2026-09-16
> n'est remboursé que si sa garde a rendu **au moins un verdict exploitable en CI** (vert, ou
> rouge sur un vrai défaut). Une garde posée mais jamais jouée, ou cassée, ne rembourse rien.
> Un défaut nommé ce soir coûte selon le barème du 09-16.
>
> | Item | Effet | Mesuré le 2026-09-22 |
> |---|---|---|
> | AM-2 · corps des pages `en` | **+1** | `i18n:pages` vert à `HEAD`, dans `lint-test-build` **et** dans `lighthouse` (`--pages`) |
> | AM-3 · pluriels et formats | **+1** | même garde : « pluriels complets, locales cohérentes, aucune page en recul » |
> | AM-1 · qualité | **0** | toujours `M-50` |
>
> ✅ `i18n:check`, `i18n:scan`, `i18n:identical` verts en CI à `HEAD`.
>
> **86 → 88.** Détail, règle et ordre de réparation : [tableau de bord](../README.md).

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
> | AM-1 · **les trois gates mesurent les clés et les copies, jamais la QUALITÉ** | −2 | une traduction fausse mais différente passe les trois sans bruit |
> | AM-2 · le CORPS des pages `en` n'est comparé à rien depuis `C-20` | −1 | mesuré une fois avant l'ouverture à l'indexation |
> | AM-3 · pluriels et formats de date sans garde dédiée | −1 | `tp()` et `format.ts` |
> | AM-4 · `es` déclarée mais ni servie ni indexable | 0 | mécanisme prévu, couvert par AM-2 |
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
| AM-1 | 🔴 **Les trois gates mesurent les CLÉS et les COPIES, jamais la QUALITÉ.** `i18n:check` compare des clés, `i18n:identical` détecte un `en` recopié du `fr`. Une traduction **fausse mais différente** passe les trois sans bruit | les trois gates sont vertes avec 3 898 couples | 🟠 **TOUJOURS OUVERT** au 2026-09-21 · **`M-50`**, et aucune des **quatre** gates ne l'atteindra : elles comparent des clés, des copies, des volumes et des formes. Une traduction **fausse mais différente** les passe toutes sans un bruit — *(jugé outillable le 09-16 : non par un script : seule une relecture humaine datée le comble)* · 🟡 **RÉDUIT le 2026-10-22** · `npm run i18n:quality` (§ « La garde de qualité ») tient le **vocabulaire produit** (glossaire épinglé) et refuse le **français resté** dans `en`. 🔴 ne prouve PAS : le **sens**. « Delete the task » pour « Terminer la tâche » passe. Le reste est toujours `M-50` · 🟡 **REVU le 2026-10-23** · relecture complète des 33 catalogues `en` et des overlays des seeds de démo, couple par couple contre le `fr` : **60 valeurs et 2 seeds corrigées** (contresens État/Statut sur la santé des tâches et projets, « seat » pour une place d'organigramme, « in progress » pour des tâches ouvertes, `**` affichés en clair dans le guide, unités des KR restées en français dans la démo anglaise, un même terme rendu de deux ou trois façons), sept termes stabilisés épinglés au glossaire (15 au total). Journal, avant/après et raisons : [`archive/I18N-REVUE-2026-10-23.md`](../I18N-REVUE-2026-10-23.md). 🔴 ne garde PAS dans le temps : une revue ferme le sens **à cette date**. Une clé ajoutée ou une phrase réécrite demain n'est relue par rien ; seuls le vocabulaire épinglé et le français résiduel restent gardés. L'angle mort reste ouvert, et `M-50` redevient dû à chaque lot de copie nouvelle |
| AM-2 | **Le CORPS des pages prérendues en `en` n'est comparé à rien.** Les 50 pages ont été mesurées une fois avant l'ouverture d'`en` à l'indexation (`C-20`), jamais depuis | aucune garde ne rejoue cette comparaison | ✅ **OUTILLÉ le 2026-09-20** · `npm run i18n:pages` · corps des pages prérendues **par locale** (`C-99`) — 🔴 ne prouve PAS : la **qualité**, qui reste `M-50` |
| AM-3 | **Les pluriels et les formats de date ne sont testés que ponctuellement.** `tp()` et `src/i18n/format.ts` n'ont pas de garde dédiée balayant les deux locales | aucun test de parité de pluriels | ✅ **OUTILLÉ le 2026-09-20** · `npm run i18n:pages` · parité des formes plurielles (`C-99`) — 🔴 ne prouve PAS : rien ici. 1ʳᵉ exécution : **23 formes plurielles MORTES** en `en`, des `_many` recopiés du français que `Intl.PluralRules('en')` ne demandera jamais · ✅ **Formats de date OUTILLÉS le 2026-10-22** · `src/i18n/date-format.guard.test.ts` (dans `npm test`) : balaie `src/` et refuse tout formatage qui contourne `@/i18n/format` (`toLocale*String()` sans locale ou avec une étiquette en dur, `Intl.*Format('fr…')` ou sans étiquette, `date-fns/locale` importée, `{ locale: fr }`, `locale = 'fr-FR'` par défaut, `locale="fr"` en prop, `date-fns` `format(d, 'EEEE')` sans `{ locale }` qui rend de l'anglais pour tous, noms de jours ou de mois écrits à la main) ; allowlist d'**une entrée par cas** (2, chacune avec sa raison, refusée si elle ne détecte plus rien) ; témoin positif **et** négatif par détecteur, plancher de fichiers balayés. 1ʳᵉ exécution : **cinq défauts**, tous corrigés (jours de la récurrence en français en dur, agenda d'un membre en `locale="fr"`, bilan partagé daté en `fr-FR`, nombre des infobulles de graphique à la langue du navigateur ; plus le repli du mois de `ui/calendar`). 🔴 ne prouve PAS : un `format()` dont le motif est une VARIABLE ou dont les options sont passées sans `locale`, ni une date composée à la main par concaténation (`${d.getDate()}/${m}`), ni `api/` et `supabase/functions/` (hors `src/`) |
| AM-4 | **`es` figure dans `route-slugs.json` sans être servie ni indexable.** C'est le mécanisme prévu, mais rien ne garde l'écart : un ajout à `SUPPORTED_LOCALES` sans traduction du corps ne fait échouer aucun job | `i18n:check` garde l'état à moitié ouvert, pas la qualité du corps | ✅ **OUTILLÉ le 2026-09-20** · `npm run i18n:pages` · formats de date sur les deux locales servies (`C-99`) — 🔴 ne prouve PAS : rien pour `es`, qui figure toujours dans `route-slugs.json` sans être ni servie ni indexable |


> ### ⚪ 2026-09-14 (soir) · 0 : les trois gates rejouées rendent les mêmes chiffres, à l'unité
>
> `i18n:check` **23 namespaces, 0 erreur, 0 avertissement** · `i18n:scan` **0 chaîne** ·
> `i18n:identical` **3 898 couples, 92 identiques, 92 déclarées, 0 non déclarée**. Identique au
> matin, ce qui est le résultat attendu d'une journée sans travail de traduction, et qui n'avait
> aucune raison d'être supposé.
>
> ⚠️ **Deux fichiers annonçaient encore « 19 namespaces », et ce document avait raison contre eux**
> : `CLAUDE.md` § i18n et `PERFORMANCE.md` § catalogue. Le chiffre datait du levier de chargement
> paresseux du 2026-08-25 ; quatre catalogues sont entrés depuis. Corrigés ce soir, ainsi que le
> commentaire de `src/i18n/catalog.ts` qui parlait des « 17 autres » namespaces paresseux, désormais
> **21**. Poids mesuré sur disque au passage : **244 ko** de JSON `fr`, 215 ko de `en`, contre les
> 178 ko cités comme état d'avant-levier.
>
> 🔴 **Angle mort · les articles de blog anglais portent des slugs FRANÇAIS.** Mesuré sur le build
> de ce soir : `/en/blog/combien-de-temps-prendre-habitude`,
> `/en/blog/gestion-du-temps-efficace`, `/en/blog/methode-okr-exemples`, et ainsi pour les onze.
> **Ce n'est pas un oubli** : `src/content/blog/*.mjs` pose la règle en toutes lettres, « la colonne
> vertébrale (`slug`, dates, `related`) est COMMUNE à toutes les langues : c'est une seule
> publication traduite, pas deux articles ». L'arbitrage se défend, il évite deux identités pour un
> même contenu.
>
> Ce qui manquait, c'est qu'il ne soit écrit **nulle part dans un audit** : ni ici, ni dans
> [`SEO.md`](../SEO.md). Or il a un prix, et il tombe sur le marché qu'on ouvre : un slug est un
> signal de pertinence, et onze articles anglais concourent avec une URL que leur lecteur ne peut
> pas lire. La décision reste la bonne tant que l'anglais n'a aucun trafic ; **elle doit être
> rouverte le jour où l'anglais en a**, et ce jour-là le coût d'un changement de slug est une table
> de redirections 301, pas une réécriture. Consigné pour que la question soit posée plutôt que
> redécouverte.
>
> ⚠️ Rappel de ce que cette note ne mesure toujours pas : la **qualité** des 26 pages anglaises.
> Aucune relecture par un locuteur natif n'a eu lieu, et aucune gate ne peut y suppléer.


**Audit du 2026-08-14** — premier audit de ce domaine. Mesuré sur les catalogues de
`src/locales/` et le contenu éditorial de `src/content/`.

> ### ⚠️ Note du 2026-09-03 · les chiffres du §1 datent du 2026-08-14 et n'ont PAS été remesurés
>
> Trois choses ont bougé depuis, aucune ne change les mesures ci-dessous, et la troisième explique
> un chiffre qui a l'air d'une régression sans en être une :
>
> - **`npm run i18n:scan` est une gate CI bloquante depuis le 2026-09-02.** Il compte les chaînes
>   d'interface **en dur**, celles qui ne sont dans aucun catalogue : un axe que cet audit ne
>   mesurait pas du tout ;
> - **le seuil est passé de 4 à 25, sans qu'une seule chaîne ait été ajoutée.** Le seuil valait 4
>   sur une heuristique **aveugle à quatre formes entières** : texte JSX contenant une
>   interpolation, texte sur plusieurs lignes, propriété d'objet `label:` (par opposition à
>   l'attribut `label=`), et valeur par défaut de prop. La gate certifiait « plus aucune chaîne
>   d'interface en dur » pendant qu'il en restait des dizaines dans le produit. **C'est la MESURE
>   qui a changé, pas la dette**, et `src/components` est à zéro depuis. `-- --list` dit
>   lesquelles ;
> - **les trois pages contractuelles (CGU, confidentialité, mentions légales) existent en
>   anglais**, avec une clause de langue disant que **le français prévaut**. Modifier leur fond
>   n'est donc pas une tâche de traduction, c'est modifier un contrat.
>
> 🟢 **PREMIÈRE NOTE ATTRIBUÉE le 2026-09-14 : 90 / 100.** Aucune n'avait jamais été posée sur ce
> document — le périmètre réellement bilingue n'était pas remesuré écran par écran depuis le
> 2026-08-14, et les trois gates n'existaient pas encore pour la plupart des dates citées ici. Ce
> n'est plus le cas : les trois tournent, sur le catalogue d'AUJOURD'HUI, pas sur celui du 14 août.
>
> | Gate | Résultat le 2026-09-14 |
> |---|---|
> | `npm run i18n:check` | ✅ 23 namespaces, **0** erreur, **0** avertissement — parité des clés |
> | `npm run i18n:scan` | ✅ **0** chaîne d'interface en dur (cliquet CI à 0) |
> | `npm run i18n:identical` | ✅ **3 898** couples comparables (+90 depuis le 09-08, sous-catégories arrivées), **92** identiques, **92** déclarées légitimes, **0** non déclarée |
> | Contenu éditorial | ✅ **11/11** articles de blog, **4/4** pages cas d'usage portent un corps `en` (vérifié dans `src/content/`, pas déduit du prérendu) |
>
> **Ce qui retient la note à 90, et pas plus haut** : aucun gate ne peut mesurer la QUALITÉ d'une
> traduction, seulement sa présence et sa non-identité au français. C'est la même limite que
> l'accessibilité pose entre « focus » et « annonce » (`docs/ACCESSIBILITY.md`) — une lecture
> humaine, par un locuteur natif, des 26 pages anglaises n'a jamais été faite. Et c'est une
> **première** note : elle part prudente plutôt qu'au plafond, un domaine qu'on note pour la
> première fois n'a pas l'historique qui justifierait un 95.

Le fonctionnement du socle est décrit dans [`../CLAUDE.md`](../../CLAUDE.md) §i18n ; l'indexation par
locale dans [`SEO.md`](../SEO.md). Ce document ne traite que d'une question : **le produit est-il
réellement bilingue ?**

---
