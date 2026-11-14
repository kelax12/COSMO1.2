# Sécurité · règles permanentes

> **Quand lire** : avant de toucher `supabase/**`, un `supabase.repository.ts`, `src/modules/billing/**`, `vercel.json`, un secret ou une Edge Function.
> **Fait foi** : le code et la production ; findings ouverts : `faille.md` (hors dépôt). Codes `(V1)`, `(N9)`, `(M-6)` = fiches `faille.md`. Comptes : [`FAITS.md`](./FAITS.md).
> Récits et relevés datés : [`archive/SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md`](./archive/SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md), [`archive/OPS-SECURITE-recits-2026-11-13.md`](./archive/OPS-SECURITE-recits-2026-11-13.md).

## Gardes et ce que leur vert ne prouve pas

- `npm run check:supabase-posture` (`C-88`) : réglages Auth du Dashboard et advisors, en **écart** à une référence commitée ; ne dit pas que la référence est bonne.
- 🔴 Recaler `Posture` : relire chaque objet nouveau au catalogue AVANT, puis job `regenerer` de `posture.yml` sur `main`, jamais à la main ; `--update` garde les `_note` (témoin `gardes-posture.guard.test.mjs`).
- `codeql.yml` (`security-extended`, JS/TS et `actions`, `C-89`) : fini seulement quand chaque alerte ouverte porte une décision ; ⚠️ exige un dépôt **public**.
- `npm run check:secrets-age` (`M-54`) : [`SECRETS-ET-COFFRE.md`](./SECRETS-ET-COFFRE.md). Ne date pas ce que ni GitHub ni Vercel ne datent tant que `lastRotated` est vide.
- `validate:migrations`, `check:rls`, `check:erasure` : § Avant tout commit qui touche `supabase/migration/*.sql`.
- `supabase/rpc-inventory.md` (généré) donne les droits `EXECUTE` de chaque fonction depuis les migrations.

## RLS · pattern obligatoire d'une table à `user_id`

```sql
ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own <name>"   ON <name> FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own <name>" ON <name> FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own <name>" ON <name> FOR UPDATE
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own <name>" ON <name> FOR DELETE USING ((select auth.uid()) = user_id);
CREATE TRIGGER trg_prevent_user_id_change BEFORE UPDATE ON <name>
  FOR EACH ROW EXECUTE FUNCTION prevent_user_id_change();
```

- ❌ Jamais une policy `UPDATE` sans `WITH CHECK` : `USING` n'inspecte que la ligne OLD, `user_id` se réécrirait (N1, N2).
- ❌ Jamais deux policies PERMISSIVE pour le même rôle et la même action : élargir le `OR` existant (mig. `049`, advisor `multiple_permissive_policies`).
- ❌ Jamais échapper les guillemets dans un `CREATE POLICY` (`\"…\"` casse Postgres).

## Fonctions `SECURITY DEFINER` et triggers

- 🔴 Un helper de RLS (`get_subtree`, `has_subordinates`, `org_admin_count`) qui prend un périmètre sans le borner par `auth.uid()` : `REVOKE EXECUTE … FROM authenticated, anon` (mig. `100`, exposé en RPC il contourne la RLS).
- ❌ Jamais l'appeler depuis une policy : elle s'évalue avec le rôle courant, donc `permission denied`. Dans une policy : `is_above(org_id, user_id)` ou `i_have_subordinates(org_id)`. Dans une fonction DEFINER il reste appelable (rôle = propriétaire).
- ❌ Jamais une fonction de trigger en `SECURITY DEFINER` pour valider : un trigger `BEFORE` passe avant le `WITH CHECK`, ses messages deviennent un oracle (mig. `108`, B-3). Référence conforme : `freeze_team_membership_identity()` (mig. `107`).
- ✅ Seule exception DEFINER : un trigger qui doit écrire au-delà des droits de l'appelant (`notify_task_assignment`, `notify_task_comment`, semis des catégories).
- 🔴 Toute fonction de trigger : `REVOKE` pour `anon` ET `authenticated` (mig. `064b`, `094b`) ; `REVOKE … FROM PUBLIC` ne retire pas le `GRANT` par défaut de Supabase.
- ❌ Jamais une fonction DEFINER exécutable par `authenticated` parce qu'un trigger INVOKER l'appelle, sans garde `pg_trigger_depth()` : elle devient une RPC (W-3, mig. `207`).
- ⚠️ Récursion `tasks ↔ shared_tasks` : jamais d'`EXISTS` direct sur `tasks` dans une policy de `shared_tasks` ou `share_links` (42P17) ; utiliser `public.owns_task(task_id)` (mig. `045`).
- Fonctions DEFINER clés : `accept_friend_request_v2`, `accept_shared_task`, `remove_friendship`, `resolve_profile_by_email`, `handle_new_user_profile`, `prevent_user_id_change`, `owns_task`, `claim_share_link`, `sanitize_display_name`, `get_my_tasks`, `toggle_task_complete_v2`, `get_admin_stats`. `friend_requests` = `sender_id` / `receiver_id`.

## Repositories et surface client

- ❌ Jamais copier `user_id` depuis l'input dans `mapToDb()` : il vient de `supabase.auth.getUser()` dans `create()` (V1).
- ❌ Jamais `...input` dans un `.update()` / `.insert()` : whitelist champ par champ, `if (input.X !== undefined) result.X = input.X`.
- ✅ Requête sur `subscriptions` et tables de propriété : `.eq('user_id', user.id)` en plus de la RLS (V15).
- ❌ Jamais d'écriture client sur `subscriptions` : aucune policy UPDATE (mig. `015`), INSERT limité à la ligne `free` sans identifiant Stripe (mig. `041`, `141`) ; seul le webhook écrit, en `service_role`.
- ❌ Jamais lire l'identité ou le premium depuis `localStorage` / `user_metadata`, ni y écrire le premium : identité = `useAuth().user`, premium = `useBilling().isPremium()` (N5, N6).
- ❌ Jamais ré-exposer `isPremium` dans `AuthContext`.
- ❌ Jamais dériver `isDemo` de l'email : `useIsDemo()` / `appModeStore.isDemo` (B0).
- ❌ Jamais `supabase.auth.updateUser({ password })` sans réauthentification par `signInWithPassword` (B8).
- ❌ Jamais insérer dans `friends` / `shared_tasks` sans vérifier l'amitié côté SQL (V12, V13) ; `removeFriend` supprime les deux lignes posées par `accept_friend_request` (B15).
- ✅ `friends.INSERT` exige une `friend_requests` acceptée ; `shared_tasks.INSERT` exige une amitié OU une demande `pending` envoyée par le partageur (`sender_id = auth.uid()`, mig. `036`), et le destinataire accepte (`accepted_at`).
- ✅ `friend_requests.UPDATE` : une policy, `(uid=receiver AND status∈{accepted,rejected}) OR (uid=sender AND status∈{pending,cancelled})`.
- ❌ Jamais `window.parent.postMessage(payload, '*')` (V6).
- ❌ Jamais `error.message` brut dans l'UI ou un toast : `normalizeApiError().message`, l'original en `originalMessage` (V7) ; `AppErrorBoundary` reste générique (son `console.error` est permis).
- ❌ Jamais de fichier mort style Next.js (V9).
- ❌ Jamais `navigate(X)` ou `window.location.href = X` avec X venu d'une URL ou d'une saisie non validée ; `redirectTo` OAuth restreint dans Supabase Auth.
- ❌ Jamais interpoler `params.cursor` / `params.cursorDate` dans un `.or()` PostgREST : `assertValidCursor` de `@/lib/pagination.types` dans chaque `getPage` paginé (N6, H-1).
- ❌ Jamais interpoler un id client dans `.or()` / `.not('in', …)` sans valider l'UUID (`syncKRsToTable`, M-1).
- ❌ Jamais une chaîne utilisateur dans le `dangerouslySetInnerHTML` d'un `<style>` sans whitelist (`#[0-9a-f]{3,8}`, `var(--…)`, `hsl()`, `rgb()`, `chart.tsx`, M-11).
- ❌ Jamais `cosmo:qcache:*` après un `SIGNED_OUT` : purge par préfixe (L-11).
- ❌ Jamais `error.message` à Sentry sans `beforeSend` qui retire emails et UUID (M-9).
- ❌ Jamais `allowedHosts: true` dans `vite.config.ts` (N10).
- Upload (`<input type="file">`) : ✅ whitelist MIME, ❌ jamais `image/svg+xml` (V5), ✅ plafond `file.size` (avatar 500 Ko), ✅ réencodage canvas ; référence `handleAvatarUpload` de `src/pages/SettingsPage.tsx`.

## `/admin` · allowlist ET second facteur (mig. `131`)

| Fonction | Rôle |
|---|---|
| `public.admin_allowlisted()` | AFFICHAGE : entrée « Stats COSMO », écran d'enrôlement TOTP ; ignore `aal` exprès |
| `public.is_admin()` | GARDE : `admin_allowlisted()` ET `auth.jwt() ->> 'aal' = 'aal2'` |

- ❌ Jamais garder une surface admin par `admin_allowlisted()` : l'écran d'enrôlement deviendrait la porte (mig. `131`).
- ❌ Jamais tester « ce compte a activé la 2FA » : `aal2` porte sur la SESSION, celle d'un mot de passe volé est `aal1`.
- ❌ Jamais relâcher une claim absente : `COALESCE(…, 'aal1')`.
- ⚠️ QR d'enrôlement en `<img>` sur `data:`, jamais `dangerouslySetInnerHTML` (un SVG inline exécute ses scripts).
- Téléphone perdu, enrôlement, vérification : [`MISES-EN-SERVICE.md`](./MISES-EN-SERVICE.md) § 2quinquies. Second administrateur : [`CONTINUITE.md`](./CONTINUITE.md).

## CSP et en-têtes (`vercel.json`)

- ✅ Garder tous les en-têtes (HSTS, X-Frame-Options, CSP). `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- ❌ Aucun domaine Stripe en CSP : checkout par redirection serveur (SEC-09, COD-03).
- ✅ Supabase : le seul hôte du projet, en `https://` ET `wss://`, sans joker. 🔴 `https:` ne couvre PAS `wss:` (Realtime coupé en silence). Garde : `src/csp.guard.test.ts` (`wss`, confinement, pas d'`unsafe-eval`, `data:` en `img-src` pour le QR TOTP).
- ⚠️ `style-src 'unsafe-inline'` conservé : attributs `style` en ligne de Framer Motion, Radix, FullCalendar, shader ; risque d'injection CSS sans script accepté (COD-03).
- ❌ Jamais une origine externe sans l'ajouter à la CSP ; jamais un script tiers dans `index.html` sans CSP.
- 🔴 Jamais de clé `"//"` dans `vercel.json` : schéma strict, tout déploiement échoue et `npm run build` ne le voit pas. Justifier ici.
- 🔴 `noindex` : garder les `source` `/(en|es)/(invite|org-invite)/(.*)` et `/(en|es)/(forgot-password|reset-password)` (jetons d'invitation indexables sinon) ; toute nouvelle locale s'y ajoute. Le `noindex` global `/en/(.*)` se retire par décision SEO.

## Edge Functions

| Fonction | Sécurité |
|---|---|
| `stripe-create-checkout` | CORS `_shared/env.ts` (`APP_URL`), upsert `subscriptions` (U1), idempotency `customer:${uid}`, `checkout:${uid}:${day}` (M-3) |
| `stripe-webhook` | signature, `'Invalid signature'` générique (N9) ; 405 avant tout parsing (L-13) ; marqueur `processed_stripe_events` APRÈS handler, 500 si INSERT échoue hors 23505 (M-4, M-5) ; abonnement **relu** par `stripe.subscriptions.retrieve`, jamais `event.data.object` (SEC-08, `_shared/subscription-event.ts`) |
| `delete-account` | JWT pour l'identité, `service_role` pour purger ; `shared_tasks` par `friend_id`/`shared_by` (M-6) ; abandon si une purge échoue (RGPD art. 17) ; ne touche pas `payment_records` |
| `stripe-org-checkout`, `stripe-org-portal` | CORS, **propriétaire seul**, même 403 pour org inexistante et non-propriétaire ; customer `org_owner_uid`, jamais `supabase_uid` ; idempotency `org-customer:${orgId}`, `org-checkout:${orgId}:${tier}:${day}` |
| `stripe-org-refund` | `is_admin()` seul ; anti-rejeu `_shared/refund-replay.ts`, montant `_shared/refund-amount.ts` ; jamais sondée en POST |
| `stripe-org-subscription` | JWT, propriétaire seul ; client en `retry: 0` |
| `report-bug` | aucun accès base ; auteur du JWT en `Reply-To`, jamais du corps ; `singleLine()` sur titre et nom de fichier ; HTML échappé ; pièce jointe image/PDF/texte, 3 Mo, base64 validé ; erreur Resend jamais relayée |
| `send-org-invite` | JWT ; créateur du lien ou admin ; plafond par e-mail et 100/jour par compte et organisation (W-4) ; sans `RATE_LIMIT_SALT` = 503 |
| `verify-org-domain` | JWT, admin actif ; domaine d'autrui = absent ; seule écriture de `verified_at` |
| `org-webhook-dispatch` | `x-cron-secret` ; cible publique exigée, nom puis chaque A/AAAA (W-2) ; `redirect: 'manual'` ; corps de réponse jamais lu ; HMAC-SHA256 horodaté |
| `renewal-notice`, `org-digest`, `inactive-accounts`, `seat-alert` | `x-cron-secret`, échec fermé (503) sans secret ; `seat-alert` trace APRÈS l'envoi |
| `analytics-admin-login` | code TOTP seul ; plafonds en échec fermé (`failClosed`) ; en-tête `Origin` vérifié (`analyticsOrigins`) |
| `affiliation-api` | juge l'appelant : `X-Affiliation-Token` signé ou JWT `is_admin()` ; `/session`, `/click` publics plafonnés par IP |

- 🔴 Chaque fonction a sa section dans `supabase/config.toml` (M-10, W-1, garde `src/edge-config.guard.test.ts`) : `verify_jwt = false` pour `stripe-webhook`, `affiliation-api`, `analytics-admin-login` et les fonctions à `x-cron-secret` ; `true` pour toute autre, et exigé pour toute fonction qui appelle `auth.getUser()`.
- ❌ Jamais `Access-Control-Allow-Origin: '*'` sur une fonction authentifiée (N7) ; CORS par `_shared/env.ts`.
- ❌ Jamais un read-then-write sur `subscriptions` : `upsert(…, { onConflict: 'user_id' })` (U1, U2).
- ❌ Jamais `customers.create` / `checkout.sessions.create` sans `idempotencyKey` (M-3).
- ❌ Jamais un appel sortant vers une URL client sans résoudre le nom et refuser toute adresse non publique (`_shared/org-integrations.ts`, W-2) : `https://2130706433/` est `127.0.0.1`.
- ❌ Jamais un e-mail sans plafond (`_shared/rate-limit.ts`, C-31, W-4) : le domaine d'envoi est celui de l'Auth.
- ❌ Jamais recopier `raw_user_meta_data->>'name'` dans une table partagée sans `sanitize_display_name()` (M-2, XSS de second ordre).
- Règles de dossier (dérive, sondes, `_shared/`) : [`supabase/functions/CLAUDE.md`](../supabase/functions/CLAUDE.md). Stripe : [`src/modules/billing/CLAUDE.md`](../src/modules/billing/CLAUDE.md).

## Abonnement d'organisation (mig. `101`)

- `org_subscriptions` : SELECT aux membres (`is_org_member`), aucune policy d'écriture, seul le webhook écrit.
- Quota = `org_seats_allowed()` ; `past_due` ou `cancelled` retombe au gratuit sans retirer de membre.
- 🔴 Étanchéité des deux facturations, trois gardes solidaires : customer d'org en `org_owner_uid` ; `getUidFromCustomer` refuse un customer à `org_id` ; `orgIdFromInvoice` lève sur erreur. Sinon une facture d'entreprise écrit l'abonnement personnel et le marqueur bloque la redélivrance. Test : `e2e/rls/org-subscriptions.test.ts`.

## Avant tout commit qui touche `supabase/migration/*.sql`

> Règles 6 à 16 de `validate:migrations` : cliquet à partir de la mig. `227` (l'historique diverge de la prod). Témoins : `scripts/migration-guards.test.mjs`, sabotages `scripts/replay-sabotages.catalogue.mjs`.
> ❌ Ne jamais relever le plancher `227` : corriger la migration. 🔴 Ces règles lisent du texte, elles ne prouvent pas qu'une migration fait ce qu'elle dit (mig. `143`).

| # | Règle | Garde | Angle mort |
|---|---|---|---|
| 1 | `WITH CHECK` sur toute policy `FOR UPDATE` (N1) | `validate:migrations` r. 8 | policy `FOR ALL` sans `WITH CHECK` |
| 2 | `DROP POLICY IF EXISTS` avant `CREATE POLICY`, `CREATE OR REPLACE FUNCTION` | r. 6 | `CREATE TABLE` / `INDEX` sans `IF NOT EXISTS` |
| 3 | `SET search_path = ''` sur toute fonction DEFINER | r. 7 | INVOKER à `search_path` mutable (advisor) |
| 4 | Table à `user_id` : trigger `prevent_user_id_change` | r. 15 | ⚠️ dette : aucune table `2xx` ne l'attache |
| 5 | `raw_user_meta_data` recopié : `sanitize_display_name()` (M-2) | r. 14 | recopie par Edge Function : **manuel** |
| 6 | Lire les colonnes au catalogue avant d'écrire une policy | **manuel** | tout |
| 7 | Guillemets non échappés dans `CREATE POLICY` | r. 2 | |
| 8 | Fonction citée par une policy : `EXECUTE`-able par `authenticated` | `check:rls` r. 3 | prod : requête ci-dessous |
| 9 | `RETURNS trigger` : INVOKER + `REVOKE ALL … FROM PUBLIC, anon, authenticated` | r. 5, r. 10 | |
| 10 | `auth.uid()` écrit `(select auth.uid())` | `check:rls` r. 1 | |
| 11 | Une policy PERMISSIVE par rôle et action | `check:rls` r. 2 ; matrice RLS sur `pg_policy` rejouée (mig. `244`) | |
| 12 | `GRANT EXECUTE` précédé de `REVOKE … FROM PUBLIC, anon` | r. 16 | INVOKER jamais accordée |
| 13 | `ENABLE ROW LEVEL SECURITY` dans le fichier qui crée la table ; `anon` n'a rien par défaut (mig. `242`, r. 17), `GRANT … TO anon` explicite | r. 9 | table hors `public` |
| 14 | Table à `user_id` : décision d'effacement | `check:erasure` | table hors migration (`C-92`) |
| 15 | `payment_records` / `payment_closures` : ni policy UPDATE/DELETE ni purge ; `renewal_notices` jamais purgée | r. 11 | SQL dynamique |
| 16 | Surface admin par `is_admin()` | r. 12 (policies) | fonction DEFINER : **manuel** |
| 17 | Auto-référence `ON DELETE NO ACTION` | r. 13 | |
| 18 | Correctif appliqué = nouveau numéro | **manuel** (`git diff` contre `main`) | tout |
| 19 | Rien depuis le Dashboard (colonne, GRANT, policy) | **manuel** | tout |
| 20 | Lire le ledger AVANT d'appliquer | **manuel**, `check:migration-coverage` après | tout |
| 21 | Prédicat de policy indépendant d'un argument pris dans la ligne | **manuel** (test sur `events`, mig. `128`) | autres tables |
| 22 | Dépendance à un chemin de récupération : le parcourir | **manuel** | tout |
| 23 | Colonne écrite par le front : migration AVANT le front | **manuel** | tout |
| 24 | Preuve AVANT, transaction annulée, acteur par acteur | **manuel**, forme dans [`supabase/migration/CLAUDE.md`](../supabase/migration/CLAUDE.md) | tout |
| 25 | Visibilité projet d'équipe : `my_team_project_ids` seule (mig. `243`) | `e2e/rls/regle-unique-projet.test.ts` | nouvelle RPC de lecture : **manuel** |

Ligne 8, état réel en prod :

```sql
select p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in (<fonctions citées par la policy>);
```

Ledger, catalogue, application, `check:migration-coverage` : [`supabase/migration/CLAUDE.md`](../supabase/migration/CLAUDE.md).

## Règles de module portées ici

- ⚠️ `NO_CATEGORY` = chaîne vide en TypeScript, NULL en base ; conversion dans `tasks/mappers.ts` et `okrs/mappers.ts` seulement. ❌ Jamais `null` jusqu'aux composants ; « colonne absente » ≠ « chaîne vide ».
- ❌ Jamais d'aller-retour serveur pour dériver une branche de catégories : `src/modules/categories/tree.ts`, miroir du trigger.
- ✅ `get_admin_stats` exclut les comptes non réels par `admin_stats_excluded_uids()` (mig. `149`). ❌ Jamais recopier un de ces UUID ailleurs.

## Rotation des secrets, coffre et accès d'urgence

Registre, échéances, secret compromis, coffre, vérification trimestrielle : [`SECRETS-ET-COFFRE.md`](./SECRETS-ET-COFFRE.md).

## Garde-fous transversaux

Les interdits sont dans [`CLAUDE.md`](../CLAUDE.md) § Garde-fous transversaux ; le pourquoi en une ligne ci-dessous ; les récits d'incident dans [`archive/SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md`](./archive/SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md).

- ❌ Policy UPDATE/DELETE ou purge sur `payment_records` / `payment_closures` : journal d'encaissement inaltérable (mig. `125`, CGI art. 286-I-3° bis), tenu par trigger car `service_role` contourne la RLS.
- 🔴 Anonymiser `user_id` de ce journal : `row_hash` le scelle, `verify_payment_chain()` verrait une falsification ; corriger par ligne compensatoire.
- ⚠️ Purger `renewal_notices` : c'est la preuve d'un avis de reconduction (Conso. L215-1).
- ❌ Lire `cosmo_cookie_consent` hors `src/lib/cookie-consent.ts` / `useCookieConsent()` : un choix du bandeau doit s'appliquer partout ; `null` n'est pas une acceptation.
- ❌ Garde conditionnelle à son propre secret (`if (SECRET && …)`) : elle laisse tout passer tant que le secret manque.
- ❌ `VITE_SUPABASE_SERVICE_ROLE_KEY`, `.env` commité, `supabaseAdmin` côté client : la clé contourne la RLS.
- ❌ Écrire en base via le MCP Supabase : contourne la RLS.
- 🔴 Migration qui crée une dépendance à un chemin de récupération : le parcourir avant ; la mig. `131` a fermé `/admin` faute d'avoir ouvert l'écran une fois.
- ⚠️ Dépôt PUBLIC (secret scanning, push protection, Dependabot actifs) : retirer un fichier du suivi n'efface pas l'historique.
- ❌ Traiter `docs/archive/**` comme l'état courant ; citer un numéro de ligne d'un `.md` (les fichiers bougent).
- ❌ Recopier un « avant » : il se reconstruit à un commit nommé.
- ❌ Chercher le symptôme cité par la doc plutôt que la chose décrite : la dérive paraît vérifiée sans l'être.
