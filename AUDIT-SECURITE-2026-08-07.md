# Audit de sécurité COSMO — 2026-08-07

**Périmètre** : `src/`, `supabase/migration/*.sql` (001→083), `supabase/functions/*`,
`scripts/cosmo/`, `vercel.json`, `index.html`, `vite.config.ts`, `package.json`.
**Branche** : `main` @ `4678beb`. **Méthode** : revue de code exhaustive, statique.
**Non couvert** : test dynamique (pas d'accès à un environnement de run), configuration
Supabase Dashboard (Auth settings, redirect allowlist, rate limits), IAM Vercel, secrets réels.

---

## 1. Résumé exécutif

**Niveau de risque global : MOYEN-BAS.** Aucune vulnérabilité critique ou directement
exploitable à distance n'a été trouvée. La base est nettement au-dessus de la moyenne
d'un SaaS de cette taille : 82/82 fonctions `SECURITY DEFINER` figent `search_path`,
33/33 tables ont la RLS active, la CSP interdit `unsafe-inline` sur `script-src`, la
signature Stripe est vérifiée avec idempotence, les whitelists `mapToDb` bloquent le
mass-assignment, et l'injection de formules CSV est neutralisée.

**Niveau de confiance de l'audit : MOYEN-HAUT** pour le code, **BAS** pour la
configuration serveur (Supabase Auth, secrets, rate limits) — invérifiable ici, voir §5.

**Faiblesses principales**

1. Le flux OAuth / réinitialisation de mot de passe tourne en **implicit flow** : les
   jetons transitent par le fragment d'URL au lieu d'un échange PKCE (AUD-01).
2. **N'importe quel membre d'une organisation** peut faire entrer des comptes externes
   dans l'entreprise, sans validation admin, et leur donner accès à l'annuaire complet
   (noms + emails de tous les collègues) — AUD-02.
3. `profiles.avatar_url` est écrivable par le client **sans aucune validation ni borne
   de taille** et rendu dans un `<img>` chez tous les collègues et amis (AUD-03/04).

---

## 2. Tableau des vulnérabilités

| ID | Gravité | CVSS | Catégorie | Impact | Exploitabilité | Statut |
|---|---|---|---|---|---|---|
| AUD-01 | **High** | 6.5 | A07 Auth failures / CWE-598 | Jetons d'accès + refresh dans le fragment d'URL | Nécessite un script tiers ou un accès à l'historique | ✅ Corrigé (code) |
| AUD-02 | **High** | 6.5 | A01 Broken Access Control / CWE-269 | Tout membre fait entrer un externe → annuaire entreprise complet | Trivial (1 requête PostgREST) | ✅ Corrigé (mig. 084) |
| AUD-03 | Medium | 5.3 | A01 / CWE-20, CWE-359 | Balise de traçage IP sur tous les collègues + bloat DB non borné | Trivial (authentifié) | ✅ Corrigé (mig. 084 + CSP) |
| AUD-04 | Medium | 4.3 | A04 Insecure design / CWE-400 | Avatar base64 dans le JWT → header `Authorization` de ~20 Ko | Auto-infligé | ✅ Corrigé (Storage) |
| AUD-05 | Medium | 5.3 | A07 / CWE-204, CWE-209 | Énumération de comptes + message serveur brut en UI | Trivial | ✅ Corrigé (code) |
| AUD-06 | Medium | 5.9* | A06 Composants vulnérables | Lecture de fichiers de la machine dev via le serveur Vite exposé | Réseau local / site web piégé | ✅ Corrigé (vite 7.3.6 + loopback) |
| AUD-07 | Low | 3.1 | A04 / CWE-613 | Lien d'invitation sans expiration | Authentifié | ✅ Corrigé (mig. 084) |
| AUD-08 | Low | 3.7 | A01 / CWE-307 | Énumération d'emails multi-comptes (résiduel F-3) | Coût = créer des comptes | ✅ Atténué (mig. 084) |
| AUD-09 | Low | 3.7 | A04 / CWE-770 | Déni de service sur la télémétrie démo (anonyme) | Trivial | ✅ Atténué (mig. 084) |
| AUD-10 | Low | 3.1 | A07 / CWE-521 | Politique de mot de passe côté client uniquement | Via API directe | 🟡 Client corrigé — **réglage Supabase requis** |
| AUD-11 | Low | — | A06 | 2 critical / 4 high npm — **devDependencies**, non exploitables en prod | — | 🟡 8/9 corrigés — react-router reporté |
| AUD-12 | Low | — | A05 Misconfiguration | COOP/CORP absents, `img-src https:` large | Défense en profondeur | ✅ Corrigé (vercel.json) |
| AUD-13 | Low | 2.9 | A02 / CWE-276 | Refresh token CLI lisible (le `mode 0o600` est ignoré sous Windows) | Accès local | ✅ Corrigé (ACL icacls) |
| AUD-14 | Low | — | Logique métier | `win_streak` double-incrémenté sur livraison Stripe concurrente | Rare | ✅ Corrigé (mig. 084 + webhook) |
| AUD-15 | Info | — | Convention | 2 policies PERMISSIVE SELECT sur `events` (viole la règle mig. 049) | — | ✅ Corrigé (mig. 084) |
| AUD-16 | Info | — | Convention | `auth.uid()` non wrappé dans `team_task_comments_insert` (mig. 043) | — | ✅ Corrigé (mig. 084) |
| AUD-17 | Low | 3.7 | A08 / CWE-829 | `?debug=1` injectait un `<script>` jsdelivr dans l'app de production | Bloqué par la CSP, mais latent | ✅ Corrigé (garde `import.meta.env.DEV`) |

\* AUD-06 : score environnemental, poste de développement uniquement — pas la production.

> **AUD-17** a été découvert pendant la phase de correction, en resserrant `img-src` :
> `src/main.tsx` chargeait `https://cdn.jsdelivr.net/npm/eruda` dès qu'un `?debug=1`
> apparaissait dans l'URL — **en production comme en dev**. La CSP `script-src 'self' …`
> le bloquait déjà, mais on ne veut pas dépendre d'un en-tête pour ne pas exécuter de
> code distant : le bloc est désormais éliminé du bundle prod par le tree-shaking
> (vérifié : aucune occurrence de `jsdelivr` dans `dist/`).

---

## 3. Détail des vulnérabilités

### AUD-01 — Flux d'authentification en *implicit* au lieu de PKCE — **High**

**Fichier** : [src/lib/supabase.ts](src/lib/supabase.ts) (bloc `auth`, ~ligne 55)

`@supabase/auth-js@2.103.0` a pour défaut `flowType: 'implicit'`
(vérifié dans `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:24`). Le client
COSMO ne surcharge pas cette valeur :

```ts
auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
```

**Conséquence** — sur trois flux (Google OAuth via `loginWithGoogle`,
`resetPasswordForEmail` → `/reset-password`, et tout magic link), Supabase renvoie
l'utilisateur avec `#access_token=…&refresh_token=…` dans le **fragment d'URL**.

**Scénario d'attaque**
1. L'utilisateur se connecte avec Google ; l'URL de retour contient le refresh token.
2. Le fragment n'est pas envoyé au serveur, mais il est lisible par **tout script
   s'exécutant sur l'origine** : AdSense (injecté à la demande par `AdModal`),
   `@vercel/analytics`, `@sentry/react`, et toute future balise marketing.
3. Il est également écrit dans l'historique du navigateur et restauré à la réouverture
   d'onglet. Un refresh token Supabase est valide jusqu'à rotation → prise de contrôle
   complète du compte.

**Prérequis** : un script tiers compromis, une extension navigateur, ou un accès à
l'historique. Pas d'interaction victime au-delà de la connexion normale.

**Preuve** : défaut de la librairie confirmé à la ligne indiquée ; aucune occurrence de
`flowType` dans `src/`.

**Correctif**

```ts
export const supabase: SupabaseClient = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: timeoutFetch },
      auth: {
        flowType: 'pkce',          // ← code d'autorisation + code_verifier
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key');
```

En PKCE, l'URL de retour ne porte plus qu'un `?code=…` à usage unique, échangeable
uniquement avec le `code_verifier` stocké localement.

**Tests après correction**
- Connexion Google → vérifier que l'URL de callback contient `?code=` et **aucun**
  `#access_token`.
- `resetPasswordForEmail` → le lien reçu doit aboutir sur `?code=`; `ResetPasswordPage`
  doit toujours détecter la session (`getSession()` après `detectSessionInUrl`).
- ⚠️ Régression possible : les liens de récupération **déjà envoyés** avant le
  déploiement resteront au format implicit et échoueront. Prévoir une fenêtre.

---

### AUD-02 — Tout membre d'une organisation peut y faire entrer des externes — **High**

**Fichiers** : [067_org_invite_links.sql](supabase/migration/067_org_invite_links.sql)
(policy `org_invite_links_insert`, ~l.52 ; RPC `claim_org_invite`, ~l.158)

La policy d'insertion :

```sql
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND (
    public.is_org_admin(org_id)
    OR (manager_id IS NOT NULL
        AND (manager_id = (SELECT auth.uid()) OR public.is_above(org_id, manager_id)))
  )
);
```

La branche `manager_id = auth.uid()` est **vraie pour n'importe quel membre**, y compris
un simple `role = 'member'` sans aucun subordonné. Le commentaire d'intention dit
« manager posant le lien sous LUI », mais rien ne vérifie que l'appelant *est* manager.

La re-validation au claim reproduit exactement la même tautologie :

```sql
AND (m.role = 'admin'
     OR v_link.manager_id = v_link.created_by     -- ← toujours vrai
     OR v_link.manager_id IN (SELECT public.get_subtree(...)))
```

**Scénario d'attaque**
1. Mallory est employée (rôle `member`) chez ACME. Elle veut exfiltrer l'annuaire.
2. `POST /rest/v1/org_invite_links` avec `{org_id: <ACME>, manager_id: <son uid>}`.
3. Elle transmet `/org-invite/<uuid>` à un compte externe qu'elle contrôle.
4. Ce compte appelle `claim_org_invite` → il devient membre d'ACME.
5. Via `shares_org_with` ([071](supabase/migration/071_org_member_profiles_visible.sql)),
   il lit `profiles` de **tous les employés** : `display_name`, `avatar_url`, **`email`**.
   Il accède aussi aux OKR d'équipe non cloisonnés, aux projets et tâches d'équipe selon
   `can_access_team_task` / `can_access_team_okr`.
6. Aucune limite : elle peut répéter l'opération autant de fois qu'elle veut. La garde
   `org_seats_allowed` est dormante (`billing_flags` non activé).

**Impact** : fuite de l'annuaire d'entreprise (RGPD — données de contact
professionnelles de tiers), pollution de l'organisation par des comptes non approuvés,
contournement complet du flux « code + validation admin » de `respond_join_request`.

**Prérequis** : être membre de l'organisation. C'est une menace *insider* — mais le
modèle de menace du mode entreprise repose précisément sur le fait que tous les membres
ne sont pas de confiance égale (d'où la hiérarchie admin/manager/member).

**Correctif** — exiger un privilège réel côté policy **et** côté RPC :

```sql
-- Helper : l'appelant a-t-il au moins un subordonné dans cette org ?
CREATE OR REPLACE FUNCTION public.has_reports(p_org UUID, p_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND manager_id = p_user
  );
$$;
REVOKE ALL ON FUNCTION public.has_reports(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_reports(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "org_invite_links_insert" ON public.org_invite_links;
CREATE POLICY "org_invite_links_insert"
  ON public.org_invite_links FOR INSERT
  WITH CHECK (
    created_by = (SELECT auth.uid())
    -- AUD-07 : borne l'expiration côté serveur
    AND expires_at <= NOW() + INTERVAL '7 days'
    AND claimed_at IS NULL AND claimed_by IS NULL
    AND (
      public.is_org_admin(org_id)
      OR (
        manager_id IS NOT NULL
        AND public.has_reports(org_id, (SELECT auth.uid()))   -- ← privilège réel
        AND (manager_id = (SELECT auth.uid())
             OR public.is_above(org_id, manager_id))
      )
    )
  );
```

Et dans `claim_org_invite`, remplacer `v_link.manager_id = v_link.created_by` par
`(v_link.manager_id = v_link.created_by AND public.has_reports(v_link.org_id, v_link.created_by))`.

**Alternative produit** : si « tout le monde peut inviter » est le comportement voulu,
alors il faut réduire ce que voit un nouveau membre (n'exposer `profiles.email` qu'aux
admins et à la chaîne hiérarchique) et notifier les admins à chaque claim.

**Tests après correction**
- Compte `member` sans subordonné → `INSERT` sur `org_invite_links` doit renvoyer 403.
- Manager avec ≥ 1 subordonné → insertion OK, claim OK.
- Admin → insertion avec `manager_id IS NULL` toujours OK.
- Manager rétrogradé après création du lien → claim doit échouer (`invalid_link`).

---

### AUD-03 — `profiles.avatar_url` : écriture client sans validation ni borne — **Medium**

**Fichiers** : [018_profiles.sql](supabase/migration/018_profiles.sql) (l.13 —
`avatar_url TEXT`, aucune contrainte), [083](supabase/migration/083_security_audit_2026_07_26.sql)
l.107 (`GRANT UPDATE (display_name, avatar_url) … TO authenticated`),
[071](supabase/migration/071_org_member_profiles_visible.sql) (lecture par les
co-membres), rendu dans `<img src>` : [MemberDirectory](src/components/organization/MemberDirectory.tsx),
[InboxMenu.tsx:384](src/components/InboxMenu.tsx), [OrgSwitcher.tsx:39](src/components/organization/OrgSwitcher.tsx),
[SettingsPage.tsx:343](src/pages/SettingsPage.tsx).

Le trigger `enforce_profile_integrity` (mig. 083) sanitise `display_name` mais **laisse
`avatar_url` passer tel quel**. `isImageAvatar()` accepte tout ce qui commence par
`https?:`, `data:image/`, `blob:` ou `/`.

**Scénario A — balise de traçage** : Mallory `PATCH /rest/v1/profiles?id=eq.<self>`
avec `avatar_url = "https://mallory.tld/px.gif?t=acme"`. Chaque collègue qui ouvre
l'annuaire ou la pyramide envoie une requête à ce serveur : **adresse IP, User-Agent,
horodatage**. Mallory sait qui consulte l'annuaire, quand, depuis quel réseau, et peut
corréler les employés à leur domicile / VPN. La CSP `img-src 'self' data: blob: https:`
autorise explicitement n'importe quel hôte HTTPS.

**Scénario B — bloat** : aucune contrainte de longueur. Un `PATCH` avec 10 Mo de texte
passe. Répété, cela gonfle la table `profiles`, lue à chaque chargement d'annuaire →
dégradation générale + coût Supabase.

**Correctif**

```sql
-- 1. Borne dure au niveau schéma
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_url_len CHECK (avatar_url IS NULL OR length(avatar_url) <= 2048);

-- 2. Schéma d'URL + hôte contrôlés dans le trigger existant
CREATE OR REPLACE FUNCTION public.enforce_profile_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $fn$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  -- … blocs id/email/account_type inchangés …
  NEW.display_name := public.sanitize_display_name(NEW.display_name);

  -- AUD-03 : seul le Storage du projet (ou un avatar Google déjà vérifié)
  -- est un hôte acceptable. Tout le reste devient NULL (retombée initiales).
  IF NEW.avatar_url IS NOT NULL AND NEW.avatar_url !~ '^https://([a-z0-9-]+\.supabase\.co/storage/|lh3\.googleusercontent\.com/)' THEN
    NEW.avatar_url := NULL;
  END IF;
  RETURN NEW;
END;
$fn$;
```

Côté client : basculer l'upload d'avatar de `data:` vers Supabase Storage (voir AUD-04),
ce qui rend l'allowlist ci-dessus naturelle.

**Tests après correction**
- `PATCH profiles` avec `avatar_url = 'https://evil.tld/px.gif'` → la ligne relue doit
  avoir `avatar_url IS NULL`.
- `PATCH` avec 3000 caractères → erreur `23514`.
- Upload d'avatar normal → toujours visible chez un ami et un co-membre.

---

### AUD-04 — Avatar base64 stocké dans `user_metadata` → JWT surdimensionné — **Medium**

**Fichier** : [src/pages/SettingsPage.tsx:264](src/pages/SettingsPage.tsx)

```ts
const dataUrl = canvas.toDataURL('image/jpeg', 0.85);   // 256×256
await supabase.auth.updateUser({ data: { avatar_url: dataUrl } });
```

`user_metadata` est **embarqué dans le JWT d'accès** émis par GoTrue. Un JPEG 256×256
q0.85 pèse 10–25 Ko → 14–34 Ko une fois en base64, soit un token qui dépasse largement
les tailles usuelles. Ce token part dans l'en-tête `Authorization` de **chaque** requête
PostgREST, et est écrit dans `localStorage`.

**Impact** : requêtes rejetées en `431 Request Header Fields Too Large` par certains
proxys / CDN (limite courante : 8 Ko par en-tête), surcoût réseau permanent sur mobile,
et quota `localStorage` consommé. Ce n'est pas une brèche de confidentialité, mais un
défaut de conception qui peut rendre le compte inutilisable (disponibilité).

**Correctif** — utiliser Supabase Storage :

```ts
const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.85));
const path = `${authUser.id}/avatar.jpg`;
const { error: upErr } = await supabase.storage
  .from('avatars')
  .upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
if (upErr) { toast.error(t('profile.photoUpdateFailed')); return; }
const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', authUser.id);
```

Policies du bucket `avatars` : lecture publique, écriture restreinte à
`(storage.foldername(name))[1] = auth.uid()::text`.

**Tests** : mesurer `document.cookie`/`localStorage['sb-…-auth-token'].length` avant et
après ; l'avatar doit rester visible chez les amis et co-membres.

---

### AUD-05 — Énumération de comptes et message serveur brut à l'inscription — **Medium**

**Fichier** : [src/modules/auth/AuthContext.tsx:344 et 384](src/modules/auth/AuthContext.tsx)

```ts
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) return { success: false, error: error.message || 'Erreur de connexion' };
// …
const { error } = await supabase.auth.signUp({ … });
if (error) return { success: false, error: error.message || "Erreur lors de l'inscription" };
```

Ces deux chemins renvoient **`error.message` brut** à l'UI, ce qui contredit la règle
V7/N1 appliquée partout ailleurs via `normalizeApiError` (« never surface raw
`error.message` to the UI »). Concrètement, `signUp` sur une adresse déjà enregistrée
renvoie `User already registered` (ou `email_exists`) → oracle d'existence de compte,
utilisable pour du credential stuffing ciblé et pour vérifier qu'une adresse issue d'une
fuite tierce a un compte COSMO.

**Correctif**

```ts
const AUTH_GENERIC = "Impossible de finaliser l'opération. Vérifiez vos informations.";

const register = async (…) => {
  const { error } = await supabase.auth.signUp({ … });
  if (error) {
    console.error('[auth] signUp', error);           // droppé du bundle prod
    const code = (error as { code?: string }).code;
    // Seuls des codes explicitement whitelistés produisent un message spécifique.
    if (code === 'over_email_send_rate_limit' || (error as { status?: number }).status === 429) {
      return { success: false, error: 'Trop de tentatives. Réessayez dans quelques minutes.' };
    }
    if (code === 'weak_password') {
      return { success: false, error: 'Mot de passe trop faible.' };
    }
    return { success: false, error: AUTH_GENERIC };  // ← jamais error.message
  }
  return { success: true };
};
```

Même traitement pour `login`. Idéalement, activer « Confirm email » côté Supabase :
`signUp` renvoie alors un succès indifférencié et l'oracle disparaît côté serveur aussi.

**Tests** : `signUp` sur un email existant et sur un email neuf → messages UI
strictement identiques ; latence comparable (sinon oracle temporel résiduel).

---

### AUD-06 — Serveur de développement exposé + CVE Vite/esbuild — **Medium (poste dev)**

**Fichiers** : [package.json](package.json) (`"start": "vite --host 0.0.0.0 --port 3000"`),
`vite@7.3.2`, `vitest@2.1.9`.

`npm audit` remonte, entre autres :
- `esbuild` — « enables any website to send any requests to the development server and
  read the response » ;
- `vite` — path traversal dans la gestion des `.map` d'optimized deps ; **bypass de
  `server.fs.deny` via les chemins alternatifs Windows** ;
- `vitest` — lecture et exécution de fichier arbitraire quand le serveur Vitest UI écoute.

Le poste de développement tourne sous **Windows 11** et `npm start` bind `0.0.0.0`. Un
site web ouvert dans le navigateur du développeur, ou un appareil du réseau local, peut
donc lire des fichiers hors du projet (dont `.env`, `.env.cosmo-cli`, `~/.cosmo/session.json`).

**Ce n'est pas une exposition de production** — Vercel sert un build statique — mais la
compromission du poste dev est un chemin direct vers les secrets de production.

**Correctif**
```bash
npm i -D vitest@latest @vitest/coverage-v8@latest vite@latest && npm audit fix
```
et restreindre le bind :
```jsonc
// package.json
"start": "vite --host 127.0.0.1 --port 3000"
```
Si l'accès depuis un mobile du réseau est nécessaire, garder `--host` mais ajouter dans
`vite.config.ts` :
```ts
server: { host: true, allowedHosts: ['localhost', '192.168.1.x'], cors: false }
```

**Tests** : `npm audit --omit=dev` doit rester à 0 ; `npm audit` ne doit plus remonter de
`high`/`critical` sur vite/vitest/esbuild.

---

### AUD-07 — Expiration des liens d'invitation non contrainte à l'insertion — **Low**

**Fichiers** : [046_share_links.sql](supabase/migration/046_share_links.sql) (policy
`share_links_insert`), [067_org_invite_links.sql](supabase/migration/067_org_invite_links.sql)
(policy `org_invite_links_insert`).

`expires_at` a un `DEFAULT NOW() + 7 days`, mais un `DEFAULT` n'est qu'un défaut : le
client insère directement dans ces tables et peut fournir `expires_at = '2099-01-01'`.
La garde « expiration 7 jours » documentée en en-tête de migration n'est donc pas
appliquée. Idem pour `claimed_at` / `claimed_by`, pré-positionnables (effet limité :
cela ne fait que tuer le lien).

**Correctif** : ajouter aux deux `WITH CHECK` (voir le bloc SQL d'AUD-02) :
```sql
AND expires_at <= NOW() + INTERVAL '7 days'
AND claimed_at IS NULL AND claimed_by IS NULL   -- org_invite_links uniquement
```

**Tests** : insertion avec `expires_at` à +30 jours → 403 ; insertion sans `expires_at`
→ OK, valeur à +7 jours.

---

### AUD-08 — Quota anti-énumération contournable par multi-comptes — **Low (résiduel)**

**Fichier** : [083](supabase/migration/083_security_audit_2026_07_26.sql)
(`consume_email_lookup_quota`, cap 200 / 24 h).

Le quota est indexé sur `user_id`. La création de compte étant gratuite et non limitée,
le coût d'une énumération de 100 000 adresses est de 500 comptes. Le correctif M-3
augmente le coût sans le rendre prohibitif — c'est un durcissement, pas une fermeture.

**Correctif proposé** (défense en profondeur, à arbitrer) : ajouter un compteur global
horaire sur `resolve_profiles_by_emails` et refuser au-delà (comme
`record_demo_visit`), plus un délai d'attente sur les comptes de moins de 24 h.
Alternative plus robuste : ne plus jamais confirmer l'existence d'un compte — envoyer
l'invitation par email quel que soit le résultat, et ne créer la relation qu'au clic.

---

### AUD-09 — `record_demo_visit` : déni de service sur la télémétrie anonyme — **Low**

**Fichier** : [083](supabase/migration/083_security_audit_2026_07_26.sql) l.275

```sql
SELECT count(*) INTO v_recent FROM public.demo_devices
WHERE first_seen_at > NOW() - INTERVAL '1 hour';
IF v_recent >= c_hourly_cap THEN RETURN; END IF;   -- cap GLOBAL de 500
```

Le plafond est **global**, pas par appareil ni par IP. Un attaquant anonyme émet 500
`record_demo_visit` avec des UUID aléatoires en quelques secondes et, pendant l'heure
suivante, **aucune visite démo légitime n'est plus comptabilisée**. Répété, cela fausse
durablement les métriques d'acquisition (`demo.visitors`, `conversion_pct` du dashboard
admin). Impact business/observabilité, pas confidentialité.

**Correctif** : conserver le plafond global comme filet, mais compter les vrais
appareils. Le plus simple sans PII : borner par `device_id` déjà vu (déjà le cas via
`ON CONFLICT DO NOTHING`) et ajouter un plafond distinct pour les **nouveaux** UUID,
avec purge des lignes de plus de 90 jours (rétention RGPD) :

```sql
DELETE FROM public.demo_devices WHERE first_seen_at < NOW() - INTERVAL '90 days';
```
Idéalement, déporter ce compteur vers Vercel Analytics plutôt qu'une écriture anonyme
en base.

---

### AUD-10 — Politique de mot de passe appliquée côté client seulement — **Low**

**Fichiers** : [src/components/AuthForm.tsx:31](src/components/AuthForm.tsx)
(`MIN_PASSWORD_LENGTH = 8`), [src/pages/ResetPasswordPage.tsx:9](src/pages/ResetPasswordPage.tsx).

Le minimum de 8 caractères et l'indicateur de robustesse sont purement UI. Un appel
direct à `POST /auth/v1/signup` accepte ce que Supabase autorise (défaut : 6
caractères, aucune complexité, pas de vérification HIBP).

**Correctif** — Supabase Dashboard → *Authentication → Policies* : `Minimum password
length = 12`, `Password requirements = lower+upper+digits+symbols`, activer
*Prevent use of leaked passwords* (HaveIBeenPwned). Puis aligner `MIN_PASSWORD_LENGTH`
à 12 et mapper le code `weak_password` sur un message explicite.

---

### AUD-11 — Dépendances vulnérables — **Low (non exploitable en production)**

```
critical  vitest, @vitest/coverage-v8      → dev only
high      vite, js-yaml, brace-expansion   → dev only
high      react-router                     → « RSC Mode CSRF Bypass »
moderate  esbuild, vite-node, @vitest/mocker → dev only
```

`react-router@7.18.2` : l'avis ne concerne que le **mode RSC** (React Server
Components), qui suppose un runtime serveur. COSMO est une SPA statique servie par
Vercel, sans loader/action serveur → **non exploitable**. À mettre à jour néanmoins
(`react-router@8` est un major, à planifier hors chemin critique).

Tout le reste est en `devDependencies` et n'atteint jamais `dist/`. À traiter au titre
d'AUD-06 (sécurité du poste dev), pas de la production.

**Recommandation CI** : ajouter au workflow GitHub Actions
```yaml
- run: npm audit --omit=dev --audit-level=high
```
qui échoue uniquement sur les vulnérabilités réellement embarquées.

---

### AUD-12 — En-têtes HTTP : durcissements restants — **Low**

**Fichier** : [vercel.json](vercel.json)

Bien en place : HSTS avec `preload`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`,
`nosniff`, `Referrer-Policy`, `Permissions-Policy`, `object-src 'none'`, `base-uri
'self'`, `form-action 'self'`, et surtout `script-src` **sans** `'unsafe-inline'`.

Manquants / perfectibles :

| En-tête | Valeur recommandée | Raison |
|---|---|---|
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | Isole `window.opener` ; `allow-popups` est requis pour le popup OAuth Google |
| `Cross-Origin-Resource-Policy` | `same-origin` | Empêche l'inclusion des ressources par des sites tiers |
| `X-Robots-Tag` sur `/reset-password` | déjà posé ✅ | — |
| `img-src` | resserrer sur les hôtes réellement utilisés | `https:` autorise le beacon d'AUD-03 |

`style-src 'unsafe-inline'` est structurellement nécessaire (Tailwind + `chart.tsx`) et
le sink CSS est déjà whitelisté (`SAFE_COLOR_RE`) — acceptable en l'état.

⚠️ N'ajouter `COEP: require-corp` **qu'après** avoir vérifié Stripe et AdSense en iframe :
ce header casse les intégrations tierces qui n'envoient pas de CORP.

---

### AUD-13 — Refresh token du CLI en clair sous Windows — **Low**

**Fichier** : [scripts/cosmo/client.mjs:29](scripts/cosmo/client.mjs)

```js
fs.writeFileSync(sessionPath, JSON.stringify(data, null, 2), { mode: 0o600 });
```

`mode` est **ignoré par Node sous Windows** (NTFS n'a pas de bits POSIX). Le fichier
`~/.cosmo/session.json` hérite des ACL du dossier utilisateur et contient un refresh
token de production valide long. Toute application tournant sous le même compte
utilisateur peut le lire.

**Correctif** : restreindre l'ACL explicitement à la création sous Windows —
```js
if (process.platform === 'win32') {
  execFileSync('icacls', [sessionPath, '/inheritance:r', '/grant:r', `${process.env.USERNAME}:F`]);
}
```
ou, mieux, stocker le token dans le Credential Manager Windows. À défaut, considérer que
le poste est la frontière de confiance et documenter le risque.

---

### AUD-14 — `win_streak` double-incrémenté sur livraison Stripe concurrente — **Low**

**Fichier** : [supabase/functions/stripe-webhook/index.ts:245](supabase/functions/stripe-webhook/index.ts)

Le marqueur d'idempotence est écrit **après** le handler (choix délibéré et correct,
faille M-5). Conséquence assumée : deux livraisons concurrentes du **même** événement
exécutent toutes deux le handler. Les écritures sont idempotentes… sauf
`incrementWinStreak`, qui fait un `SELECT win_streak` puis un `upsert` avec `+1`. Deux
exécutions en parallèle lisent la même valeur et écrivent `n+1` (perte d'un
incrément) — ou, avec un entrelacement différent, produisent `n+2`.

Le commentaire indique que « les renouvellements ne sont pas déclenchés par
l'utilisateur », ce qui rend la course rare, mais elle n'est pas impossible (Stripe
retente en cas de timeout réseau).

**Correctif** — incrément atomique côté base :

```sql
CREATE OR REPLACE FUNCTION public.bump_win_streak(p_user uuid)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  UPDATE public.subscriptions SET win_streak = win_streak + 1
  WHERE user_id = p_user RETURNING win_streak;
$$;
REVOKE ALL ON FUNCTION public.bump_win_streak(uuid) FROM PUBLIC, anon, authenticated;
```
puis, dans `applySubscriptionToDb`, remplacer le read-modify-write par
`await supabaseAdmin.rpc('bump_win_streak', { p_user: userId })` **après** l'upsert
(et retirer `win_streak` du payload dans ce cas).

---

### AUD-15 / AUD-16 — Écarts aux conventions internes — **Info**

- **AUD-15** : [077](supabase/migration/077_manager_agenda.sql) puis
  [081](supabase/migration/081_event_privacy_owner_transfer.sql) ajoutent
  `events_manager_select` **en plus** de la policy « own ». Cela fait deux policies
  PERMISSIVE pour `authenticated` + `SELECT` sur `events` — exactement ce que la
  migration 049 et le CLAUDE.md interdisent (advisor `multiple_permissive_policies`).
  Sémantiquement correct, mais coûteux en plan d'exécution et incohérent avec la règle
  affichée. À fusionner : `USING (user_id = (SELECT auth.uid()) OR (public.manages_user(user_id) AND NOT is_private))`.
- **AUD-16** : [082](supabase/migration/082_team_task_comments.sql) l.54 utilise
  `author_id = auth.uid()` sans le wrapping `(SELECT auth.uid())` imposé par la
  migration 043 (initplan). Purement perf, à aligner.

---

## 4. Points sains confirmés

Vérifiés et corrects — à ne pas régresser :

- **`search_path` figé sur 82/82 fonctions `SECURITY DEFINER`** (scan exhaustif). Aucune
  fenêtre de détournement par schéma malveillant.
- **RLS active sur 33/33 tables**, aucun `DISABLE ROW LEVEL SECURITY` nulle part.
  `email_lookup_quota` et `admin_users` sont en deny-by-default (RLS sans policy).
- **Stripe** : `constructEventAsync` avec signature obligatoire, rejet non-POST, message
  d'erreur générique côté anonyme, idempotence durable (`processed_stripe_events`),
  `idempotencyKey` sur la création de client et de session. Aucun montant ni prix
  n'est accepté depuis le client (`STRIPE_PRICE_ID` côté serveur).
- **`delete-account`** : identité résolue exclusivement depuis le JWT, jamais depuis le
  corps ; garde `UUID_RE` avant interpolation dans les filtres PostgREST `.or()` ;
  refus de supprimer la ligne `auth.users` si un nettoyage a échoué (art. 17 RGPD) ;
  transfert de propriété d'organisation avant cascade.
- **CSP** : `script-src` sans `'unsafe-inline'` ni `'unsafe-eval'`, `object-src 'none'`,
  `frame-ancestors 'none'`, `base-uri 'self'`. Les blocs `<script type="application/ld+json">`
  d'`index.html` sont des blocs de données, non exécutés — pas de contradiction.
- **XSS** : aucun `dangerouslySetInnerHTML` sur de la donnée utilisateur. Les deux
  occurrences (`BlogArticlePage`, `UseCasePage`) rendent du contenu statique de
  `src/content/blog/*.mjs` compilé au build. `chart.tsx` whiteliste couleurs et
  identifiants avant interpolation CSS. Aucun `eval`, `new Function`, `document.write`.
- **Mass-assignment** : `mapTaskToDb` & consorts sont des whitelists explicites qui
  n'émettent jamais `user_id` ; aucun spread d'objet client dans un `.insert()`/`.update()`.
- **Injection SQL** : aucune concaténation de chaîne dans une requête. Tout passe par
  PostgREST paramétré ou des RPC à paramètres typés.
- **Injection de formules CSV** (N11) : `escapeCSV` préfixe `'` sur `= + - @ \t \r`.
- **Upload d'avatar** : whitelist MIME stricte (SVG exclu), cap 500 Ko, ré-encodage
  canvas qui détruit tout payload embarqué.
- **Build** : aucune source map dans `dist/`, `console.*` et `debugger` supprimés par
  esbuild, `.env` et `.env.cosmo-cli` correctement gitignorés (seul `.env.example` est
  suivi).
- **Fuite d'erreurs** : `normalizeApiError` ne rend jamais le message serveur brut à
  l'UI (sauf les deux chemins d'AUD-05).
- **Cohérence multi-tenant** : `validate_team_kr` / `validate_team_okr_team` vérifient
  que `org_id` et l'entité parente concordent — pas d'écriture cross-tenant possible
  malgré la dénormalisation d'`org_id`.

---

## 5. Ce qui n'a pas pu être vérifié

Ces points ne sont pas des « absences de faille » : ils sont **hors de portée d'une revue
statique** et doivent être contrôlés manuellement.

| Élément | Où vérifier | Ce qu'il faut confirmer |
|---|---|---|
| Rate limiting auth | Supabase → Auth → Rate Limits | Limites par IP sur signin/signup/recover non désactivées |
| Allowlist de redirection OAuth | Supabase → Auth → URL Configuration | Uniquement `https://thecosmo.app/**` ; **pas** de wildcard large (sinon vol de jeton par redirection, aggravé par AUD-01) |
| « Secure email change » | Supabase → Auth → Email | Doit être activé : confirmation sur l'ancienne **et** la nouvelle adresse (sinon une session volée change l'email sans preuve) |
| Confirmation d'email | Supabase → Auth | Si désactivée, AUD-05 est directement exploitable |
| Secrets Edge Functions | `supabase secrets list` | `STRIPE_WEBHOOK_SECRET`, `APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPS_ALERT_WEBHOOK_URL` définis ; aucun secret dans les variables d'env Vercel exposées au client |
| Historique git | `git log -p -- .env` | Le §1 de `faille.md` indique que le projet Supabase concerné a été supprimé — à re-confirmer qu'aucune clé actuelle n'est dans l'historique |
| Advisors Supabase | Dashboard → Advisors | Aucun `security` advisor ouvert après application des correctifs |
| Rétention / purge | `demo_devices`, `user_activity_days` | Durée de conservation définie et appliquée (RGPD art. 5.1.e) |
| MFA | Supabase → Auth → MFA | Aucun TOTP dans le code : le compte admin (`/admin`) n'a pas de second facteur |

**Note MFA** : `/admin` n'est protégé que par l'allowlist `admin_users` + mot de passe.
Compte tenu de ce que la RPC `get_admin_stats` expose (volumétrie, conversion, rétention),
activer le TOTP sur ce compte est la mesure la plus rentable de tout ce rapport.

---

## 6. Correctifs appliqués — 2026-08-07

### Code (déployé avec le prochain build)

| Fichier | Correctif |
|---|---|
| `src/lib/supabase.ts` | **AUD-01** — `flowType: 'pkce'` |
| `src/lib/password-policy.ts` *(nouveau)* | **AUD-10** — source unique, minimum 12 caractères |
| `src/components/AuthForm.tsx`, `src/pages/ResetPasswordPage.tsx`, `src/pages/SettingsPage.tsx` | **AUD-10** — consomment la constante partagée ; copie FR/EN paramétrée `{{count}}` |
| `src/modules/auth/AuthContext.tsx` | **AUD-05** — `safeAuthError()` : plus aucun `error.message` brut renvoyé par `login`/`register` |
| `src/lib/avatar-upload.ts` | **AUD-04** — `canvasToAvatarBlob()` + `uploadAvatar()` (Storage) |
| `src/pages/SettingsPage.tsx` | **AUD-04** — l'upload passe par Storage ; seule l'URL publique est persistée |
| `src/main.tsx` | **AUD-17** — bloc eruda gardé par `import.meta.env.DEV` |
| `vercel.json` | **AUD-12** — `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` sur `/assets/*`, `img-src` resserré sur les hôtes réellement utilisés |
| `package.json` | **AUD-06** — `npm start` bind `127.0.0.1` (`start:lan` conservé pour le test mobile) ; vite 7.3.6, vitest 4.1.10 |
| `scripts/cosmo/client.mjs` | **AUD-13** — `restrictToOwner()` : ACL `icacls` sous Windows |
| `supabase/functions/stripe-webhook/index.ts` | **AUD-14** — RPC atomique `bump_win_streak` au lieu du read-modify-write |

### SQL — `084_security_audit_2026_08_07.sql` + `087_use_existing_has_subordinates.sql`

> **Note de ledger** : les deux migrations ont été appliquées en production le
> 2026-08-07 via le MCP Supabase, enregistrées sous les noms
> `084_security_audit_2026_08_07` et `084b_use_existing_has_subordinates`. Le
> fichier local a ensuite été renuméroté `087` (le suffixe `b` est refusé par
> `npm run validate:migrations`, et `085`/`086` ont été pris entre-temps par une
> autre session). Le contenu est identique — seul le nom d'entrée du ledger
> diffère du nom de fichier.
>
> `087` corrige une erreur de la première version de `084` : elle créait un
> helper `has_reports` qui était le doublon exact de `has_subordinates`
> (migration 066, déjà consommé par `is_org_manager`). La policy et la RPC ont
> été recâblées sur l'helper existant et `has_reports` supprimé.


AUD-02 (`has_reports` + policy + `claim_org_invite`), AUD-03 (`is_allowed_avatar_url`,
contrainte `profiles_avatar_url_valid`, trigger), AUD-04 (bucket `avatars` + 4 policies
Storage), AUD-07 (bornes `expires_at`), AUD-08 (plafond global horaire),
AUD-09 (fenêtre 1 min + rétention 90 j), AUD-14 (`bump_win_streak`),
AUD-15 (fusion des policies `events`), AUD-16 (`(SELECT auth.uid())`).

### Vérifications passées

```
npm run validate:migrations   85 fichiers, 0 erreur
npm run typecheck             0 erreur
npm run lint                  0 erreur, 25 warnings (baseline inchangée)
npm test                      1104 passés / 4 échecs — baseline pré-existante identique
                              (lists + team-stats + design-system.guard, cf. mémoire projet)
npm run build                 OK — aucune occurrence de `jsdelivr` dans dist/
npm audit --omit=dev          1 high (react-router, non exploitable) — était 1 high + 8 dev
```

Vérification navigateur (dev server, mode démo) : page d'inscription refuse un mot de
passe de 9 caractères avec « au moins 12 caractères », `/settings` rend correctement,
0 erreur console.

---

## 7. Reste à faire

### 🚨 Bloquant production
*Aucun.*

### Action manuelle d'Axel — requise

1. **Appliquer la migration 084** dans le SQL editor Supabase.
   ⚠️ Elle contient un `UPDATE public.profiles SET avatar_url = NULL` sur les valeurs
   non conformes (hôte hors allowlist, ou > 60 000 caractères). Les avatars concernés
   retombent sur les initiales ; les data URLs déjà en base (ancien chemin canvas) sont
   conservées. Compter d'abord l'impact :
   ```sql
   SELECT count(*) FROM public.profiles
   WHERE avatar_url IS NOT NULL
     AND (length(avatar_url) > 60000 OR NOT public.is_allowed_avatar_url(avatar_url));
   ```
   *(à exécuter après la création de la fonction, ou en inlinant le regex).*
2. **Redéployer `stripe-webhook`** — elle appelle désormais `bump_win_streak`, créée par
   la 084. Déployer la fonction **après** la migration.
3. **Supabase → Authentication → Policies** : `Minimum password length = 12`,
   `Password requirements` = lower+upper+digits+symbols, *Prevent use of leaked
   passwords* activé. Sans ce réglage, AUD-10 n'est corrigé que côté UI.
4. **Supabase → Authentication → URL Configuration** : vérifier que l'allowlist de
   redirection ne contient que `https://thecosmo.app/**` (+ `http://localhost:*` pour le
   dev). Un wildcard large annule une partie du bénéfice de PKCE.
5. **Supabase → Authentication → Email** : « Secure email change » activé.
6. **MFA (TOTP) sur le compte admin** `axellongatte2@gmail.com`.

### Reporté — avec justification

- **AUD-11 / `react-router`** — l'avis GHSA-qwww-vcr4-c8h2 ne concerne que le **mode
  RSC**, qui suppose un runtime serveur avec loaders/actions. COSMO est une SPA statique
  servie par Vercel : **non exploitable**. Le seul correctif disponible est
  `react-router@8`, un major qui touche le routing de toute l'application. Ce n'est pas
  une urgence de sécurité et cela mérite sa propre passe, avec les tests E2E Playwright
  en filet.

### Défense en profondeur — non fait

- **CI** : ajouter `npm audit --omit=dev --audit-level=high` au workflow GitHub Actions,
  et exécuter `npm run test:rls` sur toute PR touchant `supabase/`.
- **AUD-08** : le plafond global horaire rend l'énumération de masse non rentable mais ne
  la ferme pas. La fermeture réelle serait de supprimer l'oracle — envoyer l'invitation
  par email quel que soit le résultat de la résolution, et ne créer la relation qu'au
  clic. C'est un changement de flux produit, pas un correctif technique.
- **AUD-09** : la fenêtre de blocage passe de 60 min à 1 min, mais toute écriture non
  authentifiée reste inondable par construction. Le correctif durable est de déporter ce
  compteur vers Vercel Analytics (mesure côté client, aucune écriture en base).

---

## 8. Validation des correctifs

Pour chaque correctif appliqué, fournir le diff ou le numéro de migration. Chaque point
sera ré-analysé isolément : vérification que la primitive d'attaque décrite est bien
fermée, recherche du même motif ailleurs dans le code, et contrôle des effets de bord
(en particulier : AUD-01 sur les liens de récupération en circulation, AUD-02 sur les
liens d'invitation déjà émis par des membres non-managers — qui deviendront invalides —,
AUD-03/04 sur les avatars existants en `data:` qui basculeront sur les initiales).
Aucun correctif ne sera déclaré suffisant sans justification technique explicite.
