# Performance bundle — `vite.config.ts manualChunks`

## Note de performance : 68 → 64 → 88 → 91 → 94 → **92 / 100** (2026-08-24 → 2026-08-27 → 2026-08-29 → 2026-09-03)

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
[`UI-PATTERNS.md`](./UI-PATTERNS.md) et [`MOBILE.md`](./MOBILE.md). *Ne pas le compter comme un
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
([SCALABILITY.md](./SCALABILITY.md) §2), pour repeindre une pastille. `useTeamTasks` gagne
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

## Vendor chunks isolés (commenter toute modif)

**Tailles réelles, `npm run build` du 2026-08-25** (brut / gzip). Les colonnes précédentes
gardent les mesures antérieures pour rendre la dérive lisible :

| Chunk | Contenu | 08-24 (gzip) | 08-25 midi | **08-25 soir** | Quand chargé |
|---|---|---|---|---|---|
| `index` (app) | code applicatif partagé | 470 kB (134 kB) | 487 kB (139 kB) | **327 kB (87 kB)** ✅ | Toujours |
| `vendor-react` | react + react-dom + scheduler | 227 kB (72 kB) | 227 kB (72 kB) | 227 kB (72 kB) | Toujours |
| `vendor-router` | react-router | 38 kB (14 kB) | 38 kB (13 kB) | 38 kB (14 kB) | Toujours (split pour parallel HTTP/2) |
| `vendor-radix` | @radix-ui/* | 145 kB (45 kB) | 145 kB (45 kB) | 145 kB (45 kB) | Toujours |
| `vendor-supabase` | @supabase/supabase-js | 215 kB (56 kB) | 215 kB (56 kB) | 215 kB (56 kB) | Toujours (extrait pour cache CDN) |
| `vendor-sentry` | @sentry/react | 146 kB (49 kB) | 146 kB (49 kB) | 146 kB (49 kB) | Toujours (extrait pour cache CDN) |
| `vendor-animation` | framer-motion | 148 kB (49 kB) | 148 kB (49 kB) | 148 kB (49 kB) | Toujours |
| `vendor-utils` | date-fns + lucide-react **+ clsx / tailwind-merge / cva** | 70 kB (21 kB) | 71 kB (21 kB) | **100 kB (30 kB)** | Toujours |
| `vendor-query` | @tanstack/* | 60 kB (18 kB) | 60 kB (17 kB) | 60 kB (18 kB) | Toujours |
| `vendor-charts` | **recharts + d3-* + victory-vendor** | 414 kB (118 kB) | 414 kB (118 kB) | 414 kB (118 kB) | **Lazy · et VRAIMENT lazy depuis le 2026-08-25 soir** (StatisticsPage, DashboardChart, GuidePage) |
| **catalogues i18n** | un chunk par namespace et par langue | dans `index` | dans `index` | **`org` 14 kB · `landing` 10 kB · `guide` 4 kB · `tasks` 3 kB · les 13 autres < 2 kB** | **Lazy** (avec la page qui les utilise) |
| `vendor-calendar` | @fullcalendar/* **+ `locales-all`** | 290 kB (85 kB) | 290 kB (85 kB) | 290 kB (85 kB) | **Lazy** (`/agenda` uniquement) |
| `vendor-gsap` | gsap + plugins (+ `InertiaPlugin`) | 139 kB (55 kB) | 139 kB (55 kB) | 139 kB (55 kB) | **Lazy** (LandingPage uniquement) |
| `vendor-ogl` | ogl · micro-runtime WebGL | 44 kB (13 kB) | 44 kB (13 kB) | 44 kB (12 kB) | **Lazy** (fond `LightRays` du hero entreprise) |
| **`OrganizationPage`** | **tout le mode entreprise** | 265 kB (61 kB) | 281 kB (64 kB) | 281 kB (64 kB) 🟠 | **Lazy** (`/entreprise`) |
| `TasksPage` | page Tâches | 130 kB (30 kB) | 129 kB (29 kB) | 129 kB (30 kB) | **Lazy** |
| `TaskModal` | modal de tâche | 104 kB (24 kB) | 102 kB (22 kB) | 102 kB (23 kB) | **Lazy** |
| `LandingPage` | shell + aiguillage + parcours perso | 81 kB (21 kB) | 82 kB (20 kB) | 82 kB (21 kB) | **Lazy** (`/`) |
| `EnterpriseTrack` | les 10 sections du parcours entreprise | 44 kB (11 kB) | 48 kB (12 kB) | 49 kB (12 kB) | **Lazy** (à la bascule / `/entreprise-presentation`) |

**Chemin critique réel**, l'entrée PLUS tout ce que `dist/index.html` précharge, c'est-à-dire ce
que télécharge un visiteur qui arrive et repart :

| | 08-25 midi | **08-25 soir** |
|---|---|---|
| Chunks préchargés | 10 | **9** |
| Total gzip | **580,5 kB** | **420,1 kB** (−27,6 %) |

C'est CE chiffre qu'il faut regarder, pas la seule taille de `index` : c'est lui qui a caché
117 kB de recharts pendant des semaines.

> 🟠 **Le warning Vite « chunks larger than 400 kB » reste actif**, mais il ne concerne plus le
> chemin critique : le seul chunk au-dessus de 400 ko bruts est `vendor-charts` (414 ko), désormais
> réellement lazy. Le chunk `index` est retombé à **327 ko bruts / 87 ko gzip**.
>
> Trajectoire du chunk d'entrée : **124 kB (08-14) → 128 (08-15) → 134 (08-24) → 139 (08-25 midi)
> → 87 (08-25 soir)**. Les quatre premières valeurs montaient parce que rien ne les mesurait ; la
> cinquième descend parce qu'on a enfin regardé *ce qui* était dedans plutôt que *combien* il
> pesait.
>
> Recharts n'est **plus** importé par la landing (`AppWindowShowcase` l'exclut volontairement du
> hero) : `StatsShowcase` ne vit plus que dans `GuidePage`, en `React.lazy`.

## Images et polices, le poste qu'on n'avait jamais pesé

**Tout ce qui précède parle de JavaScript. Ce n'était pas le plus lourd.**

Le 2026-08-25 au soir, le chemin critique JS pesait 420 ko gzip, et la page
d'accueil servait **1 046 ko d'images et 133 ko de polices** aux mêmes
visiteurs. Trois gaspillages, tous invisibles à la lecture du code :

| Ce qui était servi | Poids | Pourquoi c'était du gaspillage |
|---|---|---|
| `logo.png` | **255 ko** | 584 px de côté pour un affichage à 28-40 px, et chargé deux fois plutôt qu'une (`<img>` de l'en-tête ET `rel="icon"`) |
| 3 captures de la landing, en PNG | **790 ko** | Elles vivent dans `#seo-fallback`, qui est en `display:none`. **Aucun visiteur ne les a jamais vues.** Le scanner de préchargement les téléchargeait quand même, parce qu'il lit le balisage avant le CSS |
| `inter-var-latin-ext.woff2` | **85 ko** | Téléchargé à cause d'UN caractère, le « œ » de « coup d'œil » |

### Le « œ » à 85 ko

Les deux `@font-face` d'Inter se **chevauchent** sur `U+0152-0153` (Œ œ) : la
plage latin les liste explicitement, la plage latin-ext les contient dans son
intervalle `U+0100-02BA`. Quand un caractère est couvert deux fois dans la même
famille, **c'est la dernière déclaration qui gagne**. Latin-ext était déclaré
en second : un seul « œ » suffisait à faire venir 85 ko de glyphes
d'Europe centrale sur chaque page d'un site français.

**Correctif : intervertir les deux blocs.** C'est exactement l'ordre qu'utilise
la feuille de style de Google Fonts, et pour cette raison précise. Vérifié dans
le navigateur avant de conclure : le subset latin **contient** la ligature œ
(largeur mesurée 16 px contre 8,8 px pour une police de secours), donc le rendu
est identique au pixel près.

### Résultat mesuré sur `/`

| | avant | après |
|---|---|---|
| Images | 1 046 ko | **2,7 ko** |
| Polices | 133 ko | **48 ko** |
| Total de la page | ~1 610 ko | **749 ko** (−53 %) |

Aucune image n'a été redimensionnée en dessous de sa taille d'affichage, aucun
cadrage n'a changé, aucune balise n'a bougé de place. Les captures restent en
2560 × 1600 pour un affichage en 1280 × 800, c'est-à-dire exactement ce qu'un
écran retina consomme.

### Règles qui en sortent

- ❌ **Ne jamais servir une image sans regarder sa taille d'affichage.** Un
  facteur 2 est du retina ; un facteur 15, comme le logo, est un oubli.
- ❌ **Ne jamais mettre une `<img>` sans `loading="lazy"` dans un bloc masqué.**
  `display:none` n'empêche PAS le téléchargement. C'est contre-intuitif et ça a
  coûté 790 ko par visite pendant des mois.
- ⚠️ **Deux `unicode-range` qui se chevauchent se départagent par l'ordre de
  déclaration.** Le subset le plus large se déclare en PREMIER.
- ✅ Les captures du parcours entreprise étaient déjà en WebP et déjà `lazy`
  (`AppShot.tsx`). Le motif existait dans le dépôt ; il n'avait simplement
  jamais été appliqué à la landing perso.
- ⚪️ **`og-card.png` (504 ko) est laissé tel quel, et c'est une décision.** Elle
  n'est chargée par aucun visiteur, seulement par les robots des réseaux
  sociaux quand un lien est partagé. La recompresser ferait gagner de la bande
  passante de crawl et risquerait de dégrader l'aperçu de partage, qui est la
  première impression du produit. Mauvais échange.

Réencodage reproductible : `npm run images:check` (mesure) puis
`node scripts/optimize-images.mjs`.

## Règles non négociables

- ❌ **Ne jamais importer Recharts ou un composant qui l'utilise (DashboardChart/StatsShowcase) sans `React.lazy`** — sinon il retombe dans le chunk du caller et pollue le critical path. Faille P-2.
- ⚠️ **GSAP : réintroduit en 2026-07, landing page uniquement.** L'ancienne règle « ne jamais réintroduire GSAP » (finding P-1, 2026-05) **ne s'applique plus** : la lib est de retour derrière le point d'entrée unique `src/lib/gsap.ts`, isolée dans le chunk `vendor-gsap` que seule la `LandingPage` (lazy) charge. Contrainte maintenue : **aucun import GSAP hors landing**, et jamais `import { gsap } from 'gsap'` en direct.
- ❌ **Toute nouvelle dep > 50 kB minified doit être ajoutée à `manualChunks`** avec une règle explicite et commentée.
- ✅ `lucide-react` : imports nominaux uniquement (`import { Icon } from 'lucide-react'`). Jamais `import * as`.
- ✅ `date-fns/locale/fr` : import nominal. Jamais `import * as locales`.
- ✅ Tout composant globalement monté dans App.tsx (CommandPalette, etc.) qui n'apparaît qu'après un geste utilisateur → **lazy avec Suspense**.

## Budget bundle (objectif)

- Chunk `index` : au 2026-08-27, **106,9 kB gzip** (2026-08-25 soir : 87,2 kB).
- **Cliquet** : `npm run check:bundle` refuse un chunk d'entrée au-dessus de **112 kB gzip** et un
  chemin critique au-dessus de **400 kB gzip**. Bloquant dans le job CI `lint-test-build`, juste
  après le build.
- 🔴 **Le plafond d'entrée est passé de 92 à 112 kB le 2026-08-26**, seule remontée de plafond du
  dépôt, justifiée en commentaire dans `scripts/check-bundle-budget.mjs`. Une seconde remontée
  ferait du budget une formalité : la marge se regagne en descendant la mesure.

> ✅ **Ce budget a enfin sa garde (2026-08-25).** Il était le seul du dépôt à n'être mesuré par
> aucun script, et le seul à avoir reculé sans que personne le voie : +5 kB gzip en une journée,
> pour une marge de 11 kB. `scripts/check-bundle-budget.mjs` lit le build RÉEL, les tailles gzip
> de `dist/assets`, et surtout **le chunk d'entrée déclaré dans `dist/index.html`**, pas le
> premier `index-*.js` venu.
>
> 🔴 **Ne jamais remonter un plafond pour faire passer la CI.** Même règle que
> `vitest.config.ts` : un plafond ne descend que quand la mesure descend.

> ✅ **Le levier i18n est APPLIQUÉ (2026-08-25 soir).** Le catalogue `fr` était importé
> **statiquement** en entier par `src/i18n/catalog.ts` : 19 namespaces, **178 ko de JSON brut**
> dans le chunk `index`, dont `org` 50 ko, `landing` 34 ko, `guide` 14 ko, `tutorials` 8 ko, des
> pages que la plupart des sessions n'ouvrent jamais.
>
> **Ce qui a été fait, et pourquoi c'est sûr.** Seuls `common` et `errors` restent eager. Le choix
> n'est pas arbitraire : `scripts/i18n-shell-namespaces.mjs` parcourt le graphe d'imports
> statiques depuis `App.tsx` et `main.tsx` et dit exactement ce que le SHELL rend avant qu'une
> route soit résolue. Les 17 autres sont attendus par `lazyWithRetry` (src/App.tsx), donc par le
> `<Suspense>` qui enveloppe déjà chaque route.
>
> ⚠️ **Le risque était réel et il est traité par une garde, pas par la vigilance.** Rendre un
> namespace paresseux sans attendre son chargement affiche `org.project.name` à l'écran pendant
> une frame. `src/i18n/lazy-namespaces.guard.test.ts` échoue si une route déclare moins de
> namespaces que son sous-arbre n'en utilise, sous-arbre calculé en traversant AUSSI les `lazy()`
> imbriqués, parce qu'un composant chargé paresseusement dans une page rend quand même sous le
> même toit.
>
> **Vérifié dans le navigateur sur le build de production**, pas seulement en test : 10 routes en
> `fr` et 5 en `en`, balayage du DOM et des attributs `aria-label` / `title` / `placeholder` à la
> recherche du motif `namespace.clé`. **Zéro occurrence.**
>
> ⚠️ Un test de composant qui monte directement un composant utilisant un namespace non-eager doit
> désormais faire `await ensureNamespaces(['org'], 'fr')` dans un `beforeAll`, sinon il assertera
> sur des clés brutes. Exemple : `EnterpriseTierGrid.test.tsx`.

- Chaque chunk lazy : **< 80 kB gzip**. Exceptions documentées : `vendor-charts` (118 kB),
  `vendor-calendar` (85 kB), `vendor-gsap` (55 kB).
  ⚠️ **`OrganizationPage` est à 64,2 kB gzip au 2026-08-25** (61 kB la veille) : toujours sous le
  budget, mais c'est de loin le plus gros chunk de page, et il grossit à chaque vague entreprise.
  Le découpage de `PyramidTab` (1 506 → 1 045 lignes) **n'a rien changé à son poids** : extraire
  `PyramidNodeCard` déplace du code à l'intérieur du même chunk. Découper aide la maintenabilité ;
  seul le `lazy` aide le bundle.

> **`vendor-calendar` : 76 → 85 kB gzip (2026-08-02, i18n Agenda).** `AgendaPage`
> importe `@fullcalendar/core/locales-all` (+9 kB gzip). Sans données de locale,
> FullCalendar retombe sur les défauts anglais pour `firstDay` et l'agenda
> français commençait la semaine le dimanche. L'alternative — un import par
> langue (~1 kB) — obligerait à éditer `AgendaPage.tsx` à chaque nouvelle
> langue, ce que le socle i18n évite partout ailleurs (cf. `src/i18n/catalog.ts`).
> Coût assumé : le chunk est lazy et ne concerne que `/agenda`.
- Le warning Vite `> 400 kB` sur `index` est **déjà là** et ne signale pas une régression du split
  charts (les vendors sont bien isolés) : c'est le code applicatif qui a grossi (mode entreprise,
  i18n). Si tu veux le faire baisser, la cible est le découpage des grosses pages, pas `manualChunks`.

## Résiduels connus (audit perf du 2026-05-29, revérifiés le 2026-08-14)

- ✅ **Lighthouse CI câblé le 2026-08-24** (`lighthouserc.json` + job `lighthouse` dans
  `.github/workflows/ci.yml`). Mesure LCP / TBT / CLS / a11y / SEO sur les 4 routes
  **prérendues** (`/`, `/guide`, `/blog`, `/pour-freelances`) ; les routes protégées
  demandent une session, donc un job Playwright, pas Lighthouse.
  Bloquant sur a11y, SEO et CLS ; avertissement sur la performance, qui varie avec le
  runner — une gate rouge en permanence finit ignorée.
  ⚠️ **Les seuils sont PROVISOIRES et doivent être resserrés après le premier run.**
  Ils n'ont pas pu être posés « au réel mesuré » comme les autres budgets du dépôt :
  Lighthouse a besoin d'un Chrome exécutable, absent de la machine de développement.
  Un budget très au-dessus du réel ne mesure rien.
- **`vendor-charts` reste le plus gros lazy** (118 kB gzip). Le grief d'origine (« chargé au scroll
  de la landing ») est **caduc** : la landing n'importe plus Recharts. Une migration `visx`/`chart.js`
  n'a donc plus d'urgence.
- **15 fichiers source dépassent 600 LOC** (2026-08-25), le plus gros étant désormais
  `src/components/TaskTable.tsx` (1 124 lignes), et non plus `PyramidTab.tsx`, tombé à 1 045.
  L'objectif « aucun fichier > 600 LOC » du refactor de juin 2026 n'est toujours pas tenu, mais le
  budget baisse : 13 103 → 11 452 lignes en deux jours, cf.
  [`ARCHITECTURE.md`](./ARCHITECTURE.md) §3.

## Ce que coûte une ouverture d'application

**29 requêtes REST au chargement, ramenées à 21 le 2026-08-27.** Le compte vient des
`edge_logs` de production, sur une session réelle du bundle courant arrivant à froid sur
`/dashboard`.

⚠️ **Correction d'un chiffre annoncé la veille.** La trace de 25 secondes contient 32 requêtes,
et elles ont d'abord été comptées comme étant toutes celles du chargement. Trois d'entre elles
portent en fait un identifiant de tâche précis (`tasks?id=eq.…`, `shared_tasks?task_id=eq.…`,
`share_links?task_id=eq.…`) : c'est une fiche que l'utilisateur a ouverte juste après. Le
chargement lui-même en coûtait **29**. Une fenêtre de temps n'est pas un événement.

| Ce qui les émet | Avant | Après | Payées par |
|---|---|---|---|
| Données du tableau de bord (tâches, catégories, listes, agenda, habitudes, OKR, KR) | 9 | **7** | tout le monde |
| Collaboration (amis, profils, demandes reçues et émises, tâches et listes partagées) | 8 | **7** | tout le monde |
| Mode entreprise (org, membres, adhésions, notifications, invitations, projets, tâches d'équipe) | 9 | **4** | **membres d'une org seulement** |
| Session et abonnement (`touch_last_seen`, `subscriptions`, profil) | 3 | 3 | tout le monde |
| **Total** | **29** | **21** | |

Ce n'est pas absurde pour sept domaines métier affichés, et ces requêtes partent en parallèle sur
HTTP/2, pas en série. Mais **c'est le multiplicateur de charge du produit** : 100 arrivées
simultanées valaient 2 900 requêtes, elles en valent 2 100. C'est ce nombre qu'il faut surveiller
avant un pic d'acquisition, bien avant le coût unitaire de chacune.

### Les 4 premières requêtes retirées, et pourquoi elles existaient

Aucune migration, aucun changement d'écran, aucune donnée affichée en moins. Les quatre venaient
du même travers : **une donnée déjà chargée, redemandée sous un autre angle.**

1. **`okrs?completed=eq.false` et le `key_results` qui suivait (−2).** `useWeeklyCheckin()` est
   monté par le tableau de bord à chaque ouverture et ne se sert de cette liste que pour tester
   `length > 0`, un lundi ou un mardi. Elle passait par une clé React Query distincte, donc une
   requête réseau, et le repository enchaînait un second appel pour hydrater les `key_results`
   des OKR qu'il venait de lire. `completed` est une colonne déjà présente sur chaque OKR chargé
   par `useOkrs()` : le filtre se fait en mémoire, sur quelques dizaines d'éléments.
2. **`shared_tasks?shared_by=eq.moi` (−1).** Deux lectures de la même table cohabitaient :
   `mine` (`shared_by = moi`) et `related` (`shared_by = moi OR friend_id = moi`). La seconde
   contient déjà la première en entier, et sélectionne toutes ses colonnes. C'était une requête
   pour un sous-ensemble de l'autre. Effet de bord bienvenu : les badges d'avatars suivent
   désormais le canal Realtime, qui n'invalidait que la clé `related`.
3. **`organizations?id=in.(…)` (−1).** `getMyOrganizations` lisait les adhésions, **puis**
   les organisations avec un `in(...)` bâti sur le premier résultat : deux allers-retours
   **séquentiels**, le second ne pouvant même pas partir avant le retour du premier. La jointure
   PostgREST sur la clé étrangère `organization_members.org_id` fait les deux en une requête. La
   RLS ne change pas : la ligne jointe est filtrée par sa propre policy, et une organisation
   illisible revient à `null`, écartée côté client.

Les trois sont verrouillées par des tests qui échouent si on les rebranche
(`okrs/hooks.test.tsx`, `friends/hooks.test.tsx`, `organizations/supabase.repository.test.ts`),
et chaque garde a été vue **rouge** sur la régression qu'elle prétend attraper.

### La boîte de réception d'entreprise : 5 requêtes en 1 (mig. `129`)

Le palier suivant, et le plus gros. Cinq lectures partaient à chaque ouverture,
sur **toutes** les pages protégées, parce que `Layout` monte `useOrgBadges` pour peindre une
pastille de notification :

| Ce qui partait | Ce que ça servait à afficher |
|---|---|
| `rpc/get_my_org_invitations` | la boîte de réception |
| `rpc/get_my_org_removal_notices` | la boîte de réception |
| `organization_join_requests?user_id=eq.moi` | ma demande d'adhésion en attente |
| `organization_join_requests?org_id=eq.X` | les demandes reçues, vue admin |
| `org_notifications?org_id=eq.X` | la pastille |
| `profiles?id=in.(…)` *(conditionnelle)* | nommer les demandeurs |

`get_my_org_inbox()` les rend ensemble, en un objet JSON. Les cinq hooks gardent leur nom, leur
signature et leur forme de retour : ils deviennent des sélecteurs `useMemo` sur une lecture unique.
Aucun écran n'a changé.

**Deux décisions de conception valent d'être retenues.**

**1. Aucun paramètre, et c'est le point.** Le périmètre vient de `auth.uid()` seul, comme
`get_my_tasks` (mig. 085). Prendre un `p_org` aurait obligé le client à attendre que
l'organisation active soit résolue avant de partir : on aurait échangé quatre requêtes contre du
**délai**, en sérialisant ce qui partait en parallèle. La fonction rend donc les sections par
organisation pour toutes mes organisations, et le client filtre.

**2. `SECURITY INVOKER`, volontairement.** 🔴 Agréger cinq lectures dans une fonction
`SECURITY DEFINER` reviendrait à réécrire cinq autorisations à la main, dans une fonction qui
contourne la RLS. C'est exactement là qu'une agrégation « de performance » devient une fuite. Ici,
les deux sections qui ont besoin de privilèges élevés ne sont pas réécrites, elles **appellent les
fonctions `DEFINER` existantes**, inchangées ; les trois autres lisent leurs tables en direct, donc
sous la RLS de l'appelant. La fonction n'ouvre **aucun accès nouveau**, et si une policy change
demain, elle suit.

**Vérifié en prod après application**, sur des demandes d'adhésion posées en transaction annulée
pour que la section admin ne soit pas jugée sur du vide :

| Compte | Demandes vues | Notifications | Invitations |
|---|---|---|---|
| admin de l'org | 2 | 0 | 0 |
| **membre simple de la même org** | **0** | 0 | 1 |
| non-membre | 0 | 20 | 0 |

Parité prouvée avant application, pour **chaque** compte de `auth.users`, section par section,
contre les requêtes que le client émettait.

⚠️ Les bornes sont appliquées **par organisation** (window function), pas globalement : 200
demandes, 50 notifications. Sans cela, un compte membre de trois organisations verrait la
troisième tronquée par les deux premières, et ça ne se serait vu que chez lui.

❌ Ne pas réintroduire une invalidation par section dans `useOrgInboxRealtime` : ces clés ne
portent plus de donnée, l'écran cesserait de se rafraîchir **en silence**. Garde :
`organizations/inbox.hooks.test.tsx`, vue rouge avant d'être committée.

⚪️ **Deuxième piste** : `friends` puis `profiles?email=in.(…)`, et `friend_requests` en deux
requêtes (reçues, émises). La première paire ne peut pas devenir une jointure PostgREST, il n'y a
pas de clé étrangère entre `friends.email` et `profiles.email`.

### 🔴 Le correctif que personne ne reçoit : les onglets jamais rechargés

**91,5 % du trafic Supabase du 2026-08-26 est venu de DEUX onglets** qui exécutaient encore le
bundle d'avant la suppression des sondes (2026-08-25). Ventilation par session, sur les 18 408
requêtes `/rest/v1/*` de la journée :

| Session | Requêtes / 24 h | dont `friend_requests` | Verdict |
|---|---|---|---|
| `051be163` | 10 835 | 6 151 | ancien bundle, **sonde toutes les 16 à 20 s** |
| `dc812ab1` | 6 002 | 2 044 | ancien bundle, **sonde** |
| `7aa61ad2` | 1 185 | 52 | bundle courant, **aucune sonde** |

La session propre est restée ouverte **douze heures** pour 52 lectures de `friend_requests`, soit
4 par heure, toutes attribuables à des changements d'écran. Le code livré est propre. **Ce qui
tourne encore, c'est du code d'avant.**

Une SPA ne recharge pas son bundle toute seule : un onglet laissé ouvert exécute indéfiniment la
version qu'il a téléchargée. Conséquence produit, contre-intuitive : **un gain de performance
n'atteint que les utilisateurs qui rouvrent l'application**, et les plus assidus, ceux qui ne
ferment jamais l'onglet, sont les derniers servis et les plus coûteux.

⚪️ **Reste ouvert** : COSMO n'a aucun mécanisme pour signaler à un onglet ouvert qu'une nouvelle
version existe. C'est le chantier qui transformerait tout correctif client en gain réel.

## Limites de requêtes

> **⚡ `tasks` : lire via `get_my_tasks()`, jamais `.from('tasks')`** (mig. 085,
> 2026-08-07). La policy `tasks_select_own_or_shared` est un `OR` qui rend
> `idx_tasks_user_id` inutilisable → `Seq Scan` de la table GLOBALE, vérifié par
> `EXPLAIN` en prod. La RPC exprime le même ensemble en `UNION` indexable.
> Vaut pour `getAll`, `getByDate`, `getFiltered` **et** `getPage`.
> Exception : `getById` (accès par clé primaire).

> **⚡ Tables entreprise : passer par les RPC indexables** (mig. 113 et 117, appliquées en prod).
> `team_tasks` / `team_projects` / `team_task_dependencies` sont filtrées par
> `can_access_team_project(...)`, une fonction appelée par ligne, donc `Seq Scan` obligatoire +
> CTE récursive à chaque ligne, **≈ 60× le coût par ligne** du prédicat de `tasks` (mesuré le
> 2026-08-14). Les policies restent en place en défense en profondeur ; les lectures passent par
> `get_my_team_tasks`, `get_my_team_projects` et `get_my_team_task_dependencies`, qui n'évaluent
> le sous-arbre managérial **qu'une fois par organisation**. Chemin verrouillé par
> `team-projects/supabase.repository.test.ts`. Détail : [`SCALABILITY.md`](./SCALABILITY.md) §2.


> **⚡ `events` : ne jamais faire juger une ligne par une fonction** (mig. `128`, **appliquée en
> prod le 2026-08-27**). La policy de lecture appelait `manages_user(user_id)`, une fonction **sur une
> colonne**, donc rappelée pour chaque ligne examinée, chaque appel joignant deux fois
> `organization_members` puis évaluant la CTE récursive `get_subtree`. Mesuré en prod le
> 2026-08-26, plan chauffé, lecture de l'agenda d'un membre non géré : **17,19 ms → 0,61 ms**, et
> le plan passe de `Rows Removed by Filter: 128` à un BitmapOr de deux Index Scan, donc **zéro
> ligne remontée du tas pour être jetée**. Lire son propre agenda ne changeait rien (0,25 ms) : la
> branche « own » court-circuitait déjà le `OR`. Le correctif est `my_managed_user_ids()`, sans
> argument, donc hissée en InitPlan et évaluée une fois par requête. Troisième occurrence de la
> classe, après `tasks` (085) et `team_tasks` (113, 117). Garde :
> `scripts/migration-guards.test.mjs`. Détail : [`SCALABILITY.md`](./SCALABILITY.md) §2ter.

> **📉 Habitudes : lire par `get_my_habits(p_days)`** (mig. 119, prod). `habits.completions`
> gagnait 12,7 octets par jour et par habitude, **sans borne**. La RPC renvoie `completions`
> filtré à la fenêtre ET quatre agrégats calculés serveur sur l'historique entier
> (`streak_current`, `streak_best`, `completions_total`, `first_completion_date`), c'est ce qui
> rend la troncature acceptable. **Ne jamais dériver une série ou un total de `completions`.**

> **📡 Collaboration : Realtime, pas sondage** (mig. 089). Le `refetchInterval`
> de 15 s sur `useTasks` coûtait ≈ 58 Mo/mois/utilisateur d'egress Supabase.
> `useSharedTasksRealtime` (monté une fois dans `App.tsx`) écoute
> `shared_tasks` ; le sondage subsiste à 5 min en filet de sécurité.
> Toute table écoutée doit être dans la publication `supabase_realtime` **et**
> en `REPLICA IDENTITY FULL` (sinon les DELETE ne portent que la clé primaire).

> **🔑 Identité : `getSession()`, pas `getUser()`** (`src/lib/auth-user.ts`).
> `supabase.auth.getUser()` fait un **aller-retour réseau** vers GoTrue ; il
> était appelé en tête de presque chaque lecture (45 sites), doublant la latence
> perçue et faisant de GoTrue un SPOF pour la lecture de données.

Les `getAll()` à fort volume (**tasks, events, habits, okrs**) utilisent l'auto-pagination `fetchAllPages()` (`src/lib/fetch-all-pages.ts`) : pagination via `.range(from, to)` par pages de `PAGE_SIZE` (1000) jusqu'à épuisement, plafonné à `MAX_ROWS` (5000). Pour ≤ 1000 items → **une seule requête**. Ordre stable garanti par un tiebreak `.order('id')`.

- Les `getAll()` à faible volume (categories, lists, friends) gardent `.limit(200)`.
- ❌ Ne pas réintroduire un `.limit(500)` sec sur tasks/events/habits/okrs.
- ✅ Tout nouveau `getAll()` volumineux doit passer par `fetchAllPages()`.

## Ne jamais faire — Performance

- ❌ Importer `gsap` hors de la landing page, ou en direct depuis `'gsap'` — passer par `@/lib/gsap` (chunk `vendor-gsap`, cf. CLAUDE.md). Partout ailleurs : Framer Motion ou CSS keyframes.
- ❌ Importer un composant Recharts sans `React.lazy` — fait retomber `vendor-charts` (374 kB) dans le critical path.
- ❌ Ajouter une dépendance > 50 kB minified sans règle `manualChunks`.
- ❌ Importer `* as locales` de `date-fns/locale` ou `* as Icons` de `lucide-react` — casse le tree-shaking.
- ❌ Monter un composant gros au niveau App qui ne s'affiche qu'après un geste — il doit être `lazy` + Suspense.
- ❌ Créer une clé React Query distincte pour un **filtre** d'une liste déjà chargée. Une clé de plus est une requête de plus, et sur Supabase le repository enchaîne souvent une seconde lecture pour hydrater ce qu'il vient de lire : deux requêtes pour un `filter()`. Dériver avec `useMemo` depuis le hook de base. Cas réels : `useActiveOkrs` (2 requêtes par ouverture, pour tester `length > 0`) et `useSharesByTask` (un sous-ensemble strict d'une lecture déjà faite).
- ❌ Lire une table, **puis** une seconde avec un `in(...)` bâti sur le premier résultat. Ce sont deux allers-retours séquentiels, le second ne pouvant pas partir avant le retour du premier. Quand une clé étrangère existe, la jointure PostgREST (`select=col, autre_table(*)`) fait les deux en une requête, sans changer la RLS : la ligne jointe reste filtrée par sa propre policy.
- ❌ Écrire un prédicat de policy RLS qui appelle une fonction **sur une colonne** (`fn(user_id)`). Il est rappelé pour chaque ligne examinée et rend l'index inutilisable. Un helper sans argument, dont le périmètre vient de `auth.uid()` seul, est hissé en InitPlan et évalué une fois par requête. Trois occurrences déjà : `tasks` (085), `team_tasks` (113, 117), `events` (128).
- ❌ **Valider un correctif de performance CLIENT sur un compteur agrégé de Postgres** (`pg_stat_user_tables`, `pg_stat_statements`). Ils cumulent depuis la création de la base et mélangent les anciens et les nouveaux clients : ils donneront tort au correctif pendant des jours. Ventiler les `edge_logs` par `request.sb.jwt.authorization.payload.session_id`, une seule session du bundle courant suffit à trancher.
- ❌ Conclure quoi que ce soit d'un total cumulé. Seul un **delta entre deux instants**, mesuré au repos, donne un débit. `organization_members` affichait 2 440 047 balayages pour 11 lignes et n'en prenait **aucun** sur une fenêtre de 285 s au repos.

## Optimisations 2026-07-16 (issues de l'audit technique 2026-07-15)

| Optimisation | État |
|---|---|
| **Agrégats stats en SQL** | Module `src/modules/stats/` : `useWorkTimeStats(ranges)` → RPC `get_work_time_stats` (mig. 074, SECURITY INVOKER, cap 32 plages) en prod ; `LocalStatsRepository` (même calcul que `calculateWorkTimeForPeriod`) en démo. StatisticsPage : graphique « Temps investi » + synthèse 4 périodes = **un seul appel RPC (~1 kB)** au lieu d'un reduce client sur toutes les entités. Les sections détaillées (TasksStatistics, heatmap, insights) consomment encore les entités — migration en suivant. |
| **staleTime différencié** | categories : 15 → 30 min ; lists : 10 → 30 min (les mutations invalident le cache, le refetch périodique était du gaspillage). |
| **Prefetch au hover** | Déjà en place (`src/lib/route-prefetch.ts` + sidebar `NavItemLink`). Ajout de la route `/entreprise` (chunk OrganizationPage/PyramidTab). |
| **Brotli + fonts** | Vérifié en prod le 2026-07-16 : `Content-Encoding: br` servi par Vercel sur `/assets/*` (fallback gzip), cache immuable 1 an. `display=swap` déjà présent sur la feuille Google Fonts (`index.html`). Rien à changer. |

- ⚠️ La sémantique de la RPC `get_work_time_stats` doit rester **identique** à `calculateWorkTimeForPeriod` (dates locales inclusives via `p_tz`) — les deux modes démo/prod doivent afficher les mêmes chiffres à données égales.
