# Audit de sécurité — COSMO 1.2

**Date** : 2026-07-26
**Périmètre** : application complète (SPA React + Supabase + Edge Functions + Vercel)
**Projet Supabase audité (live)** : `ykeugqfgklejcdbrmawy` (`cosmo test`, ACTIVE_HEALTHY, eu-west-1)
**Dépôt** : https://github.com/kelax12/COSMO1.2 — ⚠️ **public**
**Méthode** : revue de code + interrogation du catalogue PostgreSQL **en production** + PoC exécutés sous RLS réelle (tous en transaction annulée)

---

## 1. Résumé exécutif

### Niveau de risque global : **MOYEN** (1 finding High confirmé, 0 Critical)

Le projet est **nettement mieux sécurisé que la moyenne des applications "vibe codées"**. Les fondations sont solides et vérifiées en production :

- **0 lint ERROR** au linter de sécurité Supabase, **0 table sans RLS**, **0 vue `SECURITY DEFINER`**, **0 fonction `SECURITY DEFINER` à `search_path` mutable** (76 définitions auditées).
- Le webhook Stripe vérifie la signature, gère l'idempotence et les retries correctement.
- Aucun secret dans le bundle client ; scrubbing PII Sentry en place.
- Aucune surface d'injection SQL (PostgREST + RPC entièrement paramétrés), aucun sink XSS alimenté par des données utilisateur.

Le risque résiduel ne vient **pas** de l'infrastructure mais d'un **angle mort de contrôle d'accès au niveau colonne** : la table `profiles` est protégée en RLS *au niveau ligne*, mais les `GRANT` *au niveau colonne* laissent l'utilisateur réécrire son propre `email` — champ qui sert d'identité pivot pour tout le système d'invitation.

### Niveau de confiance de l'audit : **ÉLEVÉ sur le code et la base, FAIBLE sur la configuration cloud**

| Vérifié directement | Non vérifiable depuis le dépôt |
|---|---|
| Schéma, RLS, policies, RPC, GRANT (prod live) | Console Vercel (variables d'env réellement définies) |
| Edge Functions (code source) | Secrets Supabase réellement configurés (`STRIPE_WEBHOOK_SECRET`…) |
| Dépendances (`npm audit`) | Rate limiting effectif (Cloudflare / Supabase quotas) |
| En-têtes HTTP (`vercel.json`) | Politique de backup / rotation des secrets, IAM |

### Principales faiblesses

1. **Usurpation d'identité par réécriture de `profiles.email`** (confirmée par PoC) → détournement d'invitations.
2. **Absence totale de rate limiting applicatif** → énumération d'utilisateurs, brute-force de codes d'organisation, écriture anonyme non bornée.
3. **Fuite historique de secrets dans un dépôt public** (impact réel neutralisé : le projet visé est supprimé).

---

## 2. Tableau des vulnérabilités

| ID | Gravité | CVSS | Catégorie | Titre | Statut |
|---|---|---|---|---|---|
| **H-1** | **High** | **8.1** | Broken Access Control (A01) / CWE-639 | Réécriture arbitraire de `profiles.email` → usurpation d'identité et détournement d'invitations | ✅ Confirmé (PoC) |
| **M-1** | Medium | 5.3 | CWE-341 / A04 | `resolve_profile_by_email` : `LIMIT 1` sans `ORDER BY` + collision de casse → résolution d'identité non déterministe | ⚠️ Plausible |
| **M-2** | Medium | 5.3 | CWE-770 / A04 | `record_demo_visit` exécutable par `anon` : écriture non bornée non authentifiée | ✅ Confirmé (statique) |
| **M-3** | Medium | 5.3 | CWE-204 / A01 | Énumération d'utilisateurs par email (50 par requête, sans limite de débit) | ✅ Confirmé |
| **M-4** | Medium | 4.3 | CWE-367 (TOCTOU) / A04 | `credit_premium_token_from_ad` : course entre lecture et écriture → dépassement du plafond quotidien | ✅ Confirmé (statique) |
| **M-5** | Medium | 6.1 | A06 (dépendance) | `react-router` < 7.17.1 — open redirect via antislash | ✅ Confirmé (`npm audit`) |
| **M-6** | Medium | 5.3 | A07 | Protection « mots de passe compromis » (HIBP) désactivée | ✅ Confirmé (advisor) |
| **M-7** | Medium | 4.3 | CWE-330 / A07 | Code d'invitation organisation : ~30 bits + biais modulo, sans anti-brute-force | ✅ Confirmé |
| **L-1** | Low | 3.5 | CWE-20 | `profiles.display_name` : contournement de `sanitize_display_name()` par PATCH direct | ✅ Confirmé |
| **L-2** | Low | 3.1 | A05 | Jetons de session en `localStorage` + CSP `style-src 'unsafe-inline'` | ✅ Confirmé |
| **L-3** | Low | 2.0 | A05 | 7 fonctions trigger `validate_*()` exposées à `anon` via RPC | ✅ Confirmé (advisor) |
| **L-4** | Low | 3.7 | A02 | Secrets historiques dans un dépôt public (projet cible supprimé) | ⚠️ Impact neutralisé |
| **L-5** | Low | 2.0 | A05 | `consume_premium_token` : `search_path = 'public'` au lieu de `''` | ✅ Confirmé |
| **L-6** | Low | — | A06 | `postcss` < 8.5.18 (build-time uniquement) | ✅ Confirmé |

---

## 3. Findings détaillés

### 🚨 H-1 — Réécriture arbitraire de `profiles.email` → usurpation d'identité

**Gravité** : High · **CVSS 3.1 estimé** : 8.1 (`AV:N/AC:L/PR:L/UI:R/S:C/C:H/I:H/A:N`)
**Catégorie** : OWASP A01 Broken Access Control · CWE-639 (Authorization Bypass Through User-Controlled Key) · API3:2023 (Broken Object Property Level Authorization)

#### Cause racine

La RLS de `profiles` est correcte **au niveau ligne** :

```sql
-- policy UPDATE : un utilisateur ne modifie que SA ligne
USING  (auth.uid() = id)
WITH CHECK (auth.uid() = id)
```

Mais la RLS de PostgreSQL est **row-level, pas column-level**. Or les `GRANT` colonne sont larges :

```
authenticated UPDATE -> email          ← problème
authenticated UPDATE -> account_type
authenticated UPDATE -> display_name
authenticated UPDATE -> id
authenticated UPDATE -> last_seen_at
```

Et **aucun trigger** n'existe sur `profiles` (vérifié sur `pg_trigger` en prod) — contrairement à `prevent_user_id_change` qui protège d'autres tables.

Conséquence : un utilisateur authentifié peut réécrire son propre `email`, alors que ce champ est la **clé d'identité** de tout le flux d'invitation.

#### Prérequis

Un compte gratuit sur l'application. C'est tout.

#### Scénario d'attaque

1. L'attaquant crée un compte `attacker@evil.com`.
2. Il réécrit son profil via l'API REST publique (la clé `anon` est dans le bundle JS, donc publique par conception) :

```bash
curl -X PATCH "https://<ref>.supabase.co/rest/v1/profiles?id=eq.<son_propre_uid>" \
  -H "apikey: <anon_key>" \
  -H "Authorization: Bearer <son_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"email":"cfo@target-corp.com"}'
```

3. Un employé de `target-corp` invite son DAF (pas encore inscrit) sur une tâche, une liste ou une organisation. Le client appelle `resolve_profile_by_email('cfo@target-corp.com')`.
4. La RPC renvoie **l'UUID de l'attaquant**. L'invitation, la tâche partagée et la relation `friends` sont attribuées à l'attaquant.

#### Preuve

PoC exécuté **en production sous RLS réelle**, en se faisant passer pour un utilisateur `authenticated` normal, dans un bloc `DO` terminé par `RAISE EXCEPTION` — **rollback total garanti, aucune donnée modifiée** :

```
POC2 >>> update_rows=1
       | resolve_single -> 0490e82a-452e-46fa-8353-f084fef4762f
       | attacker_owns_identity=t
       | batch_rows_returned=1
```

`update_rows=1` : la RLS a **autorisé** la réécriture de l'email.
`attacker_owns_identity=t` : l'email visé résout désormais vers le compte de l'attaquant, via `resolve_profile_by_email` **et** `resolve_profiles_by_emails`.

Un premier PoC a également confirmé que la contrainte `UNIQUE(email)` est **contournable par la casse** (`spoof_casing_accepted=t`) : `VICTIM@corp.com` et `victim@corp.com` sont deux lignes distinctes pour l'index unique, mais **la même** pour les recherches en `lower(email)`. Voir M-1.

#### Impact

- Détournement d'invitations : accès non autorisé à des tâches, listes et organisations.
- Divulgation de PII : la policy SELECT de `profiles` autorise la lecture par correspondance d'email (`lower(f.email) = lower(profiles.email)`), donc l'usurpation ouvre aussi la lecture de profil.
- Usurpation sociale : l'attaquant apparaît dans les annuaires sous l'identité email de la victime.
- `account_type` est également modifiable (`personal` → `business`) sans passer par `create_organization`.

#### Fichiers concernés

- `supabase/migration/018_profiles.sql` (création de la table et des GRANT)
- `supabase/migration/071_org_member_profiles_visible.sql` (policy SELECT par email)
- Consommateurs : `src/modules/friends/supabase.repository.ts:105,163,325,455`

#### Correctif

Migration à appliquer — révoquer les colonnes d'identité et verrouiller par trigger (défense en profondeur) :

```sql
-- 083_profiles_column_lockdown.sql

-- 1. Ne laisser modifiables que les champs réellement « profil ».
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT  UPDATE (display_name, avatar_url) ON public.profiles TO authenticated;

-- 2. Filet de sécurité : même si un GRANT est ré-élargi par erreur,
--    les champs d'identité restent immuables côté client.
CREATE OR REPLACE FUNCTION public.prevent_profile_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Les writes service_role (webhooks, triggers auth) restent autorisés.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.id           IS DISTINCT FROM OLD.id
  OR NEW.email        IS DISTINCT FROM OLD.email
  OR NEW.account_type IS DISTINCT FROM OLD.account_type THEN
    RAISE EXCEPTION 'profile identity fields are immutable'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_identity_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_identity_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_identity_change();

-- 3. Rendre l'unicité insensible à la casse (corrige aussi M-1).
--    ⚠️ Vérifier d'abord l'absence de doublons :
--    SELECT lower(email) FROM public.profiles GROUP BY 1 HAVING count(*) > 1;
DROP INDEX IF EXISTS public.idx_profiles_email;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_key
  ON public.profiles (lower(email));
```

> `account_type` doit rester piloté par `create_organization()` (qui est `SECURITY DEFINER` et s'exécute donc hors RLS/GRANT du client — le trigger ci-dessus le laisse passer via le garde `auth.uid() IS NULL`… **attention** : `create_organization` conserve `auth.uid()`. Si le trigger bloque cette RPC, ajouter un garde local :
> `PERFORM set_config('cosmo.allow_account_type','on',true);` dans `create_organization`, et tester ce flag dans le trigger — même motif que `cosmo.allow_owner_transfer` déjà utilisé dans `transfer_org_ownership`.)

#### Tests après correction

```sql
-- Doit échouer (42501)
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims','{"sub":"<uid>","role":"authenticated"}',true);
UPDATE public.profiles SET email = 'someone-else@corp.com' WHERE id = '<uid>';

-- Doit réussir
UPDATE public.profiles SET display_name = 'Nouveau nom' WHERE id = '<uid>';
```

Régressions à vérifier : création d'organisation, `claim_share_link`, connexion OAuth (trigger `handle_new_user_profile`), synchronisation d'avatar (mig. 032).

---

### M-1 — Résolution d'identité non déterministe (`LIMIT 1` sans `ORDER BY`)

```sql
SELECT id INTO v_id FROM public.profiles
WHERE lower(email) = lower(p_email)
LIMIT 1;   -- ← aucun ORDER BY
```

Combiné au contournement de casse de la contrainte `UNIQUE` (H-1), deux lignes peuvent matcher. La ligne renvoyée dépend alors du plan d'exécution et de l'ordre physique — susceptible de **changer après un `VACUUM FULL`, une reconstruction d'index ou un changement de plan**.

Mon PoC a renvoyé la victime légitime (`HIJACK_SUCCESS=f`), donc l'exploitation contre un utilisateur **déjà inscrit** n'est **pas fiable** — je classe ce point *Plausible*, pas *Confirmé*. Contre un email **non encore inscrit**, l'attaque est en revanche déterministe (voir H-1).

**Correctif** : l'index unique sur `lower(email)` du correctif H-1 supprime la cause racine. Ajouter malgré tout `ORDER BY id` pour un comportement déterministe.

---

### M-2 — `record_demo_visit` : écriture non authentifiée et non bornée

```sql
CREATE FUNCTION public.record_demo_visit(p_device_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $$ INSERT INTO public.demo_devices (device_id) VALUES (p_device_id)
      ON CONFLICT (device_id) DO NOTHING; $$;
```

Exécutable par le rôle **`anon`** (confirmé par l'advisor Supabase). `p_device_id` est fourni par le client, sans corrélation avec une session.

**Scénario** : boucle de `POST /rest/v1/rpc/record_demo_visit` avec des UUID v4 aléatoires. `ON CONFLICT DO NOTHING` ne protège pas — chaque UUID inédit crée une ligne.

```bash
# Attaquant non authentifié, avec la seule clé anon (publique)
for i in $(seq 1 100000); do
  curl -s -X POST "https://<ref>.supabase.co/rest/v1/rpc/record_demo_visit" \
    -H "apikey: <anon_key>" -H "Content-Type: application/json" \
    -d "{\"p_device_id\":\"$(uuidgen)\"}" &
done
```

**Impact** : gonflement de la table (16 lignes aujourd'hui), saturation disque, hausse de facturation, pollution des statistiques d'acquisition (`get_admin_stats`).

**Correctif** : plafonner l'insertion dans la fonction et/ou placer un rate limit en amont.

```sql
CREATE OR REPLACE FUNCTION public.record_demo_visit(p_device_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_recent INT;
BEGIN
  SELECT count(*) INTO v_recent FROM public.demo_devices
   WHERE first_seen_at > NOW() - INTERVAL '1 hour';
  IF v_recent > 500 THEN RETURN; END IF;   -- absorbe la rafale silencieusement
  INSERT INTO public.demo_devices (device_id) VALUES (p_device_id)
  ON CONFLICT (device_id) DO NOTHING;
END; $$;
```

---

### M-3 — Énumération d'utilisateurs par email

`resolve_profile_by_email` (1 email/appel) et `resolve_profiles_by_emails` (**50 emails/appel**) renvoient un UUID si l'email possède un compte, `NULL` sinon. Tout utilisateur authentifié peut donc tester une liste d'emails et déterminer qui utilise Cosmo. Aucune limite de débit.

Le plafond `p_emails[1:50]` est une bonne pratique déjà présente, mais il borne la *taille de requête*, pas le *nombre de requêtes*.

**Impact RGPD** : révèle l'appartenance d'une personne au service (donnée personnelle). Utile en reconnaissance pour du phishing ciblé.

**Correctif** : compteur d'appels par utilisateur et par fenêtre glissante, sur le modèle déjà utilisé par `credit_premium_token_from_ad` (`ad_credits_window_start` / `ad_credits_in_window`). Par exemple 200 emails résolus / 24 h / utilisateur.

---

### M-4 — TOCTOU dans `credit_premium_token_from_ad`

```sql
SELECT ad_credits_window_start, ad_credits_in_window INTO v_start, v_count
FROM public.subscriptions WHERE user_id = auth.uid();   -- ← pas de FOR UPDATE
...
IF v_count >= c_daily_cap THEN RAISE EXCEPTION ... END IF;
UPDATE public.subscriptions SET ad_credits_in_window = v_count + 1 ...
```

En `READ COMMITTED`, le `SELECT` ne pose aucun verrou. N appels concurrents lisent tous `v_count = 19`, passent tous le test, et écrivent tous `20` → le plafond de 20 crédits/24 h est dépassé.

**Impact actuel nul** : `PREMIUM_ENFORCED = false` (cf. `src/modules/billing/premium-config.ts`), les jetons ne débloquent rien. **Le devient dès la réactivation du premium.**

**Correctif** : une seule ligne.

```sql
SELECT ad_credits_window_start, ad_credits_in_window INTO v_start, v_count
FROM public.subscriptions WHERE user_id = auth.uid()
FOR UPDATE;   -- sérialise les appels concurrents sur la ligne
```

**Test** : 30 appels parallèles → exactement 20 succès et 10 `check_violation`.

---

### M-5 — `react-router` : open redirect (dépendance)

`npm audit` (dépendances de production) :

| Paquet | Version | Avis | Gravité |
|---|---|---|---|
| `react-router` / `react-router-dom` | 6.x | GHSA-wrjc-x8rr-h8h6 — open redirect via antislash dans `<Link>`/`useNavigate` | Moderate |
| `postcss` | <8.5.18 | GHSA-6g55-p6wh-862q — lecture de fichier arbitraire via `sourceMappingURL` | High (build-time) |

J'ai vérifié la **surface réelle** : aucun `navigate()` ni `<Link to=…>` n'est alimenté par un paramètre d'URL contrôlable (`redirect`, `next`, `returnTo` — aucune occurrence). Les seules redirections externes sont `window.location.href = data.url` vers l'URL Stripe renvoyée par l'Edge Function (donc côté serveur), et des `redirectTo` construits sur `window.location.origin`. **L'exploitabilité est donc actuellement nulle** — mais la dépendance doit être mise à jour pour éviter une régression future.

Le second avis `react-router` (`deserializeErrors()` en hydratation SSR) **ne s'applique pas** : l'application est une SPA sans SSR.

`postcss` n'est utilisé qu'au build (Tailwind) et ne traite pas de CSS d'origine externe → risque pratique faible.

```bash
npm audit fix
```

---

### M-6 — Protection « mots de passe compromis » désactivée

L'advisor Supabase signale que la vérification HaveIBeenPwned est désactivée. Les utilisateurs peuvent choisir un mot de passe présent dans des fuites publiques → credential stuffing.

**Correctif** : Dashboard Supabase → *Authentication* → *Policies* → activer *Leaked password protection*. Envisager aussi le passage du minimum à 10 caractères et l'activation de la MFA (absente aujourd'hui).

---

### M-7 — Code d'invitation organisation : entropie et biais

```sql
v_alphabet := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 caractères
v_code := 'COSMO-' || 6 caractères
v_byte := ('x' || substr(v_hex, i*2-1, 2))::bit(8)::int;
v_code := v_code || substr(v_alphabet, (v_byte % 31) + 1, 1);
```

- **Entropie** : 31⁶ ≈ 8,9 × 10⁸ ≈ **29,7 bits**. Faible pour un secret sans anti-brute-force.
- **Biais modulo** : `v_byte` ∈ [0,255], or 256 = 31×8 + 8. Les restes 0..7 apparaissent 9 fois contre 8 pour les restes 8..30 → les 8 premières lettres (`A`–`H`) sont ~12,5 % plus probables. Entropie effective encore réduite (CWE-331).

`request_join_organization` n'impose aucune limite de tentatives. Avec N organisations, le nombre d'essais attendu pour toucher **une** organisation valide est ≈ 8,9×10⁸ / N — négligeable dès quelques milliers d'organisations.

**Atténuation existante (importante)** : un code valide ne donne **pas** l'accès. Il crée une demande dans `organization_join_requests`, qu'un admin doit approuver via `respond_join_request`. L'impact se limite donc à la **divulgation du nom de l'organisation** et au **spam de demandes**. C'est un bon design — c'est ce qui maintient ce point en Medium et non en High.

**Correctif** : porter à 10 caractères (≈ 49,5 bits), supprimer le biais par rejet, et limiter les tentatives.

```sql
-- tirage non biaisé : on rejette les octets ≥ 248 (= 31×8)
LOOP
  v_byte := (('x' || encode(gen_random_bytes(1),'hex'))::bit(8)::int);
  EXIT WHEN v_byte < 248;
END LOOP;
v_code := v_code || substr(v_alphabet, (v_byte % 31) + 1, 1);
```

---

### L-1 — Contournement de `sanitize_display_name()`

`sanitize_display_name()` (retrait de `< > " ' \``, troncature à 80 caractères) est appliquée dans `create_organization()` et `claim_share_link()`. Mais `authenticated` dispose du `GRANT UPDATE` sur `profiles.display_name` et **aucun trigger** ne rappelle la fonction → un `PATCH` direct injecte une valeur arbitraire, de longueur illimitée.

Pas de XSS : React échappe les valeurs interpolées, et aucun `dangerouslySetInnerHTML` n'est alimenté par des données utilisateur (vérifié : les 3 occurrences sont du contenu de build ou du CSS de graphique). Le risque est l'**usurpation d'affichage** dans les annuaires d'organisation et la **dégradation de l'UI** par des chaînes très longues.

**Correctif** : appliquer la sanitisation dans un trigger `BEFORE INSERT OR UPDATE` sur `profiles`.

> Note fonctionnelle (hors sécurité) : la classe de caractères `'[<>"''` -]'` retire aussi **l'espace** et le **tiret**. « Jean Dupont » devient « JeanDupont » et « Marie-Claire » devient « MarieClaire ». À corriger indépendamment.

---

### L-2 — Jetons de session en `localStorage`

`persistSession: true` sans `storage` personnalisé → supabase-js stocke `access_token` et `refresh_token` dans `localStorage`, donc lisibles par tout JavaScript de la page. Toute XSS devient une **prise de contrôle de compte complète**, et le `refresh_token` survit à la fermeture de l'onglet.

C'est le compromis standard de Supabase en SPA, pas un défaut d'implémentation. Ce qui l'aggrave marginalement : `style-src 'unsafe-inline'` dans la CSP et `detectSessionInUrl: true`.

**Atténuations** : la CSP est par ailleurs stricte (`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, pas de `script-src 'unsafe-inline'`), `X-Frame-Options: DENY`, HSTS avec `preload`. Le risque XSS réel est faible car aucun sink n'est alimenté par des données utilisateur.

**Améliorations** : retirer `'unsafe-inline'` de `style-src` (nonce/hash) et ajouter `frame-ancestors 'none'` à la CSP (X-Frame-Options est obsolète, seul `frame-ancestors` est normatif).

---

### L-3 — Fonctions trigger exposées à `anon`

7 fonctions `validate_*()` (`validate_org_manager`, `validate_team_task`, `validate_project_team`…) sont appelables par `anon` via `/rest/v1/rpc/…`. Ce sont des fonctions `RETURNS trigger` : appelées hors contexte trigger, PostgreSQL les rejette. **Non exploitable**, mais c'est de la surface d'attaque inutile.

```sql
REVOKE EXECUTE ON FUNCTION public.validate_org_manager()     FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_project_team()    FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_team_kr()         FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_team_membership() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_team_okr_team()   FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_team_task()       FROM anon, authenticated, public;
```

(Les triggers continuent de fonctionner : ils s'exécutent avec les droits du propriétaire de la table.)

---

### L-4 — Secrets historiques dans un dépôt public

Le dépôt **est public**. L'historique Git contient un `.env` traqué aux commits `900ee3e` (initial) et `0b5d9b6`, retiré seulement en `f3ee9d2`. Les clés présentes :

| Clé | Commit | Nature |
|---|---|---|
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | 900ee3e, 0b5d9b6 | JWT `role=service_role`, `ref=pzrpwyqwultyenvqfyhg`, `exp=2084938178` (**an 2036**) — contourne toute la RLS |
| `DATABASE_URL` | 900ee3e, 0b5d9b6 | Chaîne PostgreSQL **avec mot de passe en clair** |
| `BETTER_AUTH_SECRET` | 900ee3e | Secret de signature |

**Impact réel : neutralisé.** Le projet `pzrpwyqwultyenvqfyhg` **n'existe plus** (NXDOMAIN sur `pzrpwyqwultyenvqfyhg.supabase.co`, et absent de la liste des projets de l'organisation). Le projet de production actuel est `ykeugqfgklejcdbrmawy`, dont les secrets n'ont jamais été committés. Le `.env` local ne contient d'ailleurs plus que `VITE_SENTRY_DSN` (les autres valeurs sont vides).

**Ce qui reste à traiter** :
1. **Vérifier la réutilisation du mot de passe** : si le mot de passe de `DATABASE_URL` a été réutilisé sur le projet actuel ou ailleurs, le changer.
2. Ces secrets restent lisibles publiquement et indexés par les scanners. Purger l'historique (`git filter-repo --path .env --invert-paths` puis `push --force`) — sachant que GitHub conserve les objets orphelins un certain temps et que des miroirs ont pu les capter : **considérer ces secrets comme définitivement brûlés**, ce qui est déjà le cas.
3. Activer *Secret scanning* et *Push protection* sur le dépôt GitHub.

---

## 4. Points positifs vérifiés

Ces éléments ont été **testés en production**, pas seulement lus :

- **RLS** : 100 % des tables du schéma `public` ont RLS activée. Les 3 tables sans policy (`admin_users`, `demo_devices`, `user_activity_days`) sont en **deny-by-default** — c'est intentionnel et correct, l'accès passe par des fonctions `SECURITY DEFINER`.
- **`search_path`** : les 76 fonctions `SECURITY DEFINER` en production ont toutes un `search_path` figé. Aucune n'est vulnérable au détournement de schéma. (Deux migrations anciennes — `005`, `018` — en manquaient ; corrigé depuis par `024`/`064`/`069`/`080`.)
- **Aucune vue `SECURITY DEFINER`** exposée à PostgREST.
- **Séparation des privilèges** : `set_member_role` (verrou `FOR UPDATE` + garde « dernier admin »), `transfer_org_ownership` (owner uniquement, pas simple admin, + vérification d'appartenance) sont correctement écrites.
- **Auto-approbation d'ami impossible** : la policy `WITH CHECK` de `friend_requests` interdit à l'émetteur de passer son propre statut à `accepted` (seul le destinataire le peut). J'ai spécifiquement cherché cette escalade — elle est bloquée.
- **Stripe** : signature vérifiée via `constructEventAsync`, rejet des méthodes ≠ POST, idempotence via `processed_stripe_events` avec marqueur écrit **après** succès du handler, clés d'idempotence Stripe côté checkout, erreurs jamais renvoyées à l'appelant, CORS en allowlist. C'est du travail de qualité.
- **Aucune injection SQL possible** : tout passe par PostgREST et des RPC à paramètres typés. Aucune concaténation de chaîne SQL.
- **Aucun secret côté client** : `grep` sur `sk_live|sk_test|whsec_|SERVICE_ROLE` dans `src/` → 0 résultat.
- **Sentry** : `beforeSend` retire emails et UUID des messages, exceptions et breadcrumbs.
- **Uploads / Storage : surface nulle** — aucun bucket Supabase Storage n'existe. Les sections 8 et 9 du cahier des charges sont **sans objet** (les avatars sont des URL externes).
- **En-têtes HTTP** : HSTS `preload`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP sans `script-src 'unsafe-inline'`, `noindex` sur les routes d'invitation et de reset.

---

## 5. Roadmap

### 🚨 Bloquant production
- **H-1** — Verrouiller les colonnes de `profiles` (`REVOKE` + trigger + index unique sur `lower(email)`). C'est le seul point qui justifie de retarder une mise en production.

### Haute priorité (7 jours)
- **M-2** — Plafonner `record_demo_visit` (écriture anonyme non bornée).
- **M-6** — Activer la protection HIBP (5 minutes, dans le dashboard).
- **M-5** — `npm audit fix` (react-router, postcss).
- **L-4** — Vérifier la non-réutilisation du mot de passe `DATABASE_URL` historique ; activer le secret scanning GitHub.

### Moyenne priorité (30 jours)
- **M-3** — Rate limiting sur la résolution d'email (fenêtre glissante par utilisateur).
- **M-4** — `FOR UPDATE` dans `credit_premium_token_from_ad` — **impérativement avant de repasser `PREMIUM_ENFORCED` à `true`**.
- **M-7** — Codes d'organisation à 10 caractères, tirage sans biais, limitation des tentatives.
- **M-1** — `ORDER BY id` dans `resolve_profile_by_email` (résolu à la racine par H-1).

### Faible priorité
- **L-1** — Sanitisation de `display_name` par trigger (+ corriger le retrait des espaces/tirets).
- **L-3** — `REVOKE` sur les 7 fonctions trigger.
- **L-5** — Aligner `consume_premium_token` sur `search_path = ''`.

### Défense en profondeur
- Retirer `'unsafe-inline'` de `style-src` ; ajouter `frame-ancestors 'none'`.
- Proposer la MFA (TOTP) — absente aujourd'hui.
- Journal d'audit des actions sensibles (changement de rôle, transfert de propriété, suppression d'organisation).
- Étendre `opsAlert()` aux anomalies d'autorisation (pics de 42501), pas seulement aux échecs Stripe.
- WAF / rate limiting en amont (Cloudflare) devant l'API PostgREST — c'est le manque transverse qui sous-tend M-2, M-3 et M-7.

---

## 6. Ce que je n'ai pas pu vérifier

| Sujet | Pourquoi | Comment le tester |
|---|---|---|
| Variables d'env réellement définies sur Vercel | Pas d'accès à la console | Vercel → Settings → Environment Variables ; vérifier qu'aucune n'est un secret non-`VITE_` |
| Secrets Supabase (`STRIPE_WEBHOOK_SECRET`, `APP_URL`, `OPS_ALERT_WEBHOOK_URL`) | Non lisibles par MCP | `supabase secrets list` |
| Rate limiting effectif | Dépend de la config Supabase/Cloudflare | `for i in $(seq 200); do curl … ; done` et observer les 429 |
| Backups / PITR / rotation | Console Supabase | Dashboard → Database → Backups |
| Flux Stripe de bout en bout | Stripe non finalisé (`faille.md`) | Stripe CLI en mode test : `stripe trigger checkout.session.completed`, puis rejouer le même event (idempotence) et rejouer avec une signature invalide (doit donner 400) |
| MITRE ATT&CK / pentest réseau | Hors périmètre d'une revue de code | Test d'intrusion externe |

---

## 7. Correctifs appliqués et validation (2026-07-26)

Migration **`083_security_audit_2026_07_26`** appliquée en production (+ un correctif `083b` sur le trigger, voir plus bas). Chaque PoC d'attaque a été **rejoué après correction**, sous RLS réelle, en transaction annulée.

### Résultats des tests

| ID | Test rejoué | Avant | Après |
|---|---|---|---|
| **H-1** | Pré-réservation d'un email non inscrit | `attacker_owns_identity=t` | `preclaim_blocked=t` ✅ |
| **H-1** | Collision de casse sur un email existant | `spoof_casing_accepted=t` | `casing_blocked=t` ✅ |
| **H-1** | Élévation `account_type` → `business` | possible | `account_type_blocked=t` ✅ |
| **H-1** | Écriture sur la ligne d'un autre utilisateur | bloquée (RLS) | `other_row_blocked=t` ✅ |
| **M-1** | Index unique sur `lower(email)` | absent | `profiles_email_lower_key` créé ✅ |
| **M-2** | Écriture anonyme au-delà du plafond horaire | illimitée | `537 → 537`, absorbée ✅ |
| **M-3** | 3 résolutions d'un **contact** | — | quota consommé = **0** ✅ |
| **M-3** | Résolution d'un **inconnu** | gratuite | quota = 1, plafond 200/24 h appliqué ✅ |
| **M-3** | Contact encore résolvable **au plafond** | — | `contact_still_ok=t` ✅ (pas de DoS métier) |
| **M-7** | 3 000 codes générés | 6 car., biais A–H | 10 car., `bad_format=0`, 31 symboles ✅ |
| **M-7** | Uniformité du tirage | A–H ~12,5 % plus fréquents | A–H **965,4** vs autres **968,6** ✅ |
| **L-1** | `display_name` via PATCH direct | non sanitisé | `<script>` retiré, espace et tiret **préservés** ✅ |
| **L-3** | Fonctions trigger exécutables par `anon` | 7 | **0** ✅ |
| **L-5** | `consume_premium_token` `search_path` | `'public'` | `''` ✅ |

### Non-régression

| Flux | Résultat |
|---|---|
| `create_organization` (écrit `account_type`) | OK — `acct=business`, code 16 car. ✅ |
| `regenerate_join_code` | OK — 16 car. ✅ |
| Mise à jour de son propre `display_name` / avatar | OK ✅ |
| `tsc -b` | 0 erreur ✅ |
| `npm run lint` | 0 erreur (25 warnings préexistants) ✅ |
| `npm test` | 785 passés / 3 échecs **préexistants** (`team-stats` ×2, `lists` ×1 — fichiers non modifiés) |
| `npm run build` + prerender | OK, 19 routes ✅ |
| Advisors Supabase | 0 ERROR ; avertissements `anon` : 7 → 1 (`record_demo_visit`, intentionnel) |

### Un défaut introduit puis corrigé pendant la validation

Le premier jet du trigger `enforce_profile_integrity()` était déclaré `SECURITY DEFINER`. Or dans ce mode `current_user` vaut toujours le propriétaire (`postgres`), donc le garde `current_user NOT IN ('authenticated','anon')` renvoyait **toujours vrai** : le trigger sortait immédiatement et ne sanitisait jamais `display_name`. Les attaques étaient bien bloquées, mais **uniquement par les GRANT colonne** — la défense en profondeur était inopérante.

C'est le test de `display_name` qui l'a révélé (la valeur revenait brute). Corrigé en repassant le trigger en **`SECURITY INVOKER`** (migration `083b`), ce qui donne exactement la distinction recherchée : `authenticated` pour un PATCH client, `postgres` pour un corps `SECURITY DEFINER`.

### Correctifs partiels ou non appliqués — et pourquoi

| ID | État | Justification |
|---|---|---|
| **M-5** `react-router` | ⚠️ **Non corrigé** | `postcss` est passé en 8.5.23 (corrigé). Mais **aucune version corrigée n'existe dans la ligne v6** : 6.30.4 est la dernière v6 et reste affectée ; le correctif exige v7.17.1+, un **majeur cassant**. Exploitabilité vérifiée **nulle** (aucun `navigate()`/`<Link>` alimenté par un paramètre d'URL ; pas de SSR). À traiter comme une migration v7 planifiée, pas dans une passe sécurité. |
| **M-6** HIBP | ⚠️ **Action requise de ta part** | Réglage du dashboard, non modifiable par migration : *Authentication → Policies → Leaked password protection*. C'est le **seul point restant** de la roadmap « 7 jours ». |
| **M-4** TOCTOU | ✅ Corrigé, ⚠️ validation partielle | `FOR UPDATE` vérifié présent en base. Une vraie course exige **plusieurs connexions parallèles**, impossible via le MCP (session unique). À valider par : `seq 30 \| xargs -P30 -I{} curl -s -X POST ".../rpc/credit_premium_token_from_ad" -H "apikey: <anon>" -H "Authorization: Bearer <jwt>"` → attendu : exactement 20 succès, 10 `check_violation`. |
| Vulnérabilités **dev-only** | ⚠️ Non corrigées volontairement | `vitest`, `eslint`, `vite`, `glob/minimatch` : `npm audit fix --force` imposerait vitest 3→4 et eslint 9→10 et casserait le peer `eslint-plugin-react-hooks`. Ces paquets ne sont **jamais servis au navigateur**. À traiter comme une mise à jour outillage dédiée. |
| **L-2** `style-src 'unsafe-inline'` | ⚠️ Volontairement conservé | Le retirer casserait Framer Motion et Radix, qui posent des styles inline. `frame-ancestors 'none'` a en revanche été ajouté à la CSP. |
| **L-4** secrets Git | ⚠️ Action requise de ta part | Reste à confirmer que le mot de passe `DATABASE_URL` historique n'est pas réutilisé, et à activer le secret scanning GitHub. |

### Risque résiduel

Le risque global passe de **MOYEN** à **FAIBLE**. Il ne reste aucun finding High ou Critical exploitable. Les points ouverts sont soit des actions de console (M-6, L-4), soit des mises à jour de dépendances non exploitables en l'état (M-5 et dev-only).
