# À faire — CODE

**Dressé le 2026-09-03**, contre le code de `main` à `HEAD` (`ff82214`), `faille.md`,
`docs/ROADMAP-60J.md` et les dix audits de `docs/`. Chaque item porte **où c'est**, **pourquoi ça
compte** et **ce qui prouve que c'est fini**.

**Ce que ce fichier contient** : uniquement ce qui se corrige **en écrivant du code ou du SQL**.
Tout ce qui se règle dans une console, chez un fournisseur ou au guichet (immatriculation, Stripe
live, secrets, backlinks, DPA, plan Supabase) reste dans [`docs/ROADMAP-60J.md`](./docs/ROADMAP-60J.md)
et [`faille.md`](./faille.md). Le §9 y renvoie sans les recopier, pour qu'aucun statut ne vive à
deux endroits.

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
| [1](#1-défauts-fonctionnels-connus) | Défauts fonctionnels connus | C-01 → C-08 |
| [2](#2-dette-structurelle) | Dette structurelle | C-09 → C-11 |
| [3](#3-performance) | Performance | C-12 → C-14 |
| [4](#4-scalabilité) | Scalabilité | C-15 → C-16 |
| [5](#5-sécurité-et-dépendances) | Sécurité et dépendances | C-17 → C-19 |
| [6](#6-i18n) | i18n | C-20 → C-22 |
| [7](#7-accessibilité) | Accessibilité | C-23 → C-25 |
| [8](#8-tests-et-gardes) | Tests et gardes | C-26 → C-28 |
| [9](#9-ce-qui-nest-PAS-du-code) | Ce qui n'est PAS du code | renvois |
| [10](#10-couverture--ce-que-cette-liste-ne-peut-pas-contenir) | 🔴 Couverture et audits à lancer | 8 audits |

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

---

## 9. Ce qui n'est PAS du code

Rappelé ici uniquement pour qu'on ne le cherche pas dans ce fichier. **Statuts tenus ailleurs, ne
pas les dupliquer** :

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

**Cette liste est exhaustive de ce qui est CONNU. Elle ne l'est pas du produit.** Quatre zones
n'ont jamais reçu de revue dédiée, et une cinquième a été auditée à moitié. Les défauts qui y
dorment ne peuvent pas figurer ici, par construction : *un finding qu'on n'a jamais cherché n'est ni
vrai ni faux, il est absent.*

Ce dépôt a déjà mesuré ce que vaut une zone non lue : les Edge Functions Stripe affichaient
« 0 finding ouvert » depuis le 2026-08-24, et la première lecture, le 2026-09-02, en a rendu **six**.

### Audits à lancer, par rapport valeur / effort

| # | Audit | Pourquoi maintenant | Ce qu'il rendrait |
|---|---|---|---|
| **A-1** | **Les 3 Edge Functions NON-Stripe** : `delete-account`, `report-bug`, `renewal-notice` | Seules les 4 fonctions Stripe ont été auditées. `delete-account` porte le droit à l'effacement (RGPD art. 17) et tourne en `service_role`, donc hors RLS | La même famille de findings que S-1 à S-6 : erreurs avalées, idempotence, autorisations dérivées d'un mauvais champ |
| **A-2** | **`src/modules` : repositories et hooks** (parité démo ↔ Supabase, clés React Query, invalidations) | La revue du 2026-09-02 portait sur `src/pages` et `src/lib`. Les modules n'ont jamais été relus en tant que tels, et c'est là que vivent les deux implémentations qui doivent se comporter pareil | Les divergences démo / prod, les clés d'invalidation manquantes (un écran qui ne se rafraîchit plus **en silence**), et les fermetures périmées de C-06 |
| **A-3** | **Accessibilité manuelle** : clavier complet, modals, `/agenda`, VoiceOver iOS | C-24. Un tiers de WCAG est invisible pour axe-core, et le défaut trouvé le 2026-08-30 (flèches mortes dans le calendrier) en est la preuve | Les défauts de focus, d'ordre de tabulation et d'annonce, sur les écrans les plus utilisés |
| **A-4** | **Mobile sur appareil réel** (iOS Safari, Android) | La note mobile n'a **aucune** mesure sur vrai téléphone : tout vient d'un viewport émulé. Les pièges WebKit documentés dans `MOBILE.md` viennent d'ailleurs de là | Les bugs de feuille, de clavier virtuel, de `100vh` et de gestes que l'émulation ne montre pas |
| **A-5** | **Revue de `src/components`, seconde moitié** | Le 2026-09-02 a traité 16 points sur `src/components`, mais le dossier fait plusieurs centaines de fichiers et la revue s'est arrêtée avec la journée | La même densité de findings que la première moitié |
| **A-6** | **Faisabilité React 19 + `react-router` 8** | C-17 et C-19. C'est la seule sortie de la double CVE, et la cause d'un bug déjà rencontré | Un plan de migration chiffré, et la liste des composants shadcn à réaligner |
| **A-7** | **Chemins d'erreur du client** (que voit l'utilisateur quand ça casse) | `R-10` a montré un message d'erreur brut affiché à l'écran, en contradiction avec une règle que le fichier citait dans un commentaire. Personne n'a vérifié les autres | Les fuites de détail technique, les échecs avalés, et les écrans blancs derrière `AppErrorBoundary` |
| **A-8** | **Le fil principal de la landing** | C-12. C'est la seule page lente, et la première que voit un visiteur d'annuaire | L'attribution réelle des 546 à 1 633 ms de blocage, à prendre **sur le runner**, jamais en local |

> **Une fois A-1 à A-8 passés et leurs findings ajoutés ici, la phrase « il ne reste plus un seul
> problème lié au code » devient vérifiable.** Avant, elle ne l'est pas, et l'écrire quand même
> serait exactement le défaut que ce dépôt a corrigé quatre fois en cinq jours : **une réponse
> rassurante donnée par une mesure qui ne regardait pas.**
