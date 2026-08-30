# Sécurité — COSMO

> Sécurité : [`../faille.md`](../faille.md) = findings **ouverts** + priorités (source de vérité) ·
> [`archive/faille-historique.md`](./archive/faille-historique.md) = historique des corrections (archive, non maintenue).
> Ce document = règles permanentes à respecter. Les codes `(V1)`, `(N9)`, `(M-6)`… réfèrent aux fiches `faille.md`.

## Règles de sécurité (non négociables)

Ces règles découlent d'audits de sécurité et de failles déjà corrigées. Les
réintroduire = régression.

### RLS Supabase — pattern obligatoire pour toute nouvelle table

Toute nouvelle table avec des données utilisateur **doit** avoir :

```sql
ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own <name>"
  ON <name> FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own <name>"
  ON <name> FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own <name>"
  ON <name> FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);  -- ⚠️ WITH CHECK obligatoire (faille N1)

CREATE POLICY "Users can delete own <name>"
  ON <name> FOR DELETE USING (auth.uid() = user_id);
```

> **`WITH CHECK` est obligatoire sur tout UPDATE.** Sans, un attaquant peut
> rewriter `user_id` ou n'importe quel champ vers une valeur arbitraire (la
> policy `USING` n'inspecte que la ligne OLD). Cf. faille N1 sur `subscriptions`.

Et appliquer le trigger anti-mutation :
```sql
CREATE TRIGGER trg_prevent_user_id_change
  BEFORE UPDATE ON <name>
  FOR EACH ROW EXECUTE FUNCTION prevent_user_id_change();
```

### Helpers `SECURITY DEFINER` — exposition et appel depuis une policy

> Ajouté le **2026-08-24**, après la mig. `100` (fuite inter-organisations refermée) et sa
> régression immédiate par la mig. `107` (finding B-1 de `faille.md`).

Un helper de RLS (`get_subtree`, `has_subordinates`, `org_admin_count`…) est un **prédicat
interne**, pas une API. Étant `SECURITY DEFINER`, il s'exécute **sans RLS** : exposé en RPC
PostgREST, il contourne la table qu'il est censé protéger.

Trois règles, dans cet ordre :

1. **`REVOKE EXECUTE … FROM authenticated, anon`** sur tout helper qui prend un `p_org` (ou tout
   autre périmètre) en argument sans le vérifier contre `auth.uid()`.
2. Cela **ne casse pas** les appels internes : dans une fonction `SECURITY DEFINER`, le rôle
   effectif est le **propriétaire**. `claim_org_invite`, `can_access_team_project`… continuent
   d'appeler les helpers.
3. Mais cela **casse** l'appel direct depuis une policy : un `USING` / `WITH CHECK` s'évalue avec
   le **rôle courant**. Une policy ne peut donc appeler qu'un helper resté exécutable par
   `authenticated` — c'est-à-dire un helper **borné par `auth.uid()`** :

| Depuis une policy | Interdit | À utiliser |
|---|---|---|
| « ce membre est-il sous moi ? » | `user_id IN (SELECT get_subtree(org_id, auth.uid()))` | `is_above(org_id, user_id)` |
| « ai-je des subordonnés ici ? » | `has_subordinates(org_id, auth.uid())` | `i_have_subordinates(org_id)` |

### Fonctions de trigger — `SECURITY INVOKER` et `REVOKE anon`

Une fonction `RETURNS trigger` qui ne fait que **valider** ne doit **jamais** être
`SECURITY DEFINER` (règle de l'audit du 2026-07-26). Un trigger qui doit **écrire au-delà des
droits de l'appelant** — notifier d'autres utilisateurs (`notify_task_assignment`,
`notify_task_comment`), semer les catégories d'un nouveau compte — est l'exception légitime, et
c'est la seule.

Dans les deux cas, la fonction doit être `REVOKE`-ée pour `anon` **et** `authenticated`
(mig. `064b`, réappliquée par `094b`) : `REVOKE … FROM PUBLIC` ne retire pas le `GRANT` par défaut
posé par Supabase. Cela ne casse aucun trigger — Postgres vérifie le privilège `EXECUTE` d'une
fonction de trigger au `CREATE TRIGGER`, pas à chaque déclenchement.

Deux raisons, la seconde souvent oubliée :

- Une garde exécutée avec des privilèges élargis **devient elle-même le contournement**.
- Un trigger `BEFORE INSERT/UPDATE` s'exécute **avant** l'évaluation du `WITH CHECK` de la RLS.
  En `SECURITY DEFINER`, ses lectures ignorent la RLS et ses **messages d'erreur** deviennent un
  oracle sur des lignes que l'appelant n'a pas le droit de lire. C'est exactement ce qui est
  ouvert aujourd'hui sur `team_task_dependencies` (mig. `108`, finding B-3).

Référence conforme : `freeze_team_membership_identity()` (mig. `107`).

### Repositories Supabase — anti-mass-assignment

Dans tous les `mapToDb(input)` :
- ❌ **Ne jamais** copier `user_id` depuis l'input client (faille V1)
- ✅ Le `user_id` est ajouté **explicitement** dans `create()` à partir de `supabase.auth.getUser()`
- ❌ **Ne jamais** spreader `...input` directement dans un `.update()` ou `.insert()`
- ✅ Whitelist des champs un par un avec `if (input.X !== undefined) result.X = input.X`

Pour toute requête `subscriptions` (et tables sensibles à la propriété) :
- ✅ **Toujours** ajouter `.eq('user_id', user.id)` même quand RLS scope déjà (defense-in-depth, faille V15)

### Pas d'écriture client directe sur tables financières

❌ **Interdit** : `supabase.from('subscriptions').update({plan: 'premium', ...})` côté client.
✅ État actuel : la policy UPDATE client est **supprimée** (mig. 015) et l'INSERT est verrouillé sur la ligne d'amorçage `free`/zéro token (mig. 041). Les seules écritures client passent par les RPCs `consume_premium_token` / `credit_premium_token_from_ad` ; le webhook Stripe écrit en service_role.

### Sources de vérité authentification & premium

- `useAuth().user` — identité (depuis Supabase session, **pas** localStorage en prod)
- `useBilling().isPremium()` — premium (depuis table `subscriptions`)
- ❌ **Ne jamais** lire `premiumTokens` ou état premium depuis `localStorage` ou `user_metadata` (faille N5/N6)
- ❌ **Ne jamais** ré-exposer `isPremium` dans `AuthContext` — un seul hook fait foi : `useBilling`

### `/admin` — allowlist ET second facteur (mig. 131)

`/admin` rend toute la volumétrie business du produit : comptes, canaux
d'acquisition, rétention, organisations. Depuis la mig. 131, l'appartenance à
`admin_users` ne suffit plus, la **session** doit avoir présenté un second
facteur.

Deux fonctions, et il ne faut jamais les intervertir :

| Fonction | Répond à | Usage |
|---|---|---|
| `public.admin_allowlisted()` | « ce compte est-il admin ? » | AFFICHAGE : entrée « Stats COSMO » dans les Réglages, écran d'enrôlement TOTP |
| `public.is_admin()` | « cette requête est-elle autorisée ? » | GARDE : appelée par `get_admin_stats()`, exige `admin_allowlisted()` **ET** `auth.jwt() ->> 'aal' = 'aal2'` |

- ❌ **Ne jamais garder une surface admin par `admin_allowlisted()`.** Elle ignore
  volontairement le niveau d'assurance de la session : c'est ce qui rend l'écran
  d'enrôlement atteignable avant tout second facteur. L'utiliser comme garde
  annulerait la migration.
- ❌ **Ne jamais tester « ce compte a activé la 2FA ».** `aal2` dit que **cette
  session** a présenté le facteur. Un mot de passe volé ouvre une session `aal1`
  sur un compte pourtant enrôlé : c'est exactement le cas que la garde doit
  refuser. La claim est posée par GoTrue, jamais par le client.
- ❌ **Ne jamais relâcher sur une claim absente** : `COALESCE(..., 'aal1')`. Un
  jeton sans `aal` est traité comme un facteur unique.
- ⚠️ Le QR d'enrôlement est rendu par une balise `<img>` sur une `data:` URI,
  **jamais** par `dangerouslySetInnerHTML` : un SVG inline exécute ses scripts,
  un SVG chargé comme image ne le peut pas. La source est notre propre GoTrue,
  et ce n'est pas une raison suffisante.
- 🔑 **Téléphone perdu** : `DELETE FROM auth.mfa_factors WHERE user_id = '<uid>';`
  depuis le SQL editor (rôle `service_role`, qui ne passe par aucune de ces
  fonctions). La session redevient `aal1` et l'écran d'enrôlement reparaît. Il
  n'y a donc pas de verrouillage définitif, donc pas de codes de récupération à
  stocker quelque part.

### Uploads de fichiers (avatars, etc.)

Pour tout `<input type="file">` :
- ✅ Whitelist MIME (ex. `['image/jpeg','image/png','image/webp','image/gif']`)
- ❌ **Jamais** de `image/svg+xml` (peut contenir du JS)
- ✅ Cap `file.size` (avatar : 500 KB)
- ✅ Re-encoder via canvas avant stockage pour neutraliser un payload caché
- Voir `src/pages/SettingsPage.tsx → handleAvatarUpload` comme référence

### Surface client — pas de leak

- ❌ **Jamais** `window.parent.postMessage(payload, '*')` — fuite vers iframe parente (faille V6)
- ❌ **Jamais** afficher `error.message` brut dans l'UI (`AppErrorBoundary` doit montrer un message générique — faille V7)
- ❌ Pas de fichier dead-code style Next.js (`ErrorReporter.tsx` était supprimé pour cette raison — faille V9)
- ✅ `console.error` reste autorisé pour `AppErrorBoundary`, mais à terme → Sentry

### Navigation & redirections

- ❌ **Jamais** `navigate(X)` ou `window.location.href = X` avec X provenant d'une URL param ou d'input utilisateur sans validation
- ✅ `redirectTo` OAuth doit être restreint (Supabase Auth → URL Configuration)

### Système d'amis & partage (RLS social)

- ✅ `friends.INSERT` exige une `friend_requests` acceptée
- ✅ `shared_tasks.INSERT` exige une amitié confirmée **OU** une demande d'ami `pending` envoyée par le partageur au destinataire (migration 036). La branche pending vérifie `sender_id = auth.uid()` (on ne cible qu'un destinataire à qui ON a envoyé une demande) ; le destinataire doit toujours accepter la tâche (`shared_tasks.accepted_at`)
- ✅ `friend_requests.UPDATE` : sender peut seulement `cancel`, receiver peut seulement `accept/reject`. **Depuis la mig. 049** ces deux règles vivent dans **UNE seule** policy fusionnée (`friend_requests_update_sender_or_receiver`) dont le `WITH CHECK` est `(uid=receiver AND status∈{accepted,rejected}) OR (uid=sender AND status∈{pending,cancelled})` — sémantique strictement identique à l'ancien split (advisor perf `multiple_permissive_policies`). De même `friend_requests.SELECT` (receiver OR sender) et `tasks.SELECT/UPDATE` (own OR collaborator/editor) sont fusionnées en une policy OR unique.
- ❌ **Ne pas** ré-introduire deux policies permissives séparées pour le même rôle+action (advisor `multiple_permissive_policies`). Pour étendre l'accès, élargir le `OR` de la policy existante — sans jamais affaiblir le modèle de confiance
- ⚠️ **Récursion RLS `tasks ↔ shared_tasks`** : la policy `shared_tasks_insert` ne doit JAMAIS contenir d'`EXISTS` direct sur `tasks` (cycle → erreur 42P17 `infinite recursion`, partage cassé en prod après la mig. 043). Utiliser `public.owns_task(task_id)` (SECURITY DEFINER, mig. 045) pour tout check de propriété de tâche dans une policy de `shared_tasks` ou `share_links`.

### CSP & headers

- ✅ Tous les headers de sécurité Vercel doivent rester (HSTS, X-Frame-Options, etc.)
- ✅ CSP **présente** dans `vercel.json` (faille §6 CLOSE) : `default-src 'self'` + Stripe (`js.stripe.com`/`api.stripe.com`) + Supabase (`*.supabase.co`) + Sentry (`*.ingest.de.sentry.io`) + Google Fonts, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. Toute nouvelle origine externe (CDN, AdSense, etc.) doit y être whitelistée explicitement, sinon elle sera bloquée.

#### 🚫 Jamais de clé `"//"` (commentaire) dans `vercel.json`

Le schéma Vercel est **strict** : une entrée de `headers[]` n'accepte que `source`,
`headers`, `has`, `missing`. Toute propriété additionnelle — dont la convention
`"//"` utilisée comme commentaire — fait **échouer le déploiement** à la validation,
sur *toutes* les branches à la fois. `npm run build` ne valide PAS `vercel.json` :
le build reste vert en local pendant que chaque déploiement Vercel est rouge
(vécu du 2026-07-31 au 2026-08-01, ~13 déploiements perdus). Le JSON n'ayant pas
de commentaires, toute justification se documente **ici**, jamais dans le fichier.

#### noindex — variantes préfixées par locale (i18n)

Les `source` Vercel ne sont **pas** préfixe-agnostiques. Sans les entrées
`/(en|es)/(invite|org-invite)/(.*)` et `/(en|es)/(forgot-password|reset-password)`,
une URL comme `/en/invite/<token>` **perdrait son `noindex`** et des tokens
d'invitation deviendraient indexables — c'est une fuite, pas un détail SEO.
Ces entrées doivent survivre au retrait du `noindex` global sur `/en/*`, et toute
nouvelle locale servie doit être ajoutée à ces deux `source`.

> Le `noindex` global `/en/(.*)` est **temporaire** (posé en phase 2, catalogues
> anglais alors partiels → duplicate content FR sur des URLs anglaises). À retirer
> quand les traductions `/en/` sont jugées complètes — décision SEO, pas technique.

### Pagination cursor-based — `assertValidCursor`

Tous les `getPage(params)` des repos qui utilisent un filtre PostgREST `.or()` avec `params.cursor`/`params.cursorDate` **doivent** appeler :
```ts
import { assertValidCursor } from '@/lib/pagination.types';
if (params.cursor && params.cursorDate) {
  assertValidCursor(params.cursor, params.cursorDate);
  query = query.or(`...lt.${params.cursorDate},...`);
}
```
- Le helper valide UUID + ISO 8601 (regex). Sans guard, un cursor forgé (`?cursor=...`) peut bypasser le cutoff ou faire fuiter le schéma via erreur PostgREST. Faille H-1 (régression du fix N6 appliqué uniquement à OKR avant 2026-05-30).
- Appliqué dans `tasks`, `habits`, `events`, `okrs` — à dupliquer si on ajoute un autre module paginé.
- Même principe pour tout filtre `.or()` / `.not('in',...)` qui interpole un id client-fourni : valider UUID en amont (cf. `syncKRsToTable` dans `okrs/supabase.repository.ts`, faille M-1).

## Edge Functions Supabase

| Function | Rôle | Sécurité notable |
|---|---|---|
| `stripe-create-checkout` | Crée une session Checkout Stripe | CORS allowlist (`APP_URL`), upsert sur `subscriptions` (B0/N7/U1), idempotency-key `customer:${uid}` + `checkout:${uid}:${day}` (M-3) |
| `stripe-webhook` | Reçoit les events Stripe | Signature verify, idempotence via `processed_stripe_events` (PK event.id) — **marker INSERT après handler** (M-4) pour préserver at-least-once Stripe + 500 sur erreur dedup non-23505 (M-5) + rejet non-POST (L-13) (B10/W6/N8/N9/U2) |
| `delete-account` | Supprime compte + données utilisateur | Anon JWT pour l'identité, service_role pour purger toutes les tables user-owned + `auth.admin.deleteUser` (B9). Purge `shared_tasks` par `friend_id`/`shared_by` (M-6), abort si cleanup échoue (RGPD) |
| `stripe-org-checkout` | Session Checkout d'une **organisation** | CORS allowlist, **owner-only** (`organizations.owner_id`) — org inexistante et non-propriétaire renvoient la **même** 403, pour ne pas confirmer l'existence d'une org dont on connaîtrait l'UUID. `allow_promotion_codes`, idempotency-keys `org-customer:${orgId}` + `org-checkout:${orgId}:${tier}:${day}`. Le customer porte `org_owner_uid`, **jamais** `supabase_uid` (cf. encadré ci-dessous) |
| `stripe-org-portal` | Portail de facturation d'une organisation | Mêmes CORS et owner-only. Délègue à Stripe carte / factures / changement de palier / **résiliation** |
| `report-bug` | Relaie le formulaire « Signaler un bug » par e-mail (Resend) | **Aucun accès base** — ni anon ni service_role pour lire ou écrire. CORS allowlist (`APP_URL` + les deux origines de dev). L'identité de l'auteur vient du JWT (`Reply-To`), **jamais** du corps de la requête. Titre et nom de fichier passent par un `singleLine()` (un CR/LF dans un `Subject` scinde les en-têtes du mail), description échappée dans la partie HTML. Pièce jointe : allowlist de types (image / PDF / texte, ni archive ni exécutable), 3 Mo, base64 validé par regex. Erreur Resend jamais relayée au client (peut contenir des détails de compte), résumée dans `opsAlert` |

> **`supabase/config.toml` obligatoire** (M-10) : `stripe-webhook` doit avoir `verify_jwt = false` (Stripe authentifie par signature, pas JWT). **Toutes les autres fonctions**, y compris `stripe-org-checkout` et `stripe-org-portal`, gardent `verify_jwt = true`. Ne pas déployer sans ce fichier ou Stripe recevra 401 avant la vérification signature.

### Abonnement d'organisation (mig. 101)

`org_subscriptions` : SELECT réservé aux membres (`is_org_member`), **aucune policy d'écriture**.
Contrairement à `subscriptions` (mig. 013), aucun trigger-guard n'est nécessaire — il n'y a rien
à garder quand rien n'est écrivable. Seul le `service_role` du webhook écrit.

Le quota appliqué est `org_seats_allowed()` ; un abonnement `past_due` ou `cancelled` retombe au
palier gratuit **sans jamais retirer de membre**.

> 🔴 **Étanchéité des deux univers de facturation.** Un event Stripe d'organisation ne doit
> jamais être traité par la branche particulier. Trois gardes le garantissent, et elles sont
> solidaires : le customer Stripe d'une org porte `org_owner_uid` et non `supabase_uid` ;
> `getUidFromCustomer` refuse tout customer portant `org_id` ; et `orgIdFromInvoice` **lève**
> sur erreur de requête au lieu de renvoyer `null`. Sans ces trois-là, une facture d'entreprise
> écrivait dans l'abonnement **personnel** du propriétaire — et comme le handler retournait un
> succès, le marqueur d'idempotence était posé et Stripe ne redélivrait jamais. Défaut trouvé
> par deux revues indépendantes le 2026-08-17, avant toute mise en service.

Test d'intégration : `e2e/rls/org-subscriptions.test.ts` (nécessite la stack Supabase locale).

```bash
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy delete-account
supabase db push  # applique 017_processed_stripe_events.sql
```

## Avant tout commit qui touche `supabase/migration/*.sql`

- ✅ Vérifier `WITH CHECK` sur tous les UPDATE
- ✅ Idempotence : `DROP POLICY IF EXISTS ... CREATE POLICY ...` (la prod a déjà des policies appliquées). `CREATE OR REPLACE FUNCTION` pour les RPCs.
- ✅ `SET search_path = ''` sur toute fonction `SECURITY DEFINER` (advisor hardening).
- ✅ Si la table a `user_id`, attacher le trigger `prevent_user_id_change`.
- ✅ Toute donnée utilisateur recopiée depuis `auth.users.raw_user_meta_data` ou autre source contrôlée par un tiers doit passer par `public.sanitize_display_name()` (migration 026, faille M-2) avant insertion dans une table partagée — `accept_friend_request_v2` est la référence.
- ⚠️ Le schéma réel de prod peut diverger des migrations (ex. `friend_requests` utilise `sender_id`/`receiver_id`) — vérifier avant d'écrire des policies qui réfèrent à des colonnes.
- ✅ Toutes les `CREATE POLICY` utilisent des guillemets non-échappés (`"..."`). Ne pas réintroduire de `\"`.
- ✅ **Toute fonction citée dans un `USING` / `WITH CHECK` doit être `EXECUTE`-able par `authenticated`.** Vérification en une requête, à faire avant de pousser une migration qui crée une policy :
  ```sql
  select p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in (<fonctions citées par la policy>);
  ```
  ✅ **Automatisé depuis le 2026-08-24** : `npm run check:rls` rejoue les `GRANT`/`REVOKE` de tout
  l'historique et refuse toute policy citant une fonction révoquée à `authenticated` (règle 3 du
  script). La requête ci-dessus reste utile pour vérifier l'**état réel** en prod — le script, lui,
  ne voit que les migrations.
- ✅ **Fonction `RETURNS trigger` : `SECURITY INVOKER` (défaut) + `REVOKE ALL … FROM PUBLIC, anon, authenticated`.** Cf. section dédiée plus haut. ✅ **Automatisé depuis le 2026-08-24** : `npm run validate:migrations` (règle 5) échoue si le `REVOKE` manque, et avertit sur tout trigger `SECURITY DEFINER`. Cliquet à partir de la mig. `109` — les deux gardes sont elles-mêmes testées par `scripts/migration-guards.test.mjs`.

## Rotation des secrets

Si une clé fuite (commit accidentel, compromission soupçonnée, etc.) :

1. **Rotater immédiatement** :
   - Supabase : `Dashboard → Project Settings → API → Reset anon/service_role`
   - Stripe : `Dashboard → Developers → API keys → Roll`
   - Webhook signing secret Stripe : recréer l'endpoint
2. **Invalider les sessions actives** : `auth.admin.signOut()` côté Edge Function ou requête manuelle SQL `delete from auth.refresh_tokens`
3. **Mettre à jour** : Vercel env vars + `.env` local + Edge Function secrets (`supabase secrets set ...`)
4. **Re-deploy** Vercel + redéployer les Edge Functions
5. **Audit** : vérifier les logs Supabase pour activité suspecte avant la rotation

Variables sensibles **jamais côté client** : `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY` (si utilisé).

## Ne jamais faire — Sécurité (récap)

### 🔐 Données & auth

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
- ❌ Déployer une Edge Function sans `supabase/config.toml` — `stripe-webhook` doit avoir `verify_jwt = false` (M-10)
- ❌ Rejeter une méthode HTTP avec un parsing préalable du body — `if (req.method !== 'POST') return 405` avant tout pour `stripe-webhook` (L-13)
- ❌ Recopier `auth.users.raw_user_meta_data->>'name'` dans une table partagée sans `sanitize_display_name()` — second-order XSS (M-2)
- ❌ `delete-account` qui `DELETE FROM shared_tasks WHERE user_id = ...` — la colonne s'appelle `friend_id` / `shared_by`. Utiliser `.or('friend_id.eq.{uid},shared_by.eq.{uid}')` (M-6)
- ❌ `delete-account` qui supprime `auth.users` même si une table user-owned a échoué la purge — orphelins RGPD article 17 (M-6)
- ❌ Envoyer `error.message` brut à Sentry sans `beforeSend` qui strip emails/UUIDs (M-9)
- ❌ Laisser `cosmo:qcache:*` survivre à un `SIGNED_OUT` — purge prefix-sweep (L-11)
- ❌ Passer une chaîne user-contrôlée dans `dangerouslySetInnerHTML` d'un `<style>` sans whitelist regex (`#[0-9a-f]{3,8}`, `var(--…)`, `hsl()`, `rgb()`) — cf. `chart.tsx` (M-11)
