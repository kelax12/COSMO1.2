# Sécurité — findings ouverts & priorités — COSMO 1.2

**Source de vérité sécurité du projet.** Ce fichier ne contient que ce qui est **encore ouvert**
et les **règles durables** tirées des audits.

- Historique complet (preuve des corrections, audits datés 2026-04 → 2026-08, anciens ordres de
  priorité) : [`docs/archive/faille-historique.md`](./docs/archive/faille-historique.md) — **archive, non maintenue**.
- Procédures et patterns : [`docs/SECURITY.md`](./docs/SECURITY.md).
- Dernière vérification de ce fichier contre le code **et contre la prod** : **2026-08-24**.

Légende : 🔴 bloquant · 🟠 important · 🟡 à planifier · ✅ corrigé

---

## Gardes automatiques — état au 2026-08-24

| Garde | Résultat |
|---|---|
| `npm run check:rls` | ✅ **120 policies analysées sur 66 migrations, 0 violation** |
| `npm run validate:migrations` | ✅ **112 fichiers, 0 erreur, 5 avertissements** — tous préexistants (doublons de numéro `000`/`007`/`010`, deux `FOR UPDATE` sans `WITH CHECK` sur `007`/`010`) |
| `npm run typecheck` · `npm run lint` | ✅ 0 erreur (27 warnings Fast-refresh tolérés) |
| `npm run i18n:check` | ✅ 19 namespaces, 0 erreur |
| Advisors Supabase (sécurité) | 5 INFO `rls_enabled_no_policy` (tables analytiques, **deny-all volontaire**), 1 WARN `auth_leaked_password_protection` (= A-10 ci-dessous), 48 WARN `authenticated_security_definer_function_executable`, **5** WARN `anon_security_definer_function_executable` (2 de plus qu'au 2026-08-14, cf. finding B-3) |
| Couverture RLS | ✅ **toutes** les tables `public` ont RLS activée (vérifié en prod : `relrowsecurity = false` sur 0 table) |
| Migrations appliquées en prod | ✅ ledger à jour jusqu'à `108_team_task_dependencies` (vérifié le 2026-08-24) |

Les fonctions exécutables par `anon` sont désormais **cinq**, et seules deux le sont
volontairement : `preview_share_link(uuid)` (aperçu d'un lien d'invitation avant connexion) et
`record_demo_visit(uuid)` (comptage des visites de démo). Toutes deux prennent un UUID non
devinable en argument — à ne pas « nettoyer » par erreur. Les trois autres
(`seed_default_categories`, `validate_team_task_dependency`,
`prevent_team_task_dependency_cycle`) sont des **fonctions de trigger** : Postgres refuse leur
appel direct, elles ne sont donc pas exploitables, mais elles violent la règle de durcissement
posée par les migrations `064b` / `094b` (cf. B-3).

## État global

**Aucun finding High ou Critical exploitable** (dernière passe complète : **2026-08-24**, contre
la prod `ykeugqfgklejcdbrmawy`, migrations appliquées jusqu'à `108`). Risque global : **faible**.

Deux choses ont changé depuis le 2026-08-14 :

- ✅ **La fuite inter-organisations par les helpers RLS est refermée** (mig. `100`, appliquée en
  prod le 2026-08-23). Vérifié aujourd'hui en base :
  `has_function_privilege('authenticated', 'get_subtree', 'EXECUTE')` → **false**, idem
  `has_subordinates` et `org_admin_count`. Le détail du finding et son PoC sont archivés dans
  [`docs/archive/faille-historique.md`](./docs/archive/faille-historique.md) ; la **règle durable**
  qu'il a produite est en bas de ce fichier.
- 🟠 **Trois nouveaux findings** ouverts par la vague entreprise du 2026-08-23/24
  (migrations `103` → `108`) : B-1, B-2, B-3 ci-dessous.

Un seul **bloquant** subsiste côté sécurité, et c'est un point de **résilience**, pas une faille :
le plan Supabase `free`. Tout le reste est du réglage de console Supabase.

---

## 🟠 Ouvert — B-1 · la mig. 107 rappelle `get_subtree` depuis une policy, que la mig. 100 a révoqué

**Régression, vérifiée en prod le 2026-08-24.** La migration `100` a fermé la fuite des helpers en
révoquant `EXECUTE` à `authenticated` — et a pris soin de réécrire la seule policy qui appelait
`get_subtree` **directement**, `org_team_members_insert`, en `is_above(org_id, user_id)`.

La migration `107` (leads d'équipe) crée une policy `org_team_members_update` qui **réintroduit
exactement le motif supprimé** :

```sql
WITH CHECK (
  can_manage_team(team_id)
  AND ( is_org_admin(org_id)
        OR user_id = (select auth.uid())
        OR user_id IN (SELECT public.get_subtree(org_id, (select auth.uid()))) )  -- 🔴
)
```

Un `WITH CHECK` de policy s'évalue **avec le rôle courant** (`authenticated`), pas avec le
propriétaire : l'appel est donc refusé au niveau des droits.

**Impact** : ce n'est **pas** une fuite — ça échoue fermé. C'est une **fonctionnalité cassée en
prod** : le `OR` court-circuite pour un admin d'organisation et pour un membre qui modifie sa
propre ligne, mais dès qu'un **lead ou un manager non-admin** nomme un lead sur un subordonné
(`setTeamLead`, `src/modules/org-teams/supabase.repository.ts`), Postgres renvoie
`ERROR: permission denied for function get_subtree`. C'est précisément le cas d'usage pour lequel
la mig. `107` a été écrite.

**Correction** : remplacer la troisième branche par `is_above(org_id, user_id)`, qui en est la
définition exacte et reste exécutable par `authenticated`. Une migration `109` d'une seule policy.

> **Règle qui manquait** : aucune garde n'attrape ça. `check:rls` vérifie le wrapping d'`auth.uid()`
> et l'unicité des policies permissives, pas les **droits d'exécution** des fonctions appelées
> depuis une policy. À ajouter à `scripts/check-rls-advisors.mjs` : toute fonction citée dans un
> `USING`/`WITH CHECK` doit être `EXECUTE`-able par `authenticated`.

## 🟠 Ouvert — B-2 · un simple membre peut faire entrer quelqu'un dans l'organisation

`invite_friend_to_org(p_org, p_invitee)` (mig. `105`) ne demande que
`public.is_org_member(p_org)`. Or les deux autres chemins d'entrée sont bien plus stricts —
vérifié en prod sur `pg_policies` :

| Chemin | Qui peut l'ouvrir |
|---|---|
| `org_invite_links_insert` (lien / code) | admin **ou** manager ayant des subordonnés (`i_have_subordinates`) |
| `organization_join_requests` (demande spontanée) | l'admin décide (`respond_join_request`) |
| **`invite_friend_to_org` (mig. 105)** | **n'importe quel membre** 🟠 |

La garde d'amitié confirmée limite le rayon d'action (on n'invite qu'un ami déjà accepté) et le
quota de sièges est bien vérifié à l'acceptation (`org_seats_allowed`, garde présente ✅). Mais le
modèle d'autorisation de la croissance de l'organisation est désormais **incohérent** : la feuille
la plus basse de la pyramide peut faire entrer un tiers — et, une fois le paywall entreprise
activé, **consommer un siège payant** — sans qu'aucun admin ne l'ait décidé.

**Impact** : pas d'élévation de privilège (l'entrant arrive en `role = 'member'`, `manager_id NULL`),
mais perte de contrôle de l'admin sur l'effectif et sur la facture.

**Décision à prendre** (produit, pas technique) : soit c'est voulu — et il faut alors le dire dans
`docs/SECURITY.md` et aligner les deux autres chemins — soit il faut ajouter
`is_org_admin(p_org) OR i_have_subordinates(p_org)` en tête de la RPC.

**Note connexe** : `org_invitations_select` laisse **tout membre** lire l'`invitee_id` de toutes les
invitations émises, y compris **refusées**. Ce ne sont que des UUID (pas d'email ni de nom), mais
c'est une trace persistante d'un refus — à recouper avec `docs/RGPD.md` si le mode entreprise
sort du cercle des testeurs.

## 🟡 Ouvert — B-3 · mig. 108 : triggers de garde en `SECURITY DEFINER`, non révoqués à `anon`

Deux règles durables de ce fichier sont enfreintes par la mig. `108` :

1. **« Un trigger de garde doit être `SECURITY INVOKER` »** (audit du 2026-07-26).
   `validate_team_task_dependency()` et `prevent_team_task_dependency_cycle()` sont
   `SECURITY DEFINER`. La mig. `107`, écrite le même jour, respecte pourtant la règle pour
   `freeze_team_membership_identity()`.
2. **Pas de `REVOKE … FROM anon`** sur ces deux fonctions (règle posée par `064b`, réappliquée par
   `094b`) → les 2 nouveaux WARN advisor `anon_security_definer_function_executable`.

**Exploitabilité directe : nulle.** Les deux fonctions sont `RETURNS trigger` ; Postgres refuse
tout appel direct, y compris via PostgREST.

**Ce qui est réellement exploitable, et c'est le vrai point** : un trigger `BEFORE INSERT`
s'exécute **avant** l'évaluation du `WITH CHECK` de la RLS. En `SECURITY DEFINER`, la lecture de
`team_tasks` faite par `validate_team_task_dependency` ignore donc la RLS, et le message d'erreur
distingue deux cas :

| Insertion tentée sur `team_task_dependencies` | Message renvoyé | Ce qu'il révèle |
|---|---|---|
| `depends_on_id` inexistant | `Both tasks must exist` | rien |
| `depends_on_id` existant, **autre projet, autre organisation** | `A dependency must stay within a single project` | **l'UUID correspond à une tâche réelle** 🟡 |

C'est un **oracle d'existence** sur `team_tasks` hors périmètre — la même classe que le finding
helpers refermé par la mig. `100`, en plus étroit : il faut déjà connaître l'UUID (v4, non
devinable), et il ne rend qu'un booléen.

**Correction** : passer les deux triggers en `SECURITY INVOKER` (défaut) — la lecture de
`team_tasks` redevient filtrée par la RLS, les deux cas convergent vers `Both tasks must exist`,
et l'oracle disparaît — puis `REVOKE ALL … FROM PUBLIC, anon` sur les deux. Même migration `109`
que B-1.

⚠️ Vérifier au passage que `validate_team_task_dependency` reste capable de redériver `org_id`
depuis la tâche : c'est le cas, puisque l'insertion exige déjà de **voir** les deux tâches
(policy `team_task_dependencies_insert`).

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
- **N6 — `useUser()` lit l'identité depuis `localStorage`** (`src/modules/user/hooks.ts`).
  Un utilisateur peut éditer `cosmo_user` pour changer son nom/email/avatar **dans son propre
  affichage**. Aucune élévation de privilège (la donnée serveur reste la RLS). Chemin de sortie :
  consommer `useAuth().user`.

---

## Ordre de priorité avant déploiement prod (à jour 2026-08-24)

Section référencée par [`CLAUDE.md`](./CLAUDE.md) — elle n'existait plus depuis la refonte
documentaire du 2026-08-14, le lien pointait dans le vide. Restaurée ici.

| # | Action | Nature | Effort |
|---|---|---|---|
| 1 | **Migration `109`** : B-1 (`get_subtree` → `is_above` dans `org_team_members_update`) **et** B-3 (deux triggers de la mig. `108` en `SECURITY INVOKER` + `REVOKE … FROM anon`) | 🟠 fonctionnalité cassée en prod + 🟡 oracle d'existence | ~30 min |
| 2 | **Suite unitaire au vert** : `design-system.guard` est rouge sur `main` (cf. [`docs/TESTING.md`](./docs/TESTING.md)) | 🔴 gate CI | ~15 min |
| 3 | **Arbitrer B-2** : qui a le droit de faire entrer un membre dans l'organisation | 🟠 décision produit | discussion |
| 4 | **Réglages de console Supabase** (A-10, MFA admin, allowlist OAuth, secure email change) | 🟠 clics Dashboard | ~30 min cumulés |
| 5 | **A-9 — plan Pro + PITR + drill de restauration** | 🔴 résilience, seul bloquant | ~1 h |
| 6 | Ajouter au `check:rls` la garde « toute fonction citée dans une policy est `EXECUTE`-able par `authenticated` » | prévention (aurait attrapé B-1) | ~1 h |
| 7 | Ajouter au `validate:migrations` la garde « `RETURNS trigger` ⇒ `SECURITY INVOKER` + `REVOKE anon` » | prévention (aurait attrapé B-3) | ~1 h |

Les lignes 6 et 7 comptent autant que les correctifs eux-mêmes : B-1 et B-3 sont deux
**régressions de règles déjà écrites**, chacune arrivée dans la migration qui suivait celle qui
posait la règle. *Une règle non vérifiée par un script n'est pas une règle.*

---

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

---

## Migrations

L'état des migrations n'est **pas** décrit ici — il périme trop vite. Sources de vérité :

```bash
npm run validate:migrations   # garde statique (CI)
npm run check:rls             # invariants RLS (CI)
npm run check:drift           # dérive repo ↔ prod, 2 étapes (cf. docs/DEPLOYMENT.md)
```

Repo au 2026-08-24 : **112 fichiers, dernière = `108_team_task_dependencies.sql`**. Les
migrations `099` → `108` sont **toutes appliquées en prod** (ledger relu le 2026-08-24) — y
compris la `100`, qui referme la fuite des helpers.

Procédure d'application, checklist de rédaction d'une migration et pattern RLS obligatoire :
[`docs/SECURITY.md`](./docs/SECURITY.md). Réconciliation du ledger :
[`supabase/migration/README.md`](./supabase/migration/README.md).

---

## Stripe

Le paiement n'est **pas finalisé**. S'il est activé, il faut les secrets `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` et l'endpoint webhook côté Stripe.
Détails : [`docs/POST-AUDIT-GUIDE.md`](./docs/POST-AUDIT-GUIDE.md).
