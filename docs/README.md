# Documentation COSMO — carte

**Dernière revue de cohérence complète : 2026-08-25**, tous les documents notés ci-dessous ont été
confrontés au code de `main`, au build du jour et à la prod à cette date.

**Passe documentaire du 2026-09-03** : les **71 commits** postérieurs à la revue du 2026-08-29
relus, et **les onze audits renotés ou explicitement laissés inchangés**. ⚠️ **Aucune mesure
nouvelle contre la production** ce jour-là : chaque chiffre cité vient du commit qui l'a produit,
ou se relit dans le dépôt à `HEAD`. Une erreur de report est corrigée au passage, la note RGPD du
2026-09-02 partait d'une base périmée. Tableau et détail : [§ Mise à jour du
2026-09-03](#mise-à-jour-du-2026-09-03--les-journées-08-30-à-09-01-navaient-jamais-été-notées).

**Passe partielle du 2026-08-27** (fin de journée) : les dix audits notés ont été relus contre le
code de `main` et les dix-neuf commits du jour. Les mesures **contre la production** n'ont pas été
refaites ce jour-là, sauf celles inscrites dans les commits eux-mêmes. Détail dans le second
tableau ci-dessous.

## Tableau de bord des audits · avant / après (2026-08-24 → 2026-08-25)

Chaque note est justifiée, critère par critère, en tête du document correspondant. Elles ne se
comparent **pas entre elles** : un 64 en performance et un 86 en sécurité ne disent pas que la
performance va moins bien que la sécurité, ils disent où chaque domaine se situe par rapport à
**sa propre cible**.

| Audit | 08-24 | 08-25 | Δ | Ce qui a bougé |
|---|---|---|---|---|
| [Scalabilité](./SCALABILITY.md) | 71 | **84** | **+13** | 4 findings structurels sur 5 refermés (mig. 117, 118, 119, 120, 121) |
| [Mobile / DA](./MOBILE.md) | 62 | **72** | **+10** | `MobileHeader` migré sur 6 pages, et découvert cassé depuis sa création |
| [UI / UX](./UI-PATTERNS.md) | 70 | **80** | **+10** | Les 6 findings de l'audit du 14 août sont refermés |
| [RGPD](./RGPD.md) | 78 | **84** | **+6** | FK d'effacement alignée en prod (mig. 116) ; portabilité préservée malgré la troncature |
| [Sécurité](../faille.md) | 82 | **86** | **+4** | Une nouvelle surface d'autorisation livrée avec son test de base réelle (mig. 115) |
| [Architecture](./ARCHITECTURE.md) | 74 | **79** | **+5** | Budget > 600 LOC : 12 503 → 11 452 lignes |
| [Tests / CI](./TESTING.md) | 80 | **88** | **+8** | +188 tests, +21 E2E, 5ᵉ job CI ; couverture repassée au rouge puis **refermée sans baisser un seuil** |
| [Mode entreprise](./archive/RAPPORT-MODE-ENTREPRISE-2026-08-12.md) | 74 | **84** | **+10** | Aperçu refondu (la même tâche s'affichait 4 fois), 3 onglets n'affichent plus de zéros faux au chargement, page 5× plus légère à ouvrir. Restent la barre d'onglets mobile et les 2 grammaires de filtre |
| [Accessibilité](./ACCESSIBILITY.md) | 76 | **79** | **+3** | 2ᵉ gate a11y, sur les pages **publiques** cette fois |
| [SEO](./SEO.md) | 73 | **73** | **0** | Aucun travail SEO : le seul levier restant est hors dépôt |
| [Performance](./PERFORMANCE.md) | 68 | **91** | **+23** | Ouvrir `/entreprise` : **64,1 → 12,2 kB gzip** ; plus de lecture org-wide des tâches au retour d'onglet. Retenu par le chunk d'entrée, **87,2 → 106,9 kB en deux jours** |

> **2026-08-26 · les notes ne bougent pas, et c'est le résultat.** La journée a mesuré un axe que
> ce tableau ne couvrait pas : **le coût serveur d'une session**, distinct du poids envoyé au
> navigateur. L'ouverture du tableau de bord coûtait **29 requêtes REST**, et **91,5 % du trafic
> Supabase du jour venait de deux onglets jamais rechargés**, donc d'un bundle périmé : ces deux
> chiffres ont depuis bougé pour le premier seulement, cf. la note du 2026-08-27 ci-dessous.
> Deux migrations ont par ailleurs été
> **appliquées en prod le 2026-08-27** : la `127` ramène la page Statistiques de **854 ms à
> 12,0 ms** sur 32 plages, et la `128` la lecture d'agenda hiérarchique de **17,19 ms à 0,61 ms**.
> Aucun point n'est encore attribué : une note se remesure, elle ne s'estime pas. Détail dans
> [`PERFORMANCE.md`](./PERFORMANCE.md) et [`SCALABILITY.md`](./SCALABILITY.md) §2ter et §3.
>
> **2026-08-27 · l'ouverture de l'application passe de 29 à 21 requêtes.** D'abord sans
> migration : un filtre d'OKR et un sous-ensemble de partages qui repartaient en réseau au lieu
> d'être dérivés de listes déjà chargées, et une lecture d'organisations en deux allers-retours
> séquentiels devenue une jointure PostgREST. Puis avec la mig. `129`, appliquée en prod : la
> boîte de réception d'entreprise passe de **cinq lectures à une**. Elle est `SECURITY INVOKER`,
> donc elle n'ouvre aucun accès nouveau, et un membre simple continue de ne voir aucune des
> demandes d'adhésion réservées aux admins, vérifié en base après application. Les quatre
> correctifs sont verrouillés par des gardes vues rouges avant d'être committées. Correction au passage : **le chargement en coûtait
> 29, pas 32** ; trois requêtes de la trace de la veille venaient d'une fiche de tâche ouverte
> juste après. Reste, non engagé, le comptage du badge qui lit jusqu'à 1 000 tâches d'équipe
> pour en faire un nombre.
>
> ⚠️ La leçon de méthode vaut plus que les trois chiffres : **une note de performance front ne dit
> rien du coût serveur**, et un compteur Postgres cumulé ne dit rien du débit courant. Les deux
> ont été confondus jusqu'ici.
>
> **2026-08-27 (soir) · le badge cesse de recharger, et `/entreprise` s'ouvre 5× plus léger.**
> Le comptage du badge, laissé « non engagé » le matin, l'est maintenant à moitié : il lit
> toujours les tâches d'équipe, mais il ne les **recharge** plus. Monté par `Layout`, donc sur
> toutes les pages protégées, il montait `useTeamTasks` avec 30 s de fraîcheur et un refetch au
> retour d'onglet, alors qu'il n'affiche pas la liste. `useTeamTasks` gagne `background`,
> symétrique de `live`. ⚠️ **Gain non chiffré** : le mode démo est en `localStorage`, il n'y a
> aucune requête à compter ; à confirmer dans les `edge_logs` d'une vraie session.
> Côté poids, ouvrir `/entreprise` passe de **64,1 à 12,2 kB gzip** (les six onglets non-défaut,
> les blocs de l'onglet Membres et les dialogues sont paresseux). La contrepartie est inscrite
> dans [`PERFORMANCE.md`](./PERFORMANCE.md) : qui ouvre les sept onglets paie 9 kB gzip de plus.
> Et une dérive est enfin notée, celle que personne n'avait vue : **le chunk d'entrée est passé de
> 87,2 à 106,9 kB en deux jours**, avec un plafond relevé de 92 à 112 kB pour l'absorber.

## Mise à jour du 2026-09-03 · les journées 08-30 à 09-01 n'avaient jamais été notées

La passe du 2026-09-02 a noté **les deux campagnes de sa propre journée**, et rien d'autre : elle
ne dit rien des 08-30, 08-31 et 09-01, et elle ne crédite pas la fermeture de T-41, faite à 18 h 58
le 09-02, trois heures avant qu'elle soit écrite. Cette passe relit les **71 commits** postérieurs
à la revue du 2026-08-29 (14 h 45) contre le code de `main` et contre les mesures inscrites dans
les commits eux-mêmes. **Aucune mesure nouvelle n'a été prise contre la production ce jour-là** :
tout ce qui suit est soit vérifiable dans le dépôt à `HEAD`, soit une mesure datée et signée par
le commit qui l'a produite.

| Audit | dernière note | **09-03** | Δ | Ce qui a bougé |
|---|---|---|---|---|
| [Scalabilité](./SCALABILITY.md) | 86 (08-29) | **89** | +3 | **T-41 fermée** : le comportement du planificateur est mesuré à volume sur le runner, 200 → 2 000 `team_tasks`, aucun basculement de plan. Le rapport entre les deux chemins est de **354×** à 2 000 lignes, et la projection du §9bis était **2,7× trop optimiste** |
| [UI / UX](./UI-PATTERNS.md) | 84 (08-29) | **87** | +3 | Le calendrier COSMO remplace le picker natif sur **six surfaces** ; un focus clavier mort depuis toujours dans le calendrier ; une icône noire sur fond noir causée par le correctif censé la corriger ; un premier écran qui demande au lieu de faire à la place |
| [Sécurité](../faille.md) | 84 (09-02) | **86** | +2 | `/admin` est réellement derrière une session `aal2` : la mig. `131` est appliquée **et** le facteur TOTP est enrôlé et vérifié. Realtime était bloqué en production faute de `wss://` dans la CSP, sans un mot à l'écran. Secret scanning, push protection et Dependabot actifs sur un dépôt public |
| [Tests / CI](./TESTING.md) | 94 (09-02) | **95** | +1 | Suite 1 836 → **2 051 / 179**. Quatre cliquets nouveaux, dont deux avec témoin. Ce qui retient le cinquième point est nommé plus bas : **quatre gardes ont été prises en train de répondre sans mesurer**, en cinq jours |
| [Architecture](./ARCHITECTURE.md) | 83 (09-02) | **84** | +1 | Cliquet 9 949 → **9 190**, fichiers hors budget 13 → **12**. `friends/supabase.repository.ts` sort de la liste **et** le budget baisse de ses 592 lignes, au lieu de les distribuer en mou aux douze autres |
| [Accessibilité](./ACCESSIBILITY.md) | 81 (08-29) | **82** | +1 | Trois défauts réels, aucun visible par axe-core : les flèches ne déplaçaient pas le focus dans le calendrier (`Button` ne recevait jamais son `ref`), les liens de `RichText` n'étaient pas soulignés, et l'icône des sélecteurs de date natifs était noire sur fond noir en thème sombre |
| [Performance](./PERFORMANCE.md) | 94 (08-29) | **92** | −2 | `check:bundle` **mesurait un artefact qui n'existe nulle part** : sans `VITE_SENTRY_DSN`, Rollup jette presque tout `@sentry/react` et la garde sous-estimait le chemin critique d'environ **45 ko gzip**. La marge réelle sous le plafond n'est pas de 57,8 ko mais de **11,9** |
| [RGPD](./RGPD.md) | 86 (08-29) | **86** | 0 | Le +2 du 09-02 était réel mais **calculé depuis une base périmée** (84 au lieu de 86, cf. correction ci-dessous). Appliqué à la bonne base il est compensé, pas annulé : un script tiers a transmis **email et nom** depuis `/signup` en production, hors de ce que déclare le registre, et son DPA n'est toujours pas obtenu |
| [Mobile / DA](./MOBILE.md) | 76 (08-29) | **76** | 0 | Rien de spécifiquement mobile n'a été mesuré. Les deux `input[type=date]` natifs restants sont **assumés** (roue système iOS), et l'adhérence à l'échelle typographique n'a pas été recomptée depuis le 08-25 |
| [SEO](./SEO.md) | 75 (08-29) | **75** | 0 | Aucun contenu indexable produit, aucun `hreflang` ni canonical touché. Search Console n'a pas été relue depuis le **2026-08-19** |
| [i18n](./I18N.md) | · | **·** | · | La dette annoncée passe de 4 à **25** chaînes en dur sans qu'une seule chaîne ait été ajoutée : l'heuristique était aveugle à quatre formes entières. `src/components` est à zéro. Note toujours non attribuée, le périmètre bilingue n'ayant pas été remesuré écran par écran |

> ### 🔴 Une correction de base, avant de lire les deltas
>
> Le tableau du 2026-09-02 fait partir le RGPD de **84**, alors que la passe du 08-29 l'avait déjà
> porté à **86**. Le +2 de la journée était justifié, ligne par ligne ; c'est la colonne de départ
> qui était périmée, recopiée depuis le tableau du 25. Les deux valeurs affichées ce jour-là ne
> peuvent donc pas être vraies en même temps. **La bonne lecture est : 86 le 08-29, et 86 le
> 09-02**, le gain de la journée étant exactement compensé par ce qu'elle a découvert.
>
> C'est la troisième fois que ce document se trompe en recopiant un « avant » au lieu de le
> relire : après les `refetchInterval` du 08-25 et la garde `architecture.guard` du 08-27.
> *Un « avant » se relit à sa source, il ne se recopie pas.*

> ### 🔴 Ce que cette fenêtre de cinq jours dit vraiment
>
> **Quatre gardes ont été prises en train de répondre sans mesurer.** C'est le fait le plus lourd
> de la période, et il touche quatre outils différents :
>
> | Garde | Ce qu'elle affirmait | Ce qu'elle mesurait |
> |---|---|---|
> | `check:bundle` | chemin critique à 321,2 ko | un build sans Sentry, soit ~45 ko de moins que ce qui part en production |
> | `uptime.yml` | run **vert**, « tout va bien » | le site répond ; la moitié backend de la sonde était sautée sur un secret inexistant |
> | `restore-drill.yml` | isolation vérifiée | `tail -1` capturait le mot `ROLLBACK`, jamais le compte : le contrôle ne pouvait **pas** échouer |
> | `i18n:scan` | « plus aucune chaîne d'interface en dur », seuil verrouillé à 4 | une heuristique aveugle au texte interpolé, au texte multiligne, aux propriétés `label:` et aux valeurs par défaut de prop |
>
> Les quatre ont été trouvées et corrigées dans la fenêtre, trois d'entre elles **avec un témoin**
> qui refuse un parseur ou une sonde qui ne détecterait plus rien. Mais la classe est la même à
> chaque fois, et elle est pire que l'absence de garde : *une garde qui se trompe dans le sens
> rassurant donne une réponse, et on la croit.*
>
> **Une alerte que personne ne lit n'est pas une alerte, c'est une archive.** `vendor-watch.yml` a
> parfaitement fonctionné : il a détecté que le script tiers chargé sur les pages publiques s'était
> mis à extraire l'**adresse email et le nom** saisis à l'inscription, il a échoué chaque jour du
> 2026-08-29 au 2026-09-01, il a mis à jour son issue à chaque fois, et personne ne l'a ouverte
> pendant quatre jours. Les alertes sont désormais **poussées** sur le webhook d'ops, avec un
> exercice à blanc déclenchable à la main. ⚠️ Le mécanisme reste **inerte** tant que le secret
> `OPS_ALERT_WEBHOOK_URL` n'est pas posé dans les secrets Actions du dépôt.
>
> **Deux migrations ont été appliquées deux fois.** Les `134` et `135` avaient déjà été passées par
> une session voisine trois heures plus tôt. Aucun effet sur le schéma, les deux étant idempotentes,
> mais le ledger a porté les seuls doublons de ses 127 entrées. *Ce dépôt a plusieurs sessions
> actives : l'état de la production n'est jamais celui qu'on a laissé.*
>
> **Une migration appliquée avant que son chemin de secours ait été parcouru a verrouillé `/admin`
> pendant deux jours.** La mig. `131` exige une session `aal2` ; l'écran d'enrôlement TOTP levait
> en phase de rendu, donc affichait l'erreur générique au lieu du QR code, lui-même cassé par un
> double préfixe `data:`. Le raisonnement « ce n'est pas un verrouillage, l'écran reste
> atteignable » était juste sur la garde et faux dans les faits. *Quand une migration crée une
> dépendance à un chemin de récupération, ce chemin se PARCOURT avant, il ne se raisonne pas.*

## Mise à jour du 2026-09-02 · revue des pages, puis audit Stripe

Deux campagnes le même jour, et elles ne se ressemblent pas.

**Le matin, une revue page par page** (`src/pages`, 18 000 lignes, plus les repositories et
`src/lib` qu'elles consomment) : vingt risques, dont quatre mesurés directement en base de
production. Dix-sept sont refermés le jour même. Le plus lourd, `R-01`, est une classe de bug que
ce dépôt déclare éradiquée depuis juin 2026 : une échéance écrite à minuit UTC et relue en heure
locale, soit **467 des 601 échéances de la base**, invisible depuis la métropole et systématique
pour tout fuseau à décalage négatif.

**L'après-midi, l'audit des Edge Functions Stripe**, jamais relues jusque-là. Six findings, tous sur
des chemins d'erreur ; détail dans [`../faille.md`](../faille.md).

| Audit | 08-29 | **09-02** | Δ | Ce qui a bougé |
|---|---|---|---|---|
| [Sécurité](../faille.md) | 86 | **84** | −2 | Les Edge Functions Stripe sont auditées pour la première fois. Deux findings ouverts (`S-5`, `S-6`) et une contrainte que le code suppose depuis toujours, absente en base (`S-3`). Quatre correctifs livrés le même jour ne compensent pas : ils réparent des trous que la note n'avait jamais comptés |
| [RGPD](./RGPD.md) | 84 | **86** | +2 | Le fichier d'avatar part enfin avec la référence, au retrait de la photo comme à la suppression du compte (bucket public). L'export de portabilité gagne dix colonnes réellement saisies. Et la politique de confidentialité cesse d'annoncer une anonymisation du journal d'encaissement que le scellement rend impossible |
| [Tests / CI](./TESTING.md) | 93 | **94** | +1 | 1884 → **2026** tests. Deux nouveaux cliquets : `i18n:scan` devient bloquant (334 → **4** chaînes en dur), et une garde interdit `{var}` dans un catalogue — la syntaxe qui affichait « Étape {current} sur {total} » dans l'onboarding livré la veille |
| [Architecture](./ARCHITECTURE.md) | 83 | **83** | 0 | Le cliquet a mordu deux fois et a été resserré deux fois (9903 → **9791**), mais aucun god component n'a disparu : trois extractions de compensation, pas d'assainissement |
| [i18n](./I18N.md) | · | **·** | · | Les trois pages contractuelles existent en anglais, avec clause de langue. La dette de chaînes en dur passe de 334 à 4, toutes des commentaires de code. Note non attribuée : le périmètre réellement bilingue n'a pas été remesuré écran par écran |
| [Scalabilité](./SCALABILITY.md) | 86 | **86** | 0 | Le tableau de bord charge toujours le jeu de données complet. Mesuré : 289 tâches et 128 événements au maximum pour un compte, donc aucun coût réel — le risque reste, la mesure ne le justifie pas encore |

> ### ⚠️ Ce que ces deux campagnes disent de la méthode
>
> **Trois findings sur vingt étaient des règles déjà écrites, non tenues.** `R-10` (le message
> d'erreur brut affiché à l'écran) contredit la règle « faille V7 » que `SettingsPage` cite dans un
> commentaire. `S-2` a reçu son correctif dans `orgIdFromInvoice`, avec dix lignes d'explication —
> et sa jumelle vingt lignes plus bas ne l'a pas reçu. `R-12` documentait une garde
> (`RequireModule`) qui n'a jamais existé.
>
> **Deux findings ont été trouvés en regardant, pas en lisant.** Les quatre liens vers les pages
> contractuelles rendaient une 404 en anglais ; le compteur d'étapes de l'onboarding affichait son
> gabarit. Aucune gate ne pouvait les voir, et aucune relecture de code ne les avait vus.
>
> **Une garde du dépôt a refusé un correctif, et elle avait raison.** La première version de `R-08`
> acceptait un `id` dans le payload de création ; `categories/supabase.repository.test.ts` l'a
> rejetée parce que cela ouvrait un oracle d'existence sur les lignes d'autrui. *Le meilleur
> résultat d'un audit, c'est quand le dépôt corrige l'auditeur.*

## Mise à jour du 2026-08-27 (fin de journée) · seuls les audits qui ont bougé

Ce second tableau **complète** celui du dessus, il ne le remplace pas. Les audits absents de cette
liste n'ont pas été remesurés ce jour-là et gardent leur note du 2026-08-25.

| Audit | 08-25 | **08-27** | Δ | Ce qui a bougé |
|---|---|---|---|---|
| [Performance](./PERFORMANCE.md) | 88 | **91** | +3 | Ouvrir `/entreprise` : 64,1 → **12,2 kB gzip**. Retenu par le chunk d'entrée, 87,2 → **106,9 kB** |
| [UI / UX](./UI-PATTERNS.md) | 80 | **82** | +2 | Trois écrans n'annoncent plus de zéros faux pendant le chargement, la nav ne se réordonne plus, deux clics n'emportent plus le visiteur hors de la landing |
| [Architecture](./ARCHITECTURE.md) | 79 | **81** | +2 | 4ᵉ passe du cliquet : 15 → **14 fichiers**, budget 11 452 → **10 811**. Suite 1 736 → **1 802** |
| [Mobile / DA](./MOBILE.md) | 72 | **74** | +2 | L'espace entreprise passe du 3ᵉ au **1ᵉʳ** niveau de navigation mobile. ⚠️ La « feuille cassée » annoncée le matin est **rétractée le soir**, mesure à l'appui |
| [Accessibilité](./ACCESSIBILITY.md) | 79 | **80** | +1 | Trois défauts de nom accessible qu'**axe-core ne voit pas** (« 27août », « (3)· 1 h 45 », pastille en `title` seul) |
| [Tests / CI](./TESTING.md) | 88 | **89** | +1 | +66 tests, puis le soir : couverture **relancée et verte** (4 indicateurs en hausse), 7ᵉ cliquet, et 2 tests bâtis autour d'un **témoin** |
| [Sécurité](../faille.md) | 86 | **86** | 0 | Le finding G-1 reçoit son correctif (mig. `130`), **non appliqué en prod**, donc rien n'est refermé. Il reçoit en revanche son **test de base réelle** (5 rôles), qui reste rouge jusqu'à l'application |
| [Scalabilité](./SCALABILITY.md) | 84 | **84** | 0 | La pastille de nav rechargeait la lecture la plus chère du produit à chaque retour d'onglet. Corrigé ; **gain toujours non chiffré en requêtes**, mais le comportement est désormais prouvé par comptage d'appels |
| [RGPD](./RGPD.md) | 84 | **84** | 0 | Idem G-1 : minimisation d'`org_invitations` écrite, non appliquée |
| [SEO](./SEO.md) | 73 | **73** | 0 | Aucun contenu indexable produit, terrain non remesuré depuis le 08-19 |
| Mode entreprise · relecture UI/UX indépendante | 19 / 40 | **24 / 40** | +5 | Trois passages le même jour sur les dix heuristiques de Nielsen. Montent : visibilité de l'état système (1 → 3), esthétique et minimalisme (1 → 3), prévention des erreurs (2 → 3). Restent à 2 : contrôle et liberté, cohérence des filtres, reconnaissance, flexibilité, récupération d'erreur, aide |

> **Six notes montent, de 3 points au plus ; quatre ne bougent pas.** C'est volontaire et c'est le
> point de la journée : des correctifs réels n'ont rapporté **aucun** point, chacun pour une raison
> nommée. La mig. `130` n'est pas appliquée. Le gain de la pastille de nav n'est pas chiffrable
> avant déploiement. *Un correctif dont on ne peut pas montrer le gain n'est pas un point de note,
> c'est une dette de mesure.*
>
> ### Reprise du soir · trois dettes de mesure sur quatre remboursées
>
> Les quatre points « non mesurés » du matin ont été repris le soir même. Trois sont réglés, un
> ne peut pas l'être, et **la reprise a corrigé une conclusion du matin plutôt que la confirmer** :
>
> | Dette du matin | Ce qu'a donné la reprise |
> |---|---|
> | `test:coverage` non relancée | ✅ **Relancée, verte**, 1 802 tests. Les 4 indicateurs montent (statements 27,20 → **28,15**), la marge du plancher `functions` passe de 0,32 à ~1,4 point |
> | Mig. `130` sans test de base réelle | ✅ `e2e/rls/org-invitations.test.ts`, **5 rôles**. La migration reste à appliquer : le test est rouge d'ici là, et c'est ce qui distingue « écrite » de « en vigueur » |
> | Gain de la pastille de nav non chiffré | 🟡 **Toujours non chiffré en requêtes** (rien à compter en démo, et pas d'« après » dans les `edge_logs` d'un correctif non déployé), mais le **comportement** est prouvé par comptage d'appels, avec témoin négatif |
> | « Une feuille cassée sous `prefers-reduced-motion` » | 🔴 **RÉTRACTÉ. Elle ne l'était pas.** `LoginModal` remise dans sa forme exacte d'avant correctif s'ouvre normalement sous `reducedMotion: 'reduce'` réellement émulé |
>
> 🔴 **La rétractation est la vraie leçon, et elle vaut pour les deux camps.** Le matin, un commit
> a affirmé un bug par **déduction depuis une règle**, sans l'ouvrir. Le soir, une première
> contre-mesure a affirmé l'inverse, en masse, depuis un **panneau navigateur non affiché** : dans
> un onglet caché `requestAnimationFrame` ne tourne pas, tout reste sur sa valeur initiale, et le
> harnais rend un rapport « tout est cassé » parfaitement convaincant. Les deux erreurs ont la même
> forme : **conclure sans témoin**. Le test qui referme le sujet en embarque un, et refuse de
> conclure si sa propre page ne peint pas.
>
> ⚠️ **Deux leçons de méthode, et la première est un aveu.**
>
> - **Une garde CI rouge a été déclarée deux fois « antérieure à mon travail », et c'était faux.**
>   `architecture.guard` était **verte** au commit précédent ; les 9 lignes ajoutées à
>   `TeamTasksTab` par le correctif d'états de chargement l'avaient cassée. L'erreur vient d'un
>   `git stash` pris à un moment où le commit fautif était déjà en place, c'est-à-dire d'un
>   « avant » qui n'en était pas un. **Un « avant » se reconstruit à un commit nommé, jamais dans
>   un arbre de travail.** C'est la deuxième fois en trois jours qu'une affirmation confiante sur
>   un état antérieur se révèle fausse, après les `refetchInterval` du 08-25.
> - **Un finding a été retiré parce qu'il était un artefact de mesure.** L'entrée « Entreprise »
>   avait été déclarée absente de la navigation ; elle était là, rendue en `<div role="button">`
>   quand le compte a plusieurs organisations, et les sélecteurs ne cherchaient que `button` et
>   `a`. Axel avait raison de dire « quand je teste, tout marche ». **Un outil de mesure qui ne
>   voit pas une chose ne prouve pas qu'elle est absente.**
>
> ⚠️ **Une migration écrite n'est pas une migration appliquée.** La `130` est dans le dépôt,
> vérifiée par `check:rls` et `validate:migrations`, et **la production est inchangée**. Elle
> figure à ce titre dans l'ordre de priorité de [`../faille.md`](../faille.md), pas dans les
> findings refermés.

## Mise à jour du 2026-08-29 · deux journées remesurées ensemble

Les 28 et 29 août n'avaient **jamais été notés** : le tableau précédent s'arrête au 27. Cette passe
couvre donc deux journées, et se lit contre la colonne 08-27. Les audits absents de cette liste
n'ont pas été remesurés et gardent leur note.

| Audit | 08-27 | **08-29** | Δ | Ce qui a bougé |
|---|---|---|---|---|
| [Performance](./PERFORMANCE.md) | 91 | **94** | +3 | Chunk d'entrée 106,9 → **75,5 ko**, plafond REDESCENDU. Landing : **407 ko de moins** au chargement. Le job `lighthouse` produit enfin un rapport |
| [Tests / CI](./TESTING.md) | 89 | **93** | +4 | **Les cinq jobs CI verts sur `main`**, une première ; `rls-integration` ne l'avait jamais été depuis 2026-06-21. Suite 1 802 → **1 836**, couverture en hausse sur les quatre indicateurs |
| [Architecture](./ARCHITECTURE.md) | 81 | **83** | +2 | 5ᵉ passe du cliquet, et la **première volontaire** : `TaskTable` 1 124 → **890**, budget 10 811 → **9 949** |
| [Scalabilité](./SCALABILITY.md) | 84 | **86** | +2 | Coût par ligne **mesuré** (54×, deux méthodes indépendantes). Le pooler n'était pas le sujet : l'application n'ouvre **aucune** connexion Postgres |
| [RGPD](./RGPD.md) | 84 | **86** | +2 | Les trois durées de conservation sont **publiées** dans la politique de confidentialité |
| [UI / UX](./UI-PATTERNS.md) | 82 | **84** | +2 | Une seule grammaire de filtre entre Tâches et Projets ; un onglet resté ouvert cesse d'exécuter un bundle périmé |
| [Mobile / DA](./MOBILE.md) | 74 | **76** | +2 | Sept onglets entreprise dans 335 px visibles, dont l'**actif** hors champ sur un lien profond |
| [SEO](./SEO.md) | 73 | **75** | +2 | Une barre finale renvoyait **quatre pages** use-case vers l'accueil, en production. Les pages prérendues sont mesurées à **100** |
| [Accessibilité](./ACCESSIBILITY.md) | 80 | **81** | +1 | La gate Lighthouse mesure et **bloque** (93 à 99 sur quatre pages). Aucun défaut corrigé : le point vient de la mesure |
| [Sécurité](../faille.md) | 86 | **86** | 0 | Le crédit accordé le 08-25 au test d'intégration de la mig. 115 était **faux** : ce test n'avait jamais été vert. Il l'est depuis le 08-29, donc la justification devient vraie, mais aucune protection nouvelle n'est en vigueur. G-1 toujours non appliqué |

> ### 🔴 Ce que cette passe dit, et ce n'est pas flatteur
>
> **Neuf notes montent. C'est exactement le profil dont ce document se méfie**, alors voici ce
> qu'il faut lire dedans.
>
> **Aucun des cinq jobs CI n'était rouge à cause du produit.** Cinq gardes en échec, cinq causes
> **dans les gardes elles-mêmes** : un test aux props inexistantes, un titre renommé sans son test,
> un Chrome qui ne démarrait pas, une configuration qui mesurait la page 404, et deux tests faux
> dans le harnais RLS. Les points gagnés sur Tests, Performance et Accessibilité récompensent donc
> surtout le fait qu'**on mesure enfin**, pas un produit qui se serait amélioré d'autant.
>
> **Deux fichiers avaient été posés sur `main` sans avoir jamais tourné**, faute de Docker sur la
> machine qui les écrivait. D'où la règle, écrite dans `TESTING.md` : *une garde qui ne peut pas
> être exécutée localement doit l'être en CI avant d'être invoquée comme preuve, et son premier run
> doit être regardé.*
>
> **Une note a déjà récompensé une garde qui ne tournait pas.** Le +4 de sécurité du 08-25
> s'appuyait sur « 337 lignes de test d'intégration contre une vraie base ». Le test existait et
> n'avait jamais été vert. La sécurité reste donc à 86 aujourd'hui, alors même que le test passe :
> le crédit avait déjà été versé.
>
> **La seule note qui ne bouge pas est celle qui dépend de la production.** Sécurité tient à G-1,
> écrit et non appliqué, et au PITR. C'est cohérent avec le reste du dossier : ce qui bloque le
> lancement n'est pas du code.

### Ce que ce tableau dit, au-delà des chiffres

**Un audit dont toutes les notes montent est un audit qui se félicite.** Deux lignes valent plus
que les neuf autres :

- **Performance, de −4 à +14 dans la même journée.** À 16 h la note tombait à 64 : sept
  migrations et un système de permissions livrés sans que personne ne regarde le bundle, sur le
  seul budget du dépôt qu'aucune garde ne mesurait. Le soir, le chemin critique passe de
  **580 à 420 kB gzip** (−27,6 %) et le budget devient une gate CI. Les deux leviers :
  les catalogues i18n voyagent avec leur page, et **recharts était préchargé pour tous les
  visiteurs** à cause d'une ligne de `manualChunks`, 117 kB gzip que ce dossier décrivait comme
  « lazy » depuis des semaines. Ce n'est pas une coïncidence si le seul budget non outillé est
  celui qui cachait une erreur : *une règle qu'aucun script ne mesure recule à chaque vague de
  features.*
- **Tests, de +3 à +8 en fin de journée.** À 16 h la note ne montait que de 3 malgré 73 tests
  ajoutés : la couverture était repassée sous ses seuils, le dénominateur ayant grossi plus vite
  que le numérateur (~2 000 lignes d'interface non testées). La gate a été refermée le soir par
  **115 tests de repository**, sans qu'aucun seuil ne soit baissé, et les seuils du glob
  `supabase.repository.ts` ont été **remontés** (65 → 74 % de statements) pour verrouiller le
  gain. C'est le cliquet dans les deux sens : il attrape la dette, puis il enregistre le
  remboursement.

Et deux constats de méthode, tous deux issus de vérifications faites **contre le code**, pas
contre la doc :

- **Trois `refetchInterval` permanents subsistaient** alors que `CLAUDE.md` et `SCALABILITY.md`
  annonçaient le matin même qu'il n'en restait aucun. Trouvés par recomptage nominatif, corrigés
  dans la journée. La cause de l'erreur est instructive : `isDemo ? false : 20_000` avait été lu
  comme « gardé par le mode démo », alors que c'est l'inverse, le sondage est retiré du seul
  environnement qui ne paie rien. **Un total ne prouve rien ; seul un décompte qui nomme le
  composant qui monte chaque hook prouve quelque chose.**
- **`MobileHeader` n'avait jamais fonctionné** en un mois d'existence, sur la seule page qui
  l'utilisait. Un code sans consommateur n'est pas seulement inutile, il est **non éprouvé**.
- **La facturation entreprise a basculé deux fois dans la journée** : `true` le matin, `false` à
  midi, `true` le soir (commits `d7d0ed7` puis `0425044`), les deux drapeaux à chaque fois
  ensemble, ce qui est la bonne pratique. Mais un état qui change trois fois en douze heures ne
  peut pas être documenté par une phrase d'affirmation : le rapport entreprise l'a affirmé trois
  fois, et s'est trompé deux fois. **L'état de la facturation se lit dans
  `src/modules/billing/premium-config.ts` et dans `billing_flags`, jamais dans un document.**

> ✅ **Refermé le 2026-08-26.** Ce point n'était pas theorique : mesuré en base, **une
> organisation sur quatre était déjà au plafond**, donc réellement dans l'impasse décrite ici.
> Les deux drapeaux sont repassés à `false` ensemble (mig. `124` appliquée en prod, et
> `ENTERPRISE_BILLING_ENFORCED = false`). Plus de quota appliqué, plus de CTA de paiement, et la
> croissance est débloquée. Réarmement = les deux drapeaux, après immatriculation et passage de
> Stripe en compte live. Détail : [`LEGAL.md`](./LEGAL.md).
>
> ✅ **Le second point est levé** : `npm run test:coverage` bloquait la CI en milieu de journée,
> il est vert depuis la campagne de tests du soir. Détail dans [`TESTING.md`](./TESTING.md).

---

**Correctifs de la veille (2026-08-24)** : la migration `109` referme les trois findings B-1, B-2,
B-3, **appliquée et vérifiée en prod le jour même**. La suite unitaire repasse au vert, la
convention d'alias `@/` devient une règle ESLint, et deux gardes de migration sont ajoutées **puis
testées** (`scripts/migration-guards.test.mjs`).

`I18N`, `DEPLOYMENT` et `POST-AUDIT-GUIDE` portent encore la date de leur dernier audit propre :
**ils n'ont pas été remesurés**, ne pas lire leur date comme une revérification.

## Deux statuts, jamais à confondre

| Statut | Où | Comment le lire |
|---|---|---|
| **Vivant** | [`../CLAUDE.md`](../CLAUDE.md), [`../faille.md`](../faille.md), `docs/*.md` | Décrit l'état courant. Si le code le contredit, **c'est un bug de doc à corriger**. |
| **Archive** | `docs/archive/**` | Instantané daté, **non maintenu**, coiffé d'un bandeau ⚠️. À lire pour comprendre *pourquoi* une décision a été prise. **Le code fait foi contre une archive.** |

## Documents vivants

| Doc | Périmètre |
|---|---|
| [`../CLAUDE.md`](../CLAUDE.md) | Point d'entrée : stack, modules, conventions, garde-fous |
| [`../faille.md`](../faille.md) | Sécurité : findings **ouverts**, priorités avant prod, règles durables · **note 86 au 2026-09-03** |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Invariants du projet et leur état vérifié · **note 84 au 2026-09-03** |
| [`SECURITY.md`](./SECURITY.md) | RLS, migrations SQL, repositories, Edge Functions, Stripe, CSP, secrets · **les 4 Edge Functions Stripe auditées le 2026-09-02**, cf. [`../faille.md`](../faille.md) |
| [`TESTING.md`](./TESTING.md) | Vitest, Playwright, a11y, i18n, CI, **checklist avant push prod** · **note 95 au 2026-09-03**, les cinq jobs CI verts · couverture relancée et verte le 2026-08-29 |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Runbook deploy / rollback Vercel + Supabase, drill de restauration |
| [`MOBILE.md`](./MOBILE.md) | Pages et composants mobiles, bottom-sheets, pièges iOS Safari · **note 76 au 2026-08-29**, inchangée au 2026-09-03 |
| [`UI-PATTERNS.md`](./UI-PATTERNS.md) | Listes, modals, tutoriels, onboarding, thèmes · **note 87 au 2026-09-03** |
| [`PERFORMANCE.md`](./PERFORMANCE.md) | `manualChunks`, lazy loading, images et polices, budget bundle · **note 92 au 2026-09-03**, gardé par `npm run check:bundle` et par le job `lighthouse` · et depuis le 2026-08-26 **le coût serveur d'une ouverture de session**, ramené de 29 à 21 requêtes REST |
| [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) | WCAG / EAA, aria, contraste, gates axe-core + Lighthouse · **note 82 au 2026-09-03**, la gate Lighthouse mesure et bloque enfin |
| [`SCALABILITY.md`](./SCALABILITY.md) | Montée en charge · **note 89 au 2026-09-03**, coût par ligne mesuré ET éprouvé à volume (200 puis 2 000 lignes, §9ter) |
| [`SEO.md`](./SEO.md) | Prérendu, sitemap, hreflang, indexation par locale · **note 75 au 2026-08-29**, inchangée au 2026-09-03 · données Search Console du 2026-08-19, non remesurées |
| [`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md) | 🔴 Le chantier qui débloque le SEO : kit de soumission annuaires, prêt à coller — **100 % manuel** |
| [`ACQUISITION.md`](./ACQUISITION.md) | Attribution `?ref=`, funnel mesuré en prod, runbook — **audit du 2026-08-14** |
| [`I18N.md`](./I18N.md) | Qualité réelle des traductions, périmètre bilingue — **audit du 2026-08-14**, non renoté · `i18n:scan` est une gate bloquante depuis le 2026-09-02 (seuil 25, cf. la note du 09-03 en tête du fichier) |
| [`RGPD.md`](./RGPD.md) | Inventaire des données personnelles, droits, rétention · **note 86 au 2026-08-29**, inchangée au 2026-09-03, durées de conservation publiées |
| [`RGPD-REGISTRE.md`](./RGPD-REGISTRE.md) | Registre des activites de traitement (RGPD art. 30) · **cree le 2026-08-26** |
| [`RGPD-VIOLATION.md`](./RGPD-VIOLATION.md) | Procedure de violation de donnees sous 72 h (RGPD art. 33-34) · **cree le 2026-08-26** |
| [`LEGAL.md`](./LEGAL.md) | Obligations légales du fondateur : statut, TVA, droit de la consommation, marque, sous-traitants · **créé le 2026-08-26**, non noté (ce n'est pas un audit) |
| [`STRIPE-LIVE.md`](./STRIPE-LIVE.md) | Compte Stripe live : les 8 prix et le `tax_behavior` définitif · **créé le 2026-08-26** |
| [`SUPPORT.md`](./SUPPORT.md) | Procédure de support : qui répond, sous quel délai, par quel canal, et quand ça devient un incident · **créé le 2026-08-28** |
| [`POST-AUDIT-GUIDE.md`](./POST-AUDIT-GUIDE.md) | Réactivation premium (`PREMIUM_ENFORCED`), finalisation Stripe |
| [`MIGRATION-REACT19.md`](./MIGRATION-REACT19.md) | Étude de faisabilité React 19 + `react-router` 8 · **créée le 2026-09-03** (audit A-6), non notée (ce n'est pas un audit de domaine) |
| [`COSMO-CLI.md`](./COSMO-CLI.md) | CLI d'accès aux données COSMO réelles (`scripts/cosmo/`) |
| [`AGENT-AJOUTER-TACHE.md`](./AGENT-AJOUTER-TACHE.md) | Mémo court : ajouter une tâche dans le vrai compte |
| [`../supabase/migration/README.md`](../supabase/migration/README.md) | Convention de nommage et ledger des migrations |

## Archives (`docs/archive/`)

Rangées par nature. Aucune n'est maintenue.

**Sécurité** — [`faille-historique.md`](./archive/faille-historique.md) : preuve de toutes les
corrections 2026-04 → 2026-08, audits datés, anciens ordres de priorité.

**Audits techniques** — `AUDIT-ARCHITECTURE-2026-08-07.md` (20 correctifs, note 60→79),
`AUDIT-TECHNIQUE-2026-07-15.md`, `audit-architecture-ultime-2026-06-11.md`.

**Audits UI / UX / mobile** — `AUDIT-UI-2026-07-14.md`, `audit-ux-ui.md`,
`AUDIT-IMPECCABLE-MOBILE-2026-07-25.md`, `AUDIT-DESIGN-SKILL-MOBILE-2026-07-25.md`,
`MOBILE-DA-BRIEF.md`.

**Acquisition / SEO / produit** — `PLAN-ACQUISITION-30J-2026-08-13.md`, `AUDIT-SEO-2026-07-18.md`,
`OUTREACH-SEO-2026-07.md`, `RAPPORT-MODE-ENTREPRISE-2026-08-12.md`,
`ENTREPRISE-MANQUEMENTS-2026-08-12.md`, `text-landingpage.md`.

**Plans et specs exécutés** — `superpowers/plans/*`, `superpowers/specs/*`.

## Règles d'entretien

1. **Un audit ne se met pas à jour** — c'est un instantané. Ses findings encore ouverts remontent
   dans le document vivant correspondant (`faille.md`, `PERFORMANCE.md`…), puis il part en archive.
2. **Jamais de numéro de ligne** vers un autre fichier : les fichiers bougent, les ancres de
   section survivent.
3. **Un chiffre porte sa date de mesure** (nombre de tests, taille de bundle, nombre de migrations),
   sinon il devient un piège silencieux.
4. **Un doc vivant qui n'a plus rien d'ouvert** part en archive ou disparaît — il ne reste pas à la
   racine à faire croire qu'il y a du travail en cours.
