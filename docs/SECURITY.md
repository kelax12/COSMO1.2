# Sécurité — COSMO

> Sécurité : `faille.md` (hors dépôt) = findings **ouverts** + priorités (source de vérité) ·
> [`archive/faille-historique.md`](./archive/faille-historique.md) = historique des corrections (archive, non maintenue).
> Ce document = règles permanentes à respecter. Les codes `(V1)`, `(N9)`, `(M-6)`… réfèrent aux fiches `faille.md`.
> **Chiffres** : les comptes (tables, policies, migrations, Edge Functions) sont dans [`FAITS.md`](./FAITS.md), générés ; l'état de la production se mesure (`check:supabase-posture`, `check:migration-coverage`, `check:edge`). Les relevés datés qui figuraient ici (2026-09-14 au 2026-10-15, advisors, confrontation au catalogue) sont archivés : [`archive/SECURITY-releves-dates-2026-08-25-au-2026-10-15.md`](./archive/SECURITY-releves-dates-2026-08-25-au-2026-10-15.md). Aucune note /100 ici : [`INDICATEURS.md`](./INDICATEURS.md) (ADR 0012).

## 🕳️ Angles morts · ce que ce document NE mesure PAS (2026-09-16)

> **Pourquoi cette section existe** : ce document affirme des règles que rien ne pèse. Chaque ligne
> ci-dessous nomme une affirmation qui n'était vérifiée par rien, et la garde qui la vérifie depuis.
> Une ligne se **referme** ou se **reconduit avec sa date**, jamais ne se recopie. 🔴 **Une garde
> posée n'est pas un angle mort fermé** : la dernière colonne dit ce que le vert ne prouve pas.
> L'énoncé du 2026-09-16, la colonne « État » réécrite le 2026-09-21 et les mesures datées de chaque
> ligne sont archivés sans une coupe :
> [`archive/SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md`](./archive/SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md).

| # | Angle mort (énoncé du 2026-09-16) | Garde qui le couvre | 🔴 Ce que cette garde ne prouve pas |
|---|---|---|---|
| AM-1 | Les **règles** de sécurité de ce document n'étaient notées nulle part (la note vivait dans `faille.md`, qui ne porte que les findings ouverts) | **Sans objet** depuis le 2026-11-08 : les notes /100 ont cessé (ADR 0012, ADR 0014), `npm run check:docs` refuse leur retour | Sans objet |
| AM-2 | Les réglages du **Dashboard Supabase** (mots de passe compromis, expiration des OTP, MFA) se modifient hors du dépôt, sans trace | `npm run check:supabase-posture` (`C-88`), qui juge un **écart** à une référence commitée ; la référence porte huit réglages d'Auth depuis `M-58` (2026-10-08) | Un absolu : elle ne dit pas que la référence est bonne |
| AM-3 | La **rotation des secrets** n'avait ni échéance ni rappel | `npm run check:secrets-age` (`M-54`) contre `.github/secrets-registry.json` (noms seulement), hebdomadaire. Échoue sur un secret échu, de date **inconnue (= échu)**, vivant sans entrée au registre, inscrit sans exister ; jeton absent = exit 1. Témoin `check-secrets-age.guard.test.mjs`. État courant : § « Rotation des secrets » | Les dates que ni GitHub ni Vercel ne datent (Edge, `SERVICE_ROLE_KEY`) tant que `lastRotated` n'est pas renseigné |
| AM-4 | La checklist « avant tout commit qui touche `supabase/migration/*.sql` » était **manuelle** | Tableau ligne par ligne au § [« Avant tout commit qui touche `supabase/migration/*.sql` »](#avant-tout-commit-qui-touche-supabasemigrationsql) : `validate:migrations` (règles 2, 5, 6 à 16), `check:rls` (règles 1 à 3), `check:erasure` ; les lignes restantes sont **manuel** et le disent. Cliquet à partir de la mig. `227`, un témoin vu rouge par règle | L'historique `000` à `226` (non jugé, il diverge de la prod) ; qu'une migration fait ce qu'elle dit : la preuve en transaction annulée reste une discipline |
| AM-5 | Les **advisors Supabase** n'étaient lus qu'à la main | `npm run check:supabase-posture` (`C-88`) lit les advisors par l'API Management ; écarts relus au § [AM-5](#am-5--écart-de-checksupabase-posture-constaté-le-2026-11-05) | Idem AM-2 |
| AM-6 | **Aucune analyse statique** (SAST) : les gardes vérifient des invariants nommés, jamais des motifs inconnus | `codeql.yml`, `security-extended`, JS/TS **et** `actions` (`C-89`, `M-60`) | Un job vert : l'item n'est fini que si **chaque alerte ouverte porte une décision**. Le dépôt doit rester **public** (CodeQL rouge « Code scanning is not enabled » sur un dépôt privé) |
| AM-7 | Le **recalage de `Posture`** ne pouvait être fait que par Axel (`--update` exige `SUPABASE_ACCESS_TOKEN`, absent du poste) | `posture.yml`, entrée `regenerer` (job `recaler-reference`, `main` seulement, rejoue la garde puis commite la référence) ; `--update` conserve les `_note` (`fusionnerReference`) | Que l'écart recalé soit légitime : relire chaque objet au catalogue AVANT |

---

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
✅ État actuel : la policy UPDATE client est **supprimée** (mig. 015) et l'INSERT est verrouillé sur la ligne d'amorçage `free`, sans identifiant Stripe (mig. 041, réécrite par la mig. 141). Depuis la suppression du système de jetons (mig. **141**, C-04), **le client n'a plus AUCUN chemin d'écriture** sur `subscriptions` : les deux RPC `consume_premium_token` / `credit_premium_token_from_ad` n'existent plus, et seul le webhook Stripe écrit, en service_role.

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
- ✅ CSP **présente** dans `vercel.json` (faille §6 CLOSE) : `default-src 'self'` + aucun domaine Stripe (checkout par redirection serveur : `js.stripe.com` retiré le 2026-11-06, SEC-09, `api.stripe.com` retiré le 2026-11-07, COD-03 ; garde `src/csp.guard.test.ts`) + Supabase (le seul hôte du projet, `https://` ET `wss://`, plus de joker `*.supabase.co` depuis le 2026-11-06) + Sentry (`*.ingest.de.sentry.io`) + Google Fonts, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. `style-src 'unsafe-inline'` est conservé (COD-03) : Framer Motion, Radix, FullCalendar, le shader de la landing et plus de 1 300 `style={}` React posent des attributs `style` en ligne, qu'un nonce ou un hash ne peut pas couvrir. Le retirer casserait l'affichage ; le risque résiduel (injection CSS, sans exécution de script) est accepté. Toute nouvelle origine externe (CDN, AdSense, etc.) doit y être whitelistée explicitement, sinon elle sera bloquée.

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
| `stripe-create-checkout` | Crée une session Checkout Stripe | CORS par `_shared/env.ts` (`APP_URL` seule), upsert sur `subscriptions` (B0/N7/U1), idempotency-key `customer:${uid}` + `checkout:${uid}:${day}` (M-3) |
| `stripe-webhook` | Reçoit les events Stripe | Signature verify, idempotence via `processed_stripe_events` (PK event.id) — **marker INSERT après handler** (M-4) pour préserver at-least-once Stripe + 500 sur erreur dedup non-23505 (M-5) + rejet non-POST (L-13) (B10/W6/N8/N9/U2). `customer.subscription.updated|deleted` : état **relu** par `stripe.subscriptions.retrieve`, jamais la charge de l'event (Stripe ne garantit pas l'ordre, SEC-08, `_shared/subscription-event.ts`) |
| `delete-account` | Supprime compte + données utilisateur | Anon JWT pour l'identité, service_role pour purger toutes les tables user-owned + `auth.admin.deleteUser` (B9). Purge `shared_tasks` par `friend_id`/`shared_by` (M-6), abort si cleanup échoue (RGPD) |
| `stripe-org-checkout` | Session Checkout d'une **organisation** | CORS allowlist, **owner-only** (`organizations.owner_id`) — org inexistante et non-propriétaire renvoient la **même** 403, pour ne pas confirmer l'existence d'une org dont on connaîtrait l'UUID. `allow_promotion_codes`, idempotency-keys `org-customer:${orgId}` + `org-checkout:${orgId}:${tier}:${day}`. Le customer porte `org_owner_uid`, **jamais** `supabase_uid` (cf. encadré ci-dessous) |
| `stripe-org-portal` | Portail de facturation d'une organisation | Mêmes CORS et owner-only. Délègue à Stripe carte / factures / changement de palier (ouvert le 2026-11-05 : prorata des frais et des crédits, facturé immédiatement ; passage à un palier moins cher et à une période plus courte appliqués immédiatement) / **résiliation** |
| `report-bug` | Relaie le formulaire « Signaler un bug » par e-mail (Resend) | **Aucun accès base** — ni anon ni service_role pour lire ou écrire. CORS par `_shared/env.ts` : `APP_URL` seule, plus d'origine de dev en production depuis le 2026-11-06 (COD-03). L'identité de l'auteur vient du JWT (`Reply-To`), **jamais** du corps de la requête. Titre et nom de fichier passent par un `singleLine()` (un CR/LF dans un `Subject` scinde les en-têtes du mail), description échappée dans la partie HTML. Pièce jointe : allowlist de types (image / PDF / texte, ni archive ni exécutable), 3 Mo, base64 validé par regex. Erreur Resend jamais relayée au client (peut contenir des détails de compte), résumée dans `opsAlert` |
| `stripe-org-refund` | Remboursement **manuel** d'un abonnement d'organisation (aperçu, puis validation) | JWT, **`is_admin()` seulement** depuis le 2026-11-01 (allowlist ET aal2), aucun utilisateur ne rembourse ; pré-contrôle anti-rejeu dans `_shared/refund-replay.ts` (module pur, testé), montant par `_shared/refund-amount.ts`. Jamais sondée en POST |
| `stripe-org-subscription` | Rétractation 14 jours (arrêt immédiat) et résiliation en fin de période | JWT, **propriétaire** seulement (403 sinon) ; `retry: 0` côté client (`useOrgSubscriptionAction`) |
| `renewal-notice` | Avis de reconduction tacite (Conso. L215-1), cron CI | `x-cron-secret`, échec fermé sans secret (503) ; `verify_jwt = false` |
| `send-org-invite` | Envoie les invitations nominatives d'entreprise (Resend) | JWT ; lien créé par l'appelant ou admin ; relance 1 h ; **plafond par e-mail**, 100/jour par compte et par organisation (W-4, 2026-09-30) ; `RATE_LIMIT_SALT` absent = 503 |
| `org-digest` | Notifications d'entreprise par e-mail, cron CI | `x-cron-secret`, échec fermé ; `verify_jwt = false` |
| `verify-org-domain` | Vérifie un domaine par TXT `_cosmo-verify` | JWT, admin **actif** ; domaine d'autrui répond comme un absent ; seule écriture de `verified_at` (aucune policy UPDATE) |
| `org-webhook-dispatch` | Vide la file des webhooks d'organisation, cron CI | `x-cron-secret` ; `verify_jwt = false` (W-1) ; **cible publique exigée** : nom DNS, puis chaque adresse A/AAAA publique (W-2) ; `redirect: 'manual'` ; corps de réponse jamais lu ; HMAC-SHA256 horodaté |
| `inactive-accounts` | Comptes inactifs depuis 3 ans : avertir, puis effacer (C-121), cron CI | `x-cron-secret`, échec fermé sans secret ; `verify_jwt = false` |
| `seat-alert` | Alerte 80 % des sièges, quotidienne (mig. `240`), cron CI | `x-cron-secret`, échec fermé ; `verify_jwt = false` ; trace écrite APRÈS l'envoi |
| `affiliation-api` | API d'affiliation (mig. `236`), seul client : COSMO Analytics | `verify_jwt = false`, la fonction juge l'appelant : jeton `X-Affiliation-Token` signé, ou JWT `is_admin()` ; `/session` et `/click` publics, plafonnés par IP |

> **`supabase/config.toml` obligatoire** (M-10). Chaque fonction y a sa section, **vérifié par
> `src/edge-config.guard.test.ts`** depuis le 2026-09-30 (W-1 : `org-webhook-dispatch` y manquait,
> et aucun webhook n'est jamais parti). `verify_jwt = false` pour `stripe-webhook` (Stripe
> authentifie par signature), pour `affiliation-api` (qui juge elle-même l'appelant) et pour les cinq
> fonctions **appelées par la CI** avec `x-cron-secret` (`renewal-notice`, `org-digest`,
> `org-webhook-dispatch`, `inactive-accounts`, `seat-alert`) : sans cette ligne, la
> passerelle rend 401 avant le code. **Toutes les autres** gardent `verify_jwt = true`, et la garde
> exige `true` pour toute fonction qui identifie l'appelant par `auth.getUser()`.

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

> **Angle mort AM-4, outillé le 2026-10-24.** Chaque ligne de cette checklist (et des interdits de
> [`supabase/migration/CLAUDE.md`](../supabase/migration/CLAUDE.md)) est rapportée à la garde qui la
> juge, ou marquée **manuel**. Les règles 6 à 16 de `validate:migrations` sont un **cliquet à partir
> de la mig. `227`** : l'historique (`000` à `226`) n'est pas jugé, parce que les fichiers divergent
> de la prod (même raison que `check:rls`). Chaque règle a son témoin dans
> `scripts/migration-guards.test.mjs`, vu rouge contre le script d'avant elle, et son sabotage de
> détecteur dans `scripts/replay-sabotages.catalogue.mjs`.
> ❌ Ne jamais relever le plancher `227` pour faire passer une migration : la corriger.

| # | Ligne de la checklist | Garde | Ce que la garde ne voit pas |
|---|---|---|---|
| 1 | `WITH CHECK` sur toute policy `FOR UPDATE` (N1) | `validate:migrations` règle 8 : **erreur** dès `227` (avertissement avant, règle 4) | une policy `FOR ALL` sans `WITH CHECK` (Postgres reprend alors le `USING`) |
| 2 | Idempotence : `DROP POLICY IF EXISTS` avant `CREATE POLICY`, `CREATE OR REPLACE FUNCTION` | `validate:migrations` règle 6 | un `CREATE TABLE` / `CREATE INDEX` sans `IF NOT EXISTS` |
| 3 | `SET search_path = ''` sur toute fonction `SECURITY DEFINER` | `validate:migrations` règle 7, attributs lus avant ET après le corps | une fonction INVOKER au `search_path` mutable (l'advisor la voit, `check:supabase-posture`) |
| 4 | Table à `user_id` : trigger `prevent_user_id_change` | `validate:migrations` règle 15, état final de l'historique | ⚠️ constaté le 2026-10-24 : **aucune** table des mig. `2xx` ne l'attache. Dette antérieure au cliquet, non jugée |
| 5 | `raw_user_meta_data` recopié : `sanitize_display_name()` (M-2) | `validate:migrations` règle 14, par fonction qui écrit, et hors fonction | une recopie par une Edge Function, ou par une autre source tierce que `raw_user_meta_data` : **manuel** |
| 6 | Le schéma de prod peut diverger des migrations : vérifier les colonnes avant d'écrire une policy | **manuel** · `Migration coverage` voit un objet absent après coup | tout, avant l'écriture : une colonne se lit au catalogue |
| 7 | Guillemets non échappés dans `CREATE POLICY` | `validate:migrations` règle 2 | |
| 8 | Fonction citée par une policy : `EXECUTE`-able par `authenticated` | `check:rls` règle 3 (dont `get_subtree`, `has_subordinates`, `org_admin_count`, révoquées mig. `100`) | l'état réel en prod : requête ci-dessous |
| 9 | Fonction `RETURNS trigger` : `SECURITY INVOKER` + `REVOKE ALL … FROM PUBLIC, anon, authenticated` | `validate:migrations` règle 5 (REVOKE, dès `109`) et règle 10 (DEFINER = **erreur** quel que soit le nom, dès `227`) | |
| 10 | `auth.uid()` toujours wrappé en `(select auth.uid())` | `check:rls` règle 1 (dès `043`) | |
| 11 | Une seule policy PERMISSIVE par rôle et par action | `check:rls` règle 2 (par table et action, donc plus strict que par rôle, dès `043`) ; sur TOUT l'historique, la matrice RLS lit `pg_policy` de la base rejouée (mig. `244`) | |
| 12 | `GRANT EXECUTE` : précédé de `REVOKE … FROM PUBLIC, anon` | `validate:migrations` règle 16, pour toute fonction accordée ou `SECURITY DEFINER` ; un `GRANT … TO anon` explicite vaut choix | une fonction INVOKER jamais accordée (elle garde le GRANT par défaut, sans privilège élargi) |
| 13 | Table créée : `ENABLE ROW LEVEL SECURITY` **dans le même fichier** | `validate:migrations` règle 9 : même fichier, puis état final (un `DISABLE` ultérieur rougit). Les privilèges par défaut de `public` ne donnent plus rien à `anon` (mig. `242`), règle 17 si on les rouvre ; une table qu'`anon` doit lire porte son `GRANT` explicite | une table créée hors du schéma `public` |
| 14 | Table à `user_id` : décision d'effacement | `check:erasure`, périmètre dérivé des migrations, sans liste en dur | une table créée hors migration (cf. `C-92`) |
| 15 | `payment_records` / `payment_closures` : ni policy UPDATE/DELETE, ni purge ; `renewal_notices` : jamais purgée | `validate:migrations` règle 11 : policy, `DELETE`/`TRUNCATE`/`UPDATE`, trigger désarmé, `GRANT` de le faire | une écriture par SQL dynamique (`EXECUTE format(…)`) |
| 16 | Surface admin gardée par `is_admin()`, jamais `admin_allowlisted()` | `validate:migrations` règle 12, pour les policies | une fonction `SECURITY DEFINER` gardée par `admin_allowlisted()` : **manuel** (l'affichage l'appelle légitimement) |
| 17 | Auto-référence : `ON DELETE NO ACTION`, ni `CASCADE` ni `RESTRICT` | `validate:migrations` règle 13, `CREATE TABLE` et `ALTER TABLE` | |
| 18 | Un correctif appliqué se versionne sous son propre numéro, jamais par édition d'un fichier appliqué | **manuel** · vérifiable par `git diff` contre `main`, pas par le texte des fichiers | tout |
| 19 | Jamais de colonne, GRANT ou policy depuis le Dashboard | **manuel** · rien ne voit un ajout fait au Dashboard (`check:drift`, retiré le 2026-11-08, ne faisait qu'avertir) | tout, avant |
| 20 | Lire le ledger AVANT d'appliquer | **manuel** · `check:migration-coverage` le relit après | tout, avant |
| 21 | Prédicat de policy indépendant d'un argument pris dans la ligne (index) | **manuel** · seul `events` (mig. `128`) a un test dédié | toute autre table : une heuristique sur le texte se tromperait dans les deux sens |
| 25 | Visibilité d'un projet d'équipe : une seule règle, `my_team_project_ids` (mig. `243`) ; `can_access_team_project` ne fait que la consulter | `e2e/rls/regle-unique-projet.test.ts` : lecture directe sous RLS = RPC `get_my_team_*`, huit acteurs types | une nouvelle RPC de lecture qui recalculerait son périmètre à la main : **manuel** |
| 22 | Migration qui crée une dépendance à un chemin de récupération : le parcourir | **manuel** | tout |
| 23 | Colonne écrite par le front : appliquer AVANT le déploiement du front | **manuel** (ordre de déploiement, pas un texte) | tout |
| 24 | Se prouver AVANT, en transaction annulée, acteur par acteur | **manuel** · forme de preuve dans `supabase/migration/CLAUDE.md` | tout : aucune vérification statique n'exécute de SQL |

**Requête de la ligne 8, pour l'état réel en prod** (`check:rls` ne voit que les migrations) :

```sql
select p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in (<fonctions citées par la policy>);
```

🔴 **Ce que les règles 6 à 16 ne prouvent PAS** : qu'une migration fait ce qu'elle dit. Elles lisent
du texte. Les huit lignes **manuel** ci-dessus restent une discipline, et la mig. `143` a mis un
défaut en production en passant cinq vérifications statiques.

## Rotation des secrets

### Quand (échéances)

Le registre `.github/secrets-registry.json` porte, pour chaque secret, son **propriétaire**, sa **criticité**, son **échéance** (`maxAgeDays`) et sa **dernière rotation** (`lastRotated`). **Noms seulement, jamais une valeur.** Échéances posées le 2026-10-24 :

| Criticité | Échéance | Secrets |
|---|---|---|
| `critical` | 180 j (365 j pour `BACKUP_PASSPHRASE`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`) | clés Stripe, `SUPABASE_DB_URL`, clés service |
| `high` | 90 j (jetons d'accès) à 180 j | `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`, `CRON_SECRET`, `RESEND_API_KEY`, `DRILL_DB_URL` |
| `medium` | 180 à 365 j | webhook ops, sel de limitation de débit, jeton d'audit |

Les identifiants et URLs (`kind: config`) ne tournent pas, mais leur existence est vérifiée.

**La garde** : `npm run check:secrets-age` (workflow `Secrets age`, chaque lundi, relié à `ci-alert.yml`). Elle lit GitHub Actions (`updated_at`), les secrets Edge (API Management, noms) et Vercel (`updatedAt`, jamais `decrypt`), puis échoue sur :

- un secret plus vieux que son échéance ;
- un secret de **date inconnue**, réputé échu ;
- un secret vivant **sans entrée** au registre, ou une entrée **sans secret** ;
- un jeton de lecture absent (exit 1, jamais un saut).

Quand elle est rouge : faire tourner le secret (procédure ci-dessous), puis, pour les stores que l'API ne date pas (Edge, `SUPABASE_SERVICE_ROLE_KEY`), écrire la date du jour dans `lastRotated`. ❌ Ne jamais écrire une date sans avoir tourné le secret, ni relever une échéance pour faire taire la garde.

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

### Comment (secret compromis ou échu)
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

### Le registre est UNIQUE et COMPLET (V4.3, 2026-11-08)

`.github/secrets-registry.json` est le seul registre : celui que lit `check:secrets-age`, il n'y en a
pas de second. Chaque entrée porte son **nom**, son **store** (GitHub, Edge, Vercel, plateforme
Supabase, `.env.example`), **qui le lit** (`readers`), son **âge maximal** (`maxAgeDays`), l'**effet
d'une fuite** (`leak`) et sa **rotation pas à pas** (`rotation`, un id du bloc `procedures` du même
fichier : générer, poser, vérifier, révoquer l'ancien, dater). **Les noms et les procédures seulement.**
❌ Jamais une valeur, ni un indice de valeur : la garde refuse une chaîne de connexion, une clé PEM,
un préfixe de clé connu ou une longue suite opaque, dans le registre comme dans ses procédures
(témoin `check-secrets-age.guard.test.mjs`).

- Une entrée incomplète est un écart : le registre est rouge, pas seulement l'âge.
- Un secret que rien ne lit n'est admis qu'avec une procédure de retrait (`variable-orpheline`,
  `secret-sans-lecteur`) : on le supprime, ou on écrit pourquoi il reste.
- `coffre: true` marque ce qui **ne se régénère pas** et que le coffre doit donc porter
  (aujourd'hui `BACKUP_PASSPHRASE`). Tout le reste se **fait tourner** : un jeton perdu se remplace,
  il ne se garde pas.
- Pour faire tourner un secret : ouvrir son entrée, lire `rotation`, suivre les étapes. Les écritures
  (`gh secret set`, `supabase secrets set`, console Vercel) restent des gestes humains : la CI ne
  porte que des jetons de lecture.

## Coffre et accès d'urgence (V4.2, SEC-04)

**Ce que le coffre répond** : « si la personne qui détient tout est injoignable, ou si un second
facteur est perdu, par où rentre-t-on ? ». Sans lui, la phrase qui déchiffre les sauvegardes et les
codes de récupération n'existent qu'à un seul endroit, et une sauvegarde sans sa phrase ne se
restaure pas.

### Ce qui doit y aller

Des **identifiants d'éléments**, vérifiés un à un par `check:coffre` (`scripts/check-coffre.mjs`) :

| Élément | Ce qu'il contient | Pourquoi ici |
|---|---|---|
| `BACKUP_PASSPHRASE` | la phrase de chiffrement des sauvegardes, et l'étiquette de chaque phrase précédente tant qu'un dump chiffré avec elle existe | un secret Actions ne se relit pas ; sans la phrase, aucune sauvegarde ne se restaure |
| `mfa-github` | codes de récupération du second facteur du compte GitHub qui administre le dépôt | sans eux, plus de secrets Actions, plus de dépôt |
| `mfa-supabase` | idem, compte Supabase | projet de production |
| `mfa-vercel` | idem, compte Vercel | déploiement et variables |
| `mfa-stripe` | idem, compte Stripe | facturation entreprise, clés |
| `mfa-hebergeur-courrier` | idem, compte de l'hébergeur de la messagerie | la boîte de contact est le chemin de récupération de tous les autres comptes |
| `admin-aal2` | le facteur TOTP de la console `/admin` (mig. `131`) : un second authentificateur enrôlé sur un autre appareil, ou la graine rangée au coffre | `is_admin()` exige `aal2` ; sans facteur, la console ne rend rien |
| `admin-aal2-sortie` | la sortie de secours : qui peut ouvrir le SQL editor du projet et jouer la suppression du facteur (`docs/DEPLOYMENT.md` § 2quinquies, « Téléphone perdu »), et la fiche pas à pas | la porte de sortie doit avoir un second gardien |
| `acces-urgence` | la fiche de l'accès d'urgence : qui, comment on le déclenche, quel délai | voir ci-dessous |

❌ **Jamais au coffre, ni nulle part ailleurs** : un jeton d'API, une clé Stripe ou Supabase (ils se
font tourner, `rotation` du registre), un mot de passe de compte tiers partagé (un compte par
personne). ❌ Jamais dans le dépôt, un message, un courriel, une capture ou une photo : le dépôt est
PUBLIC et GitHub n'est pas un coffre.

### Où, et qui

- Un **gestionnaire de mots de passe** qui sait délivrer un **accès d'urgence avec délai** (la
  personne de confiance demande l'accès ; le propriétaire peut refuser pendant le délai ; passé le
  délai sans refus, l'accès s'ouvre). Hors du poste de travail, protégé par son propre second facteur,
  dont le code de récupération est **sur papier**, rangé ailleurs que l'appareil habituel.
- Une **personne de confiance** désignée, dont le nom figure dans la fiche `acces-urgence` du coffre
  et **nulle part dans le dépôt**. Elle sait que le coffre existe, ce qu'il permet et la première
  chose à lire (la fiche), jamais ce qu'il contient avant l'ouverture.
- **Délai** : assez long pour qu'une demande abusive soit vue et refusée (sept jours est un point de
  départ), assez court pour qu'une vraie urgence ne soit pas bloquée. À arbitrer par le propriétaire.
- À terme, un **second administrateur** (`docs/CONTINUITE.md`) : le coffre est le filet, pas la voie
  normale.

### Mise en place, une fois

1. Créer le coffre et la collection « continuité », partagée avec la seule personne de confiance, en
   accès d'urgence avec délai.
2. Pour chacun des cinq services : régénérer un jeu neuf de codes de récupération, le ranger au coffre,
   puis seulement détruire l'ancien jeu. Une copie papier du jeu du gestionnaire lui-même, ailleurs.
3. `BACKUP_PASSPHRASE` : si la phrase actuelle n'a jamais été rangée hors GitHub, appliquer la
   procédure `phrase-sauvegardes` du registre (nouvelle phrase d'abord au coffre, puis posée) plutôt
   que de tenter de relire un secret qui ne se relit pas.
4. `admin-aal2` et `admin-aal2-sortie` : enrôler un second authentificateur, et **parcourir** la sortie
   de secours une fois, à froid, sur un compte de test ou sur le compte du second administrateur
   (la leçon de la mig. `131` : un chemin de récupération se parcourt, il ne se raisonne pas).
5. Rédiger la fiche `acces-urgence`, la faire lire à la personne de confiance.
6. Consigner la première vérification dans `.github/coffre-verifications.json` (voir ci-dessous).

### Vérification trimestrielle

À faire **avant l'échéance de 92 jours**, depuis un autre appareil que l'habituel :

1. Ouvrir le coffre avec le seul accès normal. Chaque élément du tableau est présent et daté.
2. Pour chaque service : le jeu de codes de récupération est lisible et non barré. Ne **consommer** un
   code que pour de vrai ; en régénérer un jeu dès qu'il en reste moins de deux, ranger le neuf, puis
   détruire l'ancien.
3. `BACKUP_PASSPHRASE` : sur une machine de confiance, déchiffrer le dernier dump (artefact `db-backup`)
   avec la phrase **du coffre** (`gpg --batch --passphrase-file <fichier> -d`), vérifier qu'il sort un
   fichier non vide, puis effacer le clair. C'est la seule façon de prouver que la copie du coffre est
   la bonne : `restore-drill` prouve la phrase de GitHub, pas celle du coffre.
4. Joindre la personne de confiance : elle a toujours son accès, connaît le délai et sait où est la fiche.
5. Consigner : ajouter une ligne à `verifications` de `.github/coffre-verifications.json` (date, prénom,
   liste des éléments vérifiés), puis pousser. **Noms d'éléments et dates seulement.**

**Le rappel est automatique, pas la vérification.** `check:coffre` joue chaque jour dans
`gardes-calendrier.yml` et rougit (issue `calendrier-red`, `ci-alert.yml` ensuite) quand la dernière
vérification a plus de 92 jours, quand elle oublie un élément, ou, tant qu'aucune n'est consignée,
après la première échéance (**2026-12-08**). ❌ Ne jamais dater une vérification qui n'a pas eu lieu,
ni relever la période : la garde prouve qu'on l'a dit, pas que le coffre est plein.

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

---

## Base de données · état et récits repris de `CLAUDE.md` (déplacés le 2026-09-16)

> Les récits datés qui vivaient ici (applications de migrations du 2026-08-27 au 2026-09-20, mesures
> du ledger, enrôlement MFA de l'admin, correctifs de la `136`, `146`, `149`) sont archivés **sans
> une coupe** : [`archive/SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md`](./archive/SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md).
> Ne restent que les règles, chacune avec son « pourquoi » en une ligne. Les règles courtes vivent dans
> [`supabase/migration/CLAUDE.md`](../supabase/migration/CLAUDE.md).

## Base de données Supabase

Migrations dans `supabase/migration/*.sql`, convention `NNN_<feature>.sql`. Le nombre de fichiers est
dans [`FAITS.md`](./FAITS.md) (généré), l'état de production au § « État des migrations » plus bas.
Toutes les tables ont **RLS activée** : pattern obligatoire et checklist migration → ce document.

### Ce qui prouve qu'une migration est en base

- ❌ **Ne jamais conclure d'un comptage du ledger que le dépôt est appliqué.** Le ledger est un journal
  de NOMS, pas un état de schéma : il ne dit rien d'une migration passée autrement, ni d'un
  `CREATE OR REPLACE` qui n'a pas pris. La seule preuve est d'interroger le CATALOGUE
  (`information_schema`, `pg_get_functiondef`) sur l'objet que la migration prétend créer.
  *Pourquoi : mesuré le 2026-09-14, 32 fichiers du dépôt sans entrée au ledger et 17 entrées sans
  fichier ; la mig. `144` n'avait pas remplacé le corps vivant, la `147` l'a rejouée.*
- 🟢 **`npm run check:migration-coverage` (`C-79`) tient ce compte, jamais la main.** Ne plus jamais
  écrire un état de tête dans ce document : le relire à la sortie de la garde. Le détail de la garde
  est au § « Gardes SQL et Edge Functions ».
- ⚠️ **Lire le ledger AVANT d'appliquer une migration, pas seulement après.** Ce dépôt a plusieurs
  sessions actives : l'état de la prod n'est jamais celui qu'on a laissé. *(2026-09-02 : les `134` et
  `135` ont été appliquées deux fois, sans effet, car idempotentes.)*
- ✅ **Prouver avant d'appliquer** : transaction annulée par un `RAISE` final, acteur par acteur, puis
  relecture au catalogue (procédure au § « Avant tout commit qui touche `supabase/migration/*.sql` »).
- ⚠️ **Une migration appliquée verbatim par le CLI n'inscrit rien au ledger** : insérer la ligne à la main
  (mig. `145` et `149`), puis relire.

### Versionner et ordonner

- 🔴 **Un correctif appliqué en prod se versionne sous son propre numéro**, jamais par édition d'un
  fichier déjà appliqué. *Pourquoi : le ledger a porté `119b_habits_bounded_payload_future_guard`, sans
  fichier ; le contenu avait été replié dans la `119`, ce qui rend le rejeu identique mais brouille la
  lecture.*
- 🔴 **Ne jamais ajouter une colonne, un GRANT ou une policy depuis le Dashboard Supabase.** *Pourquoi :
  la prod avançait, le dépôt non, personne ne le voyait tant que rien ne rejouait les migrations à
  blanc ; quatre migrations ont dû « formaliser l'existant » (`subscriptions`, trois colonnes, les
  privilèges par défaut), dont deux numérotées `000_`. Le job `rls-integration` n'avait jamais été vert
  avant elles.* Ces migrations sont des no-op en production : elles alignent le dépôt sur la prod,
  jamais l'inverse.
- 🔴 **Appliquer la migration AVANT de déployer le front** quand un mapper émet la colonne neuve
  (mig. `113`, `146`). *Pourquoi : `mapEventToDb` émet `review_dismissed_at` à CHAQUE mise à jour
  d'événement ; le front déployé d'abord faisait échouer « Reporter » en usage réel, pas en test.*
- 🔴 **Une migration qui crée une dépendance à un chemin de récupération : PARCOURIR ce chemin avant**
  (mig. `131`, `aal2` sur `/admin`). Détail au § « Garde-fous transversaux ».

### Règles d'un module précis

- ⚠️ **`NO_CATEGORY` reste la chaîne vide côté TypeScript**, la base porte NULL ; la conversion vit
  dans les DEUX mappers (`tasks/mappers.ts`, `okrs/mappers.ts`) et nulle part ailleurs. ❌ Ne jamais
  propager `null` jusqu'aux composants (second marqueur d'absence à vérifier partout). « colonne absente »
  (ne pas y toucher) et « chaîne vide » (retirer la catégorie) restent deux cas distincts : les confondre
  efface la catégorie à chaque mise à jour partielle.
- ❌ **Ne jamais dériver une branche de catégories par un aller-retour serveur** : aucune RPC, un compte
  porte quelques dizaines de catégories que le client charge déjà. Les règles de l'arbre vivent dans
  `src/modules/categories/tree.ts`, miroir client du trigger.
- ⚠️ **Le repository démo des catégories est chargé À LA DEMANDE** (`local.repository.ts` +
  `src/lib/demo-repositories.ts`). Le remettre dans `repository.ts` ramène ses seeds dans le chunk
  d'entrée, payé par chaque visiteur de la landing.
- ✅ **`get_work_time_stats`** lit `kr_completions` (mig. `136`), plus `history` : un KR sans
  `estimated_time` compte 0 minute, c'est la formule. *Pourquoi : `okrTime` valait 0 pour tous les comptes
  réels depuis la mig. `074`, parce que la fonction lisait un champ que rien n'écrit.*
- ✅ **`get_admin_stats`** retranche les comptes non réels et rend leur NOMBRE dans `excluded_accounts`
  (mig. `149`). ❌ **Ne JAMAIS recopier un de ces UUID ailleurs** : la liste vit dans la seule fonction
  `admin_stats_excluded_uids()`, et deux listes finiraient par diverger.
- 🔴 **`stripe-org-checkout` ne peut PAS créer de session sans la table `withdrawal_consents`**
  (preuve de renonciation au droit de rétractation, mig. `135`) : un environnement monté sans elle coupe
  l'encaissement. C'est le bon sens de l'échec.
- ⚠️ **Un seul compte ouvre `/admin`** (`public.admin_users`) : la sortie de secours d'un téléphone perdu
  est au § « `/admin` — allowlist ET second facteur » ; l'arrivée d'un second administrateur, dans
  [`CONTINUITE.md`](./CONTINUITE.md).

### Fonctions et policies

Fonctions SECURITY DEFINER clés : `accept_friend_request_v2`, `accept_shared_task`,
`remove_friendship` / `resolve_profile_by_email`, `handle_new_user_profile`, `prevent_user_id_change`,
`owns_task`, `claim_share_link`, `sanitize_display_name`, `get_my_tasks`, `toggle_task_complete_v2`,
`get_work_time_stats`, `get_admin_stats`. Schéma `friend_requests` = `sender_id` / `receiver_id`.

> **Une seule policy PERMISSIVE par rôle+action** (mig. 049). Les anciens splits `tasks`
> (own / collaborator) et `friend_requests` (sender / receiver) sont **fusionnés en une policy
> `OR` unique**, sémantique préservée. **Ne jamais recréer deux policies permissives** pour le
> même rôle+action : élargir le `OR` existant. `npm run check:rls` est la gate.

---

### État des migrations

- Dépôt : le nombre de migrations est dans [`FAITS.md`](./FAITS.md), généré. **Tout est en production sauf `206`** (jalons, non
  appliquée délibérément) ; `Migration coverage` (ledger de production) le vérifie.
- En base **sans** ligne au ledger, par décision d'Axel : `164`, `181`, `190`-`195`, `197`-`199`.
  `196` est retirée par la `200`. ❌ **Ne jamais réappliquer la `164`** : elle retire la branche
  « membre du projet » de la `190`.
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
- Le journal daté des applications `150` → `223` (preuves, numéros de ledger, relectures au
  catalogue), dont les premières lignes étaient démenties par les suivantes, est archivé :
  [`archive/SECURITY-journal-migrations-150-223.md`](./archive/SECURITY-journal-migrations-150-223.md).


## Gardes SQL et Edge Functions · repris de `CLAUDE.md` (déplacé le 2026-09-16)

> Les commentaires datés de ces commandes (premiers runs, mesures, incidents) sont archivés sans une
> coupe : [`archive/SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md`](./archive/SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md).
> La racine ne garde que la commande. Les comptes (fichiers, fonctions) sont dans [`FAITS.md`](./FAITS.md).

```bash
npm run validate:migrations      # Garde statique sur supabase/migration/*.sql (CI)
npm run check:rls                # Invariants RLS : auth.uid() wrappé, 1 seule policy PERMISSIVE,
                                 # toute fonction citée par une policy exécutable par authenticated (CI)
npm run check:migration-coverage # Fichiers de migration contre le ledger ET le catalogue de PROD (C-79)
npm run check:edge               # Le code DÉPLOYÉ des Edge Functions contre le dépôt (C-35)
```

### `check:migration-coverage` (`C-79`)

Quotidien 05:17 UTC et à chaque push touchant `supabase/migration/` (`migration-coverage.yml`),
branché sur `ci-alert.yml`. Témoin : `scripts/check-migration-coverage.guard.test.mjs`.

- ❌ **Il ne se contente PAS d'un comptage** : c'est le comptage qui avait menti. Chaque fichier reçoit
  un VERDICT, et seul le dernier fait échouer : AU LEDGER · OBJET EN BASE · OBJET RETIRÉ DEPUIS ·
  SUPPRESSION VÉRIFIÉE · SANS OBJET VÉRIFIABLE (déclaré) · NON APPLIQUÉE (déclarée) · ABSENT DES DEUX.
  Deux verdicts sont **mesurés**, pas déclarés (migrations vidées par une ultérieure, migration purement
  suppressive vérifiée par l'absence de ses cibles) : sans eux la garde réclamait des migrations bel et
  bien appliquées.
- ⚠️ **Ce que son vert ne dit pas, et qu'il imprime à chaque exécution** : une LIGNE au ledger ne prouve
  pas qu'un `CREATE OR REPLACE` a remplacé le corps vivant. Il liste donc aussi les fichiers PARTIELS.
- 🔴 **Exige `SUPABASE_DB_URL`.** Secret absent = ÉCHEC, jamais un `::warning::` dans un run vert.
- ❌ **Ne JAMAIS ajouter une entrée à `NON_APPLIQUEES_DELIBEREMENT` ou `SANS_OBJET_VERIFIABLE` pour faire
  passer la CI.** Une dispense qui se révèle FAUSSE (la migration est en fait appliquée) fait échouer la
  garde, comme `.github/edge-deploy.json`.

### `check:edge` (`C-35`)

Job `Edge deploy drift` : quotidien 05:41 UTC et à chaque push touchant `supabase/functions/`, branché sur
`ci-alert.yml`. Témoin : `scripts/check-edge-deploy.guard.test.mjs`.

- 🔴 **Exige `SUPABASE_ACCESS_TOKEN`.** Secret absent = ÉCHEC, jamais un `::warning::` dans un run vert.
  *Pourquoi : le job avait échoué 14 fois d'affilée sans jamais avoir comparé quoi que ce soit.*
- 🔴 **`--use-api` est obligatoire sur `functions download`.** Sans lui la CLI débundle avec Docker et rend du
  code transpilé : le verdict dépend d'un Docker installé à côté. **Une garde dont le verdict dépend de son
  runner ne mesure pas la production.**
- ⚠️ **Déployer depuis la racine du dépôt, sur `main`** : un déploiement fait depuis un arbre non commité
  se voit ici (`stripe-webhook` a déjà divergé de `main` d'un caractère de commentaire).
- ⚠️ **Un « ✅ corrigé » sur une Edge Function ne veut rien dire sans sa date de déploiement** : tant que
  rien ne comparait, toute conclusion tirée de la lecture de `supabase/functions/` était fausse d'avance
  (le 2026-09-03, les trois sources déployées lisibles divergeaient de `main`, chacune à sa façon).
- ❌ **`.github/edge-deploy.json` ne déclare que l'EXISTENCE** (quelle fonction n'est pas encore en ligne,
  pourquoi, depuis quand). Il ne peut pas faire taire une divergence de CONTENU, et une fonction qu'il dit non
  déployée alors qu'elle est en ligne fait échouer la garde : sinon la note périme en silence.

## Garde-fous transversaux, récits repris de `CLAUDE.md` (déplacés le 2026-10-11)

> `CLAUDE.md` n'en garde que l'interdit, en une ligne ; le « pourquoi » tient ici en une ligne par règle.
> Les récits d'incident d'origine (dates, chiffres, correctifs) sont archivés à l'identique :
> [`archive/SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md`](./archive/SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md).
> ⚠️ B-1 (mig. `107`) est **refermé** par la mig. `109`, cf. `faille.md`.

### Journal fiscal et consentement (2026-08-26)

- ❌ **Ne JAMAIS ajouter de policy UPDATE ou DELETE sur `payment_records` ou `payment_closures`, ni les
  inclure dans une purge.** C'est le journal d'encaissement inaltérable (mig. `125`, CGI art. 286-I-3° bis).
  L'immuabilité est portée par un **trigger**, pas par la RLS, parce que `service_role` contourne la RLS
  mais pas les triggers.
  🔴 **Ne jamais anonymiser `user_id`** : `row_hash` le scelle dans le chaînage et
  `verify_payment_chain()` recalcule chaque hash ; écrire NULL casserait la chaîne, donc produirait
  exactement le signal de falsification qu'on montre à un contrôleur. La conservation reste acceptable
  parce que `user_id` cesse d'identifier quiconque dès que la ligne `auth.users` disparaît.
  `delete-account` ne touche donc PAS cette table. Une erreur se corrige par une ligne compensatoire,
  comme en comptabilité.
- ❌ **Ne jamais lire `cosmo_cookie_consent` directement.** Passer par `src/lib/cookie-consent.ts`, et par
  `useCookieConsent()` dans React. **Tout nouveau traceur doit être conditionné** : `null` n'est pas une
  acceptation tacite. *Pourquoi : la dispersion avait laissé le bandeau proposer un choix qu'aucune ligne de
  code n'appliquait.*
- ❌ **Ne jamais rendre une garde conditionnelle à la présence de son propre secret.**
  `if (SECRET && header !== SECRET)` laisse passer tout le monde tant que le secret n'est pas posé.
  *Pourquoi : bug introduit puis corrigé le 2026-08-26 dans `renewal-notice`.*
- ⚠️ **`renewal_notices` est une PREUVE**, pas un cache. Ne jamais la purger : c'est ce qu'on produit si un
  client conteste une reconduction (Conso. art. L215-1).

### Sécurité & env

- ❌ `VITE_SUPABASE_SERVICE_ROLE_KEY` côté client
- ❌ Committer sans vérifier que `.env` reste gitignored
- ❌ Écrire en base via le MCP Supabase (contourne la RLS)
- ❌ **Appeler `get_subtree` / `has_subordinates` / `org_admin_count` depuis une policy.** La mig. `100` leur a
  révoqué `EXECUTE` à `authenticated` (fuite inter-organisations) et une policy s'évalue avec le **rôle
  courant** : l'appel échoue par `permission denied`. Dans une policy, utiliser `is_above(org_id, user_id)`
  ou `i_have_subordinates(org_id)`. À l'intérieur d'une fonction `SECURITY DEFINER`, les helpers restent
  appelables (rôle = propriétaire).
- ❌ **Garder une surface admin par `admin_allowlisted()`.** Depuis la mig. `131`, `admin_allowlisted()` dit
  « ce compte est admin » (AFFICHAGE, ignore volontairement le niveau d'assurance, sinon l'écran d'enrôlement
  TOTP devient inatteignable) et `is_admin()` dit « cette requête est autorisée » (GARDE : allowlist ET
  `auth.jwt() ->> 'aal' = 'aal2'`). Les intervertir annule la migration. Ne jamais tester « ce compte a activé
  la 2FA » : `aal2` porte sur la SESSION, or c'est la session ouverte avec un mot de passe volé qu'il faut
  refuser. Détail : § « `/admin` — allowlist ET second facteur ».
- ❌ **Une fonction de trigger en `SECURITY DEFINER`.** Une garde doit être `SECURITY INVOKER` (défaut) et
  `REVOKE`-ée pour `anon` (mig. `064b` / `094b`). *Pourquoi : un trigger `BEFORE` s'exécute **avant** le
  `WITH CHECK` de la RLS ; en DEFINER ses messages d'erreur deviennent un oracle sur des lignes non lisibles
  (mig. `108`, finding B-3).*
- 🔴 **En CSP, un schéma écrit explicitement doit correspondre : `https:` ne couvre PAS `wss:`.** Garde :
  `src/csp.guard.test.ts` (schéma `wss`, directives de confinement, absence d'`unsafe-eval`, `data:` dans
  `img-src` dont dépend le QR code TOTP). *Pourquoi : `connect-src` sans `wss://*.supabase.co` bloquait
  **toutes** les connexions Realtime en production, en silence ; trouvé le 2026-09-01 en cherchant autre chose.*
- 🔴 **Une migration qui crée une dépendance à un chemin de récupération : PARCOURIR ce chemin avant de
  l'appliquer.** *Pourquoi : la mig. `131` exige `aal2` et l'écran d'enrôlement TOTP levait en phase de rendu ;
  `/admin`, qu'un seul compte ouvre, est resté inaccessible du 2026-08-31 au 2026-09-01. Raisonner « l'écran reste
  atteignable » était juste sur la garde et faux dans les faits : il suffisait d'ouvrir l'écran une fois.*
- ⚠️ **Le dépôt est PUBLIC**, avec secret scanning, push protection et Dependabot actifs depuis le 2026-09-01.
  Retirer un fichier du suivi n'efface pas l'historique (une fuite inerte, `.env` du commit initial, y est
  confirmée : elle vise un projet supprimé).

### Documentation

- ❌ Traiter un fichier de `docs/archive/**` comme l'état courant du projet
- ❌ Citer un numéro de ligne d'un autre fichier `.md` : les fichiers bougent, les liens de section survivent
- ❌ **Recopier un « avant » au lieu de le relire à sa source.** **Un « avant » se reconstruit à un commit
  nommé, jamais dans un arbre de travail ni depuis un tableau plus ancien.** *(Trois occurrences en août et
  septembre 2026 : une note RGPD, les `refetchInterval`, la garde `architecture.guard`.)*
- ❌ **Chercher le symptôme cité par la doc plutôt que la chose décrite.** *Pourquoi : une note n'a corrigé
  qu'un nom sur six sur la sélection de modules ; elle constatait l'absence de `RequireModule` sans voir que la
  fonctionnalité entière avait disparu, ce qui laisse la dérive presque intacte **et la fait paraître
  vérifiée**.*

### AM-5 · écart de `check:supabase-posture` constaté le 2026-11-05

Rouge au 2026-11-05 (référence du 10-26, descendue de `scripts/CLAUDE.md`) : `rls_enabled_no_policy`
24/14, DEFINER exposées 87/84, `unindexed_foreign_keys` nouveau (3). Écarts nés des mig. `229` → `240` :
relire au catalogue AVANT `--update`. `supabase/rpc-inventory.md` (généré, MAI-01/API-01) donne l'état
des droits `EXECUTE` de chaque fonction depuis les migrations.

**Relu et recalé le 2026-11-07 (V9.4, TST-05), soldé le 2026-11-08.** ⚠️ **Pas** « rouge pour une
amélioration » : la baisse d'`unused_index` est imprimée sans rougir, et le workflow n'annote que le verdict.
Chaque objet a été relu dans sa migration et par `get_advisors`, les noms sont écrits dans les `_note` de la
référence : sept `affiliate_*` (`236`), `billing_acceptances` et `org_withdrawals` (`237`), `org_seat_alerts`
(`240`) en RLS sans policy voulue ; trois DEFINER exposées légitimes (`affiliate_backfill`, `affiliate_attach`,
`claim_affiliate`) ; trois clés étrangères sans index, **défaut** corrigé par la mig. **`247`**
(`unindexed_foreign_keys` absent de `get_advisors` depuis). La mesure détaillée (runs, ledger, comptes) est
dans l'archive ci-dessus.

Comptes recalés par le job `regenerer` du workflow Posture sur `main` (jamais à la main). Témoin :
« la référence COMMITÉE rougit encore sur un objet de plus » (`gardes-posture.guard.test.mjs`).
