<!-- note-audit: tableau-de-bord -->
<!--
  🔴 C-109 · CE MARQUEUR EST LU PAR `npm run check:docs-scored`.
  Douze documents de fond n'étaient notés par RIEN : ils ne pouvaient ni monter
  ni baisser, donc **rien ne signalait qu'ils avaient vieilli**.
  Chaque document de `docs/` déclare donc soit sa note, soit la note qui le
  couvre, soit qu'il n'est pas noté ET pourquoi.
  ❌ Ne JAMAIS inventer une note sans avoir audité le domaine : `non-note` est
     une réponse honnête, un chiffre faux ne l'est pas.
-->
> **Note d'audit** — Ce document EST le tableau de bord des notes. Il ne s'en attribue pas une.

# Documentation COSMO — carte

## 🗺️ Trois niveaux, depuis le 2026-09-16

La documentation de travail est organisee en **trois niveaux**, et le niveau decide de ce que ca
coute en contexte a chaque session :

| Niveau | Repond a | Quand c est charge |
|---|---|---|
| `CLAUDE.md` racine | « qu est-ce que je ne dois pas casser partout ? » et « ou est ecrit le reste ? » | **a chaque session** |
| `<dossier>/CLAUDE.md` | « qu est-ce que je dois savoir avant de toucher CE code ? » | seulement quand un fichier de ce sous-arbre est lu ou edite |
| `docs/*.md` | « pourquoi cette regle existe, et qu est-ce qui a ete mesure ? » | sur demande |

**Pourquoi.** `CLAUDE.md` est le seul fichier qui se paie a chaque message. Le 2026-09-16 il pesait
2 070 lignes et ~43 000 tokens, contre 17,8 ko dix semaines plus tot, avec 78 commits en trente
jours. Il avait cesse d etre un guide pour devenir un journal : 146 dates, 114 lignes-marqueurs,
une section `## Scripts` de 281 lignes pour 20 commandes. Et sur dix sujets sondes, huit etaient
ecrits deux fois, dans `CLAUDE.md` **et** dans le doc qui declare faire foi.

Il a ete ramene a 373 lignes **sans une coupe** : des 1 672 lignes significatives de l ancien
fichier, une seule reste introuvable dans les `.md` du depot, et c est un artefact de coupure de
ligne. Les 16 `CLAUDE.md` de dossier et les docs de domaine portent tout le reste.

❌ **Ne jamais reecrire un recit d incident dans `CLAUDE.md`.** Un incident s ecrit **une fois**,
dans le doc de son domaine ; le `CLAUDE.md` concerne n en garde que l interdit, en une ligne.
C est l absence de cette regle qui a produit la courbe ci-dessus, et des affirmations fausses
restees en place pendant des jours parce que le fichier etait trop gros pour etre relu.

✅ Cliquet : `npm run check:docs` (gate CI) plafonne le racine et chaque `CLAUDE.md` de dossier,
**et** verifie que chaque fichier de dossier est cite par le racine. Une regle qui descend dans un
fichier que personne ne cite est perdue sans qu un octet ne manque : c est le seul risque du
decoupage, et c est ce que la garde mesure. Temoin : `scripts/check-docs-budget.guard.test.mjs`,
vu rouge sur cinq sabotages.

---


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

## Mise à jour du 2026-09-22 · **deux items fermés, et deux défauts de NIVEAU A trouvés en chemin**

**Aucune note ne bouge**, et pour la même raison que la veille : aucun domaine n'a été réaudité.
Cette passe a écrit du code sur les trois items que le décompte du 09-21 donnait comme traitables
par du code.

### Ce que la remesure a trouvé AVANT de coder

🔴 **Deux énoncés d'items étaient faux**, et c'est le renseignement le plus utile de la journée.

| Item | Ce qu'il disait | Ce que la mesure rend |
|---|---|---|
| `C-07` | « 17 feuilles n'utilisent toujours pas `useSheetMotion()` » | **Faux depuis le 2026-09-04** : le cliquet est à zéro et **23** fichiers consomment le helper (l'énoncé en comptait 8). Le vrai défaut était son AUTRE moitié, `useSheetDrag`, qui n'avait **jamais eu de garde** — trois poignées muettes reconstituées |
| `C-111` | « 2 cas `chromium` » pour `a11y-keyboard-audit` | **4**, soit **7 échecs `chromium` en local et non 5**. Les deux cas supplémentaires n'étaient nommés nulle part |

⚠️ Remesurer avant de coder a donc évité de refaire un travail fait, et a trouvé celui qui restait.

### Les deux défauts de niveau A

| Défaut | Ce qu'il coûtait |
|---|---|
| **Les actions d'une tâche étaient inatteignables au clavier sur mobile** (WCAG 2.1.1) | La maquette 86 a retiré le « ⋯ » en laissant trois chemins — appui long, glissement, menu desktop — qui sont **tous des gestes de pointeur**. Le bouton « Actions pour … » existe, porte le bon nom, et fait **0 × 0 px** : il vit dans `div.hidden md:block`. Modifier, supprimer ou partager une tâche était impossible au clavier |
| **La vitrine du hero ne pouvait pas être arrêtée** (WCAG 2.2.2) | Rotation toutes les 2,5 s, sans pause, sans arrêt au survol ni au focus, et sans égard pour `prefers-reduced-motion` |

🔴 **Et le premier était masqué par le test qui aurait dû le trouver.** `a11y-keyboard-audit`
cherchait ce bouton invisible depuis des semaines : son **timeout passait pour de la lenteur de
harnais**. ❌ Ne jamais classer un timeout en « lenteur » sans avoir ouvert l'écran.

⚠️ **Correction d'une erreur de cette passe** : elle a écrit « WCAG 2.2.2 **(AA)** » à cinq
endroits. Le critère est de **niveau A** — l'énoncé d'origine de `C-69` le disait juste. Corrigé
partout le soir même. Le défaut était donc **plus grave** que ce que sa fermeture annonçait.

### Ce qui est acquis, et ce qui ne l'est pas

| | |
|---|---|
| ✅ `C-69` | Fermé. Trois états, suspension au survol et au focus, bouton de 44 × 44 px réels. **Vérifié dans le navigateur** : sur la machine d'Axel, `prefers-reduced-motion` vaut `true` et le bouton rend « Lancer » — la rotation ne démarre plus seule. Témoin : 13 cas, 4 sabotages |
| ✅ `C-07` | Fermé. Cliquet neuf sur les poignées, 4 témoins, **vu rouge sur 3 sabotages** |
| 🟠 `C-111` | **Deux familles sur quatre.** `touch-targets` verte (19/19 sur `chromium`), 2 cas clavier sur 4 |
| 🔴 Ce qui reste | 2 cas clavier **non diagnostiqués**, 7 parcours WebKit, 3 `reduced-motion-sheets`, et **rien n'a été rejoué sur WebKit** |

❌ **Ne pas lire `C-111` comme refermé** : son critère reste le job `e2e` **vert sur `main`**.
Le décompte passe à **103 clos / 6 ouverts**, et **un seul** relève encore du code.

### L'arbitrage qui revient à Axel

🔴 **`/habits` ne peut pas atteindre 44 px de large**, et c'est de l'arithmétique : la grille
mesure **301,6 px** et sept cellules en exigeraient **344** (308 même à gap nul). La hauteur passe
à 44, la largeur reste à ~38, et l'écart est **déclaré** avec son critère — il échoue 2.5.5 (AAA),
il tient 2.5.8 (AA). Élargir la carte ferait tomber la dispense, et c'est sa décision.
⚠️ **La maquette 86 n'a pas été enfreinte** : le chemin clavier ne reprend aucun pixel à la
colonne du pouce. Remettre un « ⋯ » visible pour la découvrabilité reste une décision à part.

---

## Mise à jour du 2026-09-21 · passe de documentation · **aucune note ne bouge, et c'est le résultat**

Consigne d'Axel : « remets à jour tous les fichiers `.md`, il ne doit y avoir aucun fichier de
contexte périmé ». **90 fichiers** relus : les backlogs de la racine, les 18 `CLAUDE.md`, les
documents vivants de `docs/`, et les bandeaux d'archive.

❌ **Aucune note n'est touchée, délibérément.** Cette passe n'a **mesuré aucun domaine** : elle a
confronté ce qui est *écrit* à ce qui est *vrai*. Bouger une note sur cette base serait créditer
une mesure qu'on n'a pas prise, et `M-56` n'est toujours pas tranché.

### Ce que la relecture a trouvé de FAUX, et qui ne venait d'aucune garde

| Où | Ce qui était écrit | Ce que la relecture rend |
|---|---|---|
| `CLAUDE.md` (racine) · `a-faire-manuel.md` `M-45` | mig. `136` appliquée, **ledger `20260920105113`** | 🔴 **Ce numéro n'existe au ledger d'AUCUNE migration.** Relu en base : c'est `20260920104729`. Un chiffre recopié, dans le fichier le plus lu du dépôt |
| `a-faire-code.md` § 4, § 1, § 2… | **13 items** dont le titre ne portait aucun statut alors que leur corps disait ✅ | Le sommaire du fichier les donnait pour ouverts. Corrigés : `C-09`, `C-10`, `C-13`, `C-15`, `C-16`, `C-30`, `C-31`, `C-40`, `C-48`, `C-56`, `C-57`, `C-62`, `C-68` |
| `a-faire-code.md` `C-20` et `C-71` | ouverts | ✅ **Tous deux clos**, relus dans le code : `INDEXABLE_LOCALES = ['fr', 'en']` depuis le 09-08, et les deux Edge Functions Stripe distinguent `resource_missing` avec leur témoin (`src/stripe-org-404-guard.test.ts`) |
| `a-faire-manuel.md` `M-44` | « défaire un fichier **non commité** d'une autre session » | 🔴 **INVERSÉ.** L'arbitrage du 09-15 a été rendu CONTRE le retrait de la pastille « Aujourd'hui », et le retrait est entré dans `main` le **09-16** (`ab72cd39`). Il n'y a plus rien à défaire : il y a du code à réécrire |
| `docs/README.md`, fin de fichier | — | 🔴 **Le préambule était COUPÉ en plein milieu de phrase** depuis son déplacement du 09-16. Restitué depuis `7785e12d^` |
| `CLAUDE.md` § Scripts | 20 commandes | **24 gardes posées le 09-21 n'y figuraient pas**, et la racine était à 96,7 % de son plafond. L'inventaire complet (36 commandes) descend dans `scripts/CLAUDE.md` ; la racine passe à 92,4 % |
| `docs/DEMO-DATA-EXPORT.md` | dans `docs/`, donc **vivant** | Il se déclarait lui-même « à lire comme une archive ». Parti en `docs/archive/` |
| 5 plans / specs de `docs/superpowers/` | vivants, **0 case cochée** | Exécutés et en production. Archivés. ⚠️ **Les cases n'ont jamais été cochées : le code fait foi contre elles** |

### Les trois refus de la matinée, et ce qu'ils ont donné une fois levés

Ils l'ont été l'après-midi même, sur demande d'Axel. **Les trois étaient défendables et les trois
ont produit quelque chose**, ce qui mérite d'être écrit : un refus prudent n'est pas gratuit.

| Refusé le matin | Fait l'après-midi | Ce que ça a rendu |
|---|---|---|
| **Recoter `a-faire-code-risques.md`** — il aurait fallu le chiffrage de `M-56` | ✅ **Recoté sur les 111 items** | 🔴 **44 items étaient CLOS dans leur corps sans que leur titre le dise.** Le décompte passe de « 58 ouverts sur 66 » à **8 ouverts sur 111**. Coter d'abord aurait produit un classement soigneux de **cinquante problèmes résolus** |
| **Réécrire les 23 tableaux « Angles morts »** — leur date leur donne leur valeur | ✅ **95 lignes réécrites**, mais **seulement la 4ᵉ colonne** | Elle posait « Outillable ? », une **prédiction** du 09-16 ; elle porte maintenant l'état réel, la garde, et 🔴 ce qu'elle ne prouve pas. **L'énoncé, lui, n'est pas touché** : c'est ce qui explique pourquoi la garde existe. 73 lignes outillées, **22 toujours ouvertes**, dont **8 que rien ne porte** |
| **Archiver le plan de pattern mobile** — `archive/` est pour les plans exécutés | ✅ **Archivé comme ABANDONNÉ**, avec sa raison | `docs/archive/` porte désormais les deux natures. 🔴 **Un plan abandonné se range, il ne se supprime pas** : ce qu'on a décidé de ne pas faire est une information, et sans elle le même plan se réécrit dans six mois |

🔴 **Le renseignement de la journée n'est aucun de ces trois-là.** Une fois les statuts vrais,
**cinq des huit items ouverts ne se ferment pas en écrivant du code** : trois attendent un geste
d'Axel (`M-08`, `M-40`/`M-52`, les réglages de console), un attend une décision. Le travail de
développement disponible immédiatement, c'est **`C-111`** (le job `e2e` rouge, 8 défauts produit
de cibles tactiles mesurés), **`C-69`** et **`C-07`**.

> ✅ **Les trois ont été traités le lendemain** — cf. § Mise à jour du 2026-09-22 ci-dessous.

⚠️ **`M-56` n'est rendu qu'à moitié, et c'est dit sur la ligne.** Classer des **items** est fait ;
**tarifer un angle mort en points de note d'audit** ne l'est pas, et les 22 lignes encore ouvertes
ne pèsent sur aucune note. Ce sont deux gestes différents.

### La migration `150` est appliquée (`M-57`)

Ledger `20260921075529`. Prouvée avant en transaction annulée — insertion, catégorie hors
énumération refusée (`23514`), non-admin refusé (`42501`), droits effectifs — puis l'annulation
elle-même vérifiée, puis relue **au catalogue** et jamais au ledger. Plus aucune migration du dépôt
ne dort.

🔴 **Et le compteur rend ZÉRO, ce qui n'est pas une mesure du support** : `report-bug` n'est pas
redéployée (`M-61`), donc rien n'appelle `record_support_report`. `/admin` passe de « non
installé » à **0**, et `0` se lit « aucun rapport » alors que la vérité est « rien ne compte
encore ». Des trois états que `C-110` distingue, c'est le plus trompeur.

⚠️ **Ce que cette passe ne prouve pas** : elle a relu des affirmations, pas le produit. Un document
peut être exact et décrire un écran cassé. Et `C-111` — le job `e2e` **rouge sur `main`** — n'a
pas bougé : aucune relecture ne rend un test vert.

---

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

## Mise à jour du 2026-09-08 · un seul domaine mesuré, un seul déplacé

Cette passe ne note **qu'un domaine** : elle vient d'une mesure prise ce jour-là, sur le runner,
et rien d'autre n'a été remesuré. Les autres notes restent celles du 2026-09-03 — les recopier ici
en les présentant comme d'aujourd'hui serait la troisième occurrence de l'erreur nommée au
§ « Documentation » de `CLAUDE.md`.

| Audit | dernière note | **09-08** | Δ | Ce qui a bougé |
|---|---|---|---|---|
| [Scalabilité](./SCALABILITY.md) | 89 (09-03) | **91** | +2 | **C-16 fermée** : la mesure cesse d'être mono-session. 1 → 16 sessions parallèles sur acteurs distincts, plateau à **~1 250 req/s** sur 4 vCPU atteint dès **8 sessions**, mise en file au-delà (latence médiane ×6, p99 ×17, débit identique). Le rapport entre les deux chemins passe de 354× à **×532** sous charge. Le harnais repart avec un **témoin qui le fait échouer** s'il ne sature pas. **C-15 est tranchée** plutôt que laissée ouverte : le coût est le **CPU par requête**, pas le volume par compte ni le nombre de sessions — avec deux seuils de réouverture écrits |

⚠️ Les mesures restent celles d'un runner de CI, pas de la production : le nombre de vCPU du plan
Free n'est pas connu, donc son plateau à elle n'est pas celui de ce tableau.

---

## Mise à jour du 2026-09-15 (suite) · vérification de la passe de correction, et deux notes révisées

Passe de **vérification** de la section précédente : chaque item du prompt de correction a été
confronté à la production et au dépôt, pas relu. Deux notes bougent, un arbitrage est révisé, et
**un angle mort neuf apparaît, dans la mesure elle-même**.

### Ce qui a été vérifié, item par item

| Item | État annoncé | **État mesuré le 2026-09-15** |
|---|---|---|
| **C-80** cibles tactiles | corrigé | ✅ **confirmé** : la boucle du spec porte bien **16 routes** (8 protégées + 8 publiques), `.ent-range` fait 44 px de cible pour 6 px de piste et 24 px de poignée, le CTA du header a `min-h-touch`. Run CI `34945082906`, job `e2e` vert |
| **C-79** recouvrement du ledger | corrigé | ✅ **confirmé** : `check:migration-coverage` existe, son job `couverture` est vert (run `34941970659`), et il embarque 16 cas de témoin |
| **C-78** WebKit en CI | en cours | 🔴 **écrit, PAS dans le dépôt.** `git show HEAD:.github/workflows/ci.yml` lance toujours `--project=chromium --project=supabase-stub`, et `e2e/_warmup-mobile.spec.ts` est **inconnu de git sur toute branche** |
| **C-77** `okrTime` à 0 | ouvert | 🔴 **toujours ouvert en production** *(au 2026-09-15)*. `pg_get_functiondef('get_work_time_stats')` lit **encore** `kr.elem->'history'` et jamais `kr_completions`. Ledger à **138** entrées, dernière la `148` : la mig. `136` n'est pas appliquée. → ✅ **REFERMÉ le 2026-09-20**, mig. `136` appliquée (ledger `20260920105113`) et vérifiée par `pg_get_functiondef` ; détail et preuve avant/après dans [`../a-faire-code.md`](../a-faire-code.md) `C-77` |
| **P5** mig. `149` (`/admin`) | écrite | 🟠 **écrite, non appliquée** : `admin_stats_excluded_uids()` n'existe pas en base |
| **P4** M-44 | à arbitrer | ⬜ le retrait de la pastille « Aujourd'hui » est **toujours dans l'arbre**, non défait. C'était prévu : le prompt demandait de ne pas toucher au fichier d'une autre session sans demander |

### Les deux notes qui bougent

| Domaine | 09-15 | **09-15 (suite)** | Δ | Motif |
|---|---|---|---|---|
| [Architecture](./ARCHITECTURE.md) | 88 | **90** | **+2** | **Arbitrage révisé**, cf. ci-dessous |
| [Tests / CI](./TESTING.md) | 94 | **95** | **+1** | La suite E2E gagne 8 routes réellement mesurées (220 → 236 cas à `HEAD`), et un sixième job CI apparaît avec ses 16 témoins. **+1 et non +3** : les 105 cas WebKit ne sont toujours joués par aucun workflow |

### 🔴 L'arbitrage révisé, et pourquoi

La section précédente laisse Architecture à **88** avec ce motif : « C-79 ne change aucune mesure du
produit, c'est une garde de vérité documentaire ». **C'est vrai et ce n'est pas le bon critère.**

L'entrée du 2026-09-14 (soir) de [`ARCHITECTURE.md`](./ARCHITECTURE.md) nomme **trois** choses qui
retiennent la note à 88, et la première, mot pour mot, est : « **aucune garde ne relie les
migrations du dépôt à la base** ». Cette phrase est devenue fausse aujourd'hui.

**Un motif de plafonnement qu'on lève sans rien créditer n'était pas un motif de plafonnement.**
C'est exactement le raisonnement qui a fait monter cette même note de +4 la veille : le motif écrit
le 09-03 (« aucun god component n'a disparu ») était mort depuis neuf jours, et ne rien créditer
aurait rendu la note insincère dans l'autre sens.

S'y ajoute un fait, pas un principe : **la garde a rendu un verdict que personne ne lui avait
demandé.** Elle liste 9 fichiers partiels, dont la `136` à laquelle manque
`idx_kr_completions_user_completed_at`. Un instrument qui trouve ce qu'on ne cherchait pas n'est
plus de la documentation.

⚠️ **Restent les deux autres motifs du 09-14, tous deux intacts** : le même calcul vit en trois
endroits et un seul des trois sert la production (C-77), et un fichier source de 613 lignes vit
hors de tout périmètre. D'où **90 et pas davantage**.

### 🔴 Un diagnostic FAUX publié ici même, puis corrigé : la lecture avait failli, pas l'outil

⚠️ **Ce paragraphe a d'abord annoncé un « angle mort neuf : `npm test` sort en exit 0 après avoir
sauté des fichiers ». C'était faux.** Il est conservé sous cette forme corrigée parce qu'une
erreur retirée sans trace est une erreur qu'on refera.

**Les faits, dans l'ordre.** La suite lancée depuis ce poste annonce « 225 passed (225) » quand la
CI en joue 229. Quatre fichiers n'ont jamais démarré, dont
`src/hooks/use-modal-a11y.guard.test.tsx`, qui porte les **trois témoins** de C-53 :

```
Error: [vitest-pool]: Failed to start forks worker for test files ...
Caused by: [vitest-pool-runner]: Timeout waiting for worker to respond
```

✅ **Mais vitest a sorti EXIT 1.** Le code de sortie était imprimé par la commande elle-même et
n'a pas été relu : seule la ligne de résumé l'a été. L'outil signale, correctement.

🔴 **Et la cause était un conseil de `CLAUDE.md`.** La commande portait `--maxWorkers=4`,
suivant une ligne de ce fichier. Or `vitest.config.ts` fixe **`maxWorkers: 2`**, posé par le
finding **C-47** (2026-09-03) pour cette raison exacte : 4 cœurs, 8 Go, et la plupart des fichiers
montent jsdom. Le conseil était **antérieur à C-47** et n'avait jamais été retiré. Un drapeau de
ligne de commande écrase la config : **suivre la documentation désarmait la garde.**

**Les trois défauts réels, et ils sont tous corrigés :**

| # | Défaut | Correction |
|---|---|---|
| 1 | `CLAUDE.md` conseillait `--maxWorkers=4`, qui désarme C-47 | conseil **retiré**, interdiction écrite à sa place avec le récit du dégât |
| 2 | Le résumé de vitest ne dit pas combien de fichiers MANQUENT | règle écrite : lire `$?`, puis comparer au périmètre du glob (**229** à cette date) |
| 3 | Un diagnostic faux a été publié dans trois documents | corrigé aux trois endroits, sans effacer la trace |

❌ **Ne jamais passer `--maxWorkers` en ligne de commande sur ce dépôt.** Si la durée devient le
problème, remonter la borne **dans `vitest.config.ts`, en remesurant la stabilité**.

🔴 **La leçon la plus coûteuse des trois est la troisième.** Un faux positif de diagnostic
ressemble à une découverte : il est circonstancié, il cite une sortie réelle, et il flatte la passe
qui le trouve. Le seul garde-fou est celui que ce dépôt applique déjà aux gardes, retourné contre
soi : **vérifier ce qu'on a sous les yeux avant de conclure, y compris quand la conclusion est
intéressante.**

### Ce qui n'a pas bougé, et pourquoi

**Performance 95** et **UI / UX 85** restent où elles sont : les deux avaient perdu des points pour
`C-77`, et `C-77` est toujours ouvert en production. **Sécurité 88, Scalabilité 91, RGPD 87,
SEO 80, i18n 90** n'ont pas été remesurées ce jour ; la CI verte sur les cinq jobs établit que
leurs gardes tiennent, pas que leur note a changé.

⚠️ **Le seul défaut que cette campagne devait fermer AVANT d'envoyer du trafic est celui qui reste
ouvert.** `C-77` est P0 du prompt de correction, et c'est le seul de la liste qu'un utilisateur
voit. La migration qui le répare est commitée depuis le 2026-09-03 ; il ne manque que son
application et la vérification de ce qu'elle rend.

---

## Mise à jour du 2026-09-15 · P1 et P3 du prompt de correction : deux angles morts refermés

Suite directe de la passe du 2026-09-14 au soir, dont le tableau est conservé plus bas à sa date.
Deux des dix angles morts sont traités, **avec leur mesure avant et après**.

| Domaine | 09-14 soir | **09-15** | Δ | Ce qui l'a décidé |
|---|---|---|---|---|
| [Accessibilité](./ACCESSIBILITY.md) | 82 | **84** | **+2** | **C-80 refermé.** `touch-targets` couvre 8 pages publiques en plus de ses 8 routes protégées : **18 cas sur 18 verts**, contre 15 / 3 au premier passage de la boucle élargie. Le curseur de forfait passe de **308 × 6** à **308 × 44 px**, mesuré dans WebKit / iPhone 12 |
| [Mobile / DA](./MOBILE.md) | 76 | **78** | **+2** | Même correctif, vu depuis le téléphone. **+2 et non +3** : l'entrée d'hier retirait 3 points pour DEUX défauts, et le second (aucune suite mobile jouée sur un moteur mobile, C-78) n'est pas refermé à cette date |
| [Architecture](./ARCHITECTURE.md) | 88 | **88** | 0 | **C-79 refermé**, mais il ne change aucune mesure du produit : c'est une garde de vérité documentaire. Elle est notée ici parce qu'elle referme un énoncé faux de `CLAUDE.md`, pas un défaut de code |

### C-80 · ce que l'élargissement a trouvé

🔴 **La garde a trouvé des défauts réels le jour où on l'a fait regarder ailleurs.** C'est la seule
mesure qui compte : trois routes rouges au premier passage, huit défauts distincts.

| Défaut | Avant | Après |
|---|---|---|
| curseur de forfait `/entreprise-presentation` | **308 × 6 px** | **308 × 44 px** (WebKit / iPhone 12) |
| CTA « Commencer » du header | 115 × 36 | ≥ 44 px |
| logo / « Retour en haut de la page » | 116 × 36 | ≥ 44 px |
| 4 × « En savoir plus » | 121 × 20 | 44 px tactiles |
| 3 onglets de vue + 2 boutons de périodicité | 28 et 36 px | 44 px tactiles |
| 3 commandes **décoratives** (maquettes) | 16 × 24 et 28 × 28 | retirées de l'arbre d'accessibilité |

⚠️ **Le détecteur voit un objet de plus** (`input[type=range]`), donc il repart avec deux témoins :
un curseur natif, exempté par 2.5.5 / 2.5.8 comme « contrôle du navigateur », et un curseur en
`appearance: none`, qui ne l'est plus.

🔴 **Le sort des liens de pied de page est TRANCHÉ**, par son nom, dans l'en-tête du spec : ils
échouent au AAA 2.5.5 et tiennent le AA 2.5.8 par son exception d'espacement. Dette de confort
assumée. ❌ Un lien de pied de page devenu BOUTON rentre dans la mesure.

### C-79 · le premier recouvrement dépôt ↔ ledger, et il est complet

`npm run check:migration-coverage`, joué contre la production le 2026-09-15 : **152 fichiers,
0 absent.**

| Verdict | Fichiers |
|---|---|
| AU LEDGER | **118** |
| OBJET EN BASE | **27** |
| OBJET RETIRÉ DEPUIS | **3** |
| SUPPRESSION VÉRIFIÉE | **1** |
| SANS OBJET VÉRIFIABLE (déclaré) | **2** |
| NON APPLIQUÉE (déclarée) | **1** |
| **ABSENT DES DEUX** | **0** |

🔴 **Deux de ces verdicts sont MESURÉS, pas déclarés**, et ils n'étaient pas dans l'énoncé de
l'item. Sans eux, la garde réclamait quatre migrations bel et bien appliquées : les mig. `013`,
`015` et `016` ont été **vidées par la `141`** (C-04, 2026-09-04), et la `090` ne fait que
supprimer, donc son effet se vérifie par l'absence de ses cibles. Une mesure vaut mieux qu'une
liste écrite à la main.

⚠️ **Deux fichiers seulement sont déclarés non vérifiables**, et c'est un aveu de limite :
`000_default_privileges` (des GRANT, invisibles du catalogue) et `038_backfill_okr_key_results`
(une migration de DONNÉES). La `140` est déclarée non appliquée, délibérément.

✅ **Les témoins ont été VUS ROUGES** avant d'être commités, sur quatre sabotages du script.

⚠️ **Ce que ce vert ne dit pas, et le script l'imprime à chaque exécution** : une ligne au ledger
ne prouve pas qu'un `CREATE OR REPLACE` a remplacé le corps vivant (mig. `144`, rejouée par la
`147`). Le rapport liste d'ailleurs **9 fichiers partiels**, dont la `136` : son index manque, ce
qui est exactement **C-77**, toujours ouvert à cette date.

---

## Mise à jour du 2026-09-16 · les 23 documents disent désormais ce qu'ils NE mesurent PAS

**Contexte.** Axel, après la découpe de `CLAUDE.md` du jour : « comment ça se fait que cette
ancienne architecture ne poussait pas à la baisse le score `ARCHITECTURE.md`, alors que
l'organisation des fichiers `.md` fait partie de l'architecture ? ». Puis : « pour chaque audit,
repère les angles morts et ajoute-les à ce qui est mesuré ».

**La question était juste, et la cause est structurelle.** `CLAUDE.md` est cité **13 fois** dans
`ARCHITECTURE.md`, dont **9** dans la seule colonne « Où il est écrit » du tableau des invariants,
et **jamais** dans ce qui est mesuré. L'audit se pose explicitement en aval de son référentiel (« Ce document ne redécrit pas
l'architecture, c'est le rôle de `CLAUDE.md` », ligne 10). **Il était le mètre, jamais l'objet**,
et on ne mesure pas son propre mètre.

Le document avait pourtant pris `CLAUDE.md` en faute **quatre fois**, et avait traité chacune comme
un incident de contenu isolé :

| Où | Ce qui avait été constaté |
|---|---|
| `ARCHITECTURE.md` § 2026-08-25 | « aucun `refetchInterval` permanent », il en restait **trois** |
| `ARCHITECTURE.md` §4 | `useMessages`, un hook décrit qui n'existait pas |
| Ce tableau de bord, 2026-09-14 | « Ce document avait raison **contre** `CLAUDE.md` sur le nombre de namespaces » |
| Ce tableau de bord, 2026-09-15 | `C-79` referme « un énoncé faux de `CLAUDE.md` » |

**La fréquence était la donnée, et personne ne l'avait agrégée.**

### 🔴 Le mécanisme, et il vaut pour les onze audits

Ces notes sont justifiées par des points **nommés** (« ce qui retient à 88, et chaque point est
mesuré », suivi d'une liste), pas par une grille pondérée. **Une note construite ainsi ne peut
baisser que sur un défaut que quelqu'un a d'abord nommé.** Un angle mort ne peut donc, par
construction, jamais la faire bouger : il doit cesser d'être un angle mort pour compter.

C'est la même loi que `ARCHITECTURE.md` porte déjà, écrite deux fois, appliquée à elle-même :
*« une règle qu'aucun script ne mesure recule à chaque vague de features »*. `CLAUDE.md` était la
seule chose du dépôt qu'aucun script ne mesurait. La loi s'appliquait à lui ; il n'était pas dans
la liste des choses auxquelles on applique la loi.

**Correctif** : les onze documents notés portent désormais, **juste sous leur note**, une section
« 🕳️ Angles morts · ce que cet audit NE mesure PAS ». Chaque ligne est **vérifiée**, jamais
supposée, et dit si elle est outillable. La prochaine passe les traite comme les invariants : soit
comblée, soit reconduite avec sa date.

### Les angles morts TRANSVERSAUX, ceux qu'aucun document seul ne pouvait voir

| # | Angle mort | Mesuré le 2026-09-16 | Touche |
|---|---|---|---|
| T-1 | 🔴 **Les 36 témoins ne sont jamais rejoués** (**39** au 2026-09-20, cf. la mise à jour du 09-20 plus bas). Le dépôt exige qu'une garde arrive avec un témoin « vu rouge sur des sabotages ». Ce sabotage est **manuel et unique**, joué le jour de la création. Rien ne vérifie qu'un témoin détecte **encore** : c'est « une garde se vérifie sur ce qu'elle REGARDE » appliqué aux témoins eux-mêmes | **36** fichiers `*.guard.test.*`. **Aucun** mutation testing dans `package.json` ni dans un workflow | Tests, Sécurité, et toute garde |
| T-2 | **14 gardes sur 36 reposent sur une liste ÉCRITE À LA MAIN.** Certaines sont des **dispenses assumées** et documentées (`modal-a11y.guard`), c'est légitime. D'autres devraient être **dérivées** du schéma ou du code, et décrivent l'état du jour où elles ont été tapées : `rgpd-erasure.guard` en est le cas net | relevé par `grep` sur les 36 témoins | RGPD, Architecture, UI |
| T-3 | **Tout ce qui n'est pas `src/` échappe à presque tout.** `scripts/**` (le code qui décide si la CI est verte), `supabase/functions/**` (le code qui déplace de l'argent) et `e2e/**` sont hors couverture ; `e2e/**` et `showcase/**` sont hors ESLint | `vitest.config.ts` : `include: ['src/**']` · `eslint.config.js:15` | Tests, Architecture, Sécurité |
| T-4 | **Lighthouse tourne en preset DESKTOP, sur 4 URLs.** C'est la seule mesure continue de perf, d'a11y et de SEO en conditions réelles, et elle ignore le mobile, qui est le terminal du trafic visé | `lighthouserc.json` : `"preset": "desktop"`, 4 URLs contre **40** dans le sitemap (⚠️ « 45 » écrit le 09-16, **recompté 40 le 2026-09-20** sur la production et sur le build du 09-17 ; cf. [`SEO.md`](./SEO.md) AM-1) | Performance, Mobile, SEO, Accessibilité |
| T-5 | **La CONFORMITÉ est mesurée, le RÉSULTAT presque jamais.** Le SEO note 80 avec **0 clic non marqué** depuis le 2026-08-19 ; l'UI note 85 sans savoir quel écran est ouvert. Un audit peut monter pendant que rien ne se passe | notes contre GSC et Vesk | SEO, UI / UX, Mobile |
| T-6 | **Deux gardes ne tournent JAMAIS toutes seules.** `scalability-volume.yml` et `restore-drill.yml` n'ont qu'un `workflow_dispatch` : la charge et l'épreuve de restauration ne sont jouées que si quelqu'un y pense | relevé sur les 10 workflows | Scalabilité, Sécurité |
| T-7 | **Les advisors Supabase ne sont lus qu'à la main.** Dans `ci.yml`, le mot « advisor » désigne `npm audit`, pas les advisors de la base | aucun workflow n'interroge l'API Management | Sécurité, RGPD |
| T-8 | ✅ **COMBLÉ le 2026-09-16**, `npm run check:deploy` · job `Deploy SHA drift`, horaire. Était : **rien ne comparait le commit déployé sur Vercel à `main`.** C'est le défaut C-35 des Edge Functions, **côté front**, et il n'avait jamais été nommé. `check:edge` compare le code déployé des fonctions au dépôt ; **aucun équivalent n'existe pour l'application**. `uptime.yml` fait un `curl` et lit un **code HTTP**, jamais ce qui est servi | Cycle complet observé : `egal`, puis `ancetre` après un push, puis `egal` une fois Vercel passé. Run CI **`35075874315`** vert. Témoin à 17 cas, **vu rouge sur six sabotages** | Déploiement, Architecture, Sécurité |
| T-9 | 🔴 **Les réglages du Dashboard Supabase ne sont surveillés par AUCUNE garde.** Protection des mots de passe compromis, expiration des OTP, politiques d'auth : ils vivent **hors du dépôt**, se modifient en deux clics, sans commit et sans trace. Plusieurs sont pourtant cochés ✅ dans [`POST-AUDIT-GUIDE.md`](./POST-AUDIT-GUIDE.md) : **un ✅ daté décrit un instant, pas un état** | aucun script ne les lit ; seul un commentaire contient le mot « dashboard » | Sécurité, Déploiement, RGPD |
| T-10 | 🔴 **Douze documents de fond ne sont notés par RIEN**, dont [`SECURITY.md`](./SECURITY.md) et [`LEGAL.md`](./LEGAL.md). Seuls onze documents portent une note et entrent dans ce tableau de bord. Les autres ne peuvent ni monter ni baisser : **rien ne signale qu'ils ont vieilli**. Or `faille.md` porte les **findings** de sécurité, pas les **règles** : un finding qui se ferme fait monter la note, une règle qui se périme ne coûte rien | 11 documents notés sur 23 traités | Tous |

### Ce que chaque audit déclare maintenant ne pas mesurer

| Audit | Avant | **09-16** | Δ | Son angle mort le plus lourd |
|---|---|---|---|---|
| [Architecture](./ARCHITECTURE.md) | 90 | **89** | −1 | Le référentiel lui-même n'était mesuré par rien. **Seul audit à encaisser deux `+1`** : `check:docs` et `check:deploy`, posés le jour même |
| [Tests / CI](./TESTING.md) | 95 | **91** | −4 | T-1, les **36 témoins jamais rejoués**, aucun mutation testing |
| [Performance](./PERFORMANCE.md) | 95 | **90** | −5 | T-4, aucune mesure de perf **mobile** en continu |
| [Scalabilité](./SCALABILITY.md) | 91 | **87** | −4 | T-6, la garde de charge n'est jamais jouée automatiquement |
| [Sécurité](../faille.md) | 88 | **83** | −5 | T-7, advisors Supabase lus à la main · et aucun SAST sur un dépôt **public** |
| [RGPD](./RGPD.md) | 87 | **82** | −5 | T-2, la garde d'effacement lit une liste en dur, jamais le schéma |
| [UI / UX](./UI-PATTERNS.md) | 85 | **81** | −4 | Aucune garde de régression **visuelle** en CI |
| [Accessibilité](./ACCESSIBILITY.md) | 84 | **80** | −4 | axe ne couvre qu'une partie de WCAG, 10 surfaces modales mesurées sur 53, aucun lecteur d'écran |
| [SEO](./SEO.md) | 80 | **75** | −5 | Rien ne relie le **sitemap** aux pages réellement prérendues |
| [Mobile / DA](./MOBILE.md) | 78 | **73** | −5 | Un seul téléphone, un seul moteur, **aucun Android** |
| [i18n](./I18N.md) | 90 | **86** | −4 | Les trois gates mesurent les clés et les copies, **jamais la qualité** |

**Bilan : −46 points sur onze audits, dont +2 rendus par les deux gardes posées le jour même.**

🔴 **Aucune de ces baisses ne vient d'une régression.** Rien n'a cassé depuis le 2026-09-14 :
ces angles morts existaient tous pendant que les notes montaient. Une note qui ne compte que ce que
les gardes regardent **surévalue par construction**, et onze notes étaient dans ce cas. C'est le
même constat que le 2026-09-14 (−8 net), poussé d'un cran : ce jour-là on avait mesuré **ailleurs
que là où les gardes pointent** ; ici on compte **ce qu'aucune garde ne regarde**.

**Barème, identique pour les onze et déclaré dans chaque document** : −2 pour un angle mort
structurel de portée large, −1 pour un angle mort réel mais limité, 0 pour un arbitrage assumé ou
déjà payé dans une passe antérieure, **+1** pour un angle mort comblé le jour même avec garde
**et** témoin. Le détail ligne par ligne est en tête de chaque audit, pour être contesté.

🔴 **Une note baisse UNE FOIS, quand l'angle mort est nommé ; elle remonte quand il est
outillé.** Sans cette règle, nommer un angle mort deviendrait punitif et cette passe serait la
dernière à en chercher. Un angle mort reconduit sans être comblé ne re-coûte rien : **il est déjà
payé.**

⚠️ **Les douze documents sans note ne sont PAS notés par cette passe** (T-10). Leur donner une note
demanderait d'auditer leur domaine, ce qui n'a pas été fait : en inventer une reviendrait à
créditer ou débiter une mesure qu'on n'a pas prise, exactement l'erreur que ce tableau corrige.

### Et les douze documents de fond que RIEN ne note

Ils n'entrent dans aucun tableau de bord (T-10). Leur premier angle mort est donc le même pour
tous : **rien ne les pèse, donc rien ne signale qu'ils ont vieilli.** Les suivants sont propres à
chacun, et vérifiés.

| Document | Son angle mort le plus lourd |
|---|---|
| [SECURITY.md](./SECURITY.md) | Les **règles** de sécurité ne sont notées nulle part · et **aucun SAST** sur un dépôt **public**, où CodeQL serait gratuit |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | T-8, rien ne compare le commit déployé à `main` · et le **rollback n'a jamais été éprouvé** |
| [LEGAL.md](./LEGAL.md) | `check:legal` vérifie l'**arithmétique** du tableau, jamais la **conformité** : une ligne ✅ à tort laisse la garde verte |
| [STRIPE-LIVE.md](./STRIPE-LIVE.md) | **Aucune garde ne compare la grille Stripe au code** : `org-tiers.parity.test.ts` confronte deux copies du dépôt l'une à l'autre |
| [RGPD-REGISTRE.md](./RGPD-REGISTRE.md) | Les durées de conservation déclarées ne sont confrontées à **aucune donnée réelle** |
| [RGPD-VIOLATION.md](./RGPD-VIOLATION.md) | La procédure n'a **jamais été éprouvée à blanc**, et le délai de 72 h court à partir d'une **détection** que rien ne mesure |
| [POST-AUDIT-GUIDE.md](./POST-AUDIT-GUIDE.md) | T-9, les points ✅ sont des réglages de dashboard qui se désactivent sans trace |
| [MIGRATION-REACT19.md](./MIGRATION-REACT19.md) | Une **étude périme** : écrite le 2026-09-03 contre les versions de ce jour-là, rien ne signale qu'une majeure a bougé |
| [ACQUISITION.md](./ACQUISITION.md) | Chiffres du 2026-08-14 jamais rejoués · et les comptes de **test** ne sont retranchés d'aucune statistique (mig. `149` non appliquée) |
| [ACQUISITION-BACKLINKS.md](./ACQUISITION-BACKLINKS.md) | Aucun suivi des backlinks **perdus**, alors que c'est le seul levier déclaré débloquant |
| [AUDIT-VOICEOVER-IOS.md](./AUDIT-VOICEOVER-IOS.md) | 🔴 **Il EST un angle mort** : « rien dans ce fichier n'est coché », et son absence ne fait baisser aucune note |
| [SUPPORT.md](./SUPPORT.md) | Aucune mesure du support : ni volume, ni délai de réponse · et **la réception** de l'adresse publiée n'est testée par rien |

⚠️ **Quatre documents sont volontairement laissés de côté** : `COSMO-CLI.md` et
`AGENT-AJOUTER-TACHE.md` (modes d'emploi d'un outil), `DEMO-DATA-EXPORT.md` (un export généré pour
revue — ⚠️ **parti en `docs/archive/` le 2026-09-21** : il se déclarait lui-même archive tout en
vivant dans `docs/`) et `ROADMAP-60J.md` (un plan). Les backlogs (`a-faire-*.md`, `prompts-*.md`) et les
`CLAUDE.md` non plus : les premiers sont des listes de tâches, les seconds sont des règles déjà
plafonnées par `check:docs`. **Y coller une section « angles morts » en ferait le rituel contre
lequel cette passe met en garde.**

⚠️ **Aucune note n'est modifiée par cette passe, et c'est délibéré.** Nommer un angle mort n'est
pas le mesurer : on ne sait pas encore ce que chacun coûte. Les noter reviendrait à refaire
l'erreur inverse, créditer ou débiter une mesure qu'on n'a pas prise. **L'arbitrage appartient à
Axel**, et le dépôt a déjà tranché dans les deux sens : `C-79` a valu **0** point, `C-09` en a valu
**4**.

🔴 **Le piège à éviter maintenant** : ces sections peuvent devenir un rituel, listé puis recopié,
exactement comme les « avant » recopiés au lieu d'être relus (trois occurrences déjà). Un angle
mort se **referme** ou se **reconduit avec sa date**, jamais ne se recopie.

### ✅ Mise à jour du 2026-09-20 · les 77 angles morts ont désormais un propriétaire

Ils n'en avaient aucun : chacun vivait dans le document qui l'avait nommé, donc à l'endroit le
moins susceptible d'être relu au moment de décider quoi faire. C'est le même mécanisme que celui
décrit plus haut pour `CLAUDE.md`, appliqué à cette passe elle-même.

Ils sont **dédoublonnés et classés**, selon une règle unique : un item part dans
[`../a-faire-code.md`](../a-faire-code.md) si une modification du dépôt le ferme sans geste hors de
l'éditeur, dans [`../a-faire-manuel.md`](../a-faire-manuel.md) sinon.

| Destination | Items | Où |
|---|---|---|
| `a-faire-code.md` | **30**, `C-81` → `C-110`, tous ouverts | § 12 |
| `a-faire-manuel.md` | **12**, `M-45` → `M-56` | § 9 |
| Déjà portés, aucune ligne créée | 3 (`M-15`/`M-16`/`M-17`, `M-25`, `M-40`) | `a-faire-manuel.md` § 9.5 |

🔴 **Trois énoncés du 09-16 étaient FAUX, et le remesurage les a pris** :

| Énoncé | Mesuré le 2026-09-20 |
|---|---|
| `MOBILE.md` AM-1 et `TESTING.md` AM-4 : les cas `mobile-safari` « écrits, non commités » | ✅ **Dans `ci.yml` à `HEAD` depuis `af0190bd`, le 2026-09-16, le jour même.** `C-78` est **clos** |
| `TESTING.md` AM-1 : « 36 témoins » | **39**, `git ls-files` |
| `ACQUISITION.md` AM-3 : mig. `149` « écrite et non appliquée » | **Pas même commitée** : fichier non suivi, et `admin_stats_excluded_uids()` absente de la base |

⚠️ **Le classement ne note rien et ne hiérarchise rien**, délibérément : les 30 items de code n'ont
ni priorité ni taille, parce qu'aucun n'a été chiffré. L'arbitrage sur ce que chacun vaut en points
appartient à Axel, et il porte un numéro pour cesser d'être implicite : **`M-56`**.

🔴 **Ce que cette passe a trouvé en classant, et qui ne venait d'aucun audit** : le geste qui ferme
`C-77`, le défaut P0 du dépôt, **n'était écrit nulle part**. Le mot « 136 » n'apparaissait pas une
seule fois dans `a-faire-manuel.md`. Il y entre sous **`M-45`**. Relu en base le 2026-09-20, le
défaut est inchangé : ledger à **138** entrées, dernière `20260913223918`, et
`get_work_time_stats` lit encore `history`.

---

## Mise à jour du 2026-09-14 (soir) · passe COMPLÈTE : onze domaines, aucun `·`, dix angles morts

**Contexte** : Axel s'apprête à lancer le produit. Consigne, mot pour mot : « refais tous les
audits de 0, vérifie chaque chose qui est marquée, cherche des angles morts ». Cette passe ne relit
donc pas le changelog : elle **rejoue les mesures** et **interroge la production**, y compris sur
les domaines que la passe du matin avait laissés à `·`.

### Ce qui a réellement tourné ce soir

| Mesure | Résultat |
|---|---|
| `npm run build` | exit 0, `VITE_SENTRY_DSN` posée (`vendor-sentry` 49,3 ko, donc au-dessus du plancher de la garde) |
| `npm run check:bundle` | **306,6 / 323,0 ko** critique · **66,9 / 71,0 ko** entrée |
| `npm test` | **228 fichiers, 2 586 passés, 1 sauté**, exit 0, 305,65 s |
| `npm run test:coverage` | verte, exit 0 : **31,15 L · 30,73 S · 24,48 F · 26,35 B** |
| `npm run typecheck` · `npm run lint` | 0 erreur · 0 erreur, **31** warnings |
| `check:rls` · `validate:migrations` · `check:legal` | 132/106, 0 violation · 152 fichiers, 0 erreur, 6 avertissements · tableau cohérent, 46 lignes |
| `i18n:check` · `i18n:scan` · `i18n:identical` | **23 namespaces**, 0 erreur · **0** chaîne en dur · 3 898 couples, 92 identiques, **0** non déclarée |
| E2E a11y + cibles tactiles (Chromium) | **37 cas, 37 passés**, 8,9 min, exit 0 |
| Advisors Supabase (sécurité) | **9 / 52 / 2 / 1**, à l'unité ce qui était annoncé |
| Couverture RLS en base | **50 tables dans `public`, 50 avec RLS activée** · 126 policies, 117 fonctions |
| Ledger de migrations | **138 entrées** pour **152 fichiers** au dépôt : 32 sans correspondance |
| `npm run check:mail` | vert, 1 avertissement (DMARC `p=none`) |
| Production HTTP | `/`, `/entreprise-presentation`, `/en`, `/blog`, `/sitemap.xml` : **200** |
| Plans d'exécution en prod (rôle `authenticated` simulé) | `tasks` en direct **45,3 ms** (Seq Scan) contre `get_my_tasks()` **9,96 ms** |
| WebKit / iPhone 12 contre la production | `load` à **2 159 ms**, 0 requête en vol |

### Les notes

| Domaine | 09-14 matin | **09-14 soir** | Δ | Ce qui l'a décidé |
|---|---|---|---|---|
| [Architecture](./ARCHITECTURE.md) | 84 | **88** | **+4** | Le motif explicite du plafond (« aucun god component n'a disparu ») est **mort le 2026-09-05** avec C-09, et aucune note ne l'avait vu en neuf jours. Plus gros fichier gardé : 1 046 → **598** lignes ; stock hors budget 9 190 → **0** |
| [Tests / CI](./TESTING.md) | 97 | **94** | **−3** | **96 cas E2E sur 220, soit 44 %, tout le project `mobile-safari` / WebKit, ne sont joués par aucun workflow.** Le commentaire de `ci.yml` qui les exclut se trouve trois lignes sous la règle inverse, posée pour `supabase-stub` |
| [Performance](./PERFORMANCE.md) | 97 | **95** | **−2** | La mig. `127`, créditée ici d'un gain de 854 → 12 ms, rend **0** sur une de ses quatre colonnes en production. Un gain de temps a été crédité sans qu'on compare jamais ce que la fonction REND |
| [UI / UX](./UI-PATTERNS.md) | · | **85** | **−2** vs 87 (09-03) | Même cause, vue depuis l'écran : la série « OKR » du graphique « temps investi » de `/statistics` est **plate à zéro** pour tous les comptes réels. Et **M-44 est tranché** : l'argument du retrait de la pastille « Aujourd'hui » est faux, pas discutable |
| [Sécurité](../faille.md) | 88 | **88** | 0, VÉRIFIÉE | Toutes les gardes rejouées, advisors identiques, et une preuve d'isolation inédite : en prod, un compte réel voit **289 lignes sur 750**, les 461 autres rejetées par la policy |
| [Scalabilité](./SCALABILITY.md) | · | **91** | 0, VÉRIFIÉE | Le « non remesurable ici » du matin était trop large : la **charge** exige Docker, l'**invariant** non. Plans rejoués en production, le Seq Scan de `tasks` est toujours là |
| [RGPD](./RGPD.md) | 87 | **87** | 0, VÉRIFIÉE | Sémantique d'effacement relue dans `pg_constraint` : **51** FK vers `auth.users`, **32 CASCADE / 19 SET NULL**, répartition conforme à l'intention |
| [Accessibilité](./ACCESSIBILITY.md) | 84 | **82** | **−2** | 37 cas verts dans un vrai navigateur, mais **WCAG 2.5.5 n'est vérifié que sur 8 routes PROTÉGÉES** : mesurées en prod sur iPhone, `/` en porte **24** sous 44 px et `/entreprise-presentation` **23**. Énoncé honnête par ailleurs : **1 violation `color-contrast` par page**, dispensée nommément par C-23, jamais « 0 violation » |
| [SEO](./SEO.md) | 80 | **80** | 0, VÉRIFIÉE | 40 URLs, 80 `hreflang`, 0 `noindex`, et les **10** pages prérendues hors sitemap expliquées une par une |
| [i18n](./I18N.md) | 90 | **90** | 0, VÉRIFIÉE | Les trois gates rendent les mêmes chiffres à l'unité. Ce document avait raison contre `CLAUDE.md` sur le nombre de namespaces |
| [Mobile / DA](./MOBILE.md) | 79 | **76** | **−3** | Le « **0** cible tactile trop petite » du matin ne vaut que des 8 routes protégées. En production, sur iPhone : **24** cibles sous 44 px sur `/`, dont le bouton « Commencer » du header (**115 × 36**) et un curseur de forfait de **308 × 6 px**. Et les trois suites mobiles rejouées sur WebKit rendent **9 passés sur 18** |

**Bilan : +4, −12, soit huit points nets en moins.** Une passe qui rend huit points de moins que le matin n'est pas un échec de
la journée : c'est ce qui arrive quand on remplace des vérifications de gardes par des mesures de
résultats. Les **cinq** baisses viennent toutes de choses **qui existaient déjà** et qu'aucune note ne
portait : rien n'a cassé aujourd'hui, on a simplement regardé ailleurs que là où les gardes pointent.

### Ce qui bloque un lancement, ce qui attend : le tri

**Aucun des dix angles morts de cette passe n'empêche de déployer.** La CI est verte, le build
passe, la production répond 200 sur les cinq URLs testées, et `main` est déployable en l'état. Les
bloquants réels sont **antérieurs** à cette passe et déjà écrits dans
[`../faille.md`](../faille.md). Le tri, pour ne pas confondre les trois :

#### 🔴 Bloquant, et rien de tout cela n'a été découvert ce soir

| # | Quoi | Mesuré |
|---|---|---|
| A-9 | **Aucune sauvegarde, aucun PITR.** Le plan de l'organisation Supabase est `free` (relu par l'API le 2026-09-15). Le dump quotidien de `db-backup.yml` est **la seule copie de la base qui existe** | `plan: "free"` |
| Encaissement | **On ne peut pas vendre.** `STRIPE_SECRET_KEY` est une clé de test, `ENTERPRISE_BILLING_ENFORCED` et `billing_flags.enterprise_seat_limit` sont **tous deux à `false`**, `org_subscriptions` porte **0 ligne** et `payment_records` **0** | relus en base |
| Juridique | **Pas de micro-entreprise.** Encaisser sans immatriculation est du travail dissimulé : c'est ce qui bloque le point précédent, pas la technique | [`STRIPE-LIVE.md`](./STRIPE-LIVE.md) |

⚠️ **Ces trois-là ne bloquent que si le lancement VEND.** Le produit est gratuit pour tout le
monde aujourd'hui (`PREMIUM_ENFORCED = false`), et les deux drapeaux de facturation sont alignés,
donc personne ne tombe sur un mur de paiement. Pour une campagne d'acquisition sans encaissement,
seul **A-9** compte vraiment : amener du trafic sur une base sans sauvegarde, c'est augmenter ce
qu'on perd le jour où on la perd.

#### 🟠 À traiter AVANT d'envoyer du trafic, pas après

| Quoi | Pourquoi maintenant | Coût |
|---|---|---|
| **`C-77` · `okrTime` à 0 sur `/statistics`** | C'est la seule chose de cette passe qu'un utilisateur VOIT. Un graphique qui affiche zéro ne dit pas « je ne sais pas », il dit « tu n'as rien fait », sur une page qui sert d'argument produit | **faible** : la mig. `136` est écrite, relue et **déjà commitée**. Reste à l'appliquer et à comparer ce qu'elle rend au calcul client |
| **`C-80` · le curseur de forfait à 6 px** | Il est sur `/entreprise-presentation`, c'est-à-dire la page qui présente l'offre payante, et il fait **308 × 6 px** sur iPhone. C'est l'outil avec lequel un prospect choisit son palier | **faible** : une hauteur de piste et une zone tactile |
| **Confirmations d'inscription (`G-2`)** | Décision déjà prise et assumée, mais elle change de portée sous trafic : 18 comptes sur 28 ont une adresse que personne n'a jamais prouvée. Une faute de frappe crée un compte définitivement injoignable | décision, pas code. Le SMTP qui manquait est en service depuis le 2026-08-29 |

#### 🟡 Reportable sans risque, mais à savoir avant de lire les chiffres d'une campagne

- **`C-78`** · les 96 cas WebKit hors CI : dette de mesure, pas de défaut constaté. La landing
  chargée sur le même moteur depuis la production rend `load` en 2 159 ms, zéro requête en vol.
  Le risque est de ne pas voir une régression iOS, pas d'en avoir une.
- **`C-79`** · la garde de recouvrement du ledger : aucun effet utilisateur.
- **Les deux comptes de test** (`demo@cosmo.app`, `testemail@gmail.com`) que `get_admin_stats`
  ne retranche pas : **16 % des tâches de la plateforme** appartiennent au compte de démonstration.
  Rien à réparer dans le produit ; tout à retrancher avant de lire une statistique de campagne.
- **Les cibles tactiles du pied de page** (~20 px de haut) : critère **AAA**, pas AA. Confort.

### Pourquoi cinq notes baissent : ce n'est pas une casse récente, et voici les dates

La question se pose d'elle-même en lisant le tableau : ou bien les notes précédentes étaient
surévaluées, ou bien quelque chose a été cassé depuis. **Réponse mesurée, cause par cause, par
`git log -S` sur le code qui porte chaque défaut** :

| Baisse | Le défaut existe depuis | Durée avant d'être vu |
|---|---|---|
| Tests / CI −3 · 96 cas WebKit hors CI | le job `e2e` ne lance que `--project=chromium` depuis sa création, **2026-06-06** (`a163c2b3`). Le project `mobile-safari`, lui, existe depuis le **2026-05-21** | **3 mois, jamais joué** |
| Performance −2 et UI / UX −2 · `okrTime` à zéro | la lecture de `kr.elem->'history'` est dans `get_work_time_stats` depuis la mig. **074**, entrée au dépôt le **2026-07-16** (`f4c73db3`) | **2 mois** |
| Mobile −3 et Accessibilité −2 · cibles tactiles | `e2e/touch-targets.spec.ts` est né le **2026-09-04** avec sa liste de huit routes protégées, et n'a **jamais** couvert une page publique. Le curseur de forfait à 6 px date du **2026-08-15** (`c834412d`), le CTA « Commencer » à 36 px d'avant le **2026-08-03** | **depuis l'origine de la garde** |

**Aucune des cinq baisses ne vient d'une régression récente.** Rien n'a été cassé : ces défauts
étaient tous là pendant que les notes montaient.

#### Le mécanisme, qui n'est pas de la complaisance

Dire « les notes étaient gonflées » est juste sur le résultat et faux sur la cause. À chaque fois,
**le travail crédité était réel** : la garde de cibles tactiles existe et ses 8 routes sont
réellement propres ; la mig. `127` fait réellement passer la page Statistiques de 854 ms à 12 ms ;
la suite E2E compte réellement 220 cas. Ce qui était faux, c'est la **portée** que la note leur
prêtait :

- « cibles tactiles : **0** » est vrai de huit écrans derrière connexion, et se lisait comme une
  propriété du produit ;
- « 220 cas E2E » est vrai du dépôt, et se lisait comme une couverture de la CI ;
- « 854 ms → 12 ms » est vrai du temps d'exécution, et se lisait comme la santé de la page.

C'est **exactement la faute que ce dépôt a nommée le 2026-09-03** (« une garde se vérifie sur ce
qu'elle REGARDE, pas sur le fait qu'elle tourne »), appliquée depuis aux gardes et **jamais aux
notes qui s'appuient dessus**. Une note crédite ce qu'une garde DIT ; il faut qu'elle crédite ce
que la garde COUVRE.

#### Ce qui prouve que le biais n'est pas orienté vers le haut

Le même défaut de méthode a joué **à l'envers** sur Architecture, et coûtait 4 points depuis neuf
jours : C-09 avait supprimé les douze derniers god components le 2026-09-05, mais rejouer la garde
rendait le même vert qu'avant (un cliquet à zéro ne dit rien du delta), donc personne ne l'avait
crédité. Le biais n'est pas « se donner de bonnes notes », il est « suivre l'instrument sans
regarder sa portée », et il se trompe dans les deux sens.

#### Le cas le plus net, parce qu'il tient dans une journée

**Mobile a gagné 3 points le matin du 2026-09-14 et les a perdus le soir, sur la même métrique.**
Le matin : « cibles tactiles < 44 × 44 px : **0**, 10/10 cas E2E verts », +3. Le soir : la même
garde, relue dans son code, ne visite aucune page publique, et la production en porte 24 sur `/`.
Rien n'a changé dans le produit entre les deux mesures ; ce qui a changé, c'est qu'on a lu la
boucle `for (const route of [...])` au lieu du résultat du test.

#### Ce qu'il faut en faire pour la prochaine passe

❌ **Ne jamais créditer une note sur le verdict d'une garde sans avoir lu son PÉRIMÈTRE** : la liste
de routes, la liste de projects, la liste de colonnes. Le verdict dit « vert » ; le périmètre dit
« de quoi ».
❌ **Ne jamais créditer un gain de performance sans comparer ce que la fonction REND.** Une
fonction qui rend zéro très vite est la plus rapide de toutes.
✅ **Relire la valeur PRÉCÉDENTE d'un cliquet, pas seulement son vert.** C'est la seule façon de
voir un progrès sur une garde déjà satisfaite.

### Les dix angles morts

| # | Angle mort | Comment il a été trouvé |
|---|---|---|
| **1** | **`okrTime` vaut 0 en production sur `/statistics`.** La RPC `get_work_time_stats` lit un champ JSON que rien n'écrit. Le correctif du 2026-09-02 n'a touché que le calcul **client** : la démo affiche juste, le produit affiche zéro. La mig. `136` qui répare est **commitée depuis le 2026-09-03** (`31482a3f`) et n'a jamais été appliquée, décrite partout comme « travail d'une autre session » et jamais comme un défaut ouvert | `pg_get_functiondef` sur la fonction vivante, pas la lecture du dépôt |
| **2** | **44 % des cas E2E ne tournent nulle part** (96 cas WebKit / iPhone), pour un coût affiché d'une minute d'installation | `--list` par project, puis `grep` sur les neuf workflows |
| **3** | **Le ledger de migrations ne prouve pas ce qu'on lui fait dire.** « 148 entrées » était le NUMÉRO de la dernière migration ; il y en a **138**. Et 32 des 152 fichiers du dépôt n'y ont aucune correspondance. Ils SONT appliqués, mais ce n'est pas le ledger qui l'établit, et aucune garde ne surveille ce recouvrement | Comparaison nom à nom, puis vérification objet par objet dans le catalogue Postgres |
| **4** | **`email_confirmed_at` est posé pour 28 comptes sur 28, dont 26 à la seconde de leur création.** La confirmation d'adresse étant désactivée, la colonne qui sert à répondre « cette adresse est-elle vérifiée ? » répond **oui** pour **18 adresses que personne n'a vérifiées** | Requête sur `auth.users`, écart `email_confirmed_at` moins `created_at` |
| **5** | **Deux des 28 comptes ne sont pas des utilisateurs** : `demo@cosmo.app` (jamais connecté, et pourtant porteur de **120 tâches, 67 événements, 6 habitudes, 4 OKR en production**) et `testemail@gmail.com`. `get_admin_stats` **ne les exclut pas** : **16 % des tâches de la plateforme** appartiennent au compte de démonstration | Comptage par compte, puis lecture de la définition de `get_admin_stats` |
| **10** | **La check-list VoiceOver promet « les 52 surfaces » et en oublie deux**, toutes deux câblées et atteignables au doigt : `MoveCategoryDialog` (ouverte depuis `ColorSettingsModal`) et `DeleteTeamCategoryConfirm` (onglet OKR d'équipe). C'est le **seul** instrument du dépôt qui mesure l'ANNONCE, par opposition au focus | Comptage des APPELS du hook (54, dont 3 témoins) croisé avec les noms de l'annexe A |
| **9** | **Deux titres de `DEPLOYMENT.md` décrivaient comme « à faire » des choses faites depuis des semaines** : « emails d'authentification, **non configurés** » alors que le SMTP est en service depuis le 2026-08-29 au soir (16 jours), et « second facteur sur `/admin`, **mig. `131` non appliquée** » alors qu'elle l'est depuis le 2026-08-31 et que le TOTP est enrôlé depuis le 09-01 (15 jours). Même famille que l'angle mort 8 : le fait est corrigé là où on l'explique, jamais là où on l'exécute | `npm run check:mail` rejoué, puis ledger et `auth.mfa_factors` relus en base |
| **8** | **Le runbook de bascule Stripe live listait CINQ events webhook, il en faut SIX.** `CLAUDE.md` et `STRIPE-LIVE.md` avaient été corrigés le 2026-09-12, **pas `POST-AUDIT-GUIDE.md`** : le seul document qu'on EXÉCUTE le jour J. En souscrire cinq laisse `charge.refunded` de côté, donc un remboursement versé sans ligne compensatoire au journal d'encaissement | `grep "case '"` dans `stripe-webhook/index.ts`, six branches, puis comparaison des trois documents |
| **7** | **La garde « cibles tactiles » ne regarde que huit routes protégées**, et son résultat est lu comme une propriété du produit. Les pages publiques, celles qui reçoivent le trafic, en portent **24** et **23** sous 44 px, dont un `input[type=range]` de **6 px de haut** sur la page qui vend l'offre entreprise | Sonde WebKit / iPhone 12 contre la production, après lecture de la boucle de routes du spec |
| **6** | **Trois tables de contenu libre manquaient à l'inventaire RGPD §1** (`team_task_comments`, `team_task_activity`, `org_notifications`), alors que le registre art. 30 les liste. Leur `author_id` / `actor_id` est en `SET NULL` : le contenu **survit** au départ de son auteur | Croisement des FK de `pg_constraint` avec l'inventaire, puis avec le registre |

### Le chiffre qui n'est dans aucune note, et qui devrait décider de la semaine

Mesuré en base ce soir, sur `auth.users` : **28 comptes, 1 seule inscription sur 30 jours, 0 sur
7 jours, 2 connexions sur 7 jours.** Le plan d'acquisition du 2026-08-13 en comptait 27. **Un mois
de travail a produit un inscrit**, et deux des 28 comptes sont des comptes de test.

**Le haut du funnel est pire que le taux de conversion**, et c'est là que se joue la campagne :
appareils distincts ayant ouvert la démo, **19 en juillet, 25 en août, 1 du 1ᵉʳ au 14 septembre**.
Ce n'est pas un problème de conversion, c'est une absence de visiteurs, et aucune retouche de page
n'a prise dessus.

✅ **La machine à mesurer, elle, fonctionne** : le parcours a été PARCOURU en production sur iPhone
émulé (clic sur « Essayer la démo gratuite » → `/dashboard`, interface rendue, `POST
record_demo_visit` observé dans le trafic). ⚠️ **Cette vérification a écrit une ligne en
production** : un appareil de plus dans `demo_devices` (45 → 46). Elle est anonyme, mais elle est de
moi ; les chiffres de septembre ci-dessus l'excluent. Détail : [`ACQUISITION.md`](./ACQUISITION.md).

Aucune note de ce tableau ne mesure cela, et c'est normal : elles notent ce que le dépôt contrôle.
Mais un lecteur qui verrait onze notes entre 84 et 95 juste avant une campagne en tirerait une
conclusion fausse. *Une note d'infrastructure n'est pas une note d'audience.* Le levier reste celui
nommé le 2026-08-19, et il est hors du dépôt : [`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md).

### Les documents NON notés ont aussi été confrontés à la production

Un audit noté attire l'attention ; un runbook non noté est ce qu'on exécute. **Deux des trois
angles morts les plus graves de cette passe vivaient dans des documents sans note.**

| Document | Ce qui a été vérifié | Résultat |
|---|---|---|
| [`SECURITY.md`](./SECURITY.md) | Les affirmations d'ÉTAT, dans le catalogue Postgres | ✅ toutes exactes : 50/50 tables avec RLS, 0 policy UPDATE sur `subscriptions`, 0 vestige du système de jetons, journaux scellés en deny-all |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Les deux titres de section qui annoncent un état | 🔴 **deux faux**, de 16 et 15 jours (angle mort 9) |
| [`POST-AUDIT-GUIDE.md`](./POST-AUDIT-GUIDE.md) | La liste des events webhook à souscrire | 🔴 **cinq au lieu de six** (angle mort 8) |
| [`AUDIT-VOICEOVER-IOS.md`](./AUDIT-VOICEOVER-IOS.md) | L'annexe A contre les appels réels du hook | 🔴 **deux surfaces manquantes** (angle mort 10) |
| [`STRIPE-LIVE.md`](./STRIPE-LIVE.md) | Les identifiants de test restés en base | ✅ inchangé : 5 `cus_`, 2 `sub_`, `org_subscriptions` à 0, `reset_stripe_identifiers` bien absente |
| [`ACQUISITION.md`](./ACQUISITION.md) | Le funnel, un mois après l'audit du 08-14 | 🔴 remesuré, et mauvais : 1 appareil de démo en septembre contre 25 en août |

⚠️ **Une erreur de plus, sans conséquence mais du même genre** : `CLAUDE.md` annonçait « 8 comptes
portent un premium sans fin de période ». Recompté : **7** (et 3 avec une fin, sur 54 lignes).

### Deux limites de cette passe, à ne pas lire comme des vérifications

- **La tenue sous charge n'a pas été rejouée** : elle exige Docker, absent de ce poste. Seuls les
  plans d'exécution l'ont été.
- **`npm run check:edge` n'a pas tourné** : il exige `SUPABASE_ACCESS_TOKEN`, absent de cet
  environnement. La non-dérive des 8 Edge Functions reste établie par le job CI du matin
  (`34861975638`), pas par une mesure de ce soir. Les **versions en ligne** ont en revanche été
  relues par l'API : `stripe-webhook` v33, `delete-account` v17, `stripe-org-refund` v6.

---

## Mise à jour du 2026-09-14 · neuf domaines REMESURÉS, deux honnêtement hors de portée d'ici

🔴 **Une première version de cette entrée refusait toute note**, puis une deuxième en notait cinq
et laissait les six autres à `·`. Trois des six étaient de la fausse prudence : **RGPD, Mobile et
SEO** portaient chacun un fait vérifiable ce jour-là — une version d'Edge Function relue et
confrontée à la garde de dérive, des cliquets de taille déjà abaissés mais jamais absorbés par ce
document, une bascule d'indexation du 09-08 jamais notée — que refuser de mesurer n'était pas plus
honnête que de l'inventer. **i18n** n'avait simplement jamais reçu de première note : les trois
gates existent et sont vertes, rien ne justifiait de continuer à la taire. Restent deux domaines
**réellement** hors de portée d'ici, et la raison de chacun est écrite dans son propre fichier,
pas seulement ici : la charge de **Scalabilité** exige Docker, absent de ce poste ; **UI/UX**
porte un changement non commité d'une autre session que je ne peux pas trancher à sa place.

| Domaine | dernière note | **09-14** | Δ | Ce qui a bougé, et sa preuve |
|---|---|---|---|---|
| [Performance](./PERFORMANCE.md) | 92 (09-03) | **97** | **+5** | **C-14 fermé** : le rouge du 09-03 (entrée 78,1 ko pour un plafond de 78,0) devient une marge de 5,78 %, chemin critique 5,16 %. Les deux plafonds ABAISSÉS (78 000→71 000, 370 000→323 000), sonner sorti du chemin critique. Vécu 3 jours hors dépôt avant d'être commité — la note ne compte qu'à partir de `7134d7fe`, run `34846164939` |
| [Tests / CI](./TESTING.md) | 95 (09-03) | **97** | **+2** | `toast.guard.test.ts` tourne enfin EN CI (3 jours non suivie par git). `e2e/stubbed/delete-org.spec.ts` (4 cas) prouve le parcours nominal de C-39, vu rouge sur une mutation. `refund.guard.test.ts` a mordu sur ma propre extraction du verrou anti-rejeu — et avait raison. Suite 2 470/221 → **2 586/228**, Playwright 210/25 → **220/26** |
| [SEO](./SEO.md) | 75 (08-29) | **80** | **+5** | Rattrapage : la bascule C-20 (09-08, anglais ouvert à l'indexation + 3 défauts fermés) n'avait jamais été notée. Revérifié aujourd'hui sur un build réel : 40 URLs au sitemap, 80 entrées `hreflang`, 0 page `noindex`, `/entreprise-presentation` déclarée et non bloquée par `robots.txt` |
| [Sécurité](../faille.md) | 86 (09-03) | **88** | **+2** | Le seul verrou anti-rejeu jamais testé (pré-contrôle qui retranche le déjà-remboursé, sur un chemin qui déplace de l'argent) est extrait, couvert par 10 cas, vu rouge sur 3 sabotages, déployé en v6, vérifié identique au dépôt (`Edge deploy drift` `34861975638`) |
| [Mobile / DA](./MOBILE.md) | 76 (08-29) | **79** | **+3** | Libellés sous 11 px 75→**69**, stock de tailles arbitraires 196→**192** (C-75, jamais absorbé par ce document), cibles tactiles rejouées sur 8 routes + modale d'équipe : **0** violation, 10/10 cas E2E verts |
| [i18n](./I18N.md) | · | **90** | **première note** | Les trois gates existent et sont vertes : `i18n:check` 0 erreur, `i18n:scan` 0 chaîne en dur, `i18n:identical` 3 898 couples, 92 identiques, **0 non déclarée**. 11/11 articles et 4/4 pages cas d'usage bilingues, vérifié dans `src/content/` |
| [RGPD](./RGPD.md) | 86 (08-29) | **87** | **+1** | La garantie d'effacement testée par `rgpd-erasure.guard.test.ts` est désormais vérifiée contre le code **déployé** : `delete-account` v17, identique au dépôt (`Edge deploy drift`). Jamais confirmé jusqu'ici |
| [Accessibilité](./ACCESSIBILITY.md) | 83 (09-04) | **84** | **+1** | `CategoryManager` — câblée sur `useModalA11y`, montée nulle part — supprimée. 53 → **52** surfaces à auditer sur iPhone, une de moins qu'aucun doigt ne pouvait jamais atteindre |
| [Architecture](./ARCHITECTURE.md) | 84 (09-03) | **84** | **0**, VÉRIFIÉ | 452 lignes de code mort en moins, guard rejouée : `OVERSIZED_BUDGET` reste à 0. Le fichier était déjà sous 600 lignes, la métrique ne bouge pas — vérifié, pas supposé |
| [Scalabilité](./SCALABILITY.md) | 91 (09-08) | **·** | non remesurable ici | La charge se rejoue contre une stack Supabase LOCALE montée par Docker sur le runner CI (§9ter). Ce poste n'a pas Docker : `docker --version` introuvable. Ce n'est pas un choix, c'est une limite d'environnement, nommée dans `SCALABILITY.md` |
| [UI / UX](./UI-PATTERNS.md) | 87 (09-03) | **·** | non tranchable ici | Un changement UI (retrait de la pastille « Aujourd'hui » sur le report rapide) traîne **non commité** dans l'arbre de travail d'une autre session ; il contredit C-72 et attend l'arbitrage M-44. Aucune passe visuelle rejouée par ailleurs |

⚠️ **Ce que ce tableau ne fait toujours pas** : il ne recompte pas onze domaines à partir d'un
changelog de code. Les neuf notes ci-dessus viennent chacune d'une mesure prise ce jour — commit
cité, run CI cité, build vérifié, ou garde rejouée avec son résultat — écrite dans le fichier du
domaine avant d'être reportée ici. Les deux `·` restants ne sont pas des « rien n'a changé » : ce
sont des limites nommées (Docker absent, arbitrage en attente), pas des refus de regarder.

⚠️ **Quatre affirmations de la documentation ont par ailleurs été démenties par leur propre
remesure**, sans lien direct avec une note ci-dessus : la portabilité des corrections de types
React 19 (72 erreurs `tsc`), les cinq events du webhook (il y en a six), « un admin non
propriétaire peut supprimer l'entreprise » (faux depuis la mig. 138), et quatre versions d'Edge
Functions citées par `faille.md`. Aucune n'a été trouvée en relisant : toutes en comptant dans le
code, en lisant le ledger ou en interrogeant l'API.

---

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
| [`../faille.md`](../faille.md) | Sécurité : findings **ouverts**, priorités avant prod, règles durables · **note 88 au 2026-09-14 (soir)**, vérifiée inchangée |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Invariants du projet et leur état vérifié · **note 90 au 2026-09-15** (+2 : `check:migration-coverage` referme le premier des trois motifs de plafonnement) |
| [`SECURITY.md`](./SECURITY.md) | RLS, migrations SQL, repositories, Edge Functions, Stripe, CSP, secrets · **les 4 Edge Functions Stripe auditées le 2026-09-02**, cf. [`../faille.md`](../faille.md) |
| [`TESTING.md`](./TESTING.md) | Vitest, Playwright, a11y, i18n, CI, **checklist avant push prod** · **note 95 au 2026-09-15** (+1 : 8 routes publiques entrent dans la garde E2E, un 6ᵉ job CI apparaît) · ✅ **les cas WebKit tournent en CI depuis `af0190bd`, 2026-09-16** — la mention « aucun workflow » est corrigée le 09-21. 🔴 **Et le job `e2e` est ROUGE sur `main`**, 25 échecs, `C-111` · suite **2 603 / 229** verte en CI, couverture verte |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Runbook deploy / rollback Vercel + Supabase, drill de restauration |
| [`MOBILE.md`](./MOBILE.md) | Pages et composants mobiles, bottom-sheets, pièges iOS Safari · **note 78 au 2026-09-15** (+2 : C-80 refermé, le curseur de forfait passe de 308 × 6 à 308 × 44 px) · ✅ **WebKit est en CI depuis le 2026-09-16**, et Android émulé depuis le 09-20 (`C-97`) ; l'appareil réel reste `M-25` |
| [`UI-PATTERNS.md`](./UI-PATTERNS.md) | Listes, modals, tutoriels, onboarding, thèmes · **note 85 au 2026-09-15**, inchangée · ✅ **C-77 refermé le 2026-09-20**, le zéro de `/statistics` n'est plus faux (corrigé ici le 09-21) · 🔴 **M-44 s'est inversé** : le retrait tranché CONTRE est entré dans `main` le 09-16 |
| [`PERFORMANCE.md`](./PERFORMANCE.md) | `manualChunks`, lazy loading, images et polices, budget bundle · **note 95 au 2026-09-15**, inchangée · ✅ **C-77 refermé le 2026-09-20** (mig. `136` au ledger `20260920104729`), la mention « rend toujours 0 » est corrigée le 09-21, gardé par `npm run check:bundle` et par le job `lighthouse` · et depuis le 2026-08-26 **le coût serveur d'une ouverture de session**, ramené de 29 à 21 requêtes REST |
| [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) | WCAG / EAA, aria, contraste, gates axe-core + Lighthouse · **note 84 au 2026-09-15** (+2 : la garde couvre 8 pages publiques de plus, 18 cas sur 18 verts) · 37 cas a11y verts rejoués le 09-14 |
| [`AUDIT-VOICEOVER-IOS.md`](./AUDIT-VOICEOVER-IOS.md) | Check-list du **quatrième** audit d'accessibilité, à jouer d'une traite sur un iPhone (12 étapes, ~60 min, témoin en tête). Le seul instrument qui mesure l'**annonce** : le dépôt ne prouve aujourd'hui que le **focus** |
| [`SCALABILITY.md`](./SCALABILITY.md) | Montée en charge · **note 91, vérifiée au 2026-09-14 (soir)** (plans d'exécution rejoués en production), coût par ligne mesuré, éprouvé à volume (§9ter) **et en concurrence** (1 → 16 sessions, §9quater) |
| [`SEO.md`](./SEO.md) | Prérendu, sitemap, hreflang, indexation par locale · **note 80, vérifiée au 2026-09-14 (soir)** · données Search Console du 2026-08-19, non remesurées · ⚠️ **1 inscription sur 30 jours** mesurée en base le 09-14 |
| [`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md) | 🔴 Le chantier qui débloque le SEO : kit de soumission annuaires, prêt à coller — **100 % manuel** |
| [`ACQUISITION.md`](./ACQUISITION.md) | Attribution `?ref=`, funnel mesuré en prod, runbook — **audit du 2026-08-14** |
| [`I18N.md`](./I18N.md) | Qualité réelle des traductions, périmètre bilingue · **note 90, vérifiée au 2026-09-14 (soir)** · les trois gates sont bloquantes et à **0** (`i18n:check` **23 namespaces**, `i18n:scan`, `i18n:identical`) |
| [`RGPD.md`](./RGPD.md) | Inventaire des données personnelles, droits, rétention · **note 87, vérifiée au 2026-09-14 (soir)** (51 FK vers `auth.users` relues : 32 CASCADE / 19 SET NULL), durées de conservation publiées |
| [`RGPD-REGISTRE.md`](./RGPD-REGISTRE.md) | Registre des activites de traitement (RGPD art. 30) · **cree le 2026-08-26** |
| [`RGPD-VIOLATION.md`](./RGPD-VIOLATION.md) | Procedure de violation de donnees sous 72 h (RGPD art. 33-34) · **cree le 2026-08-26** |
| [`LEGAL.md`](./LEGAL.md) | Obligations légales du fondateur : statut, TVA, droit de la consommation, marque, sous-traitants · **créé le 2026-08-26**, non noté (ce n'est pas un audit) |
| [`STRIPE-LIVE.md`](./STRIPE-LIVE.md) | Compte Stripe live : les 8 prix et le `tax_behavior` définitif · **créé le 2026-08-26** |
| [`SUPPORT.md`](./SUPPORT.md) | Procédure de support : qui répond, sous quel délai, par quel canal, et quand ça devient un incident · **créé le 2026-08-28** |
| [`POST-AUDIT-GUIDE.md`](./POST-AUDIT-GUIDE.md) | Réactivation premium (`PREMIUM_ENFORCED`), finalisation Stripe |
| [`MIGRATION-REACT19.md`](./MIGRATION-REACT19.md) | Étude de faisabilité React 19 + `react-router` 8 · **créée le 2026-09-03** (audit A-6), non notée (ce n'est pas un audit de domaine) |
| [`COSMO-CLI.md`](./COSMO-CLI.md) | CLI d'accès aux données COSMO réelles (`scripts/cosmo/`) |
| [`AGENT-AJOUTER-TACHE.md`](./AGENT-AJOUTER-TACHE.md) | Mémo court : ajouter une tâche dans le vrai compte |
| [`ROADMAP-60J.md`](./ROADMAP-60J.md) | Plan à 60 jours, 47 tâches · **non noté** (c'est un plan, pas un audit) — ajouté à ce tableau le 2026-09-21, il n'y figurait pas |
| [`LEGAL-JOURNAL.md`](./LEGAL-JOURNAL.md) | Journal des documents contractuels : une ligne ✅ doit porter sa **date** · couvert par `LEGAL.md`, gardé par `npm run check:legal-journal` (`C-107`) — ajouté le 2026-09-21 |
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

**Plans et specs exécutés** — `archive/superpowers/plans/*`, `archive/superpowers/specs/*`.
Cinq y sont descendus le **2026-09-21** : Stripe entreprise (plan + spec, livré **dormant**),
landing track entreprise, et sous-catégories hiérarchiques vague 1 (plan + spec, **en production**).
⚠️ **Aucun de leurs plans n'avait une seule case cochée** — le code fait foi contre elles.

⚠️ **Deux d'entre eux ne sont pas « exécutés », ils sont ABANDONNÉS**, et ce dossier porte donc
les deux natures. Le pattern de liste mobile (plan + spec) n'a **jamais été implémenté** —
`ListRow` avait été supprimé la veille de son écriture, et sa prémisse est morte avec la refonte
mobile du 09-16 → 09-20. Arbitrage rendu par Axel le **2026-09-21** : archivé avec sa raison,
plutôt que laissé à faire croire qu'il reste du travail en cours. 🔴 **Un plan abandonné se range,
il ne se supprime pas** : ce qu'on a décidé de ne pas faire est une information, et sans elle le
même plan se réécrit dans six mois.

🔴 **`docs/superpowers/` n'est donc PAS vide, et ce qui y reste est vivant pour de bon** : le flux
de relecture des tâches d'équipe (`specs/2026-08-24`), **toujours à faire**, vérifié dans le code
le 09-21 — aucun composant ne rend « Valider » / « Renvoyer ». ⚠️ Son numéro de migration `113`
est pris depuis : ce sera la **`151`**, le dépôt étant allé jusqu'à `150`.

## Règles d'entretien

1. **Un audit ne se met pas à jour** — c'est un instantané. Ses findings encore ouverts remontent
   dans le document vivant correspondant (`faille.md`, `PERFORMANCE.md`…), puis il part en archive.
2. **Jamais de numéro de ligne** vers un autre fichier : les fichiers bougent, les ancres de
   section survivent.
3. **Un chiffre porte sa date de mesure** (nombre de tests, taille de bundle, nombre de migrations),
   sinon il devient un piège silencieux.
4. **Un doc vivant qui n'a plus rien d'ouvert** part en archive ou disparaît — il ne reste pas à la
   racine à faire croire qu'il y a du travail en cours.

---

## Préambule repris de `CLAUDE.md` (déplacé le 2026-09-16)

Guide de travail dans ce dépôt. **Vérifié dans le code ET contre la production le 2026-09-14 au
soir** : passe d'audit complète des onze domaines, gardes rejouées, base interrogée (ledger,
advisors, plans d'exécution, versions d'Edge Functions), production sondée en HTTP et sur WebKit /
iPhone. **Cinq notes baissent, une monte, et dix angles morts en sortent** : le tableau et les
preuves sont dans [§ Mise à jour du 2026-09-14 (soir)](#mise-à-jour-du-2026-09-14-soir--passe-complète--onze-domaines-aucun---dix-angles-morts).
Passes antérieures conservées à leur date (2026-08-24 contre la prod, 2026-09-03 sur le code seul).

🔴 **Le défaut le plus coûteux trouvé ce soir n'est pas dans ce fichier, il est en
production** : `okrTime` vaut **0** sur `/statistics` pour tous les comptes réels, parce que le
correctif du 2026-09-02 n'a réparé que la moitié cliente et que la mig. `136`, **pourtant commitée
depuis le 2026-09-03**, n'a jamais été appliquée. La **démo affiche juste, le produit affiche zéro**.
Item `C-77` de [`../a-faire-code.md`](../a-faire-code.md).

> ## ✅ 2026-09-21 · les deux défauts de ce préambule
>
> **1 · Il était COUPÉ EN PLEIN MILIEU depuis son déplacement** (`55940fad`, 2026-09-16) : le
> fichier s'arrêtait sur « pourtant commitée », sans point. La fin a été retrouvée dans
> `CLAUDE.md` avant sa coupe (`7785e12d^`) et restituée mot pour mot ci-dessus. ⚠️ Aucune garde
> ne voyait ça : `check:docs` mesure des octets, des pointeurs et des liens, jamais une phrase.
>
> **2 · Son contenu s'est inversé.** `C-77` est **REFERMÉ depuis le 2026-09-20** : la mig. `136`
> est au ledger (`20260920104729`, relu en base le 09-21) et `get_work_time_stats` lit
> `kr_completions`. Le paragraphe est conservé à sa date parce qu'il enseigne ce que coûte une
> migration commitée et dormante — **dix-sept jours**.
>
> 🔴 **Ne pas relire un mois à zéro comme une panne** : le temps OKR vaut `Σ minutes estimées` par
> complétion, et trois KR sur cinq du compte principal portent `estimated_time = 0`. Août et
> septembre restent donc à zéro, et c'est **juste**.
