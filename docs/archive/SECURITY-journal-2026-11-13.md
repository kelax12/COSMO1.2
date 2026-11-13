> ⚠️ **ARCHIVE : récits et relevés datés, extraits de `docs/SECURITY.md` le 2026-11-13 (DOC-02), non maintenus.**
> Chaque bloc décrit l'état **à sa date**. Les règles vivantes sont dans [`docs/SECURITY.md`](../SECURITY.md) et
> [`docs/SECRETS-ET-COFFRE.md`](../SECRETS-ET-COFFRE.md). Texte repris **sans une coupe** ; le titre de chaque bloc
> dit d'où il vient. Le code et la production font foi contre ce fichier.

# SECURITY · journal (extraits du 2026-11-13)

---
## Préambule · note d'ajout des helpers SECURITY DEFINER (2026-08-24)

> Ajouté le **2026-08-24**, après la mig. `100` (fuite inter-organisations refermée) et sa
> régression immédiate par la mig. `107` (finding B-1 de `faille.md`).

## `vercel.json` · clé `//`, récit (2026-07-31 au 2026-08-01)

#### 🚫 Jamais de clé `"//"` (commentaire) dans `vercel.json`

Le schéma Vercel est **strict** : une entrée de `headers[]` n'accepte que `source`,
`headers`, `has`, `missing`. Toute propriété additionnelle — dont la convention
`"//"` utilisée comme commentaire — fait **échouer le déploiement** à la validation,
sur *toutes* les branches à la fois. `npm run build` ne valide PAS `vercel.json` :
le build reste vert en local pendant que chaque déploiement Vercel est rouge
(vécu du 2026-07-31 au 2026-08-01, ~13 déploiements perdus). Le JSON n'ayant pas
de commentaires, toute justification se documente **ici**, jamais dans le fichier.

## Abonnement d'organisation · commandes de déploiement d'origine

```bash
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy delete-account
supabase db push  # applique 017_processed_stripe_events.sql
```

## Migrations · encadré AM-4 (2026-10-24)

> **Angle mort AM-4, outillé le 2026-10-24.** Chaque ligne de cette checklist (et des interdits de
> [`supabase/migration/CLAUDE.md`](../supabase/migration/CLAUDE.md)) est rapportée à la garde qui la
> juge, ou marquée **manuel**. Les règles 6 à 16 de `validate:migrations` sont un **cliquet à partir
> de la mig. `227`** : l'historique (`000` à `226`) n'est pas jugé, parce que les fichiers divergent
> de la prod (même raison que `check:rls`). Chaque règle a son témoin dans
> `scripts/migration-guards.test.mjs`, vu rouge contre le script d'avant elle, et son sabotage de
> détecteur dans `scripts/replay-sabotages.catalogue.mjs`.
> ❌ Ne jamais relever le plancher `227` pour faire passer une migration : la corriger.

## Rotation des secrets · relu le 2026-11-07 (V9.4, TST-05)

**Relu le 2026-11-07 (V9.4, TST-05) : rouge depuis sa pose, et AUCUN secret connu n'a dépassé son
échéance.** Run `41474391054` (2026-11-02), 44 écarts : `SECRETS_AUDIT_TOKEN` jamais posé (la source
GitHub n'est pas lue, d'où dix dates « inconnues » qui n'en sont pas), 30 noms vivants hors registre,
`vercel/VITE_TURNSTILE_SITE_KEY` absente, `supabase-platform/SUPABASE_SERVICE_ROLE_KEY` sans date.
- **Corrigé dans le dépôt** : les 30 noms sont inscrits avec leur échéance (intégrations
  Vercel-Supabase et Vercel-Sentry, prix d'équipe Stripe, origines d'affiliation). Les clés posées
  par l'intégration Supabase chez Vercel (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`,
  `POSTGRES_PASSWORD`, `POSTGRES_URL*`) ne sont lues par **aucun** code (`api/` lit
  `SUPABASE_SECRET_KEY` et `VITE_SUPABASE_URL`) : surface à retirer chez Vercel plutôt qu'à faire
  tourner. `vercel/VITE_TURNSTILE_SITE_KEY` est **retirée** du registre par décision (absente,
  Turnstile inerte, décision en attente imprimée par `check:env`) : la garde la réclamera le jour
  où elle sera posée.
- **La garde dit quoi faire** : bloc « QUE FAIRE » rangé par geste (jeton, rotation, date,
  inventaire, entrée absente), en annotations lisibles sans compte. Le verdict ne change pas.
- **Reste rouge, et c'est vrai** : deux gestes d'Axel, poser `SECRETS_AUDIT_TOKEN` et donner la
  date de dernière rotation de la `service_role` de la plateforme (ou la faire tourner). Recalé
  par décision jusqu'au **2026-11-21** dans `.github/gardes-rouges-decisions.json`.

## Base de données · en-tête de déplacement du 2026-09-16

## Base de données · état et récits repris de `CLAUDE.md` (déplacés le 2026-09-16)

> Les récits datés qui vivaient ici (applications de migrations du 2026-08-27 au 2026-09-20, mesures
> du ledger, enrôlement MFA de l'admin, correctifs de la `136`, `146`, `149`) sont archivés **sans
> une coupe** : [`archive/SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md`](./archive/SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md).
> Ne restent que les règles, chacune avec son « pourquoi » en une ligne. Les règles courtes vivent dans
> [`supabase/migration/CLAUDE.md`](../supabase/migration/CLAUDE.md).

## État des migrations · 2026-11-07, `242` à `244`

- **2026-11-07** : `242` → `244` en prod, dernière entrée `244_select_permissive_unique`
  (`20261107091936`). Pour `242` (`20261107091512`), `243` (`20261107091727`) et `244` : ledger
  relu avant, preuve `supabase/proofs/24x.proof.sql` rejouée en prod (0 ECHEC, annulation
  vérifiée), `apply_migration`, relecture au catalogue. `242` : `pg_default_acl` de `postgres`
  sur `public` ne nomme plus `anon` (tables, séquences) ; les fonctions et `supabase_admin` hors
  périmètre. `243` : `pg_get_functiondef(can_access_team_project)` = le corps du fichier, ACL
  inchangée, deux `EXISTS` sur les policies de dépendances. `244` : une SELECT permissive par
  table sur les sept ; la prod ne portait déjà plus les « read own » relevés sur base rejouée,
  la 244 y a recréé des prédicats identiques (vérifié au caractère près). Advisors sans nouvelle
  alerte ; aucun 42501 ni 500 dans les logs, sans trafic API dans la fenêtre.

## AM-5 · relu et recalé le 2026-11-07, soldé le 2026-11-08

**Relu et recalé le 2026-11-07 (V9.4, TST-05), soldé le 2026-11-08.** ⚠️ **Pas** « rouge pour une
amélioration » : la baisse d'`unused_index` est imprimée sans rougir, et le workflow n'annote que le verdict.
Chaque objet a été relu dans sa migration et par `get_advisors`, les noms sont écrits dans les `_note` de la
référence : sept `affiliate_*` (`236`), `billing_acceptances` et `org_withdrawals` (`237`), `org_seat_alerts`
(`240`) en RLS sans policy voulue ; trois DEFINER exposées légitimes (`affiliate_backfill`, `affiliate_attach`,
`claim_affiliate`) ; trois clés étrangères sans index, **défaut** corrigé par la mig. **`247`**
(`unindexed_foreign_keys` absent de `get_advisors` depuis). La mesure détaillée (runs, ledger, comptes) est
dans l'archive ci-dessus.

## Récap « Ne jamais faire » · version d origine (lignes redites des sections de règles retirées du vivant)

- ❌ Créer `supabaseAdmin` avec `SERVICE_ROLE_KEY` côté client
- ❌ Committer le fichier `.env`
- ❌ Réintroduire `user_id` dans `mapToDb()` d'un repository — mass-assignment (V1)
- ❌ Créer une policy `UPDATE` sans `WITH CHECK` (N1, N2)
- ❌ Spreader l'input client dans un `.update()` / `.insert()` Supabase — whitelist explicite obligatoire
- ❌ Échapper les guillemets dans les `CREATE POLICY` SQL (`\"...\"` casse Postgres)
- ❌ Lire `premiumTokens` ou identité depuis `localStorage` / `user_metadata` — source unique = `subscriptions` via `useBilling()` (N5, N6)
- ❌ Écrire l'état premium dans `localStorage` (utiliser Supabase `subscriptions`)
- ❌ Garder une surface admin par `admin_allowlisted()` au lieu de `is_admin()` — la première ignore le niveau d'assurance de la session, exprès (mig. 131)
- ❌ Insérer dans `friends` / `shared_tasks` sans vérifier le lien d'amitié côté SQL (V12, V13)
- ❌ Ne supprimer qu'un côté d'une amitié — `accept_friend_request` insère 2 lignes, `removeFriend` doit en supprimer 2 (B15)
- ❌ Appeler `supabase.auth.updateUser({ password })` sans réauthentification via `signInWithPassword` (B8)
- ❌ Accepter `image/svg+xml` dans un upload utilisateur — peut contenir du JS (V5)
- ❌ Dériver `isDemo` de l'email (`user?.email === 'demo@cosmo.app'`) — utiliser `useIsDemo()` / `appModeStore.isDemo` (B0)
- ❌ `window.parent.postMessage(*, '*')` — fuite vers iframe parente (V6)
- ❌ Surfacer `error.message` brut de Supabase/Postgres dans l'UI ou un toast — `normalizeApiError().message` est générique, l'original va en `originalMessage` (log only, V7)
- ❌ Ajouter un script tiers dans `index.html` sans CSP
- ❌ `allowedHosts: true` dans `vite.config.ts` — toujours une allowlist explicite (N10)

### 💳 Stripe & Edge Functions

- ❌ Faire un read-then-write sur `subscriptions` dans une Edge Function — utiliser `upsert({...}, { onConflict: 'user_id' })` (U1, U2)
- ❌ Reset `premium_tokens` ou `win_streak` sur tous les events Stripe — ces champs ne se touchent que sur `checkout.session.completed` et `invoice.payment_succeeded` (B10, W6)
- ❌ Échouer la validation signature webhook avec `return new Response(err.message, ...)` — toujours renvoyer `'Invalid signature'` générique (N9)
- ❌ Renvoyer `Access-Control-Allow-Origin: '*'` sur une Edge Function authentifiée — allowlist liée à `APP_URL` (N7)
- ❌ Interpoler `params.cursor` / `params.cursorDate` directement dans un filtre PostgREST `.or()` — utiliser `assertValidCursor(...)` de `@/lib/pagination.types` (N6 / H-1)
- ❌ Interpoler un id client-contrôlé dans un `.not('in', ...)` PostgREST sans valider l'UUID — cf. `syncKRsToTable` (M-1)
- ❌ Appeler Stripe `customers.create` ou `checkout.sessions.create` sans `idempotencyKey` (`customer:${uid}`, `checkout:${uid}:${day}`) (M-3)
- ❌ Marquer un event Stripe comme processed (`INSERT processed_stripe_events`) **avant** que le handler n'ait réussi. Ordre obligatoire : handler → INSERT marker → 500 si INSERT échoue avec code ≠ 23505 (M-4 / M-5)
- ❌ Déployer une Edge Function sans sa section dans `supabase/config.toml` — `stripe-webhook` et les trois fonctions cron doivent avoir `verify_jwt = false` (M-10, W-1). `src/edge-config.guard.test.ts` le refuse
- ❌ Un appel sortant vers une URL saisie par un client sans résoudre le nom et refuser toute adresse non publique (W-2, `_shared/org-integrations.ts`). Une liste noire textuelle ne suffit jamais : `https://2130706433/` est `127.0.0.1`
- ❌ Une fonction `SECURITY DEFINER` exécutable par `authenticated` **parce qu'un trigger INVOKER l'appelle**, sans garde `pg_trigger_depth()` : elle devient une RPC (W-3, mig. `207`)
- ❌ Une Edge Function qui envoie un e-mail sans plafond de débit (`_shared/rate-limit.ts`) : le domaine d'envoi est celui des e-mails d'authentification (C-31, W-4)
- ❌ Rejeter une méthode HTTP avec un parsing préalable du body — `if (req.method !== 'POST') return 405` avant tout pour `stripe-webhook` (L-13)
- ❌ Recopier `auth.users.raw_user_meta_data->>'name'` dans une table partagée sans `sanitize_display_name()` — second-order XSS (M-2)
- ❌ `delete-account` qui `DELETE FROM shared_tasks WHERE user_id = ...` — la colonne s'appelle `friend_id` / `shared_by`. Utiliser `.or('friend_id.eq.{uid},shared_by.eq.{uid}')` (M-6)
- ❌ `delete-account` qui supprime `auth.users` même si une table user-owned a échoué la purge — orphelins RGPD article 17 (M-6)
- ❌ Envoyer `error.message` brut à Sentry sans `beforeSend` qui strip emails/UUIDs (M-9)
- ❌ Laisser `cosmo:qcache:*` survivre à un `SIGNED_OUT` — purge prefix-sweep (L-11)
- ❌ Passer une chaîne user-contrôlée dans `dangerouslySetInnerHTML` d'un `<style>` sans whitelist regex (`#[0-9a-f]{3,8}`, `var(--…)`, `hsl()`, `rgb()`) — cf. `chart.tsx` (M-11)

