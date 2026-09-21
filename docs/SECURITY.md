<!-- note-audit: couvert-par=faille.md -->
<!--
  🔴 C-109 · CE MARQUEUR EST LU PAR `npm run check:docs-scored`.
  Douze documents de fond n'étaient notés par RIEN : ils ne pouvaient ni monter
  ni baisser, donc **rien ne signalait qu'ils avaient vieilli**.
  Chaque document de `docs/` déclare donc soit sa note, soit la note qui le
  couvre, soit qu'il n'est pas noté ET pourquoi.
  ❌ Ne JAMAIS inventer une note sans avoir audité le domaine : `non-note` est
     une réponse honnête, un chiffre faux ne l'est pas.
-->
> **Note d'audit** — 🔴 **Couvert par la note « Sécurité » de [`faille.md`](../faille.md)** — et cette délégation a une limite qu'il faut écrire : `faille.md` porte les **findings**, ce document porte les **règles**. Un finding qui se ferme fait monter la note ; une règle qui se périme ne coûte rien. Ce document peut donc vieillir sans qu'aucun chiffre bouge.

# Sécurité — COSMO

> Sécurité : [`../faille.md`](../faille.md) = findings **ouverts** + priorités (source de vérité) ·
> [`archive/faille-historique.md`](./archive/faille-historique.md) = historique des corrections (archive, non maintenue).
> Ce document = règles permanentes à respecter. Les codes `(V1)`, `(N9)`, `(M-6)`… réfèrent aux fiches `faille.md`.

> ✅ **Confronté à la production le 2026-09-14 au soir.** Les affirmations de ce document qui
> portent sur un ÉTAT (par opposition aux règles) ont été vérifiées dans le catalogue Postgres, pas
> relues :
>
> | Affirmation | Mesure en base |
> |---|---|
> | Toute table `public` a RLS activée | **50 tables, 50 avec `relrowsecurity`** · 126 policies |
> | Le client n'a AUCUN chemin d'écriture sur `subscriptions` | **0 policy UPDATE**, 2 policies au total |
> | Le système de jetons n'existe plus (mig. `141`, C-04) | **0** RPC `consume_premium_token` / `credit_premium_token_from_ad` / `bump_win_streak`, **0** colonne `premium_tokens` / `win_streak` |
> | Les journaux scellés sont en deny-all | `payment_records`, `payment_closures`, `renewal_notices` : **aucune policy**. `withdrawal_consents` en porte **une seule**, `SELECT` pour `authenticated`, c'est la lecture de sa propre preuve |
> | `npm run check:rls` | **132 policies dans 106 migrations, 0 violation** |
>
> Les advisors Supabase rendent **9 / 52 / 2 / 1**, à l'unité ce qu'annonce le tableau de gardes de
> [`../faille.md`](../faille.md). Détail de la passe : [`README.md`](./README.md) § « Mise à jour du
> 2026-09-14 (soir) ».


## 🕳️ Angles morts · ce que ce document NE mesure PAS (2026-09-16)

> ## ✅ Relu le 2026-09-21 · **3 lignes de ce tableau sont désormais OUTILLÉES**
>
> La passe du 2026-09-20 au soir (`2b4c4304`) a traité les 30 items du § 12
> d'[`a-faire-code.md`](../a-faire-code.md), qui sont nés de ces angles morts.
>
> ❌ **Le tableau ci-dessous n'est PAS réécrit.** Il décrit le 2026-09-16, et c'est sa date qui
> lui donne sa valeur : un angle mort nommé est ce qui a permis de l'outiller. Ce bandeau dit ce
> qui le couvre aujourd'hui, et surtout **ce que la garde ne prouve pas** — la moitié qui manque
> d'habitude.
>
> | Angle mort | Couvert par | 🔴 Ce que ça ne prouve PAS |
> |---|---|---|
> | AM-1 | `npm run check:docs-scored` (`C-109`) | Que les notes soient justes ni fraîches. `non-note` **ouvre** un audit, il ne le remplace pas |
> | AM-2 · AM-5 | `npm run check:supabase-posture` (`C-88`) : juge un **écart** à une référence commitée, pas un absolu | 🔴 `reglages_auth` est à `null` : la référence exige un jeton, elle se pose par `--update` **et se commite**. **La garde ÉCHOUE tant que ce n'est pas fait, exprès** — c'est `M-58` |
> | AM-6 | `codeql.yml`, `security-extended`, JS/TS **et** `actions` (`C-89`) | Un job vert. L'item n'est fini que quand **chaque alerte ouverte porte une décision** : c'est `M-60` |
>
> ⚠️ **Les lignes du tableau qui ne sont pas citées ici restent OUVERTES**, et une garde posée
> n'est pas un angle mort fermé : `M-56` (« ce que chaque angle mort coûte en points ») n'est
> toujours pas tranché, donc aucune note ne bouge sur cette base.


> **Pourquoi cette section existe.** Demande d'Axel, après le constat qui a ouvert la journée :
> `CLAUDE.md` a pesé 150 ko sans qu'aucune note ne bouge, parce qu'il était **cité comme source**
> par les audits et **jamais mesuré par eux**. Il était le mètre, jamais l'objet.
>
> 🔴 **Ce document n'a PAS de note, et c'est son premier angle mort.** Les onze documents notés
> entrent dans le tableau de bord de [`README.md`](./README.md) et peuvent donc monter ou baisser.
> Celui-ci ne le peut pas : rien ne le pèse, donc rien ne signale qu'il a vieilli. Les angles morts
> ci-dessous ne sont **pas** des défauts du produit ; ce sont les endroits où **ce document affirme
> sans que rien ne vérifie**.
>
> Chaque ligne est vérifiée par une commande, jamais supposée. Elle se **referme** ou se
> **reconduit avec sa date**, jamais ne se recopie.

| # | Angle mort | Vérifié le 2026-09-16 | Outillable ? |
|---|---|---|---|
| AM-1 | 🔴 **Les RÈGLES de sécurité ne sont notées nulle part.** La note de sécurité (88) vit dans [`../faille.md`](../faille.md), qui porte les **findings ouverts**. Ce document porte les **règles** : RLS, migrations, Edge Functions, secrets, CSP. Un finding se ferme et fait monter la note ; une règle qui se périme ici ne coûte rien à personne | `faille.md` porte la note, `SECURITY.md` n'en a aucune | oui : noter ce document, ou expliciter qu'il est couvert par celle de `faille.md` |
| AM-2 | 🔴 **Les réglages du Dashboard Supabase ne sont surveillés par AUCUNE garde.** Protection des mots de passe compromis, expiration des OTP, politiques d'auth : ils se modifient **hors du dépôt**, sans commit, sans revue et sans trace. Un réglage désactivé par erreur ne se voit qu'au prochain audit manuel | aucun workflow ni script ne lit ces réglages ; seul un commentaire contient le mot « dashboard » | oui : l'API Management les expose |
| AM-3 | **La rotation des secrets n'a ni échéance ni rappel.** Le § « Rotation des secrets » dit comment faire, jamais quand, et rien ne mesure l'âge d'un secret | aucune date d'émission stockée, aucun job | oui : un job planifié qui rappelle l'âge |
| AM-4 | **La checklist « avant tout commit qui touche `supabase/migration/*.sql` » est MANUELLE.** `validate:migrations` et `check:rls` en couvrent une partie ; le reste repose sur la lecture | les deux gardes vérifient des motifs nommés, pas la checklist entière | partiellement |
| AM-5 | **Les advisors Supabase ne sont lus qu'à la main** (T-7 du tableau de bord). Dans `ci.yml`, le mot « advisor » désigne `npm audit` | aucun workflow n'interroge l'API Management | oui |
| AM-6 | **Aucune analyse statique de sécurité (SAST).** Les gardes vérifient des invariants **nommés**, jamais des motifs inconnus. Le dépôt est **public**, donc CodeQL y serait gratuit | aucun CodeQL ni Semgrep dans `.github/workflows/` | oui, et à coût nul |

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

---

## Base de données · état et récits repris de `CLAUDE.md` (déplacés le 2026-09-16)

> Ces blocs vivaient dans `CLAUDE.md`, chargés à chaque session. Déplacés ici **sans une
> coupe**. Les règles courtes vivent dans
> [`supabase/migration/CLAUDE.md`](../supabase/migration/CLAUDE.md).

## Base de données Supabase

Migrations dans `supabase/migration/*.sql`, convention `NNN_<feature>.sql`.
**153 fichiers de migration**, ledger à **140 entrées** (recompté en base le **2026-09-20** ; ce
fichier a écrit « 148 », qui est le NUMÉRO de la dernière migration, jamais un total).

✅ **Le 2026-09-20, deux des trois migrations manquantes ont été APPLIQUÉES et vérifiées** :

- **`136_work_time_stats_okr_from_completions`** (ledger `20260920105113`), qui referme `C-77`.
  Ce fichier l'a classée « travail d'une autre session » pendant douze jours, et tant qu'elle
  portait cette étiquette personne n'a lu ce qu'elle répare : `okrTime` valait **0** pour tous les
  comptes réels. Prouvée en transaction annulée avant application, rejouée après :
  `pg_get_functiondef` sur la fonction vivante cite `kr_completions` et plus une seule fois
  `history` ; `okrTime` passe de `0/0/0/0/0` à `300/180/0/0/0` sur mai→septembre pour un compte
  réel, les trois autres catégories **inchangées au chiffre près**.
  ⚠️ Un KR sans `estimated_time` compte 0 minute, et c'est la formule : les mois portés par des
  KR à 0 restent à zéro légitimement.
- **`149_admin_stats_excludes_non_users`** (ledger `20260920105522`), appliquée **par le CLI**
  verbatim depuis le fichier, **donc avec insertion manuelle de la ligne de ledger** — même chemin
  et même piège que la mig. `145`. `/admin` annonce désormais 28 utilisateurs, 658 tâches,
  387 événements et 26 habitudes, contre 30 · 779 · 454 · 32, plus une clé `excluded_accounts = 2`.
  Un non-admin reste refusé en **42501**.

🔴 **La seule migration du dépôt dont le contenu manque encore en base est la `140`**, et c'est
**délibéré** : elle se joue DANS la fenêtre de bascule Stripe live, jamais avant.

🟢 **CE COMPTE N'EST PLUS À TENIR À LA MAIN DEPUIS LE 2026-09-15.**
`npm run check:migration-coverage` (finding C-79) relie chaque fichier au ledger de production
et échoue sur ceux qu'il ne peut ranger nulle part. Premier run CI **`34941970659`**, vert :
152 fichiers, **138 entrées de ledger lues en prod**, **0 absent des deux**.
❌ Ne plus jamais écrire un état de ce paragraphe de tête : le relire à la sortie de la garde. ⚠️ La ligne précédente disait « 151 fichiers, dernière appliquée la
`147` » : périmée d'une migration au lendemain de son écriture. La `147`
(`_categories_tree_depth_ambiguity_redo.sql`, réapplication du correctif de la `144` —
cf. section dédiée), la `146` et la `145` ont toutes été appliquées le 2026-09-13.

🔴 **UNE ABSENCE AU LEDGER NE PROUVE RIEN, ET UNE PRÉSENCE NON PLUS.** Mesuré le 2026-09-14 au
soir, en comparant nom à nom les 152 fichiers du dépôt aux 138 entrées de la base :
**32 fichiers du dépôt n'ont AUCUNE entrée correspondante**, et **17 entrées du ledger n'ont aucun
fichier**. L'énoncé « tout le dépôt est appliqué en prod, ledger relu » a donc été écrit cinq fois
dans ce fichier sur une lecture qui ne recouvre que 120 fichiers sur 152.

**Ce que ça veut dire, et ce que ça ne veut pas dire.** Les 32 sont presque tous les migrations
PRÉCOCES (`000` à `058`, plus la `081` et la `082`), passées avant que le ledger serve, ou par un
chemin qui n'y inscrit rien. Elles SONT appliquées : vérifié objet par objet sur un échantillon
(`events.exceptions` de la `029`, `team_task_comments` de la `082`, `tasks.recurrence*` de la
`058`, `events.is_private` de la `081`, tous présents). Symétriquement, les 17 entrées orphelines
sont d'anciens noms libres (`create_subscriptions_table`, `fix_task_sharing_unified`, …) et les
correctifs `…b` / `…c` repliés dans leur fichier d'origine.

❌ **Ne jamais conclure d'un comptage de lignes du ledger que le dépôt est appliqué.** Le ledger
est un journal de NOMS, pas un état de schéma : il ne sait rien dire d'une migration passée
autrement, ni d'un `CREATE OR REPLACE` qui n'a pas pris (c'est exactement le défaut de la `144`,
cf. la `147`). La seule preuve qui vaille reste celle qui a servi ici : interroger le CATALOGUE
(`information_schema`, `pg_get_functiondef`) sur l'objet que la migration prétend créer.
⚠️ Et `npm run check:drift` ne comble pas ce trou : il compare le schéma, pas le ledger, et il
exige deux étapes manuelles.

🟢 **UNE GARDE SURVEILLE CE RECOUVREMENT DEPUIS LE 2026-09-15** (`check:migration-coverage`,
C-79). Elle fait exactement ce que le paragraphe ci-dessus prescrit : elle interroge le
catalogue sur l'objet que chaque migration prétend créer, et elle refuse de conclure d'un
comptage. Elle range les 32 fichiers « sans entrée » en **27 dont l'objet est en base**, **3
vidés par une migration ultérieure** (les 013 / 015 / 016, par la `141`), **1 purement
suppressif** (la `090`, vérifié par l'absence de ses cibles) et **2 déclarés non vérifiables**
(des GRANT, une migration de données).
⚠️ **Elle reste modeste, et le dit à chaque exécution** : une ligne au ledger ne prouve toujours
pas qu'un `CREATE OR REPLACE` a remplacé le corps vivant. Elle liste pour cette raison les
fichiers **PARTIELS**, dont la `136`.


### « Ignorer » un créneau de tâche à passer en revue (mig. `146`)

✅ **APPLIQUÉE en prod le 2026-09-13**, via `apply_migration` (ledger à jour cette
fois). `events` gagne `review_dismissed_at` (`timestamptz`, nullable, `NULL` = jamais
ignoré) : colonne purement informative, aucune policy ni trigger n'en dépend, RLS
inchangée (une ligne qu'on peut déjà réécrire au complet peut écrire cette colonne).
Vérifiée après coup : type `timestamp with time zone`, nullable, et `get_advisors`
(security) ne montre **aucun nouveau finding** — uniquement les avertissements déjà
documentés ailleurs dans ce fichier (fonctions `SECURITY DEFINER` existantes, RLS sans
policy sur des tables déjà connues, protection mot de passe compromis).

🔴 **Elle devait être appliquée AVANT le déploiement du front** (même ordre que la
mig. 113) : `mapEventToDb` émet cette colonne à CHAQUE mise à jour d'événement. Le
front avait été déployé en premier — écart constaté en usage réel (« Reporter » sur un
créneau échouait avec le message générique, `review_dismissed_at` inconnu de Postgres),
pas en test. `Reporter` et `Ignorer` (les deux seules actions qui écrivent la colonne)
sont opérationnelles depuis l'application de cette migration ; `Valider` et
`Supprimer` n'y touchent pas et n'avaient jamais été affectées.

⚠️ **`NO_CATEGORY` reste la chaîne vide côté TypeScript.** La base porte NULL ; la
conversion vit dans les DEUX mappers (`tasks/mappers.ts`, `okrs/mappers.ts`) et nulle part
ailleurs. ❌ Ne jamais propager `null` jusqu'aux composants : ce serait un second marqueur
d'absence à vérifier partout. Un test garde aussi la distinction entre « colonne absente »
(ne pas y toucher) et « chaîne vide » (retirer la catégorie) : les confondre effacerait la
catégorie à chaque mise à jour partielle.

❌ **Ne jamais dériver une branche par un aller-retour serveur.** Aucune RPC n'est créée :
un compte porte quelques dizaines de catégories et le client les charge déjà toutes. Les
règles de l'arbre vivent dans `src/modules/categories/tree.ts`, miroir client du trigger.

⚠️ **Le repository démo des catégories est chargé À LA DEMANDE** (`local.repository.ts` +
`src/lib/demo-repositories.ts`). Le remettre dans `repository.ts` ferait repartir ses seeds
dans le chunk d'entrée, payé par chaque visiteur de la landing.
🔴 **La `136_work_time_stats_okr_from_completions.sql` est COMMITÉE (`31482a3f`, 2026-09-03) et
présente à `HEAD`, mais elle n'a JAMAIS été appliquée.** Cette ligne a dit « non versionnée »
jusqu'au 2026-09-15 : `git ls-files` la voit, et la phrase a été recopiée par trois documents avant
que quelqu'un lance la commande.
⚠️ **Et la classer « travail en cours d'une autre session » a coûté plus cher que l'erreur de
suivi** : tant qu'elle portait cette étiquette, personne n'a lu ce qu'elle répare. Elle répare un
**défaut ouvert en production** : `get_work_time_stats` lit un champ JSON que rien n'écrit, donc
`okrTime` vaut **0** sur `/statistics` pour tous les comptes réels, et ce depuis la mig. `074`
(2026-07-16). Item `C-77` de [`a-faire-code.md`](../a-faire-code.md).
⚠️ **Sa prémisse a été corrigée le 2026-09-15, et elle était fausse d'un mot** : l'en-tête
affirmait « ce champ n'existe pas », vérifié par `grep` dans `src` et **jamais en base**. Mesuré :
**12 Key Results sur 28 portent bien un `history` non vide**, tous sur le seul compte de seed
`aaaaaaaa-…`, jamais connecté. La conclusion tient, mais c'est un argument de **données**, et il
se prouve par une requête, désormais recopiée dans l'en-tête avec son résultat.
🔴 **Conséquence à connaître AVANT de l'appliquer** : le compte de seed est le seul dont `okrTime`
va **baisser**, ses `history` cessant d'être lus alors qu'il n'a aucune ligne dans
`kr_completions`. Ce n'est pas une régression, c'est la fin d'un chiffre qui ne reposait que sur
une donnée morte.
✅ **La `149_admin_stats_excludes_non_users.sql` est APPLIQUÉE le 2026-09-20** (ledger
`20260920105522`), après cinq jours passés **hors de git** : le fichier n'était même pas suivi.
Ce qui suit décrit ce qu'elle a corrigé, et les chiffres d'origine sont conservés à leur date.
Elle était ÉCRITE et NON APPLIQUÉE depuis le 2026-09-15.
`get_admin_stats` comptait les **28** comptes d'`auth.users`, dont `demo@cosmo.app` (jamais
connecté, porteur de **120 tâches en production**) et `testemail@gmail.com` : la console `/admin`
annonçait **28 utilisateurs là où il y en a 26**, et **16 % des tâches de la plateforme**
appartenaient au compte de démonstration. La migration retranche les deux de toutes les sources
keyées par un compte, et **rend leur NOMBRE** dans une clé `excluded_accounts` (un chiffre corrigé
sans mention de sa correction ne se recoupe plus avec le tableau de bord Supabase).
❌ **Ne JAMAIS recopier un de ces deux UUID ailleurs** : la liste vit dans la seule fonction
`admin_stats_excluded_uids()`, et deux listes finiraient par diverger.
✅ **Tout le dépôt est appliqué en prod**, ledger relu le 2026-09-02 : la `133` (échéance récurrente
en INSTANT, R-01), la `134` (un customer Stripe ne désigne qu'un seul compte, S-3) et la `135`
(preuve de renonciation au droit de rétractation, S-6) sont en base, vérifiées acteur par acteur
dans des transactions annulées.
🔴 **`stripe-org-checkout` ne peut PAS créer de session sans la table `withdrawal_consents`.** Elle
existe désormais ; mais un environnement monté sans elle coupe l'encaissement. C'est le bon sens de
l'échec, il faut juste le savoir.
⚠️ **Lire le ledger AVANT d'appliquer une migration, pas seulement après.** Le 2026-09-02, les `134`
et `135` ont été appliquées DEUX fois : une session voisine les avait déjà passées à 16:24 UTC, et
une seconde application a suivi à 21:14. Sans effet sur le schéma — elles sont idempotentes — mais
le ledger a porté les seuls doublons de ses 127 entrées, retirés depuis. Ce dépôt a plusieurs
sessions actives : l'état de la prod n'est jamais celui qu'on a laissé.
Ledger prod relu le 2026-08-31 : **tout le dépôt est appliqué**, `131` et `132` comprises.
⚠️ Elles l'ont été dans l'ordre INVERSE de leur numéro (la `132` le 08-30, la `131` le 08-31) —
elles ne se touchent pas, mais le ledger ne se lit donc pas comme une suite croissante.
✅ **La `132` a été appliquée en prod le 2026-08-30** (dépendances entre tâches PERSONNELLES,
jumelle de la `108`), et vérifiée invariant par invariant plutôt que sur un « success » :
`user_id` bien redérivé alors qu'on envoyait exprès celui d'un autre compte, doublon refusé
par la PK (23505), auto-dépendance et cycles direct **et indirect à trois maillons** refusés,
arête inter-comptes refusée, tâche inexistante refusée, `ON DELETE CASCADE` vérifié (2 arêtes
→ 0). Isolation mesurée acteur par acteur : le propriétaire voit son arête, un autre compte
en voit **zéro**, et son insertion est refusée. Tests joués dans une transaction annulée par
un `RAISE` final — la table est restée à 0 ligne. Zéro advisor de sécurité sur cette table.
Elle n'a modifié aucune table existante.
✅ **La `131` a été appliquée en prod le 2026-08-31** (`/admin` exige une session `aal2`),
et vérifiée acteur par acteur dans une transaction annulée : admin en `aal1` →
`admin_allowlisted()` vrai mais `is_admin()` FAUX et `get_admin_stats()` refusée **42501** ;
admin dont le jeton n'a **aucune** claim `aal` → `is_admin()` faux (la garde ne se relâche pas
sur une valeur manquante) ; admin en `aal2` → garde ouverte, statistiques rendues ; compte non
admin en `aal2` → tout faux, inchangé.
🔴 **ELLE A ÉTÉ APPLIQUÉE AVANT L'ENRÔLEMENT**, à la demande explicite d'Axel, donc dans
l'ordre que l'en-tête de la migration déconseille. Mesuré juste avant : le compte admin a
**zéro facteur MFA**. Conséquence, tant qu'aucun code TOTP n'a été vérifié : `/admin`
n'affiche plus de statistiques. Ce n'est pas un verrouillage — `AdminMfaGate` reste
atteignable parce que `admin_allowlisted()` ignore volontairement le niveau d'assurance.
✅ **L'enrôlement a eu lieu le 2026-09-01**, mesuré en base le 2026-09-02 : `auth.mfa_factors`
porte **1 facteur `totp` en statut `verified`** sur le compte admin, créé à 14:20:27 UTC et
vérifié 46 secondes plus tard. Accès à `/admin` confirmé le 2026-09-02. Le verrouillage
a donc duré **du 2026-08-31 au 2026-09-01**, pas au-delà.
⚠️ **Un seul compte au monde ouvre cette console** : `public.admin_users` ne contient qu'une
ligne, l'adresse Gmail personnelle d'Axel, pas l'adresse pro. Téléphone perdu →
`DELETE FROM auth.mfa_factors WHERE user_id = '<uid>';` depuis le SQL editor, seule porte de
sortie, et elle n'a pas d'autre gardien.
🔴 **La porte de sortie était elle-même cassée, et ça a bel et bien produit un verrouillage
(2026-09-01).** Le raisonnement ci-dessus — « ce n'est pas un verrouillage, `AdminMfaGate`
reste atteignable » — était juste sur la garde et faux dans les faits : l'écran d'enrôlement
levait une exception **en phase de rendu**, donc l'`AppErrorBoundary` affichait « Une erreur
inattendue s'est produite » au lieu du QR code. Atteignable, mais inutilisable : `/admin` est
resté inaccessible du 2026-08-31 au 2026-09-01, mesuré (`auth.mfa_factors` = 0 ligne).
Corrigé (`formatSecret` rendue totale, réponse d'enrôlement validée à la frontière), avec les
tests de régression qui manquaient — ils mockaient `startTotpEnrolment` sans jamais le
résoudre, donc le QR n'était **jamais rendu**.
**La leçon, qui vaut au-delà de cet écran** : quand une migration crée une dépendance à un
chemin de récupération, ce chemin se PARCOURT avant d'appliquer la migration, il ne se
raisonne pas. Ici il suffisait d'ouvrir l'écran une fois. ✅ La `130` a été appliquée
le 2026-08-29, vérifiée acteur par acteur (membre simple : 0 ligne).
✅ **Les `127`, `128` et `129` ont été appliquées en prod le 2026-08-27**, dans cet ordre, chacune
vérifiée après coup : la `127` rend un résultat identique pour les 18 comptes qui ont des données
(comparaison par empreinte, prise avant application), la `128` laisse **une seule policy
PERMISSIVE** sur `events`, et un manager voit toujours exactement les 30 événements non privés de
son subordonné, zéro de celui qu’il ne gère pas ; la `129` est `SECURITY INVOKER` et un membre
simple ne voit toujours aucune des demandes d’adhésion réservées aux admins.
**Tout le reste est en prod**, ledger relu en base le 2026-08-27 : la `129` est la dernière
appliquée. La `123` l’a été avant le redéploiement de `stripe-webhook`, qui écrit
désormais `billing_interval`.

> ⚠️ **Le ledger porte une entrée de plus que le dépôt** :
> `119b_habits_bounded_payload_future_guard`, appliquée en prod, sans fichier correspondant. Son
> contenu a été relu et comparé au fichier `119` du dépôt : **identique**, le correctif a été
> replié dans le fichier d'origine au lieu d'être versionné à part. Rejouer le dépôt sur base
> vierge donne donc le même état final. **Règle : un correctif appliqué en prod se versionne sous
> son propre numéro**, jamais par édition d'un fichier déjà appliqué.

> ⚠️ Quatre migrations ne portent pas de fonctionnalité : elles **formalisent
> l'existant**. `subscriptions`, trois colonnes et les privilèges par défaut du
> schéma `public` existaient en prod sans qu'aucune migration ne les crée — le
> dépôt ne décrivait donc pas la base qu'il prétend reconstruire, et le replay
> sur base vierge échouait. Elles sont **no-op en production** (`IF NOT EXISTS`,
> `CREATE OR REPLACE`) : elles alignent le dépôt sur la prod, jamais l'inverse.
> Deux d'entre elles sont numérotées `000_` parce qu'elles précèdent réellement
> l'historique. Le job CI `rls-integration` est vert depuis (run #713) — il ne
> l'avait **jamais** été depuis sa création le 2026-06-21.
>
> 🔴 **Ne jamais ajouter une colonne ou un GRANT depuis le dashboard Supabase.**
> C'est ce qui a produit cette dérive : la prod avance, le dépôt non, et
> personne ne le voit tant que rien ne rejoue les migrations à blanc.

Toutes les tables ont **RLS activée**. Pattern obligatoire + checklist migration →
ce document.

Fonctions SECURITY DEFINER clés : `accept_friend_request_v2`, `accept_shared_task`,
`remove_friendship` /
`resolve_profile_by_email`, `handle_new_user_profile`, `prevent_user_id_change`, `owns_task`,
`claim_share_link`, `sanitize_display_name`, `get_my_tasks`, `toggle_task_complete_v2`,
`get_work_time_stats`, `get_admin_stats`. Schéma `friend_requests` = `sender_id` / `receiver_id`.

> **Une seule policy PERMISSIVE par rôle+action** (mig. 049). Les anciens splits `tasks`
> (own / collaborator) et `friend_requests` (sender / receiver) sont **fusionnés en une policy
> `OR` unique**, sémantique préservée. **Ne jamais recréer deux policies permissives** pour le
> même rôle+action : élargir le `OR` existant. `npm run check:rls` est la gate.


---

## Gardes SQL et Edge Functions · repris de `CLAUDE.md` (déplacé le 2026-09-16)

> Commentaires de la section `## Scripts` de `CLAUDE.md`, où ils étaient chargés à chaque
> session. Déplacés ici **sans une coupe**. La racine ne garde que la commande.

```bash
npm run validate:migrations # Garde statique sur supabase/migration/*.sql (CI)
npm run check:rls           # Invariants RLS : auth.uid() wrappé, 1 seule policy PERMISSIVE,
                            # + toute fonction citée par une policy exécutable par authenticated (CI)
npm run check:drift         # Dérive repo ↔ prod (2 étapes : --print-sql puis <introspection.json>)
npm run check:migration-coverage # Recouvrement des 152 fichiers de migration ↔ ledger de PROD.
                            # Répond à C-79. GATE CI depuis le 2026-09-15
                            # (`migration-coverage.yml`, quotidien 05:17 UTC + à
                            # chaque push touchant `supabase/migration/`), branchée
                            # sur `ci-alert.yml`.
                            # ❌ Ne se contente PAS d'un comptage : c'est le comptage
                            # qui a menti. Chaque fichier reçoit un VERDICT, et seul
                            # le dernier fait échouer :
                            #   AU LEDGER · OBJET EN BASE · OBJET RETIRÉ DEPUIS ·
                            #   SUPPRESSION VÉRIFIÉE · SANS OBJET VÉRIFIABLE
                            #   (déclaré) · NON APPLIQUÉE (déclarée) · ABSENT DES DEUX
                            # ✅ Premier run CI, `34941970659` : 152 fichiers lus,
                            # 138 entrées de ledger lues EN PROD, et
                            # 118 / 27 / 3 / 1 / 2 / 1 / **0**.
                            # 🔴 Deux verdicts sont MESURÉS, pas déclarés, et sans eux
                            # la garde réclamait quatre migrations bel et bien
                            # appliquées : les mig. 013, 015 et 016 ont été VIDÉES par
                            # la 141 (C-04), et la 090 ne fait que supprimer, donc son
                            # effet se vérifie par l'absence de ses cibles.
                            # ⚠️ CE QUE SON VERT NE DIT PAS, et il l'imprime à chaque
                            # exécution : une LIGNE au ledger ne prouve pas qu'un
                            # `CREATE OR REPLACE` a remplacé le corps vivant (mig. 144,
                            # rejouée par la 147). Il liste donc aussi les 9 fichiers
                            # PARTIELS, dont la 136.
                            # 🔴 EXIGE `SUPABASE_DB_URL`. Secret absent = ÉCHEC, jamais
                            # un `::warning::` dans un run vert.
                            # ❌ Ne JAMAIS ajouter une entrée à
                            # `NON_APPLIQUEES_DELIBEREMENT` ou `SANS_OBJET_VERIFIABLE`
                            # pour faire passer la CI. Une dispense qui se révèle FAUSSE
                            # (la migration est en fait appliquée) fait échouer la garde,
                            # comme `.github/edge-deploy.json`.
                            # Témoin : `scripts/check-migration-coverage.guard.test.mjs`
                            # (16 cas), vu ROUGE sur quatre sabotages du script avant
                            # d'être committé.
npm run check:edge          # Le code DÉPLOYÉ des Edge Functions contre le dépôt (finding C-35).
                            # Job `Edge deploy drift` : quotidien 05:41 UTC + à chaque push
                            # touchant `supabase/functions/`. Branché sur `ci-alert.yml`.
                            # 🔴 EXIGE `SUPABASE_ACCESS_TOKEN`. Secret absent = ÉCHEC, jamais
                            # un `::warning::` dans un run vert. ✅ POSÉ le 2026-09-13 à
                            # 09:34 UTC : le job avait échoué 14 fois d'affilée sans
                            # JAMAIS avoir comparé quoi que ce soit.
                            # ✅ **PREMIER RUN VERT le 2026-09-13** (run 34768021931) :
                            # « 8 fonction(s) verifiee(s) : le code deploye est celui du
                            # depot ». Avant : 0 fonction comparée, 14 échecs.
                            # 🔴 `--use-api` EST OBLIGATOIRE sur `functions download`.
                            # Sans lui la CLI débundle AVEC DOCKER et rend du code
                            # TRANSPILÉ : le verdict dépendait alors d'un Docker installé
                            # à côté (poste sans Docker → 4 divergences ; runner avec
                            # Docker → 24, dont 20 FAUSSES). **Une garde dont le verdict
                            # dépend de son runner ne mesure pas la production.**
                            # ⚠️ Un déploiement fait depuis un arbre de travail non
                            # committé se voit ici, et s'est vu : `stripe-webhook` v31 a
                            # divergé de `main` d'UN caractère de commentaire. Déployer
                            # depuis la racine du dépôt, sur `main`.
                            # ⚠️ Le 2026-09-03, les TROIS sources déployées lisibles
                            # divergeaient de `main`, de trois façons différentes. Tant que
                            # rien ne comparait, toute conclusion tirée en lisant
                            # `supabase/functions/` était fausse d'avance — y compris les
                            # statuts de `faille.md`. **Un « ✅ corrigé » sur une Edge Function
                            # ne veut rien dire sans sa date de déploiement.**
                            # `.github/edge-deploy.json` ne déclare que l'EXISTENCE (quelle
                            # fonction n'est pas encore en ligne, pourquoi, depuis quand).
                            # ❌ Il ne peut pas faire taire une divergence de CONTENU, et une
                            # fonction qu'il dit non déployée alors qu'elle est en ligne fait
                            # échouer la garde : sinon la note périme en silence.
                            # Témoin : `scripts/check-edge-deploy.guard.test.mjs`.
```
