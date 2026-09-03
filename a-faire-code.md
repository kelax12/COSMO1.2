# À faire — CODE

**Dressé le 2026-09-03**, contre le code de `main` à `HEAD` (`ff82214`), `faille.md`,
`docs/ROADMAP-60J.md` et les dix audits de `docs/`. Chaque item porte **où c'est**, **pourquoi ça
compte** et **ce qui prouve que c'est fini**.

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

## Sommaire

| § | Domaine | Items |
|---|---|---|
| [1](#1-défauts-fonctionnels-connus) | Défauts fonctionnels connus | C-01 → C-08, C-37, C-40 → C-43 |
| [2](#2-dette-structurelle) | Dette structurelle | C-09 → C-11 |
| [3](#3-performance) | Performance | C-12 → C-14 |
| [4](#4-scalabilité) | Scalabilité | C-15 → C-16 |
| [5](#5-sécurité-et-dépendances) | Sécurité et dépendances | C-17 → C-19, C-29 → C-33, C-39, C-44 |
| [6](#6-i18n) | i18n | C-20 → C-22, C-38 |
| [7](#7-accessibilité) | Accessibilité | C-23 → C-25 |
| [8](#8-tests-et-gardes) | Tests et gardes | C-26 → C-28, C-34 → C-36 |
| [9](#9-ce-qui-nest-PAS-du-code) | Ce qui n'est PAS du code | renvois |
| [10](#10-couverture--ce-que-cette-liste-ne-peut-pas-contenir) | 🔴 Couverture et audits à lancer | 6 audits restants |

---

## 1. Défauts fonctionnels connus

### C-01 · Restaurer un OKR ne restaure pas le journal de ses complétions · **P1 · M**

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

### C-04 · Le mur-pub Habitudes ne consomme pas de jeton · **P2 · S**

`consume_premium_token` n'est **pas câblé côté client** : le mur est piloté par un flag localStorage
daté (`useDailyAdGate('habits')`), pas par le solde de jetons. Inoffensif aujourd'hui
(`PREMIUM_ENFORCED = false`), **c'est un bug le jour où le drapeau passe à `true`** : un utilisateur
qui vide son localStorage ne voit plus jamais le mur, et un jeton crédité ne sert à rien.

- **Fini quand** : le mur lit et consomme le solde serveur, et un test couvre « jeton consommé, mur
  masqué » et « localStorage vidé, mur toujours appliqué ».

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

Deux composants pour le même geste, avec deux garanties différentes. `TasksPage.deleteListById`
supprime avec un « Annuler » qui restaure l'identifiant **et** repose `taskIds` (le commentaire y
explique pourquoi). `add-to-list/DesktopAddToList.tsx:82`, `MobileAddToList.tsx:102` et
`BulkAddToListModal` appellent `deleteListMutation.mutate(listId)` nu : pas de toast d'annulation,
pas de comptage des tâches concernées dans la confirmation.

- **Fini quand** : les trois modales appellent le même flux que `TasksPage` (à extraire), et la
  confirmation dit combien de tâches sont dans la liste.

### C-42 · Un commentaire d'équipe se supprime en un clic, sans confirmation ni annulation · **P2 · XS**

`organization/TaskCommentsSection.tsx:149` : `onClick={() => deleteMutation.mutate(c.id)}`. Aucune
confirmation, aucun « Annuler », et le commentaire disparaît pour toute l'équipe. C'est la seule
suppression du mode entreprise sans aucun filet.

- **Fini quand** : confirmation ou toast « Annuler », au choix, mais l'un des deux.

### C-43 · « Supprimer l'événement lié » supprime N événements sans rien demander ni rien dire · **P2 · S**

`TaskSidebar.tsx:153` : une entrée de menu contextuel, un `linked.forEach(ev => deleteEventMutation.mutate(ev.id))`,
pas de confirmation, pas de comptage, pas de toast de succès, pas d'annulation. L'agenda fait
l'inverse au même endroit du modèle : `useAgendaEventActions` propose `restoreEvent(master)` et
commente pourquoi l'identifiant doit revenir.

- **Fini quand** : le libellé dit combien d'événements partent, et un « Annuler » les restaure par
  `useRestoreEvent`.

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

Le calendrier COSMO a remplacé le picker natif sur six surfaces le 2026-08-30, vérifié **à la main
dans le navigateur**. Rien n'empêche un `input type="date"` de revenir.

- **Fini quand** : une garde compte les `input[type=date]` de `src/` et n'autorise que les deux
  d'`EventModalForm`, avec la raison en commentaire.

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

### C-13 · T-47 · trancher `vendor-sentry` sur le chemin critique · **P3 · S**

49,3 ko gzip payés par tout visiteur. La conclusion « le différer ne rendrait rien » a été
**rétractée le 2026-09-02** : elle venait d'une mesure structurellement aveugle à Sentry. La
question est donc rouverte, et **maintenant mesurable**.

- **Fini quand** : une décision écrite, appuyée sur une mesure prise avec `VITE_SENTRY_DSN` posée.

### C-14 · La marge de budget est de 11,9 ko, et elle a déjà été dépassée une fois · **P1 · M**

Chemin critique **367,1 ko sous 379,0**, entrée **78,4 ko sous 79,0** (run vert du 2026-09-02). Le
lot de la campagne sécurité du même jour a poussé l'entrée à **80,9 ko**, donc au-dessus, et il a
fallu extraire du code pour passer.

- **La sortie n'est pas de relever le plafond**, elle est de regagner de la marge : les catalogues
  i18n de l'entrée, les dépendances tirées par le shell, et C-13.
- **Fini quand** : `npm run check:bundle` rend au moins 5 % de marge sur les deux budgets, sur un
  build avec `VITE_SENTRY_DSN`.

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

### C-17 · `react-router` · la seule sortie est React 19 · **P2 · L**

`GHSA-qwww-vcr4-c8h2` (CSRF en mode RSC) est **inapplicable ici** (aucun RSC dans une SPA Vite), mais
**aucune version ne ferme les deux familles à la fois sous React 18** : rétrograder en 7.11.0
réintroduirait l'open redirect `GHSA-wrjc-x8rr-h8h6`.

- ❌ **Ne jamais lancer `npm audit fix`** sur ce paquet.
- **Fini quand** : PR dédiée React 19 + `react-router` 8. ⚠️ Elle referme aussi C-18 : `Button` a dû
  devenir un `forwardRef` **parce que** la source shadcn amont est écrite pour React 19.
- **Le garde-fou tient en attendant** : `src/lib/no-open-redirect.test.ts` verrouille la propriété
  qui rend l'open redirect inexploitable.

### C-18 · CVE dev-only · **P3 · S**

`vitest`, `eslint`, `vite`, `glob`/`minimatch` : jamais servies au navigateur. `npm audit fix --force`
casse le peer `eslint-plugin-react-hooks` (vérifié en `--dry-run`).

- **Fini quand** : une passe outillage dédiée, jamais mêlée à une passe sécurité.

### C-19 · Les composants shadcn recopiés visent React 19 · **P2 · M**

`Button` a été trouvé cassé (le `ref` n'était jamais attaché, donc un focus clavier mort dans le
calendrier). **Rien ne dit que c'est le seul** : la classe de bug est « composant amont recopié sans
vérifier sa cible React », et elle est silencieuse.

- **Fini quand** : les composants de `src/components/ui/` recopiés depuis shadcn sont relus contre
  leur version amont, et ceux qui reçoivent un `ref` sont testés au clavier.

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

`const { data } = await anon.auth.getUser()` — l'erreur n'est pas lue. Sur panne de l'API auth, un
utilisateur **connecté** est traité comme anonyme : le rapport part sans son adresse et sans
`reply_to`, donc sans aucun moyen de lui répondre, et rien à l'écran ne le dit. Même famille que
C-29, conséquence bien plus faible.

- **Fini quand** : l'échec est distingué de l'absence de session, et le corps du message dit
  « auteur non résolu » plutôt que « non connecté (anonyme) ».

### C-39 · N'importe quel ADMIN peut supprimer l'entreprise depuis l'écran, et la cascade emporte tout · **P1 · M**

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

### C-22 · `i18n:scan` à 25 · **P3 · S**

Le seuil dit ce que la mesure voit, et la mesure est enfin honnête (quatre formes aveugles couvertes
le 2026-09-02). `src/components` est à zéro ; le reste ne l'est pas.

- **Fini quand** : `npm run i18n:scan -- --list` est vide et le seuil descend à 0. ❌ Ne jamais
  relever le seuil, ❌ ne jamais réécrire « plus une seule chaîne en dur » sans avoir lu la liste.

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

⚠️ **Ne pas corriger le scanner à l'aveugle.** `scripts/i18n-scan.mjs` est en cours de modification
par une autre session au moment de cet audit (c'est elle qui a descendu `MAX_STRINGS` à 0). Le
correctif se coordonne, sinon les deux se marchent dessus. Cet item **remplace** C-22, dont le
chiffre de 25 n'est plus celui du dépôt.

- **Où** : `scripts/i18n-scan.mjs` (les deux angles morts), puis les fichiers listés.
- **Fini quand** : une sonde à vocabulaire OUVERT, qui regarde les chaînes dans une expression JSX,
  et le scanner rendent le même verdict sur `src/components` ; le seuil descend à 0 sur la NOUVELLE
  mesure ; et `/en/login` comme `/en/habits` sont relus **dans le navigateur**. ❌ Ne jamais
  réécrire « plus une seule chaîne en dur » : la phrase a déjà été vraie de la mesure et fausse du
  produit trois fois.

---

## 7. Accessibilité

### C-23 · Durcir la gate axe-core de `critical` à `serious` · **P2 · S**

Écrit comme « le prochain geste, et il est bon marché » depuis que A-8 est tranché. Les violations
`serious` sont déjà dumpées dans `test-results/a11y/`, simplement non bloquantes.

- **Fini quand** : `assertNoCritical` devient `assertNoSerious`, la CI est verte, et les violations
  restantes sont corrigées et non exemptées.

### C-24 · Quatre audits d'accessibilité jamais faits · **P2 · L**

`/agenda` (FullCalendar, pattern ARIA non trivial), les modals (focus trap, ESC, `aria-modal`), le
parcours clavier complet, et VoiceOver iOS sur vrai appareil.

- ⚠️ **Le périmètre a grossi le 2026-08-30** : le calendrier COSMO est devenu le composant de saisie
  de date sur six surfaces, et **seul le déplacement du focus** y a été vérifié.
- **Fini quand** : les quatre sont faits et leurs findings sont ici. Cf. audit **A-3** du §10.

### C-25 · Le bleu de marque est à 3,34:1 · **P3 · XS**

Résiduel de A-8, laissé en **arbitrage produit** depuis le 2026-08-24. Un arbitrage qui ne se rend
pas devient un oubli.

- **Fini quand** : soit la teinte change, soit la décision « on garde, voici pourquoi et où c'est
  acceptable » est écrite dans `ACCESSIBILITY.md`.

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

Seul `delete-account` en a une (`src/rgpd-erasure.guard.test.ts`). Les deux autres n'ont **aucun
test**, alors que `renewal-notice` a déjà porté une garde inversée (`if (SECRET && …)`, introduite
puis corrigée le 2026-08-26) et que rien n'empêche sa réintroduction.

- **Fini quand** : une garde textuelle par fonction, chacune avec son témoin. Au minimum : la garde
  de `renewal-notice` échoue fermé sur secret absent, `report-bug` n'a pas de valeur par défaut
  d'expéditeur, et aucune des deux ne renvoie un corps d'erreur du fournisseur.

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

---

## 10. Couverture · ce que cette liste ne peut PAS contenir

**Cette liste est exhaustive de ce qui est CONNU. Elle ne l'est pas du produit.** Deux zones
n'ont jamais reçu de revue dédiée. Les défauts qui y dorment ne peuvent pas figurer ici, par construction : *un finding qu'on n'a jamais cherché n'est ni
vrai ni faux, il est absent.*

Ce dépôt a déjà mesuré ce que vaut une zone non lue, deux fois. Les Edge Functions Stripe
affichaient « 0 finding ouvert » depuis le 2026-08-24, et la première lecture, le 2026-09-02, en a
rendu **six**. Les trois fonctions NON-Stripe n'avaient jamais été relues : **A-1, passé le
2026-09-03, en a rendu huit** (C-29 → C-36), dont deux P1 qui ne se voyaient qu'en interrogeant la
production. La seconde moitié de `src/components` n'avait jamais été lue non plus : **A-5, passé le
2026-09-03, en a rendu huit** (C-37 → C-44), dont un mesuré en ouvrant simplement l'application en
anglais.

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

### Audits à lancer, par rapport valeur / effort

| # | Audit | Pourquoi maintenant | Ce qu'il rendrait |
|---|---|---|---|
| **A-2** | **`src/modules` : repositories et hooks** (parité démo ↔ Supabase, clés React Query, invalidations) | La revue du 2026-09-02 portait sur `src/pages` et `src/lib`. Les modules n'ont jamais été relus en tant que tels, et c'est là que vivent les deux implémentations qui doivent se comporter pareil | Les divergences démo / prod, les clés d'invalidation manquantes (un écran qui ne se rafraîchit plus **en silence**), et les fermetures périmées de C-06 |
| **A-3** | **Accessibilité manuelle** : clavier complet, modals, `/agenda`, VoiceOver iOS | C-24. Un tiers de WCAG est invisible pour axe-core, et le défaut trouvé le 2026-08-30 (flèches mortes dans le calendrier) en est la preuve | Les défauts de focus, d'ordre de tabulation et d'annonce, sur les écrans les plus utilisés |
| **A-4** | **Mobile sur appareil réel** (iOS Safari, Android) | La note mobile n'a **aucune** mesure sur vrai téléphone : tout vient d'un viewport émulé. Les pièges WebKit documentés dans `MOBILE.md` viennent d'ailleurs de là | Les bugs de feuille, de clavier virtuel, de `100vh` et de gestes que l'émulation ne montre pas |
| **A-6** | **Faisabilité React 19 + `react-router` 8** | C-17 et C-19. C'est la seule sortie de la double CVE, et la cause d'un bug déjà rencontré | Un plan de migration chiffré, et la liste des composants shadcn à réaligner |
| **A-7** | **Chemins d'erreur du client** (que voit l'utilisateur quand ça casse) | `R-10` a montré un message d'erreur brut affiché à l'écran, en contradiction avec une règle que le fichier citait dans un commentaire. Personne n'a vérifié les autres | Les fuites de détail technique, les échecs avalés, et les écrans blancs derrière `AppErrorBoundary` |
| **A-8** | **Le fil principal de la landing** | C-12. C'est la seule page lente, et la première que voit un visiteur d'annuaire | L'attribution réelle des 546 à 1 633 ms de blocage, à prendre **sur le runner**, jamais en local |

**Les huit prompts sont écrits, prêts à coller** : [`prompts-audits.md`](./prompts-audits.md), A-1
compris, pour qu'on puisse rejouer la mesure. Un
préambule commun porte les règles de méthode du dépôt (mesurer plutôt que déduire, témoin
obligatoire, jamais de seuil baissé, sessions concurrentes), puis un corps par audit avec son
périmètre, ses questions et ses pièges connus.

> **Une fois A-2, A-3, A-4, A-6, A-7 et A-8 passés et leurs findings ajoutés ici, la phrase « il ne reste plus un seul
> problème lié au code » devient vérifiable.** Avant, elle ne l'est pas, et l'écrire quand même
> serait exactement le défaut que ce dépôt a corrigé quatre fois en cinq jours : **une réponse
> rassurante donnée par une mesure qui ne regardait pas.**
