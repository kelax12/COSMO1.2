# Sécurité — findings ouverts & priorités — COSMO 1.2

**Source de vérité sécurité du projet.** Ce fichier ne contient que ce qui est **encore ouvert**
et les **règles durables** tirées des audits.

- Historique complet (preuve des corrections, audits datés 2026-04 → 2026-08, anciens ordres de
  priorité) : [`docs/archive/faille-historique.md`](./docs/archive/faille-historique.md) — **archive, non maintenue**.
- Procédures et patterns : [`docs/SECURITY.md`](./docs/SECURITY.md).
- Dernière vérification de ce fichier contre le code **et contre la prod** : **2026-08-25**.

Légende : 🔴 bloquant · 🟠 important · 🟡 à planifier · ✅ corrigé

---

## Note de sécurité : 82 → **86 / 100** (2026-08-24 → 2026-08-25)

| Ce qui compose la note | 08-24 | 08-25 |
|---|---|---|
| Findings High/Critical exploitables | 0 | 0 |
| Findings ouverts dans le code | 0 (B-1/B-2/B-3 refermés) | 0 |
| Bloquants restants, **hors dépôt** | A-9 (pas de PITR) + 5 réglages de console | **inchangés** |
| Gardes automatiques vertes | 4 | **4** (+ périmètre élargi : 128 policies, 127 migrations) |
| Nouvelle surface livrée **avec** son test de base réelle | · | ✅ `org_member_permissions` (mig. 115) + `e2e/rls/org-permissions.test.ts` |
| Fonctions `anon`-exécutables | 2 (les deux volontaires) | 2 |

**+4, et pas davantage.** Les neuf migrations du 2026-08-25 (`115` → `123`) n'ont ouvert aucune
faille : la plus sensible, un système de permissions par membre, est arrivée avec sa policy, son
trigger de garde en `SECURITY INVOKER`, ses `REVOKE`, et **337 lignes de test d'intégration contre
une vraie base dans le même commit**. C'est la première fois qu'une brique entreprise fait ça, et
c'est ce que la note récompense.

Ce qui l'empêche de monter plus haut n'a pas bougé d'un pouce : **A-9** (plan Free, pas de PITR,
restauration jamais testée) et les réglages de console. Ce sont les deux seules choses qui
séparent « aucune faille connue » de « rattrapable en production », et aucune n'est du code.

---

## Gardes automatiques · état au 2026-08-25

| Garde | Résultat |
|---|---|
| `npm run check:rls` | ✅ **128 policies sur 81 migrations, 0 violation** (120/68 au 08-24) · règle 3 comprise : toute fonction citée par une policy doit rester exécutable par `authenticated` |
| `npm run validate:migrations` | ✅ **127 fichiers, 0 erreur, 6 avertissements**, les **mêmes** 6 qu'au 08-24 : 5 préexistants (doublons `000`/`007`/`010`, deux `FOR UPDATE` sans `WITH CHECK`) + 1 informatif (mig. `110`, trigger de notification en `SECURITY DEFINER`, légitime). Les sept migrations du 25 n'en ont ajouté aucun |
| `npm run typecheck` · `npm run lint` | ✅ 0 erreur (27 warnings Fast-refresh tolérés) — + règle `no-restricted-imports` sur l'alias `@/` |
| `npm run i18n:check` | ✅ 19 namespaces, 0 erreur |
| `npm test` | ✅ **1 736 tests / 151 fichiers**, tous verts (1 583 / 143 au 08-24) |
| `npm run test:coverage` | ✅ **VERTE au 2026-08-25 en fin de journée** (26,96 L / 26,65 S / 21,32 F / 22,75 B). Elle était rouge sur 3 seuils quelques heures plus tôt : refermée par **115 tests de repository**, sans qu'aucun seuil ne soit baissé, et les seuils du glob `supabase.repository.ts` ont été **remontés** (65 → 74 statements). Cf. [`docs/TESTING.md`](./docs/TESTING.md) |
| Advisors Supabase (sécurité) | 5 INFO `rls_enabled_no_policy` (tables analytiques, **deny-all volontaire**), 1 WARN `auth_leaked_password_protection` (= A-10 ci-dessous), 51 WARN `authenticated_security_definer_function_executable` (48 au 08-24 : les 3 nouvelles RPC de lecture), **2** WARN `anon_security_definer_function_executable`, les deux volontaires, aucun de plus après sept migrations |
| Couverture RLS | ✅ **toutes** les tables `public` ont RLS activée (vérifié en prod : `relrowsecurity = false` sur 0 table) |
| Migrations appliquées en prod | ✅ ledger à jour jusqu'à `123_org_subscriptions_billing_interval` (relu en base le 2026-08-25 au soir) |

Les fonctions exécutables par `anon` étaient **cinq** au 2026-08-24. Deux le sont
volontairement : `preview_share_link(uuid)` (aperçu d'un lien d'invitation avant connexion) et
`record_demo_visit(uuid)` (comptage des visites de démo). Toutes deux prennent un UUID non
devinable en argument — à ne pas « nettoyer » par erreur. Les trois autres
(`seed_default_categories`, `validate_team_task_dependency`,
`prevent_team_task_dependency_cycle`) sont des **fonctions de trigger** : Postgres refuse leur
appel direct, elles ne sont donc pas exploitables, mais elles violaient la règle de durcissement
posée par les migrations `064b` / `094b` (cf. B-3). **La mig. `109` les révoque** — l'advisor
retombera à deux dès qu'elle sera appliquée.

## État global

**Aucun finding High ou Critical exploitable** (dernière passe complète : **2026-08-25**, contre
la prod `ykeugqfgklejcdbrmawy`). Risque global : **faible**.

### Ce que la vague du 2026-08-25 a changé (mig. `115` → `123`)

- ✅ **`org_member_permissions` (mig. 115)**, dix droits surchargeables par membre. Nouvelle
  surface d'autorisation, donc nouveau risque potentiel ; elle arrive avec sa policy, un trigger
  de garde en `SECURITY INVOKER` (règle B-3 respectée dès le premier jet, pas après coup), les
  `REVOKE` correspondants, et `e2e/rls/org-permissions.test.ts` contre une base réelle. Deux
  invariants méritent d'être relus avant toute évolution : `assign_targets = NULL` (aucune
  décision → tout le monde) et `{}` (personne) sont **opposés**, et **aucune ligne ne peut être
  posée sur un admin**, sinon un admin se retire un droit et bloque son organisation sans chemin
  de retour.
- ✅ **`friends.friend_user_id` : `SET NULL` → `CASCADE` (mig. 116)**, la prod divergeait du
  dépôt sur la sémantique d'effacement d'une table qui porte l'email et le nom d'un tiers. Défense
  en profondeur : la purge explicite de `delete-account` reste le rempart principal. Détail :
  [`docs/RGPD.md`](./docs/RGPD.md) §2.
- ✅ **Trois RPC de lecture (`117`, `119`, `121`)**, toutes `REVOKE`-ées pour `anon`, exécutables
  par `authenticated` seulement. L'advisor `anon_security_definer_function_executable` est resté à
  **2** (les deux volontaires) après sept migrations : le durcissement de la mig. `109` tient.
- ⚠️ **Une entrée de ledger sans fichier** : `119b_habits_bounded_payload_future_guard` est
  appliquée en prod et n'existe pas dans `supabase/migration/`. Vérifié : son contenu est
  **identique** à celui du fichier `119` du dépôt (le correctif a été replié dans le fichier
  d'origine au lieu d'être versionné à part), donc rejouer le dépôt sur base vierge donne le
  **même** état final. Dérive de forme, pas de fond, mais c'est exactement le motif que
  [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) §5 a mis six semaines à voir la première fois.
  **Règle : un correctif appliqué en prod se versionne sous son propre numéro, jamais par édition
  du fichier déjà appliqué.**

Trois choses ont changé depuis le 2026-08-14 :

- ✅ **La fuite inter-organisations par les helpers RLS est refermée** (mig. `100`, appliquée en
  prod le 2026-08-23). Vérifié en base :
  `has_function_privilege('authenticated', 'get_subtree', 'EXECUTE')` → **false**, idem
  `has_subordinates` et `org_admin_count`. Finding + PoC archivés dans
  [`docs/archive/faille-historique.md`](./docs/archive/faille-historique.md).
- 🟠 **Trois findings ouverts par la vague entreprise du 2026-08-23/24** (migrations `103` → `108`) :
  B-1, B-2, B-3.
- ✅ **Les trois sont refermés, dépôt ET production.** Migration `109` appliquée en prod le
  2026-08-24, vérifiée en base immédiatement après (policy, droits d'exécution, `prosecdef`).
  Advisor `anon_security_definer_function_executable` retombé de 5 à **2** — les deux seules
  fonctions volontaires (`preview_share_link`, `record_demo_visit`).

Un seul **bloquant** subsiste côté sécurité, et c'est un point de **résilience**, pas une faille :
le plan Supabase `free`. Tout le reste est du réglage de console Supabase.

---

## ✅ B-1 · refermé (mig. 109, appliquée en prod le 2026-08-24)

**Ce que c'était.** La mig. `100` a fermé la fuite des helpers en révoquant `EXECUTE` à
`authenticated` sur `get_subtree` — et a réécrit la seule policy qui l'appelait **directement**,
`org_team_members_insert`, en `is_above(org_id, user_id)`. Sept jours plus tard, la mig. `107`
(leads d'équipe) a créé `org_team_members_update` **en réintroduisant le motif supprimé** :

```sql
OR user_id IN (SELECT public.get_subtree(org_id, (select auth.uid())))   -- 🔴
```

Un `WITH CHECK` de policy s'évalue **avec le rôle courant** (`authenticated`), pas avec le
propriétaire : l'appel est refusé au niveau des droits.

**Ce n'était pas une fuite — ça échoue fermé.** C'était une **fonctionnalité cassée en prod** : le
`OR` court-circuite pour un admin et pour quelqu'un qui modifie sa propre ligne, mais dès qu'un
**lead ou manager non-admin** nomme un lead sur un subordonné (`setTeamLead`,
`src/modules/org-teams/supabase.repository.ts`), Postgres renvoie
`ERROR: permission denied for function get_subtree`. Exactement le cas d'usage de la mig. `107`.

**Correctif (mig. 109)** : `public.is_above(org_id, user_id)`, qui est à la lettre
`p_user IN (SELECT get_subtree(p_org, auth.uid()))` (vérifié via `pg_get_functiondef`) — sémantique
identique, droit d'exécution conservé.

**Garde ajoutée** : `npm run check:rls` refuse désormais toute policy citant une fonction révoquée
à `authenticated`. Il rejoue les `GRANT`/`REVOKE` de tout l'historique et évalue l'état final.
Vérifié en réinjectant la régression : le script sort **exit 1** avec le nom de la fonction.
Verrouillé par `scripts/migration-guards.test.mjs`.

## ✅ B-2 · refermé (mig. 109, appliquée en prod le 2026-08-24)

**Ce que c'était.** `invite_friend_to_org` (mig. `105`) n'exigeait que `is_org_member(p_org)`, là
où les deux autres chemins d'entrée dans une organisation sont bien plus stricts — vérifié en prod
sur `pg_policies` :

| Chemin | Qui pouvait l'ouvrir |
|---|---|
| `org_invite_links_insert` (lien / code) | admin **ou** manager ayant des subordonnés (`i_have_subordinates`) |
| `organization_join_requests` (demande spontanée) | l'admin décide (`respond_join_request`) |
| **`invite_friend_to_org` (mig. 105)** | **n'importe quel membre** 🟠 |

Pas d'élévation de privilège (l'entrant arrive `role = 'member'`, `manager_id NULL`) et le quota de
sièges était bien vérifié à l'acceptation ✅ — mais la feuille la plus basse de la pyramide pouvait
faire entrer un tiers, et consommer un siège payant une fois le paywall actif, sans qu'aucun admin
ne l'ait décidé.

**Décision (Axel, 2026-08-24)** : aligner sur le chemin du lien d'invitation. La mig. `109` ajoute
`is_org_admin(p_org) OR i_have_subordinates(p_org)` en tête de la RPC — le **même** prédicat que
`org_invite_links_insert`, pour qu'il n'y ait qu'une seule réponse à « qui peut faire grossir
l'organisation ».

**Le front était déjà aligné, par chance et non par conception** : `OrganizationPage` monte
`InviteFriendsToOrg` sous `isAdmin`, et `AddUnderSheet` sous
`canEdit = isAdmin || isManagerOf(members, currentUserId)` — or `isManagerOf` est, à la lettre,
« quelqu'un a `managerId === moi` », c'est-à-dire `i_have_subordinates`. Aucun changement d'écran
n'a donc été nécessaire ; la clé d'erreur `api.not_allowed_to_invite` est ajoutée aux deux
catalogues comme filet, pas comme parcours attendu.

**Vérifié en base le 2026-08-24** : `invite_friend_to_org(uuid, uuid)` redéployée avec la garde,
signature inchangée.

> ⚠️ **Reste ouvert, non traité** : `org_invitations_select` laisse tout membre lire l'`invitee_id`
> de toutes les invitations, **y compris refusées**, sans date de péremption. Ce ne sont que des
> UUID, mais c'est une trace persistante d'un refus. Cf. [`docs/RGPD.md`](./docs/RGPD.md) §1.

## ✅ B-3 · refermé (mig. 109, appliquée en prod le 2026-08-24)

**Ce que c'était.** La mig. `108` enfreignait deux règles déjà écrites :

1. « Un trigger de garde doit être `SECURITY INVOKER` » (audit du 2026-07-26) —
   `validate_team_task_dependency()` et `prevent_team_task_dependency_cycle()` étaient `DEFINER`,
   alors que la mig. `107`, écrite le même jour, respecte la règle pour
   `freeze_team_membership_identity()`.
2. Pas de `REVOKE … FROM anon` (règle `064b`, réappliquée par `094b`).

**Exploitabilité directe : nulle** (`RETURNS trigger`, Postgres refuse l'appel direct). Mais un
trigger `BEFORE INSERT` s'exécute **avant** le `WITH CHECK` de la RLS : en `DEFINER`, la lecture de
`team_tasks` ignorait la RLS, et les messages d'erreur distinguaient
« `Both tasks must exist` » de « `… single project` » — soit un **oracle d'existence** sur
`team_tasks` hors organisation. Étroit (UUID v4 requis, réponse booléenne), mais c'est la classe
exacte du finding refermé par la mig. `100`.

**Correctif (mig. 109)** : les deux triggers repassent en `SECURITY INVOKER` — le `SELECT`
redevient filtré par la RLS, les deux cas convergent vers `Both tasks must exist`, l'oracle
disparaît — et **quatre** fonctions de trigger sont révoquées pour `anon` **et** `authenticated`
(`validate_team_task_dependency`, `prevent_team_task_dependency_cycle`,
`freeze_team_membership_identity`, `seed_default_categories`).

Ces quatre-là sont exactement celles qui restaient exposées : vérifié en prod le 2026-08-24 sur
les **28** fonctions `RETURNS trigger` du schéma `public`, les 24 autres sont déjà fermées.

**Garde ajoutée** : `npm run validate:migrations` refuse toute nouvelle fonction de trigger sans
`REVOKE` explicite pour les deux rôles, et avertit si elle est `SECURITY DEFINER`. Cliquet à partir
de la mig. `109` — et le contrôle évalue l'**état final** de l'historique, pas chaque fichier
isolément, pour qu'une migration puisse réparer l'oubli d'une précédente.

> **Pourquoi un cliquet et pas un audit rétroactif** : le premier jet, plancher à la mig. `064`,
> sortait 12 erreurs. Vérification en prod : **les 12 étaient des faux positifs** — ces fonctions
> sont déjà révoquées, par des chemins qu'un modèle statique ne voit pas (privilèges par défaut du
> schéma, `REVOKE` hors du jeu de migrations). C'est la limite que `check-rls-advisors.mjs`
> documentait déjà : *un modèle statique de l'historique complet est faux*. Une gate rouge en
> permanence finit ignorée — le remède aurait été pire que le mal.

---

## 🔴 Ouvert — bloquant

### A-9 — Plan Supabase `free` : pas de PITR, restauration jamais testée
Rétention de backup minimale, aucun Point-In-Time Recovery, et le drill de restauration n'a
jamais été exécuté. **RPO réel jusqu'à 24 h, RTO inconnu.**

**Action** (compte, non scriptable) : passer en plan Pro → activer PITR → exécuter le drill de
restauration décrit dans [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) §7. Effort ≈ 1 h.

---

## 🟠 Ouvert — réglages de console Supabase

Aucun ne bloque un déploiement ; tous sont des clics dans le Dashboard.

| # | Action | Où | Effort |
|---|---|---|---|
| A-10 | **Activer « Leaked password protection »** (HaveIBeenPwned) + minimum 12 caractères. La garde client existe, la garde serveur non. | Authentication → Policies | 2 min |
| — | **MFA (TOTP) sur le compte admin.** `/admin` n'est protégé que par l'allowlist `admin_users` + mot de passe, alors que `get_admin_stats` expose toute la volumétrie business. Meilleur rapport effort/risque du dossier. | Authentication | 5 min |
| — | **Vérifier l'allowlist de redirection OAuth** : un wildcard trop large annulerait une partie du bénéfice de PKCE. | Authentication → URL Configuration | 5 min |
| — | **Activer « Secure email change »** (confirmation sur l'ancienne ET la nouvelle adresse). | Authentication | 2 min |
| — | **Vérifier la non-réutilisation du mot de passe `DATABASE_URL` historique** + activer le secret scanning GitHub (le dépôt est **public**). | Supabase + GitHub | 15 min |

---

## 🟡 Ouvert — à planifier

- **`GHSA-qwww-vcr4-c8h2`** (`react-router` ≥ 7.12.0 < 8.3.0, CSRF en **mode RSC**).
  **Inapplicable ici** : aucun RSC dans une SPA Vite. ⚠️ **Ne pas lancer `npm audit fix`** : il
  propose 7.11.0, qui **réintroduirait** l'open redirect `GHSA-wrjc-x8rr-h8h6`. Aucune version ne
  clôt les deux familles à la fois sous React 18 → la sortie est la migration React 19 +
  `react-router` 8, en PR dédiée.
  La propriété qui rend l'open redirect inexploitable (aucune navigation alimentée par un
  paramètre d'URL) est **verrouillée par un test** : `src/lib/no-open-redirect.test.ts`.
- **CVE dev-only** (`vitest`, `eslint`, `vite`, `glob`/`minimatch`) : jamais servies au
  navigateur. `npm audit fix --force` casserait le peer `eslint-plugin-react-hooks` (vérifié en
  `--dry-run`) → mise à jour outillage dédiée, jamais dans une passe sécurité.
- ✅ **N6 — `useUser()` lit l'identité depuis `localStorage`** — **fermé le 2026-08-24**, et pas
  par le chemin prévu. La sortie annoncée était « consommer `useAuth().user` » ; en vérifiant les
  consommateurs, `useUser` n'en avait **aucun**. Tout `src/modules/user` était mort à l'exception
  d'un hook qui écrivait dans `cosmo_user` — une clé que plus rien ne relisait, ce qui cachait un
  bug de parcours en mode démo (cf. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) §4). Le
  module a été supprimé ; il ne reste plus une seule lecture d'identité depuis `localStorage`.

---

## Ordre de priorité avant déploiement prod (à jour 2026-08-25)

Section référencée par [`CLAUDE.md`](./CLAUDE.md) — elle n'existait plus depuis la refonte
documentaire du 2026-08-14, le lien pointait dans le vide. Restaurée ici.

| # | Action | Nature | Qui | État |
|---|---|---|---|---|
| 0 | **`npm run test:coverage`** bloquait tout déploiement (3 seuils manqués). 115 tests de repository ajoutés, seuils du glob remontés | 🔴 CI | · | ✅ **verte au 2026-08-25 en fin de journée**, cf. [`docs/TESTING.md`](./docs/TESTING.md) |
| 1 | Migrations `109`/`110` (B-1, B-2, B-3 + notifications de commentaire) | 🟠 sécurité + feature | — | ✅ **appliquées et vérifiées en prod le 2026-08-24** |
| 1bis | Migrations `115` → `123` (permissions, FK RGPD, RPC indexables, Realtime, payload borné, fuseau des habitudes, périodicité de facturation) | 🟠 sécurité + perf | · | ✅ **appliquées et vérifiées en prod le 2026-08-25** |
| 2 | **Réglages de console Supabase** : A-10 (leaked password protection), MFA sur le compte admin, allowlist de redirection OAuth, secure email change | 🟠 clics Dashboard, ~30 min cumulés | **Axel** | ⏳ **en attente** |
| 3 | **A-9 — plan Pro + PITR + drill de restauration** | 🔴 résilience, seul bloquant | **Axel** (compte, non scriptable) | ⏳ **en attente** |
| 4 | Test de bout en bout de l'attribution `?ref=` (cf. [`docs/ACQUISITION.md`](./docs/ACQUISITION.md) §3) | 🟡 exige une vraie inscription | **Axel** | ⏳ **en attente** |
| — | Garde `check:rls` « fonction citée par une policy exécutable par `authenticated` » | prévention (aurait attrapé B-1) | — | ✅ **livrée**, testée |
| — | Garde `validate:migrations` « fonction de trigger révoquée + `SECURITY DEFINER` signalé » | prévention (aurait attrapé B-3) | — | ✅ **livrée**, testée |
| — | Règle ESLint `no-restricted-imports` sur l'alias `@/` | prévention de dérive | — | ✅ **livrée** |

Les trois dernières lignes comptent autant que les correctifs : B-1 et B-3 sont deux **régressions
de règles déjà écrites**, chacune arrivée dans la migration qui suivait celle qui posait la règle.
*Une règle non vérifiée par un script n'est pas une règle* — et une garde qu'on n'a jamais vue
rouge n'est pas une garde, d'où `scripts/migration-guards.test.mjs`.

## Règles durables issues des audits

Ces règles ont chacune coûté un finding. Elles s'appliquent à tout nouveau code.

- **La RLS dit ce qu'on a le DROIT de lire, jamais ce qu'on VEUT compter.** Une fonction de calcul
  métier doit filtrer explicitement (`user_id = auth.uid()`), sinon son périmètre change au gré
  des policies — c'est ainsi que `get_work_time_stats` s'est mise à agréger tout un sous-arbre
  managérial (A-1, corrigé mig. 085).
- **Une RPC `SECURITY DEFINER` n'est pas protégée par la RLS** : son périmètre ne tient qu'à sa
  propre logique. Elle doit donc être testée contre une vraie base
  (`e2e/rls/get-my-tasks.test.ts`), pas mockée, et `REVOKE` pour `anon` (A-5).
- **Une règle non vérifiée par un script n'est pas une règle** : les invariants RLS ne vivaient
  que dans la doc et avaient déjà régressé trois fois (mig. 059, 077, 082). D'où
  `npm run check:rls`, bloquant en CI (A-4).
- **`auth.uid()` doit être wrappé** — même imbriqué dans un argument de fonction
  (`get_subtree(org_id, auth.uid())`), sinon il est ré-évalué par ligne. **Les advisors Supabase
  ne voient pas ce cas** : ils ne descendent pas dans les arguments d'appel (A-2).
- **Une seule policy PERMISSIVE par rôle + action** (mig. 049) : élargir le `OR` existant, ne
  jamais en créer une seconde.
- **La RLS ne filtre pas les colonnes.** Auditer aussi `information_schema.column_privileges`
  (audit du 2026-07-26, mig. 083).
- **Toute table technique qui grossit doit avoir une purge** : `processed_stripe_events` (A-6,
  rétention 90 j) ; toute sauvegarde de données personnelles doit avoir une date de péremption
  (A-11, RGPD art. 5.1.e).
- **Frontière de sécurité = RLS + whitelist `mapToDb`.** zod est une garde UX, pas une frontière.
  `mapToDb` ne doit **jamais** émettre `user_id` ni `recurrence_parent_id`.
- **Un trigger de garde doit être `SECURITY INVOKER`** (audit 2026-07-26) — et une fonction de
  trigger doit être `REVOKE`-ée pour `anon` (mig. `064b`, `094b`). Enfreint par la mig. `108`
  (B-3) alors que la mig. `107`, écrite le même jour, respecte la règle : **une règle qu'aucun
  script ne vérifie régresse dès la migration suivante**.
- **Un helper `SECURITY DEFINER` ne doit pas être exposé en RPC** : le corriger par un `REVOKE`
  suffit, parce que dans une fonction `SECURITY DEFINER` le rôle effectif est le propriétaire —
  mais **une policy, elle, s'évalue avec le rôle courant**. Toute policy qui appelle un helper
  directement a donc besoin d'un helper resté exécutable (mig. `100` ; régression B-1 avec la
  mig. `107`).
- **Un trigger `BEFORE` s'exécute avant le `WITH CHECK` de la RLS.** En `SECURITY DEFINER`, ses
  messages d'erreur deviennent un canal d'information sur des lignes qu'on n'a pas le droit de
  lire (B-3).
- **Un correctif appliqué en prod se versionne sous son propre numéro**, jamais par édition du
  fichier déjà appliqué. Sinon le ledger porte une version que le dépôt ne contient pas, et
  personne ne le voit tant que rien ne rejoue les migrations à blanc (`119b`, 2026-08-25 : sans
  gravité cette fois, le contenu était identique, mais c'est le mécanisme exact de la dérive
  repo ↔ prod).
- **Une nouvelle surface d'autorisation se livre avec son test contre une base réelle**, dans le
  même commit. Une policy ne se prouve pas par relecture : `e2e/rls/org-permissions.test.ts`
  (mig. `115`) est le modèle à suivre.

---

## Migrations

L'état des migrations n'est **pas** décrit ici — il périme trop vite. Sources de vérité :

```bash
npm run validate:migrations   # garde statique (CI)
npm run check:rls             # invariants RLS (CI)
npm run check:drift           # dérive repo ↔ prod, 2 étapes (cf. docs/DEPLOYMENT.md)
```

Repo au 2026-08-25 : **127 fichiers, dernière = `123_org_subscriptions_billing_interval.sql`**,
**toutes appliquées en prod**, `115` → `123` déployées le 2026-08-25, après `111` → `114`.

Vérifié en base le 2026-08-25 (`supabase_migrations.schema_migrations`) :
- `115_org_member_permissions` → `123_org_subscriptions_billing_interval` présentes, dans l'ordre.
- `122_habits_local_date` (le fuseau du client décide de « aujourd'hui ») et `123` (colonne
  `billing_interval`) appliquées le soir du 2026-08-25.
- ⚠️ Le ledger porte **une entrée de plus que le dépôt** :
  `119b_habits_bounded_payload_future_guard`. Contenu relu et comparé au fichier `119` du dépôt :
  **identique**. Cf. l'avertissement de l'État global.
- Aucune migration en attente. `npm run check:drift` reste l'outil de référence avant tout
  déploiement comportant une migration.

Vérifié en base lors de la vague précédente (2026-08-24) :
- `team_categories` existe, avec `team_projects.category_id` / `team_tasks.category_id` (111).
- Le job `cosmo-prune-declined-invitations` est planifié et actif, `30 3 * * *` (112).
- `get_my_team_projects` / `get_my_team_tasks` exécutables par `authenticated` uniquement (`anon`
  et `public` révoqués), `my_team_project_ids` fermée à tout le monde (113 — c'est la migration qui
  débloquait le déploiement front : `main` appelle déjà ces deux RPC).
- `touch_last_seen` / `record_demo_visit` portent la rétention 400 j (114).
- Advisors relus après coup : aucune erreur, aucune fonction `anon`-exécutable de plus que les deux
  volontaires (`preview_share_link`, `record_demo_visit`).

- `099` → `108` : **appliquées en prod** (ledger relu le 2026-08-24), y compris la `100` qui
  referme la fuite des helpers.
- `109` (correctifs B-1/B-2/B-3) et `110` (notifications de commentaire) : **appliquées et
  vérifiées en prod le 2026-08-24**. Elles portent leur propre bloc de vérification SQL en fin de
  fichier.

> ⚠️ Ces deux dernières lignes ont dit « écrites, PAS appliquées » pendant vingt-quatre heures
> alors que le haut du même fichier disait le contraire, et vrai. Un document de sécurité qui se
> contredit sur l'état de la production est pire qu'un document absent. **Relire ce bloc à chaque
> application, pas seulement l'en-tête.**

Procédure d'application, checklist de rédaction d'une migration et pattern RLS obligatoire :
[`docs/SECURITY.md`](./docs/SECURITY.md). Réconciliation du ledger :
[`supabase/migration/README.md`](./supabase/migration/README.md).

---

## Stripe

Le paiement n'est **pas finalisé**. S'il est activé, il faut les secrets `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` et l'endpoint webhook côté Stripe.
Détails : [`docs/POST-AUDIT-GUIDE.md`](./docs/POST-AUDIT-GUIDE.md).
