# À faire — CODE

**Dressé le 2026-09-03**, contre le code de `main` à `HEAD` (`ff82214`), `faille.md`,
`docs/ROADMAP-60J.md` et les dix audits de `docs/`. Chaque item porte **où c'est**, **pourquoi ça
compte** et **ce qui prouve que c'est fini**.

> **Complété le 2026-09-03 au soir**, à `31482a3`, après la passe qui a traité les points 5 à 31
> d'une revue de code. Ajouts : **C-45** (allowlist Supabase des redirections OAuth), **C-46**
> (`localStorage` hors `try` dans les dépôts de démo), **C-47** (échecs de tests faux sous charge).
> **C-22** est clos ; **C-38** est à moitié fait et dit désormais ce qui a été fermé et ce qui reste.

> ### 🟢 Passe du 2026-09-04 — 24 items traités, poussés sur `main`
>
> Chaque item concerné porte une note en tête disant ce qui a été fait. Douze
> commits, 44 fichiers, trois migrations écrites. **Ce qui compte plus que le
> décompte** : quatre énoncés se sont révélés PARTIELLEMENT FAUX à la
> remesure, et la note de l'item le dit à chaque fois plutôt que d'aligner le
> résultat sur l'attendu.
>
> | Item | Ce que l'énoncé disait | Ce que la mesure a rendu |
> |---|---|---|
> | **C-56** | trois écrans inatteignables clavier ouvert | **un seul** — les deux autres portaient `my-auto` sur leur carte, et rendaient déjà +16 px |
> | **C-57** | « 43 sous la cible sur /okr, dont 42 à 40×40 » | `/okr` rendait **1 sur 58**, et c'était un bouton *inline* (exception WCAG 2.5.5) |
> | **C-40** | douze écrans affirment une absence | **sept** — cinq ne mentent pas, et sont nommés un par un dans la garde |
> | **C-23** | « trois violations `serious`, deux tokens, bon marché » | **onze paires de couleurs**, 74 nœuds. La gate n'est donc PAS durcie, et la raison est écrite |
>
> ⚠️ **Trois migrations écrites, AUCUNE appliquée** : `137` (identifiants de
> refus de dépendance), `138` (les preuves survivent à la suppression d'une
> org + propriétaire seul), `139` (plafond de débit). Chacune porte sa séquence
> de vérification à jouer dans une transaction annulée. Deux secrets restent à
> poser : `RATE_LIMIT_SALT` et `CRON_SECRET`.
>
> ⚠️ **Aucune Edge Function n'est déployée** par un push (C-35) : `report-bug`
> tourne encore sans son plafond de débit tant que
> `supabase functions deploy report-bug` n'a pas été joué.

**Ce que ce fichier contient** : uniquement ce qui se corrige **en écrivant du code ou du SQL**.
Tout ce qui se règle dans une console, chez un fournisseur ou au guichet (immatriculation, Stripe
live, secrets, backlinks, DPA, plan Supabase) reste dans [`docs/ROADMAP-60J.md`](./docs/ROADMAP-60J.md)
et [`faille.md`](./faille.md), et la liste des gestes correspondants est dans
[`a-faire-manuel.md`](./a-faire-manuel.md). Le §9 y renvoie sans les recopier, pour qu'aucun statut
ne vive à deux endroits.

> 🔴 **Lire le §10 AVANT de conclure que ce fichier est complet.** Il nomme ce que cette liste **ne
> peut pas** contenir : quatre zones du produit n'ont jamais été auditées, et une liste ne peut
> pas porter les défauts d'un code que personne n'a lu. « Plus un seul problème de code » ne sera
> vrai qu'une fois ces audits passés **et** leurs findings ajoutés ici.

## Règles de traitement (elles viennent de défauts réels de ce dépôt)

1. ❌ **Ne jamais relever un plafond ni baisser un seuil** pour faire passer une garde. Cliquets
   concernés : `check:bundle`, `architecture.guard`, `i18n:scan`, `test:coverage`.
2. ✅ **Mesurer avant, mesurer après**, et publier les deux chiffres. Un correctif dont on ne peut
   pas montrer le gain est une dette de mesure, pas un progrès.
3. ✅ **Tout correctif de garde repart avec un témoin** : une sonde qui refuse un détecteur qui ne
   détecterait plus rien.
4. ✅ **Un défaut d'interface se vérifie en ouvrant l'écran**, pas en relisant le code. Deux
   défauts du 2026-09-02 (404 en anglais, `{current}` affiché tel quel) étaient invisibles à toute
   relecture et à toute gate.
5. ⚠️ **Ce dépôt a plusieurs sessions actives.** Relire le ledger avant d'appliquer une migration,
   et `git status` avant de commiter.

---

## 0. Arbitrages tranchés le 2026-09-03

**27 décisions d'Axel**, prises en une passe sur les items qui en attendaient une. Elles ne
remplacent pas les items : elles disent **quelle branche** exécuter, et chaque item garde son « fini
quand ». Une décision écrite ici fait foi contre une piste écrite dans l'item avant elle.

> 🔴 **Ce qu'un arbitrage ne dit pas.** Aucune de ces lignes n'est un statut. Elles ne disent ni que
> c'est fait, ni que c'est commencé. Elles ferment une question, ce qui est exactement ce qui
> manquait : le dépôt porte trois arbitrages ouverts depuis plus d'une semaine, et un arbitrage qui
> ne se rend pas devient un oubli.

### Ce qu'on SORT du produit

| Item | Décision | Comment |
|---|---|---|
| **C-04** | 🗑️ **Supprimer le système de jetons premium et le mur-pub Habitudes.** « Ce système est une archive du passé » | Retirer `HabitsAdGate`, `useDailyAdGate`, `addTokens`, les champs `premiumTokens` / `premiumWinStreak` / `lastTokenConsumption` du type `User`, et les deux RPC `consume_premium_token` / `credit_premium_token_from_ad`. ⚠️ `bump_win_streak` est appelée par `stripe-webhook` : la retirer du webhook **avant** de toucher au SQL. Les Habitudes deviennent gratuites pour tous, la monétisation ne repose plus que sur l'abonnement |
| **C-49** | 🗑️ **Supprimer 42 des 46 hooks orphelins** | Les 29 sélecteurs purs (`hooks.derived.ts` et `useMemo`), les 12 lecteurs à l'unité **avec leurs méthodes de repository** (`getById` n'a aucun autre appelant, mesuré), et `useCreateKRCompletion`, qui est un INSERT client libre dans un journal append-only que ce fichier interdit par ailleurs. `npm run typecheck` est la preuve qu'aucun n'était appelé |
| **C-49** | 🗑️ **Supprimer les 6 hooks d'étiquettes d'équipe, garder la table** | Une fonctionnalité entière sans écran. La table reste : un `DROP TABLE` est irréversible et une table vide ne coûte rien |
| **C-10** | 🗑️ **Supprimer `MobileScreen` et `ListRow`** | Deux primitives jamais éprouvées. Si le besoin revient, elles se réécriront contre un écran réel, seule façon de les éprouver |

### Ce qu'on GARDE, en l'écrivant

| Item | Décision | Ce qui est acté |
|---|---|---|
| **C-03** | ❄️ **Geler les clés de `habits.completions` en date machine** | Migrer supposerait de savoir dans quel fuseau était chaque personne chaque jour, ce que la base ne sait pas, et décalerait des séries que les gens ont construites. À écrire dans `CLAUDE.md` et `docs/ARCHITECTURE.md` |
| **C-09** | ❄️ **Geler le cliquet des gros fichiers** | Le budget ne bouge plus, donc rien n'empire, et un fichier se découpe quand on a de toute façon à le modifier. Fin des coupes à la ligne près que la garde provoquait |
| **C-54** | ❄️ **Le bouton « Nouveau » EST le chemin clavier de l'agenda** | On ajoute le lien d'évitement qui manque (38 tabulations aujourd'hui) et la décision part dans `ACCESSIBILITY.md`. Le motif grille de FullCalendar n'est pas adopté |

### Comment corriger, quand plusieurs voies existaient

| Item | Décision | Comment |
|---|---|---|
| **C-65** | **Annuel remboursé au prorata des mois non consommés** | Transposition littérale de la règle mensuelle. Referme l'exposition annuelle en entier, donc C-34 reste en P1 |
| **C-39** | **Propriétaire seul, et la suppression résilie et rembourse** | La RPC `delete_organization` exige le propriétaire, et le chemin de suppression appelle celui de C-65 : on résilie, on rembourse la période en cours, puis on supprime. Un seul geste, aucun débit orphelin |
| **C-53** | **Un hook unique, les surfaces avec saisie d'abord** | `useModalA11y` porte le piège de focus, la restitution au déclencheur, Échap et `role="dialog" aria-modal="true"`. Ordre : `EventModal`, `HabitModal`, les feuilles mobiles, puis le reste des 58. Radix n'est PAS généralisé |
| **C-23 · C-25** | **Les deux tokens changent, puis la gate passe en `serious`** | `--color-error` → `red-600` (4,83:1, calculé), et le bleu de marque à une teinte conforme. ⚠️ Le bleu porte l'identité visuelle : la nouvelle teinte se choisit à l'œil sur la landing avant d'être posée en token |
| **C-57** | **`TouchTarget` sur les trois routes fautives** | Cases à cocher de `/dashboard` et `/entreprise` à 44 px de zone tactile (l'icône reste petite), les 42 boutons d'`/okr` de 40 à 44. Puis une garde compte les commandes sous la cible |
| **C-41 · C-42 · C-43** | **Toast « Annuler » partout, et le libellé dit combien** | Les trois modales `add-to-list` passent par le flux de `TasksPage` (à extraire), `useRestoreEvent` sert les événements liés, et il faut écrire un `useRestoreComment` |
| **C-62** | **Fermer le tuyau, pas seulement traduire** | Les refus des repositories deviennent des identifiants métier catalogués, comme les `RAISE` du SQL ; `{{message}}` ne reçoit plus que du texte de catalogue ; une garde le verrouille avec son témoin |
| **C-46** | **Les écritures se classent avant d'être recâblées** | Silencieux pour une préférence d'affichage, **signalé** pour une donnée que la personne vient de créer. Les lectures, elles, sont du câblage direct sur `safe-json.ts` |
| **C-12** | **Couper la chorégraphie GSAP sous la ligne de flottaison** | Le hero est déjà en CSS pur. On allège ou retire les `ScrollTrigger` des sections basses, qui coûtent au chargement sans être vues. Mesure de sortie : `/` au-dessus de 90 en CI, deux passes |
| **C-13 · C-14** | **Différer Sentry après le premier rendu** | 49,3 ko sortent du chemin critique, soit quatre fois la marge actuelle. 🔴 **Angle mort créé, à combler dans la même PR** : les erreurs des premières millisecondes ne seraient plus capturées, et c'est exactement la fenêtre du bug de `Layout` du 2026-09-03. Poser un `window.onerror` minimal qui tamponne, et rejouer le tampon dans Sentry une fois chargé |
| **C-06** | **Une règle ESLint qui exige le commentaire** | Chaque `eslint-disable exhaustive-deps` doit dire pourquoi la dépendance manquante ne peut pas périmer la valeur. Le nombre ne remonte plus, les injustifiables partent en passant |
| **C-47** | **Borner la concurrence de vitest** | `maxForks` / `maxThreads` plafonnés plutôt que de laisser saturer une machine à plusieurs sessions, plus un `testTimeout` réaliste. Sortie : dix runs consécutifs, même verdict, machine chargée comprise |
| **C-38** | **Corriger les deux angles morts, avec témoin** | Le détecteur cesse de jeter ce qui suit un deux-points de ternaire (`CODE_QUOTING`), le vocabulaire s'ouvre, une sonde refuse un scanner qui ne détecterait plus rien. ⚠️ À coordonner : une autre session modifie `scripts/i18n-scan.mjs` |
| **C-31** | **Plafond serveur par IP et par compte, fenêtre glissante** | Ordre de grandeur retenu : 3 rapports / heure / compte, 10 / jour / IP. Un test montre la borne rouge avant d'être verte. Le CAPTCHA n'est pas retenu : il ne protège pas d'un appel direct à la fonction |
| **C-02** | **Mesurer en prod, puis copier le flux personnel** | Compter combien d'OKR d'équipe visent une catégorie et combien sont déjà orphelins, puis réaffecter **avant** de supprimer, comme `categoryImpact()`. L'ordre est verrouillé par un test |
| **C-27** | **Les trois parcours, plus celui du remboursement** | `FirstRunSetup`, le calendrier COSMO, les dépendances de tâches personnelles. Et C-65 touche de l'argent : il ne part pas sans son parcours E2E |
| **C-18** | **Corriger maintenant**, quand aucune autre session ne travaille dans l'arbre | `npm audit fix` sans `--force`, montée de `shadcn` à 4.20.1, puis les cinq gates rejouées derrière |
| **C-15 · C-16** | **Mesurer la concurrence avant de paginer quoi que ce soit** | Sans elle, toute décision de pagination est un pari : on ne sait pas si le coût vient du volume par compte (289 tâches au maximum mesuré) ou du nombre de sessions simultanées |

### Les deux chantiers lourds acceptés

| Item | Décision | Ce que ça engage |
|---|---|---|
| **C-20** | ✅ **Traduire les 15 pages éditoriales et ouvrir l'anglais à l'indexation** | 11 articles de blog et 4 pages cas d'usage prennent une dimension de locale, puis `en` entre dans `INDEXABLE_LOCALES` en suivant `docs/SEO.md`. ❌ Ne jamais ouvrir la locale avant le contenu. Engage aussi la **maintenance** de deux versions de chaque article |
| **C-58 · C-19 · C-60** | ✅ **Migrer vers React 19 et `react-router` 8, maintenant** | Ce n'est plus une urgence sécurité (la CVE est fermée sous React 18 depuis le 2026-07-28), c'est un choix de fond : `ref` devient une prop ordinaire, donc la classe de bug qui a coûté `Button` puis `Input`, **silencieuse par construction**, disparaît. C-60 se règle dans la même PR. ⚠️ Chantier L à séquencer **après les P0**, sur une branche, avec la suite E2E derrière. Chiffrage : `docs/MIGRATION-REACT19.md` |

---

## Sommaire

| § | Domaine | Items |
|---|---|---|
| [0](#0-arbitrages-tranchés-le-2026-09-03) | 🟢 **Arbitrages tranchés** | 27 décisions du 2026-09-03 |
| [1](#1-défauts-fonctionnels-connus) | Défauts fonctionnels connus | C-01 → C-08, C-37, C-40 → C-43, C-48, C-56, C-65, C-66 |
| [2](#2-dette-structurelle) | Dette structurelle | C-09 → C-11, C-49, C-50 |
| [3](#3-performance) | Performance | C-12 → C-14, C-67, C-68 |
| [4](#4-scalabilité) | Scalabilité | C-15 → C-16 |
| [5](#5-sécurité-et-dépendances) | Sécurité et dépendances | C-17 → C-19, C-29 → C-33, C-39, C-44 → C-46, C-58 → C-64 |
| [6](#6-i18n) | i18n | C-20 → C-22, C-38 |
| [7](#7-accessibilité) | Accessibilité | C-23 → C-25, C-51 → C-55, C-57, C-69 |
| [8](#8-tests-et-gardes) | Tests et gardes | C-26 → C-28, C-34 → C-36, C-47 |
| [9](#9-ce-qui-nest-PAS-du-code) | Ce qui n'est PAS du code | renvois |
| [10](#10-couverture--ce-que-cette-liste-ne-peut-pas-contenir) | 🔴 Couverture et audits à lancer | 2 audits restants |

---

## 1. Défauts fonctionnels connus

### C-01 · Restaurer un OKR ne restaure pas le journal de ses complétions · **P1 · M**

> ✅ corrigé le 2026-09-04 · le journal est capturé AVANT le `delete` et rejoué à la
> restauration. ⚠️ **Corrigé une seconde fois le même jour** : la première version
> appelait `getKRCompletionsRepository().create()` depuis le hook, soit exactement le
> chemin que l'arbitrage C-49 fait supprimer (« un INSERT client libre dans un journal
> append-only »). L'écriture appartient désormais au repository OKR
> (`restoreCompletions`), au même endroit que `recordKRReps`, et la borne B18 a suivi.
> Aucun code client ne touche `kr_completions`.

`kr_completions` cascade depuis `okrs` **et** `key_results`. `useRestoreOkr` ramène l'objectif, ses
KR et les `task.krId` qui les visent, mais **pas** le journal : le graphique « KR réalisés » du
tableau de bord garde son trou, définitivement. Documenté comme limite dans `CLAUDE.md` § R-08,
jamais traité.

- **Où** : `src/modules/okrs/`, `src/modules/kr-completions/`, `src/lib/restore-id.ts`.
- **Piste** : capturer les complétions dans l'instantané de suppression et les réinsérer à la
  restauration, en passant par le même chemin que `recordKRCompletion()` (jamais un INSERT client
  libre : la table est un journal append-only).
- **Fini quand** : un test qui supprime un OKR ayant N complétions, restaure, et vérifie que le
  graphique rend les mêmes N points. En démo **et** en Supabase, les deux repositories portant la
  logique.

### C-02 · Supprimer une catégorie d'ÉQUIPE n'annonce toujours pas son impact · **P1 · S**

Le finding R-02 a été refermé pour les catégories **personnelles** (`categoryImpact()` +
`useReassignCategory`, réaffectation avant suppression). Son jumeau entreprise ne l'a pas été :
`DeleteCategoryConfirm` (`src/pages/okr/`) supprime une `org_okr_categories` sans compter ce qui
la vise, et **l'impact n'a jamais été mesuré en base**.

- **Fini quand** : l'impact est mesuré en prod (combien d'OKR d'équipe pointent vers une catégorie,
  combien sont déjà orphelins), la réaffectation précède la suppression, et l'ordre est verrouillé
  par un test. ⚠️ Ne pas inverser l'ordre : supprimer d'abord laisse une fenêtre où les éléments
  pointent dans le vide.

### C-03 · Les clés de `habits.completions` ignorent le fuseau choisi · **P2 · M**

Depuis la revue R-01, la préférence de fuseau pilote le découpage des **journées** pour les tâches
(`src/lib/timezone.ts`, `dayKeyInTz`). Les habitudes, non : leurs clés restent en date **machine**
(`toLocaleDateString('en-CA')`). Quelqu'un qui règle un fuseau manuel voit donc ses habitudes
découpées autrement que ses échéances, sur le même écran.

- **Pourquoi ça n'a pas été fait en passant** : les clés sont **déjà écrites en base** sous cette
  forme. Les basculer décale tout l'historique existant. C'est une migration de données, avec la
  question « dans quel fuseau était cette personne ce jour-là » à laquelle la base ne sait pas
  répondre.
- **Fini quand** : une décision écrite (migrer, ou geler et documenter), et si migration, une
  vérification acteur par acteur dans une transaction annulée, comme les mig. 130 à 135.

### C-04 · Supprimer le système de jetons premium et le mur-pub Habitudes · **P2 · M** · 🟢 arbitré le 2026-09-03

**Le défaut d'origine** : `consume_premium_token` n'est pas câblé côté client, le mur est piloté par
un flag `localStorage` daté (`useDailyAdGate('habits')`) et non par le solde de jetons. Inoffensif
tant que `PREMIUM_ENFORCED` vaut `false` ; le jour où le drapeau passe à `true`, c'est un
**contournement de paywall en une manipulation** pour 10 000 comptes gratuits, et un jeton crédité
ne sert à rien.

🟢 **Décision d'Axel du 2026-09-03 : on ne le câble pas, on le supprime.** *« Ce système est une
archive du passé, supprime-le afin de ne pas complexifier le code avec des choses inutiles. »* Les
Habitudes deviennent gratuites pour tout le monde, et la monétisation ne repose plus que sur
l'abonnement.

**Ce que la suppression emporte, dans cet ordre :**

1. **Le client** : `HabitsAdGate`, `useDailyAdGate` (`src/lib/hooks/use-daily-ad-gate.ts`), la clé
   `cosmo_adwall_habits`, `addTokens` dans `billing.context`, et les champs `premiumTokens` /
   `premiumWinStreak` / `lastTokenConsumption` du type `User`. ⚠️ Ces trois champs sont nommés dans
   les garde-fous de `CLAUDE.md` (règle N5) : la règle disparaît avec eux, elle ne devient pas fausse.
2. 🔴 **Le webhook AVANT le SQL.** `stripe-webhook` appelle `bump_win_streak`. Retirer la fonction
   SQL d'abord ferait échouer un event Stripe en production, donc une re-livraison en boucle. On
   retire l'appel, on redéploie la fonction, **et seulement ensuite** on écrit la migration.
3. **Le SQL** : `consume_premium_token`, `credit_premium_token_from_ad`, `bump_win_streak`, et les
   colonnes de `subscriptions` qui ne servent plus qu'à elles. ⚠️ Une colonne se supprime dans une
   migration numérotée, jamais depuis le dashboard.
4. **Les textes** : les clés de catalogue du mur-pub, en `fr` et en `en`.

- **Fini quand** : `grep` ne rend plus aucune occurrence de `premiumTokens`, `adwall`,
  `consume_premium_token` ni `bump_win_streak` dans `src/` et `supabase/`, la migration est
  appliquée et vérifiée, `stripe-webhook` est redéployée **avant** elle, et `npm run typecheck`
  passe. ❌ Ne pas retirer `PREMIUM_ENFORCED` au passage : ce drapeau garde les statistiques
  premium et la route `/premium`, qui ne sont pas dans ce périmètre.

### C-05 · Le badge d'organisation lit jusqu'à 1 000 tâches d'équipe pour afficher un nombre · **P2 · S**

Identifié le 2026-08-27, explicitement laissé « non engagé ». Le rechargement a été coupé
(`useTeamTasks` a gagné `background`), **la lecture pas**. C'est la lecture la plus chère du produit
(§2 de `SCALABILITY.md`), montée par `Layout`, donc sur toutes les pages protégées.

- **Fini quand** : le compte vient du serveur (RPC de comptage, ou champ agrégé), l'écran affiche le
  même nombre qu'avant, et la trace `edge_logs` d'une vraie session le prouve.

### C-06 · 36 `eslint-disable react-hooks/exhaustive-deps`, dans 28 fichiers · **P2 · L**

Compté à `HEAD`. Chacun est une dépendance retirée à la main, donc une **fermeture potentiellement
périmée** : c'est la famille de bug qui produit un écran qui ne se rafraîchit pas, en silence, et le
dépôt en a déjà rencontré plusieurs.

- **Ce n'est pas 36 bugs**, c'est 36 endroits **non éprouvés**. Certains sont légitimes (`TodayTasks`
  porte déjà sa justification en commentaire).
- **Fini quand** : chaque occurrence est soit supprimée (dépendances honnêtes, `useEvent` ou `ref`),
  soit accompagnée d'un commentaire disant **pourquoi** la dépendance manquante ne peut pas périmer
  la valeur. Une règle ESLint peut ensuite exiger le commentaire.

### C-07 · 17 feuilles animées encore écrites à la main · **P2 · M**

Invariant **explicitement non tenu** (`ARCHITECTURE.md` §1) : « aucune position d'arrivée portée par
une animation de transform ». Les 5 réellement cassées sous `prefers-reduced-motion` ont été
corrigées et un cliquet interdit la récidive, mais 17 feuilles n'utilisent toujours pas
`useSheetMotion()` / `useSheetDrag()` (8 fichiers seulement les consomment).

- **Rappel du coût** : `MobileMoreSheet` s'ouvrait à **0 px visible** chez un utilisateur en
  mouvement réduit, et c'est le seul accès mobile à OKR, Statistiques, Paramètres et déconnexion.
- **Fini quand** : les 17 passent par les helpers, et la mesure se fait **panneau navigateur
  affiché** (dans un onglet caché, `requestAnimationFrame` ne tourne pas et le harnais rend un
  rapport « tout est cassé » parfaitement convaincant, cf. la rétractation du 2026-08-27).

### C-08 · Deux dettes Stripe à payer AVANT la bascule live · **P1 · S**

Les deux sont du code, et les deux tombent pile pendant le basculement (T-36) :

1. **Remise à zéro des identifiants Stripe en base.** `stripe-org-checkout` et `stripe-org-portal`
   réutilisent `stripe_customer_id` / `stripe_subscription_id` tels quels ; un identifiant du compte
   de TEST présenté à une clé live répond 404, donc 500. Les tables sont vides aujourd'hui, le coût
   est nul : c'est le moment le moins cher.
2. **Le cache `productIndex` n'est jamais invalidé** (`resetProductIndex` n'a aucun appelant hors
   test, `supabase/functions/_shared/org-stripe-prices.ts`). Un isolate Deno survit longtemps : après
   une rotation des secrets de prix, il continue d'indexer les anciens produits.

- **Fini quand** : un script de bascule (ou une migration) vide les deux colonnes, et le cache porte
  une invalidation par TTL ou par version de secret.

### C-37 · Six « Annuler » de `src/components` rendent l'objet sous un NOUVEL identifiant · **P1 · M**

> ✅ corrigé le 2026-09-04 · les cinq chemins tâche passent par `useRestoreTask`, `useRestoreHabit` est créé. Garde vue ROUGE sur exactement les cinq fichiers.

Le correctif R-08 du 2026-09-02 a créé `splitRestore` et les cinq `useRestoreX`, puis s'est arrêté
à `src/pages`. Les chemins d'annulation qui vivent dans `src/components` écrivent toujours le motif
que `src/lib/restore-id.ts` documente comme fautif, en toutes lettres, à sa ligne 9 :

```ts
const { id: _id, createdAt: _ca, ...rest } = snapshot;   // l'identifiant est JETÉ
createMutation.mutate(rest);
```

Six occurrences, toutes derrière un toast « Annuler » :

| Fichier | Ligne | Ce qui casse |
|---|---|---|
| `TaskTable.tsx` | 368 | suppression unitaire d'une tâche |
| `TaskTable.tsx` | 455 | suppression en LOT (chaque tâche revient sous un id neuf) |
| `task-modal/useTaskModal.ts` | 592 | suppression depuis la modale de tâche |
| `TaskSidebar.tsx` | 147 | suppression depuis le menu contextuel de la barre latérale |
| `TodayTasks.tsx` | 94 | suppression depuis « Aujourd'hui » |
| `HabitCard.tsx` | 39 | suppression d'une habitude |

**Pourquoi ça compte** : `useRestoreTask` existe déjà et n'est appelé que depuis `AgendaPage`. Les
cinq chemins TÂCHE ci-dessus perdent donc les rattachements aux listes (`lists.taskIds`) et le
`krId`, exactement ce que le commentaire de `restore-id.ts` annonce comme réparé. Le cas du LOT est
le pire : quelqu'un qui supprime dix tâches puis annule récupère dix tâches détachées de toutes ses
listes, sans qu'aucune erreur ne s'affiche.

⚠️ `HabitActionsMenu.tsx:207` et `useAgendaEventActions.ts:108` écrivent le même motif **et c'est
juste** : ce sont des DUPLICATIONS, pas des annulations. Ne pas les « corriger ».

- **Où** : les six lignes ci-dessus, `src/modules/habits/` (pas de `useRestoreHabit` à ce jour).
- **Fini quand** : les cinq chemins tâche passent par `useRestoreTask`, un `useRestoreHabit` existe
  et `HabitCard` l'utilise, et un test refuse le retour du motif dans `src/components` (le témoin
  doit lister les deux duplications légitimes, sinon il redeviendra faux).

### C-40 · Douze écrans affichent « il n'y a rien » pendant le premier chargement · **P2 · S**

> 🟠 SEPT corrigés le 2026-09-04, et **cinq écartés après relecture** : ils ne mentent pas (deux rendent `null`, deux ne choisissent qu'une date ou un groupement, `useTaskModal` teste une validation de formulaire). Le chiffre de douze était une sur-mesure.

`const { data: x = [] } = useX()` sans lire `isLoading`, suivi d'un état vide sur `x.length === 0` :
l'écran affirme une absence alors qu'il ne sait pas encore. Détecté par sonde (avec témoin), 12
occurrences dans `src/components` :

`HabitGlobalTracking`, `HabitTable`, `InboxMenu`, `ShareListSheet`, `add-to-list/DesktopAddToList`,
`organization/InviteFriendsToOrg`, `organization/OrgNotificationsBell`,
`organization/TeamAssigneeGroups`, `organization/TeamProjectsTab`,
`organization/TeamSubtasksSection`, `organization/TeamsSection`, `task-modal/useTaskModal`.

Trois vérifiées à la lecture du rendu : `ShareListSheet` dit « Ajoute d'abord un ami pour partager
une liste » à quelqu'un qui en a, `InviteFriendsToOrg` dit la même chose, `TeamsSection` annonce
« aucune équipe » sur l'aperçu entreprise. `OrgNotificationsBell` rend `null` : c'est le
comportement correct, il ne ment pas.

- **Fini quand** : chaque cas rend un squelette ou rien tant que `isLoading`, et la sonde est
  versionnée en test de garde.

### C-41 · Supprimer une liste depuis les trois modales « Ajouter à une liste » n'a ni annulation ni impact annoncé · **P2 · S**

> ✅ corrigé le 2026-09-04 · flux `useDeleteListWithUndo` partagé par les trois écrans. ⚠️ `BulkAddToListModal` ne supprime aucune liste, contrairement à l'énoncé.

Deux composants pour le même geste, avec deux garanties différentes. `TasksPage.deleteListById`
supprime avec un « Annuler » qui restaure l'identifiant **et** repose `taskIds` (le commentaire y
explique pourquoi). `add-to-list/DesktopAddToList.tsx:82`, `MobileAddToList.tsx:102` et
`BulkAddToListModal` appellent `deleteListMutation.mutate(listId)` nu : pas de toast d'annulation,
pas de comptage des tâches concernées dans la confirmation.

- **Fini quand** : les trois modales appellent le même flux que `TasksPage` (à extraire), et la
  confirmation dit combien de tâches sont dans la liste.

### C-42 · Un commentaire d'équipe se supprime en un clic, sans confirmation ni annulation · **P2 · XS**

> ✅ corrigé le 2026-09-04 · toast « Annuler » + `useRestoreComment`, conformément à l'arbitrage. **L'horodatage est restauré aussi** : sans lui le commentaire reviendrait à la fin du fil.

`organization/TaskCommentsSection.tsx:149` : `onClick={() => deleteMutation.mutate(c.id)}`. Aucune
confirmation, aucun « Annuler », et le commentaire disparaît pour toute l'équipe. C'est la seule
suppression du mode entreprise sans aucun filet.

- **Fini quand** : confirmation ou toast « Annuler », au choix, mais l'un des deux.

### C-43 · « Supprimer l'événement lié » supprime N événements sans rien demander ni rien dire · **P2 · S**

> ✅ corrigé le 2026-09-04 · le libellé dit combien, et « Annuler » les rend par `useRestoreEvent`.

`TaskSidebar.tsx:153` : une entrée de menu contextuel, un `linked.forEach(ev => deleteEventMutation.mutate(ev.id))`,
pas de confirmation, pas de comptage, pas de toast de succès, pas d'annulation. L'agenda fait
l'inverse au même endroit du modèle : `useAgendaEventActions` propose `restoreEvent(master)` et
commente pourquoi l'identifiant doit revenir.

- **Fini quand** : le libellé dit combien d'événements partent, et un « Annuler » les restaure par
  `useRestoreEvent`.

### C-48 · Un refus de dépendance de tâche dit deux choses différentes, aucune lisible · **P2 · S**

> ✅ corrigé le 2026-09-04 (mig. **137**, NON APPLIQUÉE) · quatre identifiants catalogués, chemin ÉQUIPE compris. Table de transition pour que le correctif marche avant l'application, à retirer ensuite.

Le trigger de la mig. 132 refuse un cycle par `RAISE EXCEPTION 'This dependency would create a
cycle'`, et `LocalStorageTasksRepository.addDependency` lève la **même phrase anglaise en dur**,
par souci de parité. Le hook `useAddTaskDependency` justifie ce choix en commentaire : on remonte
le message tel quel plutôt qu'une erreur anonyme, parce que l'utilisateur peut agir sur un cycle.
**Les deux modes contredisent cette phrase, chacun à sa façon** :

- **En production**, `normalizeApiError` ne promeut un message serveur en code métier que s'il
  matche `BUSINESS_CODE_RE` (`^[a-z][a-z0-9_]{2,49}$`). Une phrase avec des espaces et des
  majuscules ne matche pas : le refus retombe sur le message générique. Ce qu'on voulait surtout
  ne pas perdre est **exactement ce qui est perdu**.
- **En mode démo**, aucun `normalizeApiError` sur ce chemin : la phrase anglaise arrive telle
  quelle dans le gabarit français. Un utilisateur francophone lit
  « **Dépendance impossible : This dependency would create a cycle** ».

- **Mesuré** (audit A-2, sondes rejouées) :
  `normalizeApiError({ code: 'P0001', message: 'This dependency would create a cycle' }).message`
  ne contient pas le mot « cycle » ; et `repo.addDependency(b, a)` après `addDependency(a, b)`
  rejette bien sur la phrase anglaise brute.
- **Où** : `supabase/migration/132_*.sql` (3 `RAISE`), `src/modules/tasks/local.repository.ts`
  (`addDependency`), `src/modules/tasks/hooks.ts` (`useAddTaskDependency`),
  `src/lib/normalizeApiError.ts`, `src/locales/{fr,en}/errors.json`.
- **Piste** : faire dire aux trois `RAISE` des **identifiants** (`dependency_cycle`,
  `dependency_cross_account`, `dependency_task_missing`) plutôt que des phrases — c'est la
  convention que `normalizeApiError` sait déjà relayer — les cataloguer en `api.*`, et faire lever
  les mêmes identifiants au repository local. ⚠️ Une migration qui change un message de `RAISE` se
  relit contre tous les appelants du trigger avant d'être appliquée.
- **Fini quand** : les deux repositories refusent par le même identifiant, les trois sont
  catalogués en `fr` et en `en`, et un test vérifie qu'un utilisateur francophone lit une phrase
  française **dans les deux modes**. ❌ Ne pas se contenter de traduire la chaîne du repository
  local : les deux chemins doivent converger, sinon la divergence revient au prochain message.

### C-56 · Clavier ouvert, le haut de trois écrans devient inatteignable · **P2 · S**

> 🟠 corrigé le 2026-09-04, mais **UN SEUL des trois écrans était cassé**. Remesuré à 375×350 dans l'application : `BugReportModal` et `InviteOrJoinModal` rendaient déjà +16 px, leur carte portant `my-auto`. Seul `FirstRunSetup` l'était (-55,8 px). Les trois passent au motif « scroll dehors, centrage `min-h-full` ».

Trouvé par l'audit **A-4**. Trois surfaces partagent la même classe de conteneur, et les trois sont
des **formulaires**, donc les trois ouvrent le clavier :

| Composant | Rôle |
|---|---|
| `src/components/onboarding/FirstRunSetup.tsx:119` | l'accueil d'un compte neuf, monté dans `Layout` donc mobile aussi |
| `src/components/BugReportModal.tsx:147` | signaler un bug, y compris depuis un compte cassé |
| `src/components/organization/InviteOrJoinModal.tsx:115` | rejoindre ou créer une organisation |

```
fixed inset-0 … flex items-center justify-center … overflow-y-auto p-4
```

`align-items: center` **plus** `overflow-y: auto` est le piège CSS classique : quand l'enfant est
plus haut que le conteneur, le débordement se répartit **des deux côtés**, et la partie qui sort par
le haut n'entre pas dans `scrollHeight`. Aucun défilement ne peut la ramener, `scrollTop` étant
borné à zéro.

**Mesuré le 2026-09-03**, dans le navigateur, avec le CSS réel du projet et la liste de classes de
`FirstRunSetup`, viewport **375 × 350** (la hauteur que prend le viewport de mise en page d'un
téléphone Android quand le clavier est ouvert) :

| Grandeur | Valeur |
|---|---|
| hauteur de la carte | 457,6 px |
| hauteur du conteneur | 350 px |
| `scrollHeight` / course de défilement utile | 420 px / **70 px** |
| haut de la carte à `scrollTop = 0` | **-28,8 px** |
| haut de la carte à `scrollTop` maximal | -98,4 px |

**Scénario d'échec** : quelqu'un s'inscrit sur un téléphone Android, le champ de la première
question prend le focus (`autoFocus`), le clavier s'ouvre. Le titre, le compteur d'étape et **la
question à laquelle il est en train de répondre** sont au-dessus du bord haut, et aucun geste ne les
ramène. Le bouton « Continuer », lui, reste atteignable (mesuré à 309,6 px après défilement) : la
personne peut donc valider un formulaire dont elle ne voit plus l'intitulé.

- ⚠️ **Le mécanisme n'est pas le même sur les deux plateformes**, et ceci n'a pas été joué sur un
  appareil : Android réduit le viewport de mise en page (ce que la mesure ci-dessus modélise), iOS
  Safari ne le réduit pas et fait défiler la page à la place. Le finding est donc **établi pour
  Android, à confirmer pour iOS**, cf. `a-faire-manuel.md` §7, M-25.
- **Piste** : remplacer `items-center` par `items-center` + `my-auto` sur l'enfant, ou passer le
  conteneur en `items-start` avec une marge automatique. Les deux rendent le débordement
  entièrement accessible au défilement, et le centrage survit tant que la carte tient.
- **Fini quand** : les trois conteneurs sont corrigés, et un test mesure qu'à 375 × 350 le haut de
  la carte est atteignable (`scrollTop = 0` donne un `top >= 0`), vu **rouge** avant d'être vert.

### C-65 · Le remboursement du mois en cours n'existe nulle part dans le code · **P1 · M**

**Décision d'Axel du 2026-09-03** : *« l'utilisateur doit pouvoir se faire rembourser le mois en
cours à tout moment, mais que le mois en cours »*. Prise pour ne pas avoir à arbitrer au cas par cas,
et c'est le bon calcul : sur un abonnement **mensuel**, rembourser le mois en cours est **exactement**
le remède que l'art. L215-1 accorde au consommateur qu'on n'a pas prévenu de sa reconduction. La
règle commerciale recouvre donc l'obligation légale, au lieu de s'y ajouter.

🔴 **Une règle sans mécanisme est une phrase.** Aujourd'hui le produit n'a **aucun** chemin de
remboursement : `stripe-org-portal` ouvre le portail Stripe, qui sait résilier mais **ne rembourse
pas**, et aucune fonction n'appelle `refunds.create`. Tant que la personne doit écrire un e-mail
pour obtenir ce qu'on lui promet, on est exactement dans la situation que la décision voulait
éviter : une discussion, au cas par cas.

**Ce qu'il faut écrire :**

1. **Un bouton, pas une adresse e-mail.** Dans la vue de facturation (`OrgBillingTab`, et son
   équivalent particulier) : « Résilier et être remboursé de la période en cours ». Self-service,
   sans motif, sans confirmation humaine.
2. **Une Edge Function `stripe-refund-current-period`.** Propriétaire uniquement (même contrôle que
   `stripe-org-checkout`), `refunds.create` sur le `payment_intent` de la **dernière** facture payée,
   puis `subscriptions.cancel` immédiat (pas `cancel_at_period_end` : on rembourse, donc l'accès
   s'arrête).
3. **Une borne, sinon c'est un robinet.** Une seule période remboursable, la dernière payée, une
   seule fois. La garde est une **clé d'idempotence** dérivée de l'`invoice_id`, pas un booléen en
   base. Même famille que le pré-contrôle d'idempotence du webhook, avec la même règle : une lecture
   qui décide d'un routage ne doit jamais avaler son erreur, on fait retenter plutôt que deviner.
4. **Une ligne compensatoire dans `payment_records`.** ❌ Jamais une modification de la ligne
   d'origine : la table est scellée par `row_hash` et `verify_payment_chain()` recalcule chaque hash.
   Un remboursement s'écrit comme en comptabilité, par une écriture de sens inverse.
5. **Le texte, quelque part où on peut le lire.** Une garantie **plus favorable** que la loi
   n'appelle pas le préavis de 30 jours de l'article 11 des CGU (il protège contre une dégradation),
   mais elle doit être écrite, sans quoi personne ne sait qu'elle existe et elle ne désamorce rien.

⚠️ **L'annuel n'est pas couvert par l'énoncé, et c'est le seul angle mort de la décision.** Sur un
abonnement annuel (168 / 420 / 840 / 1 680 €), la reconduction est annuelle : « le mois en cours »
ne désigne rien, et le remède légal porte sur **tout ce qui a été versé depuis l'anniversaire**,
jusqu'à douze mois. Deux sorties, à trancher :

- **(a) le prorata**, retenu par défaut ici : on rembourse les mois entamés non consommés. C'est la
  transposition littérale de la règle mensuelle, et elle referme l'exposition annuelle en entier.
- **(b) un mois seulement** sur l'annuel : moins cher, mais l'écart entre ce qu'on offre et ce que
  la loi accorde reste ouvert, et il faut alors que l'avis de reconduction annuel parte vraiment
  (C-34, C-35), ce qui remet la mécanique de cron sur le chemin critique.

- **Où** : `supabase/functions/stripe-refund-current-period/` (à créer),
  `supabase/functions/_shared/`, `src/modules/billing/`,
  `src/components/organization/OrgBillingTab.tsx`, `src/locales/{fr,en}/`, les CGU (`legal`).
- **Fini quand** : un remboursement se déclenche depuis l'écran, la ligne compensatoire est écrite,
  `verify_payment_chain()` reste vraie, un second appel sur la même période est refusé, et un test
  couvre les trois : le cas nominal, le rejeu, et la période déjà remboursée. ❌ Ne pas livrer le
  bouton avant la borne : un remboursement rejouable est une perte d'argent, pas un défaut d'UX.

### C-66 · Quatre capacités d'équipe ont leur back-end, leur permission et leur trigger, et aucun écran · **P2 · M**

**Trouvé le 2026-09-03 en mesurant C-49**, et c'est le vrai résultat de cette mesure : sur les 46
hooks sans consommateur, cinq sont des **mutations**. Un hook de lecture sans écran est du code mort ;
une mutation sans écran est une **fonctionnalité qui n'a jamais été branchée**.

| Hook orphelin | Ce qui manque au produit | Ce qui existe déjà côté serveur |
|---|---|---|
| `useArchiveTeamProject` | **Un projet d'équipe ne peut pas être archivé** | Le droit `project.delete` et le trigger `enforce_team_project_archive_scope`, écrits pour ce geste précis |
| `useUpdateTeamOKR` | On peut **créer et supprimer** un OKR d'équipe, jamais le **modifier** | `TeamOKRModal` monte `useCreateTeamOKR`, `TeamOKRTab` monte `useDeleteTeamOKR`. Le troisième n'a jamais été monté |
| `useUpdateTeamCategory` | Une catégorie d'équipe ne peut pas être **renommée** | `TeamCategoryPicker` monte `useCreateTeamCategory` et `useTeamCategories` |
| `useDeleteTeamCategory` | Une catégorie d'équipe ne peut pas être **supprimée** | idem. Cousin de C-02, qui traite l'impact de la suppression sans qu'aucune suppression existe |

**Comment c'est établi** : recherche des consommateurs de chaque hook dans `src/components` et
`src/pages`, hors tests et hors barils. `useArchiveTeamProject` rend zéro fichier ; les trois autres
rendent leurs jumeaux `create` et `delete`, jamais eux-mêmes.

- ⚠️ **Ce n'est pas un bug**, et il ne faut pas le compter comme tel : rien ne casse, personne ne
  voit d'erreur. C'est un trou de parcours, et il ne se voyait pas parce que le code du chemin
  existe : à la lecture, tout est là.
- **Arbitrage rendu le 2026-09-03** (§0) : les 42 autres orphelins sont supprimés, **ces quatre-là
  ne le sont pas**. Ils deviennent cet item.
- **Fini quand** : chacun des quatre gestes est atteignable depuis l'interface et vérifié **dans le
  navigateur**, ou l'un d'eux est explicitement abandonné avec sa raison écrite, son hook supprimé,
  et sa méthode de repository avec.

---

## 2. Dette structurelle

### C-09 · 12 fichiers au-dessus de 600 lignes, budget 9 190 · **P2 · XL**

Invariant non tenu depuis juin 2026. Le cliquet ne fait que **rétrécir**, et c'est déjà ça, mais les
quatre dernières passes étaient des **compensations imposées par la garde**, pas de
l'assainissement : aucun god component n'a disparu depuis le 2026-08-29.

| Fichier | LOC |
|---|---|
| `src/components/organization/PyramidTab.tsx` | 1 046 |
| `src/pages/AgendaPage.tsx` | 900 |
| `src/components/TaskTable.tsx` | 890 |
| `src/pages/SettingsPage.tsx` | 850 |
| `src/components/InboxMenu.tsx` | 802 |
| `src/components/task-modal/useTaskModal.ts` | 719 |
| `src/pages/TasksPage.tsx` | 712 |
| `src/modules/team-projects/local.repository.ts` | 710 |
| `src/components/task-modal/DesktopDetailsStep.tsx` | 703 |
| `src/components/task-modal/TaskModalMobileBody.tsx` | 698 |
| `src/components/organization/TeamTaskModal.tsx` | 685 |
| `src/pages/tasks/TaskListsBar.tsx` | 616 |

- **Fini quand** : la liste `KNOWN_OVERSIZED` est vide. Chaque sortie doit être une **frontière
  réelle** (un composant extrait qui ne connaît pas le domaine de son parent), jamais une coupe à la
  ligne près, et le budget baisse du nombre de lignes sorties, sinon le mou est distribué aux autres.

### C-10 · Deux primitives livrées sans aucun consommateur · **P3 · S**

`MobileScreen` et `ListRow` (`ARCHITECTURE.md` §1, `MOBILE.md`). Ce n'est pas seulement inutile :
c'est **non éprouvé**. `MobileHeader` n'avait jamais fonctionné en un mois d'existence, sur la seule
page qui l'utilisait.

- **Fini quand** : soit elles sont adoptées et vérifiées sur un écran réel, soit elles sont
  supprimées.

### C-11 · Le picker natif n'a pas de test de non-régression sur les six surfaces · **P3 · S**

> ✅ fait le 2026-09-04 · `src/date-picker.guard.test.ts`, les deux `EventModalForm` nommées une par une, avec un témoin qui refuse une dispense périmée.

Le calendrier COSMO a remplacé le picker natif sur six surfaces le 2026-08-30, vérifié **à la main
dans le navigateur**. Rien n'empêche un `input type="date"` de revenir.

- **Fini quand** : une garde compte les `input[type=date]` de `src/` et n'autorise que les deux
  d'`EventModalForm`, avec la raison en commentaire.

### C-49 · 52 des 206 hooks exportés par `src/modules` n'ont aucun consommateur · **P3 · M**

Compté à `HEAD` par un balayage qui ignore les fichiers de test et les barils `index.ts`, et
**validé par témoin** : les hooks connus comme vivants (`useTasks`, `useHabits`, `useEvents`,
`useOkrs`, `useCreateTask`, `useActiveOrganization`) rendent 7 à 27 fichiers consommateurs, là où
les 52 ci-dessous n'apparaissent que dans leur déclaration et dans le baril qui les réexporte.

**Un quart de la surface publique des modules n'est jamais exécuté.** Ce n'est pas seulement du
poids : c'est du code **non éprouvé**, la famille exacte de C-10 (`MobileScreen`, `ListRow`) et de
`MobileHeader`, qui n'avait jamais fonctionné en un mois sur la seule page qui le montait.

Le cas le plus net est une **fonctionnalité entière** : les étiquettes d'équipe, six hooks
(`useTeamLabels`, `useTeamTaskLabels`, `useCreateTeamLabel`, `useUpdateTeamLabel`,
`useDeleteTeamLabel`, `useToggleTaskLabel`), leurs clés React Query, leurs deux repositories et
leur table. Aucun écran ne les monte.

<details><summary>Les 52</summary>

`useArchiveTeamProject` · `useAtRiskOkrs` · `useBookmarkedTasks` · `useCategory` ·
`useCategoryNames` · `useCompletedKeyResults` · `useCompletedOkrs` · `useCompletedTasks` ·
`useCreateKRCompletion` · `useCreateTeamLabel` · `useDeleteTeamCategory` · `useDeleteTeamLabel` ·
`useEvent` · `useEventsByDate` · `useEventsByTask` · `useFilteredOkrs` · `useFilteredTasks` ·
`useFriendCount` · `useHabit` · `useHabitStats` · `useHabitsByFrequency` ·
`useHabitsNeedingAttention` · `useHabitsWithStats` · `useKeyResults` · `useList` ·
`useListsForTask` · `useMyTaskShares` · `useOkr` · `useOkrStats` · `useOkrsByCategory` ·
`useOkrsByStatus` · `useOkrsEndingSoon` · `useOkrsWithProgress` · `useSearchTasks` ·
`useTaskLookup` · `useTaskStats` · `useTasksByCategory` · `useTasksByDate` ·
`useTasksByPriority` · `useTasksByStatus` · `useTasksDueWithinDays` · `useTasksInPriorityRange` ·
`useTeamLabels` · `useTeamTaskActivity` · `useTeamTaskLabels` · `useTodaysHabitStatus` ·
`useTodaysTasks` · `useToggleTaskLabel` · `useUIState` · `useUpdateTeamCategory` ·
`useUpdateTeamLabel` · `useUpdateTeamOKR`

</details>

- **Nuance à ne pas perdre** : quelques-uns sont des **capacités d'interface assumées**, adossées
  à une note écrite (les `getPage` de la pagination, étape 3). Ceux-là se gardent **avec leur
  justification**, jamais par défaut.
🟢 **Arbitré le 2026-09-03** (§0), après avoir mesuré que les 52 ne sont pas une population mais
**quatre** : 6 hooks d'étiquettes d'équipe, **29 sélecteurs purs** (`useMemo` sur une donnée déjà
chargée, zéro requête, zéro repository touché), **12 lecteurs à l'unité** (qui emportent leur méthode
de repository, `getById` n'ayant **aucun** autre appelant, vérifié), et **5 mutations sans écran**.

- **48 partent** : les 6 étiquettes, les 29 sélecteurs, les 12 lecteurs avec leurs méthodes dans les
  **deux** repositories, et `useCreateKRCompletion`, qui est un INSERT client libre dans un journal
  append-only que ce dépôt interdit par ailleurs. La table des étiquettes, elle, **reste**.
- **4 restent, et changent de nature** : ce sont des écrans manquants, pas des orphelins. Ils
  deviennent **C-66**.
- **Fini quand** : les 48 sont supprimés, `npm run typecheck` confirme qu'aucun n'était appelé, et
  une garde compte les orphelins pour que le chiffre ne remonte pas. Le balayage doit embarquer son
  **témoin**, sinon il finira par ne plus rien détecter.

### C-50 · Quatre fabriques de clés React Query survivent à la mig. 129 sans porter de donnée · **P3 · XS**

> ✅ fait le 2026-09-04 · les quatre fabriques supprimées, `typecheck` confirme qu'elles n'avaient aucun appelant.

`orgKeys.joinRequests`, `orgKeys.mySentRequest`, `orgKeys.myInvitations` et
`orgKeys.myRemovalNotices` (`src/modules/organizations/constants.ts`) n'ont **plus aucun lecteur ni
aucun invalidateur** depuis que la boîte de réception a été fondue en une clé unique.

C'est précisément le piège que la note de la mig. 129 décrit : invalider une ancienne sous-clé ne
rafraîchit plus rien, **en silence**. Tant qu'elles restent exportées, elles sont disponibles pour
la prochaine mutation qu'on écrira, et l'erreur ne se verra pas.

- **Fini quand** : les quatre sont supprimées, `orgKeys.inbox()` reste la seule clé de la boîte de
  réception, et `npm run typecheck` confirme qu'elles n'avaient effectivement aucun appelant.
  ⚠️ Ne pas toucher à `orgKeys.pendingSentInvitations`, qui est vivante
  (`usePendingSentInvitations`).


---

## 3. Performance

### C-12 · T-51 · la landing est la seule page lente du site · **P2 · M**

Mesuré en CI le 2026-09-02 (deux passes) : `/` à **56-63** de performance, TBT **546 à 1 633 ms**,
contre 96-98 sur toutes les autres pages du même build.

- **Le coupable est nommé, et ce n'est pas un chunk** : `vendor-animation` coûte 11 675 à 11 992 ms
  de bootup sur `/`, et **228 à 270 ms sur `/guide/`**, soit 40× moins. Le correctif est dans la
  page, dans la quantité de travail qu'elle demande, pas dans le découpage.
- **Fini quand** : `/` dépasse 90 en CI sur deux passes, et le job `lighthouse` le prouve. ⚠️ La
  mesure **locale ne vaut rien** ici (la charge machine domine, la landing et le guide y rendent le
  même score) : toute attribution vient du runner.

> 🔴 **Corrigé le 2026-09-03 par l'audit A-8, et c'est la puce ci-dessus qui était fausse.**
> « Le coupable est nommé » l'était par une attribution de Lighthouse qui, par construction, met le
> style et le paint déclenchés par une animation sous le fichier de la **bibliothèque** d'animation.
> Mesuré : couper les **23** ScrollTrigger et les **8** tweens infinis de la page ne déplace pas la
> mesure d'un point. Le coût réel est ailleurs, il est nommé en **C-67**, et il n'a rien à voir avec
> un chunk ni avec une bibliothèque.
>
> ✅ **La cause a été corrigée le 2026-09-03** (C-67, fond du hero cuit) : la page ne bloque plus
> **rien** au repos, 2 856 ms → 0 ms sur le build de prod. **Cet item reste ouvert quand même**, et
> c'est volontaire : il porte un SCORE, et un score ne se constate que sur le runner. Tant que le
> job `lighthouse` n'a pas rendu deux passes au-dessus de 90, on sait que le travail au repos a
> disparu, pas que la page est passée. Relève : `a-faire-manuel.md` **M-39**.

### C-13 · T-47 · trancher `vendor-sentry` sur le chemin critique · **P3 · S**

49,3 ko gzip payés par tout visiteur. La conclusion « le différer ne rendrait rien » a été
**rétractée le 2026-09-02** : elle venait d'une mesure structurellement aveugle à Sentry. La
question est donc rouverte, et **maintenant mesurable**.

- **Fini quand** : une décision écrite, appuyée sur une mesure prise avec `VITE_SENTRY_DSN` posée.

### C-14 · Le budget d'entrée est DÉPASSÉ, de 0,1 ko · **P1 · M**

> ✅ **Refermé le 2026-09-04, DEUX fois** — la première n'a pas tenu.
>
> Passe 1 : 78 031 → 77 966 o, en retirant du mort (trois codes d'API LLM que
> COSMO n'appelle pas, et `common.moduleOnboarding`, dont la fonctionnalité a
> été supprimée le 2026-08-23). La cause du rouge était mon propre lot de
> catalogue, isolée en rejouant le build avec les `errors.json` d'avant.
>
> Passe 2 : trois cles EAGER de plus (C-39, C-42) ont repassé la ligne. Le
> grignotage de clés mortes n'a rendu que 15 o — gzip compresse très bien des
> chaînes voisines. Le gain est venu d'un découpage : la section `csv` vivait
> dans `common`, l'un des DEUX catalogues du chunk d'entrée, et ses 1,4 ko
> bruts partaient chez tout visiteur pour un geste qu'on n'atteint que depuis
> Réglages → Données. Elle devient un namespace à part, déclaré sur les deux
> routes que `i18n:namespaces -- --pages` nomme. **77 556 o, 444 de marge.**
>
> ❌ Le plafond n'a pas bougé. ⚠️ La marge reste inférieure aux 5 % que
> demande l'énoncé : l'item n'est PAS clos, il est repassé au vert.
>
> 🔴 **Le levier DÉCIDÉ n'a pas été tiré.** L'arbitrage du 2026-09-03 tranche
> pour **différer Sentry après le premier rendu** (49,3 ko hors du chemin
> critique, « quatre fois la marge actuelle »), avec son angle mort à combler
> dans la même PR : un `window.onerror` minimal qui tamponne et rejoue dans
> Sentry une fois chargé — précisément la fenêtre du bug de `Layout` du
> 2026-09-02. Rien de tout ça n'est fait. Ce qui précède est un **dépannage**
> qui a rendu le vert, pas l'exécution de la décision, et il ne dispense pas
> de la tirer : les 444 o regagnés ne sont pas les 49,3 ko attendus.

**Remesuré le 2026-09-03** sur le build de prod (avec `VITE_SENTRY_DSN`, sinon la garde pèse un
artefact qui n'existe nulle part) :

| | Mesure | Plafond | Marge |
|---|---|---|---|
| Chemin critique (8 chunks) | 366,8 ko | 370,0 ko | 3,2 ko |
| **Chunk d'entrée** | **78,1 ko** | **78,0 ko** | **−0,1 ko, rouge** |

⚠️ Les deux plafonds ne sont plus ceux qu'écrivait cet item (379,0 et 79,0, run du 2026-09-02) : le
cliquet a été resserré depuis, et c'est son rôle. La marge n'est donc pas « 11,9 ko » mais 3,2 ko
sur le chemin critique et **zéro** sur l'entrée.

⚠️ **Ce que la mesure ne dit pas, et qu'il ne faut pas conclure trop vite** : au moment de ce
relevé, l'arbre de travail portait des ajouts NON COMMITTÉS d'une autre session dans
`src/locales/{fr,en}/errors.json` (~1,1 ko de texte), et les catalogues de l'entrée sont justement
ce qui la fait grossir. Le dépassement peut donc être transitoire. Il se tranche en remesurant sur
un arbre propre, pas en le supposant.

- **La sortie n'est pas de relever le plafond**, elle est de regagner de la marge : les catalogues
  i18n de l'entrée, les dépendances tirées par le shell, et C-13.
- **Fini quand** : `npm run check:bundle` rend au moins 5 % de marge sur les deux budgets, sur un
  build avec `VITE_SENTRY_DSN`.

### C-67 · ~~La landing bloque le fil principal **71 % du temps AU REPOS**, et ce sont ses flous~~ · **P1 · M** · ✅ corrigé le 2026-09-03

Trouvé par l'audit **A-8**. C'est la réponse à C-12, et elle **contredit** la piste que C-12
désignait.

**La mesure.** Build de **prod** (`npm run preview`), page chargée, puis une fenêtre de 4 000 ms
**au repos** : aucun scroll, aucun clic, rien à animer par une interaction. On somme les tâches
longues qui *commencent* dans cette fenêtre. Une page tranquille rend 0.

| Page | fil bloqué / 4 000 ms | sans les `filter: blur` |
|---|---|---|
| `/` | **2 856 ms (71 %)** — passes : 2 576, 2 856, 2 906 | **259 ms (6 %)** — passes : 336, 259, 203 |
| `/guide` | **0 ms**, sur les trois passes | 0 ms |
| `/entreprise-presentation` | 3 637 ms (91 %) | inchangé, cf. **C-68** |

**Neutraliser les flous retire 91 % du blocage.** Neutraliser les `backdrop-filter` n'en retire
rien (3 286 ms). Une règle CSS **sans effet** laisse la mesure à 9 % près : ce n'est donc pas
l'injection qu'on mesure.

**Ce qui a été éliminé, et c'est ce qui corrige C-12** : tuer les **23** `ScrollTrigger` de la page
ne déplace pas la mesure (3 015 contre 3 053 ms). Mettre en pause les **8** tweens GSAP infinis non
plus (2 798). Couper la rotation de la fenêtre produit non plus (3 238). `vendor-animation` et
`vendor-gsap` arrivaient en tête du bootup Lighthouse parce que l'échantillonnage attribue le style
et le **paint** déclenchés par une animation au fichier de la bibliothèque qui tient la frame —
l'en-tête de `scripts/profile-landing.mjs` le disait déjà, personne ne l'avait appliqué au verdict.

**Ce qui coûte, précisément** : le premier écran de `/` empile **20 surfaces floutées** pour
**1,95 Mpx** d'aire visible, dont quatre grandes couches décoratives animées en permanence
(`PersoTrack.tsx`, halo conique 763 × 763 en `blur(90px)` qui tourne sur 40 s, plus trois aurores en
`blur(100px)` et `blur(110px)` qui pulsent, toutes en `repeat: Infinity`). Le coût est
**cumulatif** : retirer une seule famille n'en enlève que ~30 %, les retirer toutes en enlève 91 %.
Ce sont des couches superposées, donc chacune qui reste force le re-rendu de toute la pile.

- ❌ **Ce n'est pas un réglage de compositeur** : `will-change: transform, opacity`,
  `translateZ(0)`, `contain: paint` et diviser le rayon par trois ont **tous** été mesurés, aucun ne
  déplace la mesure.
- **Piste** : cuire le fond (image ou `radial-gradient` déjà flou, seule l'opacité reste animée).
  L'arbitrage de direction artistique appartient à Axel : `a-faire-manuel.md` **M-37**.
- ⚠️ **La mesure est en rastérisation LOGICIELLE** (SwiftShader), comme le runner de CI : c'est la
  bonne condition pour expliquer un score Lighthouse, pas pour prédire ce que ressent un poste
  équipé d'un GPU. Le lancement d'un navigateur avec GPU a échoué dans cet environnement, la
  question reste **ouverte** (`a-faire-manuel.md` **M-38**), et un téléphone d'entrée de gamme est
  plus proche du cas logiciel que d'un poste de bureau.
**Corrigé le 2026-09-03, arbitrage M-37 rendu par Axel : « cuire le fond ».** Les quatre couches
décoratives du hero et la lueur derrière le mockup ne portent plus aucun `filter: blur()` : ce sont
des `radial-gradient` qui s'éteignent vers `transparent`, c'est-à-dire déjà flous. Seule l'opacité
reste animée.

| Mesure (build de prod, 4 s au repos, 3 passes) | Avant | Après |
|---|---|---|
| Fil principal bloqué | **2 856 ms (71 %)** | **0 ms** sur les trois passes |
| Surface floutée du premier écran | 1,95 Mpx sur 20 éléments | **0,023 Mpx** sur 5 |

**Le rendu a été tenu à la mesure, pas à l'œil** : couleur moyenne et saturation moyenne du hero,
décodées dans un canvas, l'avant étant reconstruit au commit `e20920f`. Luminosité 51,5 → **51,1**,
bleu 75,8 → 72,1, saturation 46,2 → 41,0. Deux enseignements de cette boucle :

- un aplat **opaque** flouté garde son alpha sur tout son cœur, un dégradé radial ne le garde qu'au
  centre : il faut un **plateau**, et il faut dimensionner le dégradé à l'étendue du flou (un disque
  de 34 rem flouté à 110 px s'étale sur ~34 rem + 220 px), pas à celle du disque ;
- chaque dégradé doit atteindre `transparent` **avant** le bord de sa boîte : sans le flou qui
  adoucissait les arêtes, un stop encore coloré à 100 % dessine un rectangle visible. C'est le
  défaut qu'a montré la première capture après correctif.

⚠️ **Mesuré au passage, et ça ferme une piste** : retirer le halo conique tournant ne changeait
**rien** aux pixels (bleu 75,8 → 75,8). Il tournait sur 40 s, sous `opacity-50`, derrière le reste :
personne ne l'a jamais vu. Toute l'ambiance venait des trois aplats opaques floutés.

- **Reste à faire** : `/` doit dépasser 90 en CI sur deux passes pour que l'item soit clos côté
  score. L'avant est pris (56-63, TBT 546 à 1 633 ms, 2026-09-02) ; le relèvement de l'après est un
  geste d'Axel, `a-faire-manuel.md` **M-39**.
- **Garde** : `node scripts/landing-motion-probe.mjs --url http://localhost:4399/` doit rendre moins
  de 300 ms au repos **sans** rien neutraliser. ❌ Ne jamais remettre un `filter: blur()` animé dans
  le premier écran de `/`.

### C-68 · `/entreprise-presentation` bloque autant, pour une cause que l'audit n'a PAS su isoler · **P2 · M**

Trouvé par l'audit **A-8**, et écrit ici **parce qu'il n'est pas résolu**. Sur le build de prod, la
landing entreprise bloque le fil **3 637 ms sur 4 000 (91 %)** au repos, mais neutraliser les flous
n'y change **rien** : sa cause est différente de celle de C-67, et elle n'est pas nommée.

Ce que la mesure dit, et c'est tout ce qu'elle dit : le comportement est **bimodal**. Six passes ont
rendu soit ~0-370 ms, soit ~3 000-3 400 ms, sur la même URL et le même build. Retirer le canvas
WebGL (`LightRays`, `vendor-ogl`) a produit les deux **seules** passes à 0 ms — mais une troisième
passe est repartie à 3 031 ms avec le canvas retiré. Le shader est donc un **suspect**, pas une
conclusion.

- ❌ **Ne pas refermer cet item en accusant le shader** : ce serait exactement le défaut que ce
  dépôt a corrigé quatre fois, une réponse rassurante donnée par une mesure qui ne discrimine pas.
- **Fini quand** : la bimodalité est expliquée (trace CDP par catégorie raster/GPU, ou une sonde qui
  dit laquelle des deux branches le chargement a prise), la cause est nommée, et la page rend moins
  de 300 ms au repos sur trois passes consécutives.

---

## 4. Scalabilité

### C-15 · Le tableau de bord charge le jeu de données complet · **P3 · M**

Aucune pagination : la page lit tout et agrège côté client. **Mesuré le 2026-09-02 : 289 tâches et
128 événements au maximum pour un compte**, donc aucun coût réel aujourd'hui. Le risque est écrit
depuis longtemps, la mesure ne le justifie pas encore.

- **Fini quand** : soit un seuil déclenche une agrégation serveur, soit la décision « on ne fait
  rien tant que X » est écrite avec son seuil de réouverture (comme T-01).

### C-16 · La mesure à volume est mono-session · **P3 · M**

`SCALABILITY.md` §9ter a levé l'inconnue du planificateur (200 puis 2 000 `team_tasks`, aucun
basculement de plan). Ce qu'elle ne dit **toujours pas** : rien sur la **concurrence**, rien sur
`tasks` à plusieurs millions de lignes.

- **Fini quand** : le workflow `scalability-volume` sait jouer N sessions parallèles, et le résultat
  est inscrit dans le §9ter avec sa date.

---

## 5. Sécurité et dépendances

### C-17 · ~~`react-router` · la seule sortie est React 19~~ · **P2 · L** · ✅ clos le 2026-09-03, remplacé par C-58

🔴 **Ce que cet item affirmait était faux depuis le 2026-07-28**, sans que personne ne revienne
vérifier : « aucune version ne ferme les deux familles à la fois sous React 18 ». L'audit **A-6**
a mesuré que `react-router@7.18.2`, déjà installé, ferme les deux CVE sous React 18 — la migration
n'est donc plus une urgence sécurité. Détail complet, chronologie et preuve : **C-58** ci-dessous
et [`docs/MIGRATION-REACT19.md`](./docs/MIGRATION-REACT19.md).

### C-18 · CVE dev-only · **P3 · S**

**Remesuré le 2026-09-03**, après que GitHub a annoncé « 4 vulnerabilities (4 high) » au push. Les
paquets ne sont plus ceux de l'énoncé d'origine, et **la conclusion pratique s'inverse**.

Ce que disent les alertes, mesuré et non déduit :

| Source | Paquet | Sévérité | Correctif |
|---|---|---|---|
| Dependabot (4 avis) | `fast-uri` 3.1.5 | high ×4 | **3.1.6** |
| `npm audit` local | `qs` 6.16.0 | moderate ×2 | disponible |

**Les quatre alertes sont un seul paquet.** Dependabot compte les avis (deux SSRF, deux confusions
d'hôte), pas les dépendances. Et le `npm audit` local en remonte une cinquième que Dependabot ne
montre pas.

Les deux descendent de la **même racine, une devDependency** :

```
shadcn@4.18.0                        ← devDependency, CLI de génération de composants
└── @modelcontextprotocol/sdk@1.30.0
    ├── express@5.2.1 → qs@6.16.0
    └── ajv@8.20.0    → fast-uri@3.1.5
```

`shadcn` n'est **jamais bundlé** : rien de tout cela n'atteint le navigateur. La gate CI le confirme,
mesurée le 2026-09-03 : `npm audit --omit=dev --audit-level=high` → **`found 0 vulnerabilities`**,
exit 0. L'exploitation supposerait de faire avaler au CLI, sur la machine d'un développeur, un
schéma ou une URL forgés. Faible, pas nul.

🔴 **Ce que l'ancien énoncé disait de faux, et qui décidait de l'action.** Il affirmait que corriger
impose `npm audit fix --force`, lequel casse le peer `eslint-plugin-react-hooks`. C'était vrai de
`vitest` / `eslint` / `vite` / `glob`, le lot d'alors. **Ce n'est pas vrai de ce lot-ci** :
`npm audit` annonce « fix available via `npm audit fix` », **sans `--force`**, et `shadcn` est passé
à **4.20.1** en amont. L'item décourageait donc un geste bon marché.

⚠️ Ce constat vaut pour les paquets du 2026-09-03. Le prochain lot sera encore un autre : **relire
`npm audit` avant d'agir, jamais cet item seul.** C'est précisément ce que son ancienne version
invitait à ne pas faire.

- **Où** : `package.json` (`devDependencies.shadcn`), `package-lock.json`.
- **Piste** : `npm audit fix` puis montée de `shadcn` à 4.20.1. ⚠️ Réécrit `package-lock.json` et
  `node_modules` : à faire quand **aucune autre session** ne travaille dans l'arbre (règle 5 des
  règles de traitement).
- **Fini quand** : `npm audit` rend 0 vulnérabilité, les cinq gates sont rejouées derrière, et le
  tableau ci-dessus porte sa nouvelle date. ❌ Ne jamais mêler cette passe à une passe sécurité
  produit : ce sont deux natures de risque, et les confondre fait passer l'une pour l'autre.

### C-19 · ~~Les composants shadcn recopiés visent React 19~~ · **P2 · M** · 🟠 traité par l'audit A-6, cf. C-59

`Button` avait été trouvé cassé (le `ref` n'était jamais attaché, donc un focus clavier mort dans le
calendrier). L'audit **A-6** a balayé **tout** `ref={` posé sur un composant (pas un élément DOM
natif) dans `src/**/*.tsx` (125 occurrences au total) : sur `src/components/ui/`, seuls `Button` et
`Input` reçoivent un ref quelque part dans le code. `Button` était déjà corrigé ; `Input` ne l'était
pas — **corrigé cette session, cf. C-59**. Les 22 autres fichiers recopiés depuis shadcn ne
reçoivent aucun ref aujourd'hui : la classe de bug n'a plus d'instance vivante connue.

⚠️ **Reste ouvert, et c'est pour ça que ce n'est pas ✅** : ceci est un état daté, pas une garantie
permanente. Aucun test ni aucune gate ne détecte automatiquement un futur composant shadcn recopié
sans `forwardRef` avant qu'un consommateur lui pose un ref — la classe de bug reste silencieuse par
construction. Et cet audit n'a pas fait, faute de périmètre, une relecture ligne à ligne des 24
fichiers contre leur source amont (hors la question du ref) : un écart non lié au ref pourrait
dormir ailleurs.

- **Fini quand** : soit une gate détecte un composant shadcn sans `forwardRef`, soit chaque
  composant est revérifié à l'ajout de son premier ref (discipline manuelle, pas outillée).

### C-58 · Le blocage sécurité qui forçait React 19 est déjà levé · **P3 · XS** · trouvé par l'audit A-6

`CLAUDE.md` et `faille.md` décrivaient un piège à deux CVE (`GHSA-qwww-vcr4-c8h2`,
`GHSA-wrjc-x8rr-h8h6`) sans issue sous React 18. **Mesuré contre trois sources indépendantes**,
ce n'est plus vrai depuis le 2026-07-28 :

1. L'avis GitHub lui-même (interrogé via l'API, pas son résumé dans la doc) porte **deux plages
   disjointes avec chacune son propre correctif** : `[7.12.0, 7.18.2)` corrigée en **7.18.2**,
   `[8.0.0, 8.3.0)` corrigée en 8.3.0. La doc les avait fusionnées en une seule plage
   (« ≥ 7.12.0 < 8.3.0 »), ce qui masquait le correctif intermédiaire.
2. `react-router@7.18.2` (publié le 2026-07-28) est **déjà celui installé** : `package.json` porte
   `^7.18.2`, `package-lock.json` l'épingle exactement.
3. `npm audit` local (0 alerte sur `react-router` — les 2 seules alertes actuelles viennent de
   `shadcn`, C-18, sans rapport) et l'API OSV interrogée pour `react-router@7.18.2` (`{"vulns":[]}`)
   rendent tous les deux zéro résultat. `GHSA-wrjc-x8rr-h8h6` est fermé dès 7.18.0.

**Conséquence** : le dépôt ferme déjà les deux CVE, aujourd'hui, sous React 18, sans avoir rien
changé. La migration React 19 + `react-router` 8 n'est plus une urgence sécurité — chiffrage complet
dans [`docs/MIGRATION-REACT19.md`](./docs/MIGRATION-REACT19.md).

- ❌ **Ça ne change rien à la règle `npm audit fix`** : toujours ne pas la lancer sur ce paquet sans
  relire l'avis à la main.
- **Correctif documentaire livré** : `faille.md` § « Ouvert · à planifier » corrigé.
- **Fini quand** : fini — c'est un constat, pas un correctif de code. Le moment de la migration
  (désormais un arbitrage produit, plus une urgence) est dans `a-faire-manuel.md` M-33.

### C-59 · ~~`Input` (`src/components/ui/input.tsx`) n'était pas un `forwardRef`~~ · **P2 · S** · ✅ corrigé le 2026-09-03, trouvé par l'audit A-6

Même classe de bug que `Button` avant lui (C-18 historique) : composant recopié depuis shadcn
amont, écrit pour React 19 où `ref` est une prop ordinaire, sans `React.forwardRef`. Sous React 18,
un ref posé dessus n'est jamais attaché — aucune erreur visible, juste un focus qui n'arrive jamais.

**Scénario d'échec mesuré** : `AdminMfaGate` (`src/components/admin/AdminMfaGate.tsx:106`) pose
`ref={inputRef}` sur cet `Input` pour donner le focus au champ de code TOTP au montage
(`useEffect(() => inputRef.current?.focus(), [])`). Avec `Input` en simple fonction,
`inputRef.current` restait `null` : le focus automatique du **seul écran qui protège `/admin`**
ne s'exécutait jamais, silencieusement. Reproduit avant correctif : un test rend `<Input ref={ref}/>`
puis vérifie `ref.current instanceof HTMLInputElement` — échoue (`null`) avant, passe après.

- **Où** : `src/components/ui/input.tsx` (converti en `React.forwardRef`, même schéma que
  `Button`), `src/components/ui/input.test.tsx` (test de non-régression : ref attaché sans
  avertissement React, et focus programmatique fonctionnel — le cas exact d'`AdminMfaGate`).
- **Fini quand** : fini. Trouvé via le balayage systématique de A-6, corrigé et testé le
  2026-09-03 ; le correctif est entré sur `main` par le commit `8a8869d` d'une session voisine
  (travail A-3 sur le clavier), qui a repris les deux fichiers déjà écrits dans l'arbre partagé au
  moment de son propre commit. `npm run typecheck`, `npm run lint`, `npm run i18n:check` et la
  suite complète (`npx vitest run`) sont verts derrière.

### C-60 · `useRef<T>()` sans valeur initiale : cassera sous les types React 19 · **P3 · XS** · trouvé par l'audit A-6

> ✅ corrigé le 2026-09-04 · une seule occurrence, `usePrevious`.

`src/lib/hooks/useDebounce.ts:69` (`usePrevious`) appelle `useRef<T>()` sans argument. Valide sous
React 18 ; les types `@types/react` 19 rendent l'argument initial obligatoire (alignés sur
`useState`), donc ce site échouerait `tsc` dès la bascule.

- **Où** : `src/lib/hooks/useDebounce.ts:69`.
- **Piste** : `useRef<T | undefined>(undefined)`.
- **Fini quand** : fait dans la même PR que la bascule React 19 (cf. `docs/MIGRATION-REACT19.md`
  §5) — pas avant, le code est valide aujourd'hui et ce fichier n'a pas d'autre raison d'être
  touché isolément.

### C-29 · ~~`delete-account` : la lecture qui désigne le successeur d'une organisation avalait son erreur~~ · **P1 · S** · ✅ corrigé le 2026-09-03

Trouvé par l'audit **A-1**. Famille `S-1` / `S-2` de `faille.md`, cette fois hors Stripe.

```ts
const { data: others } = await supabaseAdmin.from('organization_members')…  // ❌ pas d'`error`
```

**Scénario d'échec** : la lecture échoue (panne PostgREST, coupure réseau, timeout). `others` vaut
`null`, donc « aucun autre membre », donc **aucun transfert de propriété**, donc `continue` — puis
`auth.admin.deleteUser` s'exécute. `organizations.owner_id` étant `ON DELETE CASCADE`, toute
l'organisation part avec le compte. **Mesuré en prod le 2026-09-03** : 22 clés étrangères visent
`organizations(id)`, dont 21 en CASCADE (membres, équipes, projets, tâches d'équipe, OKR, droits,
notifications, invitations). Irréversible, et ce sont les données de tiers. Deux des quatre
organisations de la prod ont d'autres membres que leur propriétaire.

- **Corrigé** : l'erreur est capturée, la table part dans `failedTables`, l'effacement s'arrête
  avant la ligne `auth` et reste rejouable. Même traitement pour la promotion du successeur, dont
  l'échec laissait une organisation avec un propriétaire non admin, donc sans personne pour
  inviter, gérer les droits ou résilier.
- **Garde** : `src/edge-swallowed-errors.guard.test.ts`, vue **rouge** avant le correctif, avec un
  témoin qui refuse un détecteur qui ne détecterait plus rien.
- ⚠️ **Le correctif n'est pas en production tant que `supabase functions deploy delete-account`
  n'a pas été joué** : un push ne déploie aucune Edge Function. Cf. `a-faire-manuel.md`.

### C-30 · Supprimer un compte propriétaire détruit les preuves L215-1 et L221-28 de son organisation · **P1 · M**

> ✅ code écrit le 2026-09-04 (mig. **138**, NON APPLIQUÉE) · les deux tables passent en `ON DELETE SET NULL`. ⚠️ `renewal_notices` avait pour PK `(org_id, period_end)` : clé de substitution + contrainte UNIQUE, c'est elle que vise l'`ON CONFLICT` de la Edge Function. ⚠️ Le trigger d'immuabilité de `withdrawal_consents` refusait TOUTE mutation, donc aussi le `SET NULL` : il autorise désormais le seul détachement `org_id → NULL`.

Trouvé par l'audit **A-1**, mesuré sur `pg_constraint` le 2026-09-03. `renewal_notices` (avis de
reconduction, Conso. art. L215-1) et `withdrawal_consents` (renonciation au droit de rétractation,
art. L221-28) référencent `organizations(id)` **`ON DELETE CASCADE`**. Or `delete-account` laisse
volontairement la cascade agir quand le propriétaire est le seul membre.

Ces deux tables sont décrites partout dans le dépôt comme **des pièces à produire, jamais un cache**,
append-only et immuables par trigger. Le trigger empêche de les modifier, il n'empêche pas de les
faire disparaître par en dessous. `payment_records`, lui, est en `ON DELETE SET NULL` : c'est le bon
motif, appliqué à une seule des trois tables de preuve.

- **Scénario d'échec** : un client résilie, conteste la reconduction, puis supprime son compte. La
  preuve qu'on lui a bien adressé l'avis a disparu avec l'organisation. La charge de la preuve est
  sur le professionnel.
- **Exposition réelle aujourd'hui : nulle.** Mesuré : 0 ligne dans les trois tables, 0
  `org_subscriptions`, rien n'est encaissé. C'est donc le moment le moins cher.
- **Fini quand** : les deux tables sont en `ON DELETE SET NULL` sur `org_id` (comme
  `payment_records`), une migration numérotée le pose, et la vérification est faite acteur par
  acteur dans une transaction annulée. À faire **avant** la bascule Stripe live (C-08).

### C-31 · `report-bug` est un relais d'e-mail ouvert, sans aucune limite de débit · **P2 · M**

> ✅ code écrit le 2026-09-04 (mig. **139**, NON APPLIQUÉE) · 3/heure/compte et 10/jour/IP, fenêtre glissante, décision atomique. **Aucune IP en base** (hachage salé). ⚠️ Reste à poser le secret `RATE_LIMIT_SALT` — sans lui la fonction REFUSE.

Trouvé par l'audit **A-1**. La fonction est en `verify_jwt: true`, mais **la clé anon suffit** (elle
est dans le bundle client, donc publique) et c'est volontaire : on veut pouvoir signaler un bug
depuis un compte cassé. Il n'y a ensuite **ni CAPTCHA, ni throttle client, ni compteur serveur, ni
plafond par IP** — vérifié : `src/lib/bug-report.ts` ne porte aucune notion de cadence.

**Scénario d'échec** : une boucle de quelques lignes poste des rapports valides avec une pièce jointe
de 3 Mo chacun. Chaque appel est un e-mail réel expédié par notre compte Resend vers
`contact@thecosmo.app`. Conséquences : quota Resend épuisé, boîte de contact noyée, et surtout
réputation d'expéditeur du domaine abîmée — celle-là met des mois à se reconstruire, et c'est le même
domaine qui porte les e-mails d'authentification et les avis L215-1.

- **Mesuré le 2026-09-03** : `POST /functions/v1/report-bug` avec la seule clé anon répond
  `400 invalid_body`, donc le corps est bien atteint sans compte utilisateur.
- **Fini quand** : une borne existe côté serveur (par IP et par compte, fenêtre glissante) **et** un
  test la montre rouge avant d'être verte. Le CAPTCHA (`VITE_TURNSTILE_SITE_KEY`, T-40) est un
  complément, pas un substitut : il ne protège pas un appel direct à la fonction.

### C-32 · `report-bug` : l'allowlist de types de pièce jointe est décorative · **P3 · S**

> ✅ corrigé le 2026-09-04 · l'extension du fichier joint est DÉRIVÉE du type validé, jamais reprise du nom envoyé.

`ALLOWED_ATTACHMENT_TYPES` valide `attachment.type`… puis **ne le transmet jamais**. Resend ne reçoit
que `filename` et `content`, et type la pièce jointe d'après le **nom de fichier**, qui n'est borné
qu'en longueur.

- **Scénario d'échec** : `{ name: 'facture.html', type: 'image/png', content: <base64 d'un
  formulaire d'hameçonnage> }` passe la validation et arrive dans la boîte de contact en pièce jointe
  HTML. L'allowlist affirme interdire exactement ça.
- **Fini quand** : l'extension du nom est dérivée du type validé (ou le couple est vérifié), et un
  test couvre le cas `type` autorisé + extension interdite. C'est la famille « composant qui porte
  une allowlist sans aucun test », déjà rencontrée sur `RichText`.

### C-33 · `report-bug` : une panne d'authentification anonymise l'auteur en silence · **P3 · XS**

> ✅ corrigé le 2026-09-04 · l'erreur de `getUser()` est lue, et « auteur non résolu » se distingue de « anonyme ».

`const { data } = await anon.auth.getUser()` — l'erreur n'est pas lue. Sur panne de l'API auth, un
utilisateur **connecté** est traité comme anonyme : le rapport part sans son adresse et sans
`reply_to`, donc sans aucun moyen de lui répondre, et rien à l'écran ne le dit. Même famille que
C-29, conséquence bien plus faible.

- **Fini quand** : l'échec est distingué de l'absence de session, et le corps du message dit
  « auteur non résolu » plutôt que « non connecté (anonyme) ».

### C-39 · N'importe quel ADMIN peut supprimer l'entreprise depuis l'écran, et la cascade emporte tout · **P1 · M**

> 🟠 code écrit le 2026-09-04 (mig. **138**, NON APPLIQUÉE) · la RPC exige le
> PROPRIÉTAIRE ✅, l'écran monte la zone rouge sur `isOwner` ✅, le dialogue dit ce
> qu'il advient de l'abonnement et des preuves ✅.
>
> ⚠️ **La moitié « rembourse » de l'arbitrage n'est PAS livrée.** La décision dit
> « résilie ET rembourse puis supprime, un seul geste, aucun débit orphelin » ; ce qui
> est livré REFUSE tant qu'un abonnement court, donc deux gestes. C-65 n'existe pas
> (rien n'appelle `refunds.create`), et des trois états possibles échouer fermé est le
> seul sûr. Le refus est écrit comme un INTÉRIM à RETIRER quand C-65 arrive, pas à
> cumuler avec lui.

C-30 a trouvé la cascade par la suppression de COMPTE et demande le bon correctif (`ON DELETE SET
NULL` sur les deux tables de preuve). Cet audit a trouvé le **second chemin, bien plus court** :
un bouton rouge dans `/entreprise`, atteignable sans supprimer quoi que ce soit d'autre.

Relu en production le 2026-09-03 :

- `delete_organization(p_org)` est `SECURITY DEFINER` et n'exige que `public.is_org_admin(p_org)`,
  **pas le propriétaire**. `organizations` n'a aucune policy DELETE : la RPC est la seule porte,
  c'est la bonne structure, il manque juste la garde.
- `src/pages/OrganizationPage.tsx:478` monte la zone rouge sur `isAdmin`. Le bouton « Transférer la
  propriété » juste à côté, lui, est bien réservé au propriétaire (`user?.id === myOrg.ownerId`) :
  la restriction existait, elle n'a pas été portée sur le geste destructeur.
- La cascade emporte aussi `org_subscriptions` (vérifié : 21 des 22 FK vers `organizations(id)` sont
  en CASCADE). L'abonnement Stripe, lui, continue de courir : on facture une organisation dont la
  ligne n'existe plus, et le prochain event webhook tentera un upsert sur une clé étrangère morte.
- `DeleteOrganizationDialog` est par ailleurs un modèle de confirmation extrême (saisie du nom
  exact, liste des conséquences). Sa liste ne mentionne **ni l'abonnement, ni les preuves**.

**Scénario d'échec** : une entreprise a deux admins. Le second, qui ne paie rien, supprime
l'organisation. Le propriétaire continue d'être débité, n'a plus d'organisation, et la preuve de sa
renonciation au droit de rétractation a disparu avec.

**Exposition réelle aujourd'hui : nulle** (rien n'est encaissé, `ENTERPRISE_BILLING_ENFORCED =
false`). C'est ce qui en fait le moment le moins cher, et le jour d'après il est irrattrapable.

- **Où** : `delete_organization` (migration à écrire), `src/pages/OrganizationPage.tsx:478`,
  `src/components/organization/DeleteOrganizationDialog.tsx`.
- **Fini quand** : la RPC exige le PROPRIÉTAIRE et refuse tant qu'un abonnement est actif, l'écran
  applique la même règle, et le dialogue dit ce qu'il advient de l'abonnement. Le correctif de
  cascade reste celui de C-30, à ne pas dupliquer ici. Le tout **avant** T-38.

### C-44 · `ui/chart.tsx` porte une allowlist anti-XSS sans un seul test · **P3 · XS**

> ✅ fait le 2026-09-04 · `chart.test.tsx`, 18 cas : les formats réels des quatre appelants, le scénario d'évasion du commentaire, l'évasion par `id` et par clé.

Exactement le cas de `RichText` avant le 2026-09-02, dans un fichier que la revue n'a pas atteint.
`src/components/ui/chart.tsx` fait un `dangerouslySetInnerHTML` sur du CSS construit, protégé par
deux gardes écrites à la main : `SAFE_COLOR_RE` (hex, `hsl()`, `rgb()`, `var(--…)`) et une
validation de l'`id` interpolé dans le sélecteur. Le commentaire explique le scénario d'évasion.
Aucun test ne le vérifie, et le composant est monté par quatre écrans (`DashboardBarChart`,
`StatisticsPage`, `TeamOverviewTab`, `admin/AdminCharts`).

⚠️ Le risque est aujourd'hui théorique : les quatre appelants passent des constantes hexadécimales.
C'est la garde qui n'est pas éprouvée, pas une exposition mesurée. Le second effet compte autant :
une couleur légitime que `SAFE_COLOR_RE` refuserait disparaîtrait en silence.

- **Fini quand** : `chart.test.tsx` couvre une couleur valide, une couleur d'évasion, un `id`
  d'évasion, et les formats réellement passés par les quatre appelants.

### C-45 · `loginWithGoogle` vise désormais des URL que l'allowlist Supabase ne couvre peut-être pas · **P1 · XS (code) + geste console**

Le code livré le 2026-09-03 construit `redirectTo` comme
`${origin}${préfixe de locale}${destination}` au lieu de `${origin}/dashboard` : c'est ce qui rend à
un anglophone sa version de l'application, et à une invitation d'entreprise réclamée via Google sa
destination (garde R-04, jeton à usage unique).

🔴 **Le code est en production ; le réglage qui le rend valide, non vérifié.** La *Redirect URL allow
list* du projet Supabase doit couvrir `https://thecosmo.app/**`. Si elle ne porte que
`/dashboard`, GoTrue ignore la valeur envoyée et renvoie sur le Site URL : la connexion Google
« marche » et perd silencieusement la destination — exactement le symptôme d'avant le correctif,
avec le correctif en place.

- **Où** : `src/modules/auth/AuthContext.tsx`, `loginWithGoogle` (le commentaire 🔴 le dit sur place).
- **Fini quand** : l'allowlist est vérifiée dans la console Supabase, **et** une vraie connexion
  Google depuis `/en/login?redirect=/org-invite/<token>` atterrit sur la page d'invitation, en
  anglais. Le geste console est dans [`a-faire-manuel.md`](./a-faire-manuel.md) ; la preuve
  attendue est ce parcours, pas la capture du réglage.

### C-46 · Les dépôts de démo touchent `localStorage` hors de tout `try` · **P2 · S**

> ✅ corrigé le 2026-09-04 · les 14 dépôts passent par `safe-json`. Les écritures sont **classées** : `safeSetItem` pour un seed, `writeJsonOrThrow` (nouveau, message catalogué) pour une donnée de l'utilisateur.

`src/lib/safe-json.ts` (créé le 2026-09-03) donne `safeGetItem` / `safeSetItem` / `safeParseArray`,
et n'est câblé que sur les **sept** lecteurs que la revue nommait. Il reste **60 appels bruts à
`localStorage` dans 14 fichiers de dépôt** — dont `org-teams`, `organizations`, `team-projects`,
`team-okrs`, `org-okr-categories`, `team-categories` et `friends`.

Le `JSON.parse` y est bien protégé — c'était la règle B14 — mais **le `getItem` qui le précède ne
l'est pas**, et c'est lui qui lève en navigation privée, en webview et quand les cookies tiers sont
bloqués. Exemple exact, `org-teams/local.repository.ts:33` : `getItem` est **avant** le `try`, donc
tout le mode entreprise en démo tombe avant d'atteindre la garde censée le sauver.

- **Où** : les 14 `*/repository.ts` et `*/local.repository.ts` listés par
  `grep -c "localStorage\.\(getItem\|setItem\|removeItem\)" src/modules/**/*repository.ts`.
- **Piste** : passer par `safe-json.ts`, qui existe déjà. Aucune décision à prendre, c'est du câblage.
- **Fini quand** : plus aucun `localStorage.` direct dans `src/modules/**/repository.ts`, et un test
  qui fait JETER `Storage.prototype.getItem` vérifie que le mode démo se re-sème au lieu de tomber
  (le patron est dans `src/lib/safe-json.test.ts`).

> ⚠️ **Complément de l'audit A-2 : l'ÉCRITURE n'est pas du câblage, elle demande une décision.**
> `safeSetItem` a **zéro appelant dans tout le dépôt**, et les écritures nues jettent dans les
> mêmes conditions que les lectures — plus une qui leur est propre, le quota. **Mesuré** : une
> saisie de progression de KR en mode démo a fait remonter un `QuotaExceededError` des 5 Mo
> **directement depuis le repository** (cause corrigée par ailleurs, mais le chemin nu demeure sur
> les 60 appels).
> Câbler `safeSetItem` partout **avalerait silencieusement** l'échec : pour une préférence
> d'affichage c'est le bon comportement, pour une donnée que l'utilisateur vient de créer c'est
> une perte sans signal. Les écritures se classent donc par nature avant d'être recâblées, et le
> test de `Storage.prototype` doit couvrir `setItem` autant que `getItem`.

### C-61 · ~~Un repli d'agrément fermait toute l'application authentifiée~~ · **P1 · S** · ✅ corrigé le 2026-09-03

Trouvé par l'audit **A-7**, et c'est son résultat le plus lourd. `src/components/Layout.tsx`
initialisait l'état « barre latérale repliée » **en phase de rendu**, à nu :

```ts
const [isCollapsed, setIsCollapsed] = useState(() => {
  const saved = localStorage.getItem('sidebar-collapsed');
  return saved ? JSON.parse(saved) : false;   // ❌ ni try, ni safeParse (règle B14)
});
```

Ce qui lève dans un initialiseur de rendu ne remonte dans aucun `onError` : ça remonte à
l'`AppErrorBoundary`. Or `Layout` est le parent de **toutes** les pages protégées.

**Mesuré dans le navigateur le 2026-09-03**, trois entrées, trois fois le même écran
« ⚠️ Une erreur inattendue s'est produite / Veuillez rafraîchir la page » :

1. une valeur non-JSON dans la clé (`'oui'`) : `JSON.parse` lève ;
2. un navigateur qui **refuse** le stockage (navigation privée stricte, « bloquer les données de
   site ») : `getItem` lève, sur un profil **neuf**, sans aucune valeur corrompue ;
3. le bouton « Rafraîchir la page », **seule sortie proposée**, relit la même clé et rend le
   **même écran**. L'impasse est permanente : toutes les pages protégées montent `Layout`, donc la
   déconnexion elle-même est hors d'atteinte.

C'est la forme exacte du verrouillage `/admin` du 2026-09-01, et la règle B14 de `CLAUDE.md` la
nommait depuis longtemps — le helper `safeParse` / `readJson` existait déjà.

- **Corrigé** : lecture par `readJson<boolean>()`, écriture par `safeSetItem()` (l'effet qui
  persistait la valeur levait pour la même raison). Vérifié **dans le navigateur après correctif** :
  les deux entrées rendent l'application normalement.
- **Garde** : `src/render-storage.guard.test.ts`, vue **rouge** sur le vrai défaut avant le
  correctif, avec **deux témoins** (un initialiseur non protégé doit être vu, un initialiseur
  protégé ne doit pas l'être).
- **Balayage complet** : c'était la **seule** occurrence de `src/`. Les 84 autres `catch` vides du
  dépôt ont été inventoriés un par un — tous portent un accès au stockage déjà protégé, aucun
  n'avale un échec de mutation.

### C-62 · Une centaine de messages d'erreur atteignent l'écran sans passer par aucun catalogue · **P2 · M**

Trouvé par l'audit **A-7**. Le dépôt affiche ses erreurs de mutation par 75 clés `mutation.*` qui
**interpolent le message de l'exception** :

```json
"mutation.updateTask2": "Impossible de modifier la tâche : {{message}}"
```

C'est sûr tant que l'exception est une `ApiError`, dont le `message` vient du catalogue. Rien ne le
garantit : `src/modules/` contient **99 `throw new Error('<littéral>')`** (hors les 151
« Supabase not configured »), et n'importe quelle exception interne passe par le même tuyau.

**Mesuré le 2026-09-03 en exécutant les vrais repositories et le vrai moteur i18n** — ce sont les
phrases telles que rendues, pas des reconstitutions :

| Ce que l'utilisateur lit | Ce que c'est |
|---|---|
| `Impossible de modifier la tâche : Task with id id-inexistant-42 not found` | une phrase **anglaise** portant un **identifiant interne** |
| `Impossible de créer le lien : Vous ne faites pas partie de cette entreprise` | un français **hors catalogue** |
| `Impossible de rejoindre l'entreprise : Code invalide` | idem |
| `Impossible de créer le lien : localStorage is not defined` | un message **du moteur JS**, brut |

La dernière ligne est la plus parlante : le canal est **entièrement ouvert**, du `throw` jusqu'au
toast. Un `TypeError` (« Cannot read properties of undefined ») s'y afficherait de la même façon.

Répartition des 99 : environ 45 phrases françaises écrites en dur (donc **identiques en anglais**,
un littéral n'ayant pas de locale), une vingtaine d'anglaises (donc affichées telles quelles en
français), et 12 qui interpolent un identifiant d'entité.

- **Le modèle existe déjà dans le dépôt** : `org-billing.hooks.ts` fait
  `t(CHECKOUT_ERROR_KEYS[err.message] ?? 'billing.error')` — le texte serveur sert de **clé**,
  jamais d'affichage. C'est la même idée que `promoteBusinessCode` dans `normalizeApiError`.
- **Fini quand** : les refus des repositories de démo sont désignés par un identifiant métier
  catalogué (comme les `RAISE EXCEPTION 'identifiant'` du SQL), `{{message}}` ne reçoit plus qu'un
  texte de catalogue, et une garde le verrouille avec son témoin. ⚠️ Ne pas se contenter de
  traduire les 45 phrases françaises : c'est le **tuyau** qui est le défaut, pas son contenu du jour.

### C-63 · `useClaimShareLink` lance l'erreur PostgREST brute, et l'appelant l'identifie par son message · **P2 · S**

> ✅ corrigé le 2026-09-04 · le hook normalise, l'appelant branche sur le CODE, et la branche par défaut REPOSE le jeton au lieu de le consommer.

Trouvé par l'audit **A-7**. `src/modules/friends/share-link.hooks.ts` fait `if (error) throw error`
sans `normalizeApiError`, et `ShareInviteClaimer` trie ensuite sur le **texte** :

```ts
const msg = error.message || '';
if (msg.includes('own_link')) …
else if (msg.includes('expired_link')) …
else toast.error(t('shareInvite.invalid'));      // ❌ branche par défaut affirmative
```

**Scénario d'échec** : le réseau tombe, ou la RPC répond `42501`, ou PostgREST rend un 500. Le
message ne contient aucun des deux identifiants, donc l'utilisateur lit « ce lien d'invitation est
invalide » — une affirmation **définitive et fausse**, sur le chemin d'acquisition que `CLAUDE.md`
protège explicitement (le partage de tâches est gratuit, c'est le levier viral). Il n'a plus aucune
raison de réessayer, et le jeton a déjà été retiré du `localStorage` avant l'appel.

C'est la même classe que le bug corrigé le 2026-09-02 dans `query-retry.ts`, dont le commentaire
reconnaît d'ailleurs le résidu : « quelques chemins lancent encore l'erreur Supabase sans la
normaliser ».

- **Inventaire complet des rethrows bruts** : 8 sites. Sept sont sans conséquence (les cinq de
  `mfa.ts` valident la réponse à la frontière et l'appelant n'affiche que des clés de catalogue ;
  `BugReportModal`, `HabitsAdGate`, `PremiumGateModal` et `PremiumPage` attrapent et affichent une
  clé, avec repli `mailto` pour le premier). Seul celui-ci décide d'un message.
- **Fini quand** : le refus est identifié par un **code** (`normalizeApiError` + `promoteBusinessCode`
  reconnaissent déjà `own_link` / `expired_link` s'ils sont catalogués), la branche par défaut dit
  « nous n'avons pas pu vérifier ce lien, réessayez » plutôt que « invalide », et le jeton n'est
  retiré du stockage qu'après un refus **nommé**.

### C-64 · `AppErrorBoundary` n'offre qu'un rechargement, là où `RootErrorBoundary` offre une sortie · **P2 · S**

> ✅ corrigé le 2026-09-04 · `hardSignOut` partagée par les deux frontières, repli aux tokens de thème. Un test vérifie que deux déclenchements de suite laissent encore un geste.

Trouvé par l'audit **A-7**, en mesurant C-61. `RootErrorBoundary` a été écrit pour une raison
nommée dans son propre en-tête : « le pire n'était pas l'écran vide, c'était l'impasse ». Il porte
donc un `hardSignOut()` qui purge les clés de session et repart sur `/`.

`AppErrorBoundary`, qui est **plus bas dans l'arbre et attrape donc en premier**, n'offre que
« Rafraîchir la page ». Quand la cause est déterministe — une valeur de stockage, une réponse d'API
mise en cache, une préférence — le rechargement ramène le même écran, ce qui a été **mesuré** sur
C-61. L'utilisateur n'a alors aucun geste disponible.

- Accessoirement, son repli est peint en couleurs écrites en dur (`#666`, `#3b82f6`) au lieu des
  tokens de thème, alors que `RootErrorBoundary` assume son couple noir/blanc pour une raison
  explicite (le thème peut ne jamais avoir été posé). Ici le thème est posé : l'écran d'erreur est
  la seule surface du produit qui ignore le thème choisi.
- **Fini quand** : le repli plein cadre propose la même sortie de secours que la racine, et un test
  vérifie qu'une frontière déclenchée deux fois de suite laisse encore un geste possible. ⚠️ Ne pas
  toucher au repli `null` (widget secondaire) : c'est une option volontaire de l'API du composant.

---

## 6. i18n

### C-20 · Le contenu éditorial est monolingue · **P2 · XL**

11 articles de blog (`src/content/blog/*.mjs`) et 4 pages cas d'usage (`src/content/use-cases.mjs`)
n'ont **aucune dimension de locale**, soit 15 des 24 pages prérendues. C'est ce qui interdit
d'ajouter `en` à `INDEXABLE_LOCALES` : un visiteur anglophone verrait l'interface en anglais et les
articles en français.

- **Fini quand** : le contenu porte sa locale, et `en` peut entrer dans `INDEXABLE_LOCALES` en
  suivant la procédure de `docs/SEO.md`. ❌ Ne jamais ouvrir la locale avant le contenu.

### C-21 · 71 valeurs `en` identiques au `fr` · **P3 · S**

3 % des 2 476 clés, concentrées sur `taskModal` (10 %), `eventModal` (9 %) et `admin` (6 %). Une
partie est légitimement identique (noms propres, symboles). **Chiffres du 2026-08-14, non
remesurés.**

- **Fini quand** : remesuré, puis les non-légitimes traduites.

### C-22 · ~~`i18n:scan` à 25~~ · **P3 · S** · ✅ clos le 2026-09-03, remplacé par C-38

Le seuil est descendu à 0 et `npm run i18n:scan -- --list` est vide. **Cela ne veut pas dire que le
produit n'a plus de chaîne en dur** : c'est exactement le piège que C-38 documente. L'item est clos
sur son énoncé (« le seuil vaut 25 »), pas sur son intention.

### C-38 · `i18n:scan` annonce ZÉRO, et l'interface anglaise parle français · **P1 · M**

**Mesuré dans le navigateur le 2026-09-03**, serveur de dev, locale `en`, arbre d'accessibilité lu
sur la page rendue :

- `/en/login` expose `button "Afficher le mot de passe"` et `button "Fermer"` ;
- `/en/habits` affiche le titre **« Habitudes »** et la ligne **« Progression : 90% (9/10) »**,
  au-dessus d'un tutoriel, lui, en anglais.

Pendant ce temps, `npm run i18n:scan -- --list` rend `FICHIERS: 0 | CHAINES UNIQUES: 0`.

C'est la **troisième** fois que ce cliquet certifie un état qu'il ne mesure pas (accents seuls en
août, quatre formes aveugles le 2026-09-02, celle-ci). Deux angles morts, tous deux structurels :

1. **Une chaîne qui n'est pas le premier jeton après `=` ou `{`.** Le motif (2) des `PATTERNS`
   exige la chaîne immédiatement après `attribut=` ou `attribut={`. Il ne voit donc jamais
   `aria-label={cond ? 'A' : 'B'}`, la forme la plus courante du dépôt. Une trentaine
   d'occurrences visibles rien que dans `src/components` : `AuthForm:356`, `CollaboratorItem:180`,
   `HabitModal:304` et `:442` (« Sauvegarder » / « Créer l'habitude »), `ListActionsSheet:200`,
   `OKRModalSheet:161`, `SmartListMenu:128`, `TaskFilter:273`, `TaskModal:51`,
   `task-modal/TaskModalDesktopBody:368`, `task-table/TaskCard:171`, `:338`, `:382`, `:416`,
   `task-modal/DeleteTaskConfirm:56-57`, `ShareListSheet:139-140`, `EventModalFormDesktop:182`,
   `EventModalFormMobile:102`.
2. **La liste `FR_STOPWORD` est fermée**, et il y manque les verbes d'interface les plus courants :
   `masquer`, `afficher`, `sauvegarder`, `creer`, `epingler`. `aria-label="Masquer l'astuce"`
   (`TaskTable:617`) est un attribut simple, sans accent : le motif le capture, le vocabulaire le
   rejette.

S'y ajoutent des chaînes hors JSX que personne ne cherche : les placeholders tournants de
`QuickAddBar` (4), les en-têtes du CSV exporté par `TeamOverviewTab:169`, le message d'erreur
`'Erreur lors de la suppression. Veuillez réessayer.'` (`useTaskModal:599`) et ses deux jumeaux dans
`save-task.ts:158` et `:238`, et les pluriels concaténés à la main `tâche{s}` des trois modales
`add-to-list`, qui violent en plus la règle « une clé = une phrase ».

Hors `src/components`, la même sonde remonte notamment `HabitsPage:142` et `:149` (le titre et la
progression vus ci-dessus), `CommandPalette:142`, `SettingsPage:421`, `ResetPasswordPage:141`
et `:181`, `ForgotPasswordPage:42` et `:137`.

**Troisième angle mort, ajouté par l'audit A-7 le 2026-09-03**, vérifié en exécutant les filtres du
script sur des échantillons : `CODE_QUOTING` rend `true` sur
`throw new Error('Vous ne faites pas partie de cette entreprise')` **et** sur
`toast.error('Impossible de créer le lien')`. Toute chaîne passée en **argument de fonction** est
donc classée « code ». C'est précisément l'endroit où vivent la centaine de messages d'erreur de
**C-62**. Et le filtre « identifiant seul » jette tout mot unique sans mot-outil français : le
libellé « Recharger » de `RootErrorBoundary` est invisible pour cette raison, alors que le bouton
voisin passe, lui, par `t('rootError.signOut')`.

⚠️ **Ne pas corriger le scanner à l'aveugle.** `scripts/i18n-scan.mjs` est en cours de modification
par une autre session au moment de cet audit (c'est elle qui a descendu `MAX_STRINGS` à 0). Le
correctif se coordonne, sinon les deux se marchent dessus. Cet item **remplace** C-22, dont le
chiffre de 25 n'est plus celui du dépôt.

#### État au 2026-09-03 (fin de journée) — la moitié est faite

**Fermé.** Le scanner est passé à **cinq** familles de motifs et sa liste de mots-outils a été
élargie. Trois angles morts de plus ont été comblés, dont deux qui n'étaient pas dans l'énoncé
ci-dessus :

- les MESSAGES rendus par du code — `return '…'`, `throw new Error('…')`, `return { error: '…' }` ;
- le corps d'une chaîne excluait les **trois** guillemets à la fois, donc une apostrophe dans une
  chaîne à guillemets doubles rendait la valeur incapturable (« Aujourd'hui ») → `QUOTED` borne
  désormais le corps par SON propre délimiteur ;
- le filtre « identifiant seul » jetait « Demain », un mot français isolé ressemblant à un
  identifiant → il ne s'applique plus à une valeur qui porte un mot-outil français.

La mesure élargie a fait apparaître **22 chaînes** que le seuil à ZÉRO certifiait absentes, dont les
**cinq sections de la landing** rendues intégralement en français alors que leurs 40 clés traduites
dormaient dans `landing.json` **sans un seul consommateur**. Toutes externalisées ; le seuil est
revenu à 0 sur la nouvelle mesure.

⚠️ **Les deux derniers angles morts n'ont pas été trouvés en relisant le scanner, mais en lui
soumettant les chaînes qu'il était censé voir.** Les deux premiers avaient été corrigés en croyant
le travail fini. C'est la leçon opérationnelle de cet item.

**Reste ouvert — les deux angles morts de l'énoncé d'origine, tous deux confirmés le 2026-09-03 :**

1. **La forme ternaire.** `aria-label={cond ? 'A' : 'B'}` : le motif (2) exige la chaîne
   immédiatement après `attribut=` ou `attribut={`, et `cond ? ` n'est pas de l'espace. **49
   occurrences dans 35 fichiers** (mesuré par `grep`, pas estimé — l'énoncé disait « une
   trentaine »), et le scanner en voit **zéro**.
2. **Le vocabulaire fermé.** `masquer`, `afficher`, `sauvegarder`, `creer`, `epingler` manquent
   toujours à `FR_STOPWORD`. Témoin encore vivant : `TaskTable.tsx:617`
   `aria-label="Masquer l'astuce"` — attribut simple, sans accent, invisible pour la mesure.

⚠️ Ces deux points ont été vérifiés **par lecture du motif et par `grep`**, pas en exécutant une
sonde : `npm test` et Bash étaient indisponibles à ce moment. Le premier geste du correctif est donc
de les REMESURER en soumettant les cas au scanner.

> ### ✅ Remesuré par sonde le 2026-09-03 (audit A-4) · les deux angles morts sont confirmés
>
> Le geste demandé juste au-dessus a été joué : un fichier `src/__i18n_probe.tsx` a été posé, ne
> contenant que des chaînes que le scan est censé voir, puis retiré.
>
> ```tsx
> <span>{cond ? format(new Date(d + "T12:00:00"), "d MMM yyyy", { locale: l() }) : 'Aucune'}</span>
> <span>{ok ? 'Terminee' : 'Aucune'}</span>
> <label className="y">Date</label>
> ```
>
> `node scripts/i18n-scan.mjs --list` rend **`FICHIERS: 0 | CHAINES UNIQUES: 0`**. Le verdict n'est
> donc plus déduit du motif, il est mesuré : **la forme ternaire est bien invisible**, y compris sur
> `'Aucune'`, dont le mot est pourtant DANS `FR_STOPWORD`.
>
> **Le mécanisme exact, qui n'était pas encore nommé** : ce n'est pas seulement le motif (2) qui
> rate la forme. Le motif (1), celui du texte JSX, capture bien tout le contenu entre `>` et `<`,
> ternaire compris, mais `looksLikeCode` le jette ensuite sur `CODE_QUOTING`
> (`/['"]\s*[,:)\]]|[,:(\[]\s*['"]/`) : **le deux-points d'un ternaire est indistinguable de celui
> d'un littéral d'objet**. Toute chaîne française placée après un `:` de ternaire est donc écartée
> comme du code, quel que soit son vocabulaire. C'est pour cela qu'élargir `FR_STOPWORD` ne
> refermera **que le second** angle mort.
>
> Le même passage remonte 41 valeurs dans 23 fichiers `.tsx` avec un vocabulaire élargi, contre 49
> dans 35 fichiers au comptage `grep` de l'énoncé : les deux ordres de grandeur concordent, l'écart
> venant du vocabulaire de la sonde, pas du produit.



- **Où** : `scripts/i18n-scan.mjs` (les deux angles morts restants), puis les fichiers listés.
- **Fini quand** : une sonde à vocabulaire OUVERT, qui regarde les chaînes dans une expression JSX,
  et le scanner rendent le même verdict sur `src/components` ; le seuil descend à 0 sur la NOUVELLE
  mesure ; et `/en/login` comme `/en/habits` sont relus **dans le navigateur**. ❌ Ne jamais
  réécrire « plus une seule chaîne en dur » : la phrase a déjà été vraie de la mesure et fausse du
  produit **quatre** fois.

---

## 7. Accessibilité

### C-23 · Durcir la gate axe-core de `critical` à `serious` · **P2 · S**

Écrit comme « le prochain geste, et il est bon marché » depuis que A-8 est tranché. **Chiffré le
2026-09-03 (A-3)**, ce qui manquait pour savoir si c'était vrai : les dix routes scannées rendent
**zéro `critical`** et, une fois dédoublonnées, **trois** violations `serious` distinctes, toutes
de contraste, toutes portées par **deux tokens** :

| Ratio | Couleur | Sur | Où | Pages touchées |
|---|---|---|---|---|
| 3,76 | `--color-error` `#ef4444` | blanc | « · N en retard » de `DeadlineReminder` | 8 / 10 |
| 3,63 | `--color-error` `#ef4444` | `#fffafa` | compteur de retard d'une ligne | 8 / 10 |
| 4,31 | `--color-accent-solid` `#2563eb` | `#e3ebfa` | lien d'action du même bandeau | 9 / 10 |

C'est donc **bon marché mais pas gratuit** : `--color-error` en thème clair est `red-500`, sous les
4,5:1 sur blanc. `red-600` (`#dc2626`) vaut 4,83:1 et suffit. Le troisième est le bleu de marque
sur son propre fond teinté, cousin de **C-25** : même arbitrage, autre surface.

- ⚠️ **La mesure ne couvre PAS un écran ouvert** : axe-core ne scanne que l'état initial de chaque
  route. Les modales, menus et calendriers ne sont dans aucun de ces chiffres.
- **Fini quand** : `assertNoCritical` devient `assertNoSerious`, la CI est verte, et les trois
  violations ci-dessus sont corrigées et non exemptées.

### C-24 · Quatre audits d'accessibilité jamais faits · **P2 · L** · 🟠 trois sur quatre faits le 2026-09-03

**A-3 en a passé trois** (parcours clavier, modales, `/agenda`), au clavier et dans le navigateur,
avec un harnais à témoin : `e2e/a11y-keyboard-audit.spec.ts`. Ils ont rendu **C-51 → C-55**, dont
trois corrigés dans la foulée.

- ❌ **VoiceOver iOS sur un vrai appareil reste entier**, et il ne se simule pas : aucun appareil
  réel n'était accessible à cette session. C'est la même limite que **A-4**, et les deux se feront
  ensemble ou pas du tout.
- ⚠️ Ce qui a été mesuré l'a été **sur Chromium desktop**. Un lecteur d'écran ne lit pas l'arbre
  d'accessibilité comme Playwright : ce qui est prouvé ici, c'est le FOCUS, pas l'annonce.
- **Fini quand** : le quatrième est fait et ses findings sont ici.

### C-25 · Le bleu de marque est à 3,34:1 · **P3 · XS**

Résiduel de A-8, laissé en **arbitrage produit** depuis le 2026-08-24. Un arbitrage qui ne se rend
pas devient un oubli.

- **Fini quand** : soit la teinte change, soit la décision « on garde, voici pourquoi et où c'est
  acceptable » est écrite dans `ACCESSIBILITY.md`.

### C-51 · ~~Le calendrier COSMO ne se pilotait pas au clavier, sur ses huit surfaces~~ · **P1 · S** · ✅ corrigé le 2026-09-03

Le 2026-08-30 avait corrigé `Button` en `forwardRef` et prouvé « Flèche droite passe du 30 au 31
août ». **Ce n'était vrai que si le focus se trouvait déjà dans la grille.** Mesuré le 2026-09-03,
en ouvrant le calendrier au clavier (Entrée sur le champ) depuis la modale OKR :

| Geste | Avant | Après |
|---|---|---|
| ouvrir le calendrier | focus sur le preset « Aujourd'hui » | focus sur le jour sélectionné, dans la grille |
| mois affiché, champ à « 2 décembre 2026 » | **septembre 2026** (le mois courant) | décembre 2026 |
| `→` `→` `↓` | aucun mouvement, trois fois | 3 déc. → 4 déc. → 11 déc. |

**Trois causes distinctes, aucune visible en relecture** :

1. `initialFocus` est **mort** depuis `react-day-picker` 9 : la prop survit dans les types, marquée
   dépréciée, et `useFocus` ne lit plus que `autoFocus`. Exactement la classe du `Button` non
   `forwardRef` — une prop écrite pour une autre version majeure, qui ne fait **rien**, en silence.
2. Radix `PopoverContent` pose le focus sur le **premier** élément focalisable, c'est-à-dire la
   rangée de presets. Sur une rangée de boutons, les flèches ne font rien : on croit être dans un
   calendrier et rien ne bouge. Corrigé par un `onOpenAutoFocus` qui vise le jour `tabindex="0"`.
3. `selected` **ne pilote pas** le mois affiché : sans `defaultMonth`, un champ déjà rempli ouvrait
   le mois courant. Le jour focalisé était alors hors de la grille rendue, et `moveFocus` ne
   trouvait aucune cible — d'où des flèches inertes même une fois le focus au bon endroit.

- 🔴 Ce défaut portait sur les **huit** surfaces qui montent `DatePicker` (échéance de tâche,
  OKR, OKR d'équipe, tâche d'équipe, dépendances perso et équipe, planification d'événement).
- **Garde** : `e2e/a11y-keyboard-audit.spec.ts` assertionne l'ouverture, le mouvement des flèches
  et l'absence de libellé anglais. Vue rouge (`arrowMoved: false`) avant d'être verte.

### C-52 · ~~Le calendrier annonçait « Go to the Previous Month » en français~~ · **P2 · XS** · ✅ corrigé le 2026-09-03

`react-day-picker` ne traduit **aucun** de ses libellés ARIA : `locale` ne porte que les DATES.
Relevé dans l'arbre d'accessibilité du calendrier ouvert :

> `["Navigation bar", "Go to the Previous Month", "Go to the Next Month", ..., "Today, jeudi 3 septembre 2026"]`

Un lecteur d'écran francophone entendait donc l'anglais sur le composant de saisie de date de tout
le produit, et « Today, jeudi 3 septembre 2026 » mélangeait les deux langues dans la même phrase.
Après correctif : `["Raccourcis de date", "Navigation du calendrier", "Aller au mois précédent",
"Aller au mois suivant", ...]`.

- 🔴 **`i18n:scan` ne pouvait pas le voir, et ne le pourra jamais** : ces chaînes vivent dans
  `node_modules`, pas dans `src/`. Le cliquet à 0 reste vrai et reste aveugle à cette famille.
- Même famille, corrigée avec : le bouton de fermeture par défaut de `DialogContent` s'appelait
  `Close`, en dur dans la source shadcn amont, sur **sept** composants du produit. Garde :
  `src/components/ui/dialog.test.tsx`, vue rouge avant d'être verte.
- La rangée de presets, qui est la première chose que rencontre le focus, n'avait **aucun nom** :
  elle est maintenant un `role="group"` nommé.

### C-53 · Aucune modale maison ne piège le focus · **P1 · L**

**58 fichiers** montent une surface modale hors `ui/dialog` (recensés par balayage de `src/`), et
le dépôt ne contient **aucun** utilitaire de piège de focus ni **aucune** capture de
`document.activeElement` : rien ne restitue le focus au déclencheur. Deux cas mesurés au clavier,
conteneur = l'overlay réel, avec témoin Radix vert sur les trois détecteurs :

| Modale | focus entre ? | piégé ? | Échap ferme ? | `role` | `aria-modal` |
|---|---|---|---|---|---|
| *témoin* « Créer une tâche » (Radix) | oui | **oui** | oui | `dialog` | absent |
| `HabitModal` | oui (champ) | **non**, sort sur `BODY` | **non**, une fois le focus sorti | absent | absent |
| `EventModal` | **non**, reste sur « Nouveau » | **non** | **non**, aucun gestionnaire | absent | absent |

**Scénario d'échec concret**, `EventModal`, au clavier seul : sur `/agenda`, Tab jusqu'à
« Nouveau », Entrée. La modale s'ouvre, le focus **reste sur le bouton derrière elle**. Le premier
Tab atteint « Réunion d'équipe », un événement du calendrier **masqué par l'overlay**. Échap ne
fait rien. On remplit donc un formulaire qu'on ne peut pas atteindre, en parcourant une page qu'on
ne voit plus.

`HabitModal` est un cran au-dessus (un champ prend le focus, Échap marche **tant qu'on est
dedans**) et montre pourquoi : le gestionnaire d'Échap est un `onKeyDown` **sur l'overlay**, donc
il dépend de la remontée d'un évènement React depuis l'élément focalisé. Focus sorti, Échap mort.

- ⚠️ **`aria-modal` manque partout, y compris sur le témoin Radix** — c'est acceptable pour Radix,
  qui neutralise les frères par `aria-hidden` ; ça ne l'est pas pour une modale maison, qui ne fait
  ni l'un ni l'autre.
- ❌ **Ne pas corriger 58 fichiers un par un.** Il faut UN composant (ou un hook) qui porte le
  piège, la restitution du focus, Échap et `role="dialog" aria-modal="true"`, puis y faire passer
  les surfaces, en commençant par celles qui portent une saisie.
- **Fini quand** : le harnais mesure `trapped: true`, `focusMovedIn: true` et `escClosed: true` sur
  `EventModal`, `HabitModal` et les feuilles mobiles, et le fichier de mesure passe de
  `console.log` à `expect`.

### C-54 · `/agenda` : les jours du calendrier sont hors d'atteinte au clavier · **P2 · M**

Premier audit du pattern ARIA de FullCalendar, mesuré sur `/agenda` en démo :

- **`focusableDays: 0`** sur 8 cellules de jour. Les **événements** sont atteignables (3 sur 3, ce
  sont des `<a>`), mais **aucune case vide ne l'est**. Or créer un événement se fait en cliquant
  un créneau : **ce geste n'a aucun équivalent clavier**, il faut passer par le bouton « Nouveau ».
- **38 tabulations** pour aller du haut de la page au premier événement, dont **onze** boutons
  « Options de la tâche » consécutifs du panneau latéral, tous nommés pareil. Il n'y a **aucun lien
  d'évitement**.
- Une `<table>` porte `role="grid"` avec **zéro descendant focalisable géré** : un motif de grille
  annoncé mais non implémenté, ce qu'axe-core ne signale pas.

- ⚠️ **Ce finding décrit, il ne prescrit pas.** Le prompt A-3 demandait de dire ce qui est
  atteignable sans chercher à tout réparer : rendre les jours navigables demande d'adopter le
  motif grille de FullCalendar, ce qui n'est pas un correctif de passage.
- **Fini quand** : un lien d'évitement existe vers le contenu principal, et soit les créneaux
  vides sont atteignables au clavier, soit la décision « on garde, le bouton Nouveau est le chemin
  clavier » est écrite dans `ACCESSIBILITY.md`.

### C-55 · Trois surfaces que A-3 n'a PAS réussi à mesurer · **P3 · S**

Honnêteté de couverture, pas finding de produit. Trois choses cherchées sans y arriver, qu'il ne
faut donc pas croire vérifiées :

1. **Le calendrier ouvert depuis une entrée de MENU** — `OverdueBanner` (« Tout replanifier ») et
   `TaskBulkActionsBar` (« Modifier la deadline »). Le premier n'apparaît pas dans le jeu de démo
   (aucune tâche en retard) ; sur le second, cocher une tâche en mode sélection laissait
   « 0 sélectionnée », donc la barre restait désactivée. C'est la surface la plus risquée des huit :
   une **grille** vit à l'intérieur d'un `role="menu"`, ce que l'ARIA n'autorise pas, et les
   correctifs de C-51 (`autoFocus`) n'ont **pas** été éprouvés dans ce conteneur-là.
2. **Le bouton « Plus d'actions » de la barre de sélection n'est jamais jugé stable** par
   Playwright — 34 tentatives, jamais immobile. Une barre qui n'arrête pas de bouger est un
   soupçon, pas une preuve, mais il mérite d'être regardé.
3. **En mode sélection, les cases à cocher gardent le nom « Marquer comme complétée »** alors
   qu'elles sélectionnent. Relevé dans l'arbre d'accessibilité, non confirmé par un clic réussi.

- **Fini quand** : les trois sont mesurés, dans le navigateur, et rendent un finding ou un « rien ».

### C-57 · Cibles tactiles sous 44 px : 16 × 16 px pour cocher une tâche sur l'accueil · **P2 · M**

> 🟠 corrigé le 2026-09-04 · **18 commandes sous la cible → 0** sur six routes, par la
> primitive `TouchTarget` que l'arbitrage nomme (posée d'abord en classes à la main,
> ce qui donnait le même pixel et ratait le point : le dépôt a déjà un item, C-10, sur
> des primitives que personne n'adopte donc que rien n'éprouve).
>
> ⚠️ Les « 42 boutons à 40×40 sur /okr » ne se reproduisent PAS : `/okr` rendait 1 sur
> 58 avant correctif, et c'était un bouton *inline* (exception WCAG 2.5.5).
>
> 🔴 **CE QUE LA GARDE NE VOIT PAS, et un cas trouvé en le vérifiant** : elle ne mesure
> que l'ÉTAT INITIAL de six routes. Rien dans une modale n'est compté. Relevé au
> passage, non corrigé : le bouton de suppression d'un commentaire d'équipe
> (`TaskCommentsSection`) fait **28 × 28 px**. Même classe, hors du périmètre de
> l'item et de son arbitrage — à traiter avec les surfaces modales.

Trouvé par l'audit **A-4**. `docs/MOBILE.md` porte « ❌ Touch target < 44 × 44 px (WCAG 2.5.5) »
dans sa liste « Ne jamais faire », et la ligne « cibles tactiles » de son tableau de note n'a pas
été recomptée depuis le 2026-08-27.

**Mesuré le 2026-09-03**, dans le navigateur, mode démo, viewport 375 × 812, en ne comptant que les
vraies commandes (`button`, `[role="button"]`, `input[type=checkbox]`) et jamais les liens de texte,
qui relèvent de l'exception « inline » de WCAG 2.5.5 :

| Route | Sous la cible | Total | Tailles rencontrées |
|---|---|---|---|
| `/dashboard` | **6** | 33 | **16 × 16** (×3), 173 × 32, 263 × 32 |
| `/entreprise` | **6** | 20 | **24 × 24** (×3), 146 à 203 × 32 |
| `/okr` | **43** | 54 | **40 × 40** (×42), 153 × 40 |
| `/tasks`, `/habits`, `/settings` | **0** | 181 | rien sous la cible |

Deux défauts de nature différente, à ne pas traiter ensemble :

1. 🔴 **16 × 16 px pour `Marquer « … » comme terminée`** sur `/dashboard`, et 24 × 24 sur
   `/entreprise`. C'est le geste principal du produit, sur son écran d'accueil, à moins de la
   moitié de la cible. **Scénario d'échec** : le doigt tombe à côté et ouvre la tâche au lieu de la
   cocher, ou ne déclenche rien ; sur une liste dense, deux cases voisines sont à quelques pixels
   l'une de l'autre.
2. 🟠 **42 boutons à 40 × 40 px sur `/okr`**, soit 4 px de manque, de façon systématique
   (« Modifier l'objectif », « Supprimer l'objectif », les incréments de KR). Une seule valeur à
   corriger, pas 42 décisions.

- ⚠️ Les trois routes propres sont exactement celles que le design system mobile a migrées, et les
  trois routes fautives celles qu'il n'a jamais touchées. C'est la même cause racine que le finding
  « le design system mobile n'a jamais été adopté » de `MOBILE.md`, pas un défaut indépendant.
- ⚠️ **Mesure en viewport émulé**, pas sur un appareil : la taille en pixels CSS est la même, mais
  le taux de ratage réel ne se mesure qu'avec un doigt. Cf. `a-faire-manuel.md` §7, M-25.
- **Fini quand** : les cases à cocher passent à 44 px de zone tactile (l'icône peut rester petite,
  c'est le `TouchTarget` du dossier `mobile/` qui porte exactement ce contrat), les 40 px d'`/okr`
  passent à 44, et une garde compte les commandes sous la cible sur les routes protégées, avec un
  témoin qui refuse un détecteur qui ne détecterait plus rien.

### C-69 · La fenêtre produit tourne toute seule, sans pause, y compris en mouvement réduit · **P2 · S** · 🟠 arbitrage rendu : on garde

Trouvé par l'audit **A-8** en cherchant autre chose. `AppWindowShowcase` (le mockup du hero de `/`)
change de vue toutes les **2,5 s**, indéfiniment. La rotation n'est gatée que par `useInView` : il
n'y a **ni bouton de pause, ni arrêt au survol, ni au focus**, et surtout **aucun égard pour
`prefers-reduced-motion`**.

**Mesuré le 2026-09-03** sur le build de prod, en relevant la vue annoncée toutes les 600 ms
pendant ~9,6 s :

| Préférence | Vues traversées |
|---|---|
| `no-preference` | `tasks` → `agenda` → `okr` → `habits` (avec les états de transition) |
| **`reduce`** | **`tasks` → `agenda` → `okr` → `habits`** — exactement la même rotation |

C'est un échec **WCAG 2.2.2 « Pause, Stop, Hide », niveau A** : un contenu qui démarre
automatiquement, dure plus de cinq secondes et est présenté en parallèle d'autre contenu doit
pouvoir être mis en pause. Ici il est présenté à côté du H1 et des CTA, c'est-à-dire exactement le
texte qu'un visiteur essaie de lire.

- ⚠️ Ce n'est **pas** la cause de la lenteur de C-67 : couper la rotation ne déplace pas la mesure
  (3 238 ms contre 3 053). Les deux findings sont indépendants, et celui-ci est un défaut de
  conformité, pas de performance.
- ⚠️ `MotionConfig reducedMotion="user"` (dans `App.tsx`) ne couvre pas ce cas : il neutralise les
  animations de transform de Framer, pas un `setInterval` ni une transition d'opacité.
🟠 **Arbitrage rendu par Axel le 2026-09-03 : on conserve le comportement actuel.** L'item
reste donc **ouvert**, et il n'est pas refermé : la décision porte sur le fait de ne rien changer
aujourd'hui, pas sur le fait que le défaut n'existe pas. Ce qu'elle laisse en l'état, dit une fois :
un échec WCAG 2.2.2 de **niveau A** sur la première page du site, c'est-à-dire la marche la plus
basse, celle qu'un audit d'accessibilité relève en premier, et l'EAA s'applique à un service vendu à
des consommateurs.

- **Si la décision change, fini quand** : la rotation ne démarre pas sous `prefers-reduced-motion`
  (les quatre vues restent atteignables autrement, la rangée de puces `HeroModuleDock` étant déjà
  cliquable-compatible), une commande de pause existe pour les autres, et un test couvre les deux
  préférences. ❌ Ne pas se contenter de ralentir : la conformité demande un **contrôle**, pas une
  cadence plus douce.

---

## 8. Tests et gardes

### C-26 · La couverture n'a pas été relancée depuis le 2026-08-29 · **P1 · S**

Dernière mesure verte : 29,17 L · 28,81 S · 23,41 F · 24,17 B. Depuis, **+215 tests** mais aussi un
dénominateur qui a grossi (onboarding, calendrier, deadline, catégories). La marge la plus serrée est
`functions`, et elle est déjà tombée à 0,32 point une fois.

- **Fini quand** : `npm run test:coverage` est vert, les quatre chiffres sont inscrits avec leur
  date, et les seuils du glob `supabase.repository.ts` sont **remontés** si le gain est acquis.
  ❌ Jamais un seuil baissé.

### C-27 · Les parcours livrés en septembre n'ont pas de test E2E · **P2 · M**

`FirstRunSetup` (25 tests unitaires, aucun parcours), le calendrier COSMO sur ses six surfaces, et
les dépendances de tâches **personnelles** (les tests E2E existants portent sur l'entreprise). Le
nombre de cas E2E n'a pas été recompté depuis le 2026-08-25 (124 alors, 16 specs aujourd'hui).

- **Fini quand** : un parcours E2E par écran neuf, et le décompte réel inscrit dans `TESTING.md`.

### C-28 · Le canal d'alerte d'ops est inerte · **P1 · XS (code) + geste d'Axel**

`ci-alert.yml` pousse désormais les échecs de garde sur `OPS_ALERT_WEBHOOK_URL`, **et ce secret
n'existe pas dans les secrets Actions du dépôt** (il n'existe que côté Supabase). Tant qu'il manque,
la seule voie restante est l'issue GitHub, c'est-à-dire le canal qui n'a **pas** été lu pendant
quatre jours pendant qu'un script tiers exfiltrait email et nom.

- **Fini quand** : le secret est posé (Axel), l'exercice à blanc `workflow_dispatch` a été joué, et
  le message est arrivé dans le salon.

### C-34 · `renewal-notice.yml` sort en VERT quand son secret est absent · **P1 · XS**

> ✅ corrigé le 2026-09-04 · secret absent = `exit 1`, plus un témoin qui refuse un run où `curl` n'a rendu aucun code HTTP.

Trouvé par l'audit **A-1**, et c'est **le motif exact retiré d'`uptime.yml` le 2026-09-03**, encore
en place dans un autre fichier :

```yaml
if [ -z "$CRON_SECRET" ]; then
  echo "::warning::CRON_SECRET absent, aucun avis declenche…"
  exit 0    # ❌ run vert sur une obligation quotidienne non tenue
fi
```

**Mesuré le 2026-09-03**, en appelant la fonction déployée : `POST /functions/v1/renewal-notice`
répond `503 {"error":"cron_secret_not_configured"}`, avec ou sans en-tête. **Le secret n'est donc
posé ni côté Supabase ni côté Actions** : le workflow prend la branche `::warning::` tous les jours
depuis sa création, en vert. La fonction, elle, échoue fermé — c'est le seul point qui a tenu.

Sans conséquence aujourd'hui (0 `org_subscriptions`, mesuré), et sans aucun signal le jour où il y en
aura un. C'est exactement la définition d'une garde qui répond sans mesurer.

- **Fini quand** : secret absent = `exit 1`, comme pour toute autre garde, et le workflow porte un
  témoin. La pose du secret elle-même est un geste d'Axel : `a-faire-manuel.md`.

### C-35 · Rien ne compare le code déployé des Edge Functions à celui du dépôt · **P1 · M**

Trouvé par l'audit **A-1**, et c'est son résultat le plus lourd. Les trois sources déployées ont été
lues via l'API le 2026-09-03 et comparées à `main` : **les trois divergent, de trois façons
différentes**.

| Fonction | Version déployée | Ce qui tourne réellement en prod |
|---|---|---|
| `delete-account` | v13, 2026-09-02 | Variante **absente du dépôt** : elle a les correctifs `R-03` et `R-06` du 09-02, mais **pas** la purge symétrique de `friends` committée le 08-24. Elle échouerait à `src/rgpd-erasure.guard.test.ts`, qui est vert. |
| `renewal-notice` | v9, 2026-08-26 | Le défaut **S-4**, que `faille.md` déclare corrigé : `BUG_REPORT_FROM ?? 'Cosmo <bug@thecosmo.app>'`, domaine que Resend ne signera jamais. |
| `report-bug` | v8, 2026-08-29 | Le **même** défaut S-4, jamais repéré à l'époque. Le correctif existe, non committé, dans l'arbre de travail d'une autre session. |

- ⚠️ Aucune donnée n'est perdue aujourd'hui par le premier point : la migration 116 a basculé
  `friends_friend_user_id_fkey` en `ON DELETE CASCADE` (remesuré), donc la cascade fait le travail
  que le code déployé ne fait plus. **La garde couvre le dépôt, la prod exécute autre chose.**
- **Pourquoi c'est P1** : toute conclusion tirée en lisant `supabase/functions/` est fausse d'avance,
  y compris celles de `faille.md`. Un « ✅ corrigé » sur une Edge Function ne veut rien dire sans la
  date de déploiement.
- **Fini quand** : un script de CI lit les sources déployées (API Management) et échoue si l'une
  diffère du dépôt, avec un témoin ; et chaque statut de finding portant sur une Edge Function cite
  sa version déployée. Les déploiements eux-mêmes sont des gestes d'Axel : `a-faire-manuel.md`.

### C-36 · `report-bug` et `renewal-notice` n'ont aucune garde, d'aucune sorte · **P2 · S**

> ✅ fait le 2026-09-04 · `src/edge-mail-functions.guard.test.ts`, trois détecteurs avec témoins. Elle retire les commentaires avant de lire : ces fichiers CITENT leurs anciens défauts.

Seul `delete-account` en a une (`src/rgpd-erasure.guard.test.ts`). Les deux autres n'ont **aucun
test**, alors que `renewal-notice` a déjà porté une garde inversée (`if (SECRET && …)`, introduite
puis corrigée le 2026-08-26) et que rien n'empêche sa réintroduction.

- **Fini quand** : une garde textuelle par fonction, chacune avec son témoin. Au minimum : la garde
  de `renewal-notice` échoue fermé sur secret absent, `report-bug` n'a pas de valeur par défaut
  d'expéditeur, et aucune des deux ne renvoie un corps d'erreur du fournisseur.

### C-47 · La suite de tests rend des échecs FAUX sous charge, et personne ne peut les distinguer des vrais · **P2 · S**

> ✅ corrigé le 2026-09-04 · `maxWorkers: 2` + délais à 20 s. **Quatre runs consécutifs sur arbre gelé, verdict identique** (plus trois autres en concurrence). ⚠️ Sept runs, pas dix. Coût : ~210 s contre ~176.

Observé **trois fois le 2026-09-03**, sur le même arbre, à quelques minutes d'intervalle :

| Run | Verdict | Réalité |
|---|---|---|
| 1 | 3 échecs (`UseCasePage`, `AuthForm.confirmation`, `FirstRunSetup`) | les 3 passent isolément |
| 2 | 2107 / 2107 ✅ | — |
| 3 | 1 échec (`TeamTasksToolbar.filter`) | passe isolément (3/3) |

Et un rejeu isolé a lui-même échoué sans exécuter un seul test :
`Error: [vitest-pool-runner]: Timeout waiting for worker to respond`, 63 s pour zéro cas.

**Pourquoi ça compte plus qu'un désagrément** : ce dépôt a plusieurs sessions actives sur la même
machine. Un rouge n'y prouve rien, et le réflexe qu'il installe — « c'est sûrement la contention,
je rejoue » — est exactement celui qui fera passer une vraie régression. C'est la même classe que le
§ « une garde se vérifie sur ce qu'elle REGARDE » de `CLAUDE.md` : ici la garde répond, mais sa
réponse n'est pas fiable.

- **Où** : `vitest.config.ts` (`pool`, `poolOptions`, `testTimeout`, `hookTimeout`).
- **Piste** : borner la concurrence (`maxForks`/`maxThreads`) plutôt que de laisser vitest saturer
  la machine, et relever le délai d'attente du worker. `--pool=threads` a suffi à rendre le cas
  isolé vert là où `forks` échouait à démarrer : ce n'est pas une preuve, c'est une piste.
- **Fini quand** : dix runs consécutifs de `npm test` sur un arbre inchangé rendent le **même**
  verdict, machine chargée comprise. ❌ Ne pas « corriger » en retirant des tests ni en relevant un
  seuil de tolérance d'échec.

---

## 9. Ce qui n'est PAS du code

Rappelé ici uniquement pour qu'on ne le cherche pas dans ce fichier. **Statuts tenus ailleurs, ne
pas les dupliquer** :

> 📋 **La liste des gestes, elle, vit dans [`a-faire-manuel.md`](./a-faire-manuel.md)** (créé le
> 2026-09-03) : ce qui se règle avec tes mains, dans une console, à un guichet ou sur un vrai
> téléphone. Elle ne porte aucun statut non plus, elle nomme pour chaque ligne le fichier qui le
> tient.

| Sujet | Où | Nature |
|---|---|---|
| Immatriculation, domiciliation, médiateur (T-32, T-33, T-34) | `ROADMAP-60J.md` | guichet |
| Bascule Stripe live, recette carte réelle, réarmement (T-36, T-38, T-39) | `ROADMAP-60J.md` | console + décision |
| Secrets `CRON_SECRET`, `OPS_ALERT_WEBHOOK_URL`, `VITE_TURNSTILE_SITE_KEY` | `ROADMAP-60J.md` | console |
| DPA des sous-traitants, dont Vesk (T-43, V-1) | `faille.md` | contractuel |
| PITR, plan Supabase (A-9, T-01) | `faille.md` | décision assumée |
| Annuaires et Search Console (T-21, T-22) | `ACQUISITION-BACKLINKS.md` | manuel |
| Mot de passe historique du `.env` fuité (T-09, seconde moitié) | `ROADMAP-60J.md` | Axel seul |
| Passer l'audit **A-4** sur un vrai téléphone (§10) | `a-faire-manuel.md` §7, M-25 | appareil en main |
| Déployer les 3 Edge Functions (C-29, C-35) | `a-faire-manuel.md` §8, M-30 | ligne de commande |
| Poser les secrets `CRON_SECRET` et `OPS_ALERT_WEBHOOK_URL` (C-28, C-34) | `a-faire-manuel.md` §3, M-11 et M-12 | console |

---

## 10. Couverture · ce que cette liste ne peut PAS contenir

**Cette liste est exhaustive de ce qui est CONNU. Elle ne l'est pas du produit.** Une zone
n'a jamais reçu de revue dédiée, et une cinquième vient d'en recevoir une aux trois quarts. Les défauts qui y dorment ne peuvent pas figurer ici, par construction : *un finding qu'on n'a jamais cherché n'est ni
vrai ni faux, il est absent.*

Ce dépôt a déjà mesuré ce que vaut une zone non lue, deux fois. Les Edge Functions Stripe
affichaient « 0 finding ouvert » depuis le 2026-08-24, et la première lecture, le 2026-09-02, en a
rendu **six**. Les trois fonctions NON-Stripe n'avaient jamais été relues : **A-1, passé le
2026-09-03, en a rendu huit** (C-29 → C-36), dont deux P1 qui ne se voyaient qu'en interrogeant la
production. La seconde moitié de `src/components` n'avait jamais été lue non plus : **A-5, passé le
2026-09-03, en a rendu huit** (C-37 → C-44), dont un mesuré en ouvrant simplement l'application en
anglais. Et `src/modules`, où vivent les deux implémentations qui doivent se comporter pareil,
n'avait jamais été relu : **A-2, passé le 2026-09-03, en a rendu trois** (C-48 → C-50), plus un
complément à C-46 et **deux correctifs livrés**. Enfin, aucun audit n'avait jamais été fait **au
clavier** : **A-3, passé le 2026-09-03, en a rendu cinq** (C-51 → C-55) et **trois correctifs**,
dont un défaut que la documentation déclarait corrigé depuis le 2026-08-30. Enfin, personne n'avait
regardé ce que voit l'utilisateur **quand ça casse** : **A-7, passé le 2026-09-03, en a rendu
quatre** (C-61 → C-64), plus un complément à C-38 et **un correctif livré** — dont un P1 qui fermait
l'application entière à quiconque navigue avec les données de site bloquées.

### ✅ A-1 · les 3 Edge Functions non-Stripe · passé le 2026-09-03

Ce qu'il a rendu, et comment c'est mesuré :

| Finding | Comment il a été établi |
|---|---|
| **C-29** · lecture avalée qui détruit une organisation | lecture de code + `pg_constraint` en prod : 22 FK vers `organizations(id)`, 21 en CASCADE |
| **C-30** · la cascade emporte les preuves L215-1 et L221-28 | même introspection : `renewal_notices` et `withdrawal_consents` en CASCADE, `payment_records` en SET NULL |
| **C-31** · `report-bug` est un relais d'e-mail sans limite | appel réel avec la seule clé anon → `400 invalid_body` |
| **C-32** · allowlist de pièce jointe décorative | lecture du contrat Resend : la pièce jointe est typée par son nom |
| **C-33** · panne d'auth qui anonymise l'auteur | lecture de code, famille C-29 |
| **C-34** · `renewal-notice.yml` vert sur secret absent | appel réel → `503 cron_secret_not_configured`, donc le secret n'est nulle part |
| **C-35** · les 3 sources déployées divergent du dépôt | lecture des 3 sources déployées via l'API, comparées à `main` |
| **C-36** · deux fonctions sur trois sans aucune garde | inventaire des tests |

Ce qu'il a **infirmé**, et qui est donc clos : l'autorisation ne vient jamais du corps de la requête
(les trois dérivent l'identité du JWT ou d'un secret), aucun message brut de Resend ou de Postgres ne
remonte à l'appelant, la garde `if (SECRET && …)` de `renewal-notice` n'est pas revenue, le
commentaire qui protège `payment_records` est bien en place, et la couverture des tables portant
`user_id` a été comparée ligne à ligne à l'introspection de la prod : aucune table n'échappe à
l'effacement. Le seul angle mort restant du côté stockage est un objet du bucket `avatars` qui ne
s'appellerait pas `avatar.jpg` — le produit n'en écrit jamais d'autre, mais la policy ne l'interdit
pas ; c'est noté ici et pas ailleurs, faute d'exposition mesurable (0 objet dans le bucket).

### ✅ A-5 · la seconde moitié de `src/components` · passé le 2026-09-03

232 fichiers que le lot du 2026-09-02 (commit `8f2a6e8`, 42 fichiers) n'avait pas touchés. Il a
rendu **huit** findings, C-37 → C-44. La densité de la seconde moitié n'était effectivement pas plus
faible que celle de la première.

| Finding | Comment il a été établi |
|---|---|
| **C-37** · six « Annuler » perdent l'identifiant | recherche du motif exact que `restore-id.ts` documente comme fautif, puis comptage des consommateurs de `useRestoreTask` (un seul, `AgendaPage`) |
| **C-38** · le cliquet i18n dit 0, l'interface anglaise parle français | `/en/login` et `/en/habits` ouverts dans le navigateur, arbre d'accessibilité lu ; sonde à vocabulaire ouvert confrontée à `i18n:scan -- --list` |
| **C-39** · un admin non propriétaire peut supprimer l'entreprise | `pg_get_functiondef('delete_organization')` et `pg_policy` lus en prod, comparés au gating de l'écran |
| **C-40** · douze écrans annoncent une absence pendant le chargement | sonde avec témoin sur `data: x = []` + état vide sans `isLoading`, trois cas vérifiés au rendu |
| **C-41 → C-43** · trois gestes destructeurs sans filet | lecture, puis comparaison avec le chemin jumeau qui, lui, a le filet (`TasksPage`, `useAgendaEventActions`) |
| **C-44** · allowlist anti-XSS sans test | inventaire des `dangerouslySetInnerHTML` et des tests de `src/components/ui/` |

Ce qu'il a **infirmé**, et qui est donc clos pour cette zone : les mutations ne meurent pas en
silence (les `onError` des hooks de module toastent, y compris quand le composant ajoute un
`console.error` que la prod supprime), `DeleteOrganizationDialog` est un modèle du genre pour la
confirmation extrême, `AppErrorBoundary` remonte bien à Sentry, et les `catch {}` de `src/components`
sont tous des accès `localStorage` gardés volontairement (règle B14).

⚠️ **Deux limites de cet audit, à dire plutôt qu'à laisser croire.** Le panneau navigateur est
resté à un viewport 0 × 0 pendant la première moitié de la session : aucune conclusion n'a été tirée
de cet état, et la vérification à l'écran n'a repris qu'après avoir forcé une taille. Et le parcours
clavier complet des écrans lus ici n'a **pas** été fait : c'est A-3, il reste entier.

### ✅ A-2 · `src/modules` : repositories, hooks, parité démo ↔ Supabase · passé le 2026-09-03

Vingt-deux modules, 21 407 lignes hors tests. La zone est celle où **deux implémentations doivent
se comporter pareil**, et c'est bien là qu'était le défaut le plus coûteux.

**Deux correctifs livrés**, vus rouges avant d'être verts (`src/modules/okrs/repository.test.ts`,
trois cas de régression) :

- **Le clamp de la faille B18 n'existait que côté Supabase.** Le champ de progression d'un KR est
  un `input[type=number]` **sans `max`** qui remonte à chaque frappe : taper « 50000 » demandait
  5, puis 50, puis 500, puis 5 000, puis 50 000 reps. Le repository Supabase borne à 100 depuis
  B18 ; le repository localStorage écrivait tout. **Mesuré** : ~20 s de fil principal bloqué, puis
  un `QuotaExceededError` des 5 Mo remonté brut. La borne est désormais **une constante partagée**
  (`MAX_REPS_PER_WRITE`, portée par le journal lui-même) : elle ne peut plus diverger.
- **Les reps étaient datées de l'achèvement du KR, pas de l'instant.** `kr.completedAt ?? now()`
  au lieu de `now()` : ajouter une rep à un KR déjà terminé écrivait au journal une ligne datée du
  jour de son achèvement, donc **invisible du graphique « KR réalisés »** du tableau de bord. Le
  serveur a toujours utilisé `now()`.

**Quatre `eslint-disable react-hooks/exhaustive-deps` supprimés** (sur les 36 de C-06) : `tasks`,
`habits`, `okrs` et `kr-completions` mémoïsaient leur repository par `useMemo(…, [isDemo])`, là où
six autres modules appellent simplement le factory. La mémoïsation était redondante — le factory
est déjà un singleton paramétré par `appModeStore.isDemo` — et son commentaire était **faux** :
`resetRepositories()` est appelé cinq fois dans `AuthContext`, dont des chemins où `isDemo` ne
change pas, où la mémo rendait alors l'instance que le factory venait de jeter. Vérifié au
préalable que la référence n'entre dans **aucun** tableau de dépendances.

| Finding | Comment il a été établi |
|---|---|
| **C-48** · le refus de cycle dit deux choses, aucune lisible | sondes exécutées : `normalizeApiError({code:'P0001', message:'This dependency would create a cycle'})` ne contient plus le mot « cycle » ; le repository local rejette bien sur la phrase anglaise brute, qui atterrit dans le gabarit français |
| **C-49** · 52 des 206 hooks exportés n'ont aucun consommateur | balayage hors tests et hors barils, **validé par témoin** : les six hooks connus comme vivants rendent 7 à 27 consommateurs, les 52 autres zéro |
| **C-50** · quatre fabriques de clés survivent à la mig. 129 à vide | recherche de chaque clé dans tout `src` : ni lecteur ni invalidateur |
| *complément à C-46* | le `QuotaExceededError` mesuré ci-dessus, qui montre que le côté **écriture** demande une décision, pas du câblage |

Ce qu'il a **infirmé**, et qui est donc clos pour cette zone — c'est la moitié utile du rapport :

- **Les six RPC obligatoires sont les seuls chemins de liste.** `get_my_tasks`,
  `get_my_team_tasks`, `get_my_team_projects`, `get_my_team_task_dependencies`, `get_my_habits`,
  `get_my_org_inbox` : aucun `.from()` direct hors des exceptions légitimes (`getById`, insert,
  update, delete, et `task_dependencies` personnelles).
- **Aucune écriture ne contourne sa whitelist.** Pas un seul `...input` répandu dans un `insert`
  ou un `update` ; `user_id` est toujours posé depuis la session (ou depuis la cible, sous la
  policy `events_manager_insert`), jamais depuis un payload.
- **Le contrat `restoreId` est identique sur les cinq modules** qui le portent : second argument
  de `create()`, jamais un champ du payload.
- **`getById` rend `null` de la même façon partout** (`PGRST116` côté Supabase, `?? null` côté
  local), et les jeux de méthodes des deux repositories coïncident, module par module.
- **Les quatre `refetchInterval` restants sont bien conditionnels**, et ce sont bien les quatre
  fichiers que `polling.guard.test.ts` nomme.
- **Deux invalidations manquantes repérées n'ont aucun symptôme**, et c'est mesuré, pas déduit :
  supprimer une tâche n'invalide pas le graphe de dépendances, mais ses deux seuls consommateurs
  filtrent déjà les arêtes orphelines (`computeCriticalPath` le fait explicitement) ; et
  `statsKeys` n'est invalidé par personne, parce que `useWorkTimeStats` est délibérément en
  `staleTime: 0`. ❌ Ne pas les « corriger » : il n'y a rien à corriger.
- **Les `JSON.parse` de `src/modules` sont tous gardés** (règle B14, côté lecture).

⚠️ **Limite de cet audit, à dire plutôt qu'à laisser croire.** Tout ce qui précède vient de la
lecture du code et de sondes exécutées en Node, **pas du navigateur**. C-48 en particulier décrit
ce qu'un utilisateur lit à l'écran : la chaîne a été prouvée maillon par maillon (repository →
`onError` → gabarit du catalogue), elle n'a pas été photographiée. Et la parité démo ↔ Supabase
n'a été éprouvée par exécution que là où elle était en doute — le reste est une lecture comparée.

### ✅ A-3 · accessibilité manuelle : clavier, modales, `/agenda` · passé le 2026-09-03

Le premier audit de ce dépôt à se faire **au clavier**, sans souris. Harnais :
`e2e/a11y-keyboard-audit.spec.ts`, qui embarque son **témoin** — une modale Radix sur laquelle les
trois détecteurs (entrée du focus, piège, Échap) doivent répondre « conforme ». S'il échoue, aucune
mesure du fichier n'a de valeur. Il a rendu **C-51 → C-55**, plus le chiffrage qui manquait à C-23.

| Finding | Comment il a été établi |
|---|---|
| **C-51** · le calendrier ne se pilotait pas au clavier | ouverture à la touche Entrée puis trace des flèches : `["2 déc.", "→ 2 déc.", "→ 2 déc.", "↓ 2 déc."]` — trois pressions, zéro mouvement ; puis lecture de `useFocus` dans `node_modules` |
| **C-52** · libellés ARIA anglais | arbre d'accessibilité du calendrier ouvert, avant / après |
| **C-53** · aucune modale maison ne piège le focus | 15 Tab depuis l'overlay réel, sur `HabitModal` et `EventModal`, témoin Radix vert ; plus l'absence, vérifiée dans tout `src/`, du moindre `activeElement` capturé |
| **C-54** · `/agenda` : jours hors d'atteinte | comptage des descendants focalisables de `.fc`, puis marche clavier réelle jusqu'au premier événement (38 tabulations) |
| **C-55** · trois surfaces non mesurées | échec des sondes, dit plutôt que masqué |
| *chiffrage de C-23* | dix routes scannées, violations dédoublonnées par (ratio, couleurs, taille) |

**Trois correctifs livrés**, chacun vu rouge avant d'être vert : les trois causes de C-51
(`autoFocus` au lieu d'`initialFocus` mort, `onOpenAutoFocus` qui vise la grille au lieu des
presets, `defaultMonth` manquant), les libellés ARIA de C-52, et le bouton de fermeture
`DialogContent` qui s'appelait `Close` sur sept composants.

Ce qu'il a **infirmé**, et qui est donc clos : le défaut du 2026-08-30 (`Button` non `forwardRef`)
n'est pas revenu — une fois le focus dans la grille, les flèches naviguent bien, jour par jour et
semaine par semaine ; Échap ferme le calendrier ; les **événements** de `/agenda` sont tous
atteignables au clavier ; et les dix routes scannées ne rendent **aucune** violation `critical`.

⚠️ **Trois limites de cet audit, à dire plutôt qu'à laisser croire.**

1. **VoiceOver iOS n'a pas été fait**, et n'a pas été simulé. Ce qui est prouvé ici, c'est le
   déplacement du FOCUS ; ce qu'un lecteur d'écran ANNONCE ne l'est pas. C-24 reste ouvert pour ça.
2. **Tout vient de Chromium desktop**, viewport de bureau. Les feuilles mobiles sous
   `prefers-reduced-motion` réellement émulé restent à parcourir — `e2e/reduced-motion-sheets.spec.ts`
   couvre leur POSITION, pas leur parcours clavier.
3. **Deux modales sur cinquante-huit** ont été mesurées. L'absence totale d'utilitaire de piège de
   focus dans le dépôt rend le résultat généralisable, mais c'est une inférence : les cinquante-six
   autres n'ont pas été ouvertes.

### 🟠 A-4 · mobile sur appareil réel · TENTÉ le 2026-09-03, moitié appareil NON FAITE

🔴 **Cet audit reste dans le tableau ci-dessous, et ce n'est pas un oubli.** Son périmètre est « le
produit connecté sur un appareil RÉEL », et son livrable exige pour chaque finding **le modèle, la
version d'OS et le navigateur**. Aucun appareil n'était accessible : son propre prompt tranche ce
cas, un audit sans appareil devient « à refaire », pas « fait ». Le protocole de reprise, écran par
écran, est dans [`a-faire-manuel.md`](./a-faire-manuel.md) §7 (M-25).

Ce que la moitié **indépendante de l'appareil** a quand même rendu, mesuré en viewport émulé et par
sonde, jamais déduit :

| Finding | Comment il a été établi |
|---|---|
| **C-56** · le haut de trois écrans devient inatteignable, clavier ouvert | carte de `FirstRunSetup` reconstruite avec sa liste de classes réelle dans le CSS du projet, viewport 375 × 350 : haut à **-28,8 px** pour un `scrollTop` déjà nul, course de défilement de 70 px pour 124 px de débordement |
| **C-57** · cibles tactiles sous 44 px | comptage des commandes (jamais des liens de texte) sur six routes en démo à 375 × 812 : 16 × 16 px pour cocher une tâche sur `/dashboard`, 42 boutons à 40 × 40 sur `/okr`, zéro sur les trois routes migrées |
| *remesure de **C-38*** | le geste que C-38 réclamait explicitement : une sonde soumise au scanner, qui rend `0` sur trois chaînes qu'il devrait voir, et qui nomme enfin le mécanisme (`CODE_QUOTING` confond le `:` d'un ternaire avec celui d'un littéral d'objet) |

Ce qu'il a **infirmé**, et qui est donc clos, chaque point mesuré plutôt que lu :

- **le plancher de 16 px sur les champs tient**, y compris là où une classe Tailwind explicite le
  contredit : `input[type=time]` avec `text-[15px]`, `input[type=date]` avec `text-[0.765997rem]`
  et `input[type=text]` avec `text-[15px]` calculent **tous 16 px** à 375 px de large. iOS Safari ne
  zoomera donc pas au focus sur la saisie d'événement. C'était le premier soupçon de cet audit, et
  il était faux ;
- **`/entreprise` ne cache rien derrière la barre d'onglets**, alors que sa racine ne porte que
  `py-6`, soit 24 px : mesuré défilement en butée, l'élément le plus bas finit à 679 px pour une
  barre qui commence à 747. C'est `Layout` qui réserve la place, pas la page. Rien à corriger, mais
  la page ne tiendrait pas seule ;
- **`FirstRunSetup` est sain sous `prefers-reduced-motion`** : il passe par `useSlideUpEntrance`,
  qui n'émet **aucune** clé de transform dans ce mode, donc aucune valeur résiduelle ne peut le
  laisser hors écran ;
- **la conversion jour vers instant de la ligne de date mobile est correcte** :
  `EventModalFormMobile` formate par `new Date(startDate + "T12:00:00")`, donc midi **local**, le
  seul motif qui survit aux deux sens de décalage. C'était le point 4 du prompt, et il ne casse pas
  ici. Reste à confirmer sur un appareil réglé sur un fuseau négatif, la roue système étant, elle,
  hors de portée d'une émulation.

⚠️ **Ce que cette moitié ne remplace pas** : la note de 76 / 100 de `docs/MOBILE.md` reste sans
**aucune** mesure sur téléphone, et les pièges qu'elle documente (WebKit, `100vh`, clavier virtuel,
scroll d'un conteneur qui n'est pas `window`) viennent tous de bugs qui ne se voyaient **pas** en
émulation. Un viewport de 375 × 350 modélise Android ; il ne modélise pas iOS, qui ne réduit pas son
viewport de mise en page.

### ✅ A-6 · faisabilité React 19 + `react-router` 8 · passé le 2026-09-03

Une ÉTUDE, comme demandé : aucune version majeure n'a bougé dans `package.json`. Rapport complet
dans [`docs/MIGRATION-REACT19.md`](./docs/MIGRATION-REACT19.md) (chronologie CVE, inventaire ref
par ref, chiffrage). Deux correctifs bornés livrés dans la foulée.

| Finding | Comment il a été établi |
|---|---|
| **C-58** · le blocage sécurité qui forçait React 19 est déjà levé | l'avis GitHub interrogé directement (pas son résumé dans la doc) rend deux plages disjointes, chacune avec son propre correctif ; `npm audit` local et l'API OSV interrogée pour `react-router@7.18.2` (déjà installé) rendent tous les deux zéro vulnérabilité |
| **C-59** · `Input` n'était pas un `forwardRef`, comme `Button` avant lui | balayage exhaustif des 125 `ref={` de `src/**/*.tsx` : `Input` est le seul composant shadcn, avec `Button`, à recevoir un ref quelque part dans le code ; test rouge (`ref.current` à `null`) avant correctif, vert après |
| **C-60** · un `useRef<T>()` sans valeur initiale, cassera sous les types React 19 | `grep` de tout `src/` : un seul site (`useDebounce.ts:69`) |

Ce qu'il a **infirmé**, et qui est donc clos : la quasi-totalité des ruptures officielles React 19
(`ReactDOM.render`/`.hydrate`, `react-dom/test-utils`, `propTypes`, `defaultProps`, refs string,
retours implicites de callback ref) n'a **aucune** occurrence dans ce code ; la nouvelle
transformation JSX est déjà active ; `prerender.mjs` ne fait aucun rendu React côté serveur, donc
les ruptures `react-dom/server` sont hors sujet ; et côté `react-router`, l'app n'utilise que le
mode déclaratif (`<BrowserRouter>`, `<Routes>/<Route>`, `React.lazy`, `AppErrorBoundary` maison) —
aucune des ruptures listées par le CHANGELOG officiel de la v8 (retrait de `react-router-dom`,
champs `meta`/`data`, middleware toujours actif, `splitRouteModules`) ne touche un mode que ce
dépôt n'utilise pas. `basename`, les routes lazy, l'`ErrorBoundary` maison et les slugs localisés
traversent donc la migration sans changement. Il n'y a, de fait, **aucune migration
`react-router` 7 → 8 indépendante à chiffrer** : une fois React 19 posé, c'est une montée de
version. Et `no-open-redirect.test.ts` verrouille une propriété du CODE du dépôt, indépendante de
la version de la bibliothèque.

⚠️ **Limite de cet audit.** Le chiffrage (§5 de `docs/MIGRATION-REACT19.md`) suppose que le
parcours manuel prévu pour PR 1 (`createPortal`, calendrier, audit clavier) ne révèle rien
d'imprévu — c'est une estimation avant exécution, pas une migration déjà éprouvée. Et la relecture
des 24 composants shadcn contre leur version amont s'est limitée à la question du `ref` (le seul
point demandé qui soit falsifiable à l'échelle du dépôt) ; un écart non lié au ref pourrait dormir
ailleurs, cf. la réserve laissée sur C-19.

### ✅ A-7 · les chemins d'erreur du client · passé le 2026-09-03

| Finding | Comment il a été établi |
|---|---|
| **C-61** · un repli d'agrément fermait toute l'app authentifiée | **navigateur**, trois entrées : valeur non-JSON, stockage refusé sur profil neuf, et le bouton de sortie qui rend le même écran |
| **C-62** · une centaine de messages d'erreur hors catalogue | exécution des vrais repositories + du vrai moteur i18n : quatre phrases relevées telles que rendues |
| **C-63** · le claim d'un lien partagé identifie son erreur par le texte | lecture de code + inventaire complet des 8 rethrows bruts, dont 7 sans conséquence |
| **C-64** · la frontière basse n'offre aucune sortie de secours | mesuré en jouant C-61 : « Rafraîchir la page » ramène le même écran |
| complément à **C-38** | exécution des filtres de `i18n-scan.mjs` sur échantillons : `CODE_QUOTING` classe « code » toute chaîne en argument |

Ce qu'il a **infirmé**, et qui est donc clos : les 84 `catch` vides du dépôt ont été inventoriés un
par un, **aucun n'avale un échec de mutation** (tous protègent un accès au stockage) ; sur 104
`useMutation`, **cinq** seulement n'ont pas d'`onError`, et quatre sont volontaires et documentées ;
`isDailyAdLimitError` survit à `normalizeApiError` par sa branche `code === '23514'` ; `mfa.ts`
valide bien sa réponse à la frontière (le correctif du 2026-09-01 tient) ; `BugReportModal` est le
modèle du genre, avec son repli `mailto` ; `safeRedirectPath` protège son `decodeURIComponent` ; et
un balayage complet des initialiseurs de rendu (`useState` / `useMemo`) n'a trouvé **qu'une** lecture
de stockage non protégée dans tout `src/` — celle de C-61.

🔴 **Ce que cet audit n'a PAS pu mesurer, et qui reste donc ouvert** : le `.env` local ne porte
**aucune** valeur Supabase, donc l'application locale tourne intégralement en **mode démo**. Aucun
chemin d'erreur réel de Supabase, de GoTrue ou du réseau n'a pu être provoqué : mot de passe refusé,
session expirée en cours d'usage, coupure réseau pendant une mutation. Le seul écran obtenu en
tentant une connexion est « Supabase non configuré. Vérifiez les variables d'environnement. », qui
mesure la configuration locale, pas le produit. Cette moitié est reportée dans
[`a-faire-manuel.md`](./a-faire-manuel.md) §7 (M-35, M-36).

### ✅ A-8 · le fil principal de la landing · passé le 2026-09-03

Ce qu'il a rendu, et comment c'est mesuré :

| Finding | Comment il a été établi |
|---|---|
| **C-67** · 71 % du fil bloqué AU REPOS, et ce sont les flous · ✅ **corrigé le jour même** | build de prod, fenêtre de 4 s sans scroll ni clic, 3 passes : `/` à 2 856 ms, `/guide` à **0**, et 259 ms une fois les `filter: blur` neutralisés. Après correctif : **0 ms sur les trois passes**, rendu tenu à la mesure de couleur (luminosité 51,5 → 51,1) |
| **C-68** · la landing entreprise bloque autant, pour une autre cause | même protocole : 3 637 ms, insensible aux flous, et **bimodale** (0-370 ms ou 3 000+ ms sur la même URL) |
| **C-69** · la fenêtre produit tourne sans pause, même en mouvement réduit | relevé de la vue annoncée toutes les 600 ms pendant 9,6 s, en `no-preference` puis en `reduce` : rotation **identique** |

Ce qu'il a **infirmé**, et qui est donc clos : la piste que C-12 désignait. `vendor-animation` et
`vendor-gsap` ne sont pas les coupables, et le découpage des chunks n'y est pour rien. Tuer les 23
`ScrollTrigger`, mettre en pause les 8 tweens infinis, couper la rotation de la fenêtre produit :
**aucune de ces trois coupes ne déplace la mesure**. Sont également infirmés, par mesure, quatre
correctifs « évidents » : `will-change`, `translateZ(0)`, `contain: paint` et diviser le rayon de
flou par trois ne changent rien. Le `backdrop-filter` ne coûte rien non plus.

**Trois pièges de mesure ont été rencontrés, et deux ont d'abord produit des chiffres faux :**

1. **Muter `el.style` ne tient pas.** React réécrit la prop `style` à chaque rendu, et cette page en
   déclenche un toutes les 2,5 s : la neutralisation disparaît en cours de mesure.
2. **Marquer les nœuds par un attribut ne tient pas non plus.** La rotation de la fenêtre produit
   **remonte des sous-arbres entiers**, et les nœuds neufs n'ont pas la marque. Seule une règle CSS
   `*` survit aux deux. Ces deux pièges ont fait rendre, au même scénario, 405 ms puis 2 679 ms.
3. **L'onglet du panneau navigateur était resté ouvert sur la landing**, donc la page mesurée
   tournait aussi à côté : les passes sont passées de ±3 % à des écarts de 1 à 13. Cousin exact de
   la rétractation du 2026-08-27, où c'était un onglet **caché** qui faussait le sens inverse.

Le harnais qui en sort, `scripts/landing-motion-probe.mjs`, porte donc **deux témoins** : une règle
CSS sans effet, qui doit laisser la mesure inchangée (sinon c'est l'injection qu'on mesure), et un
inventaire structurel qui doit **changer** entre `no-preference` et `reduce` (sinon le détecteur ne
regarde pas les animations). Les deux échouent en rouge et rendent `exit 1`.

### Audits à lancer, par rapport valeur / effort

| # | Audit | Pourquoi maintenant | Ce qu'il rendrait |
|---|---|---|---|
| **A-4** | **Mobile sur appareil réel** (iOS Safari, Android) · 🟠 **moitié appareil restante**, cf. la section juste au-dessus et [`a-faire-manuel.md`](./a-faire-manuel.md) §7 (M-25) | La note mobile n'a toujours **aucune** mesure sur vrai téléphone : la passe du 2026-09-03 n'a pu mesurer qu'en viewport émulé. Les pièges WebKit documentés dans `MOBILE.md` viennent justement de bugs invisibles en émulation | Les bugs de feuille, de clavier virtuel, de `100vh` et de gestes que l'émulation ne montre pas ; et la confirmation iOS de C-56, dont le mécanisme diffère d'Android |

**Les huit prompts sont écrits, prêts à coller** : [`prompts-audits.md`](./prompts-audits.md), A-1
compris, pour qu'on puisse rejouer la mesure. Un
préambule commun porte les règles de méthode du dépôt (mesurer plutôt que déduire, témoin
obligatoire, jamais de seuil baissé, sessions concurrentes), puis un corps par audit avec son
périmètre, ses questions et ses pièges connus.

> **Une fois A-4 passé et ses findings ajoutés ici, la phrase « il ne reste plus un seul
> problème lié au code » devient vérifiable.** Avant, elle ne l'est pas, et l'écrire quand même
> serait exactement le défaut que ce dépôt a corrigé quatre fois en cinq jours : **une réponse
> rassurante donnée par une mesure qui ne regardait pas.**
