# Déploiement & Runbook — COSMO

Procédures opérationnelles : déployer, appliquer une migration DB, rollback,
réagir à un incident. À lire avant toute mise en prod.

> Sécurité des secrets & rotation : voir [`SECURITY.md → Rotation des secrets`](./SECURITY.md#rotation-des-secrets).
> Failles connues / posture : `faille.md`.

---

## 1. Pipeline CI/CD

| Étape | Où | Bloquant |
|---|---|---|
| Lint, `tsc -b`, validation migrations, tests + coverage, build | GitHub Actions `ci.yml` (job `lint-test-build`) | ✅ |
| `npm audit` prod deps (high+) | job `audit` | ✅ |
| Playwright E2E + a11y (critical=0) | job `e2e` | ✅ |
| Déploiement front | Vercel (auto sur push `main`) | — |

Un `git push origin main` déclenche la CI **et** le déploiement Vercel du
**front uniquement**. La base de données n'est **jamais** touchée par ce push.

### Gates locales avant push (cf. [`TESTING.md → Checklist avant push prod`](./TESTING.md#checklist-avant-push-prod))
```bash
npm run lint            # 0 erreur
npx tsc -b              # 0 erreur
npm run validate:migrations
npm run check:rls       # invariants RLS (bloquant CI depuis le 2026-08-07)
npm run test:coverage   # thresholds respectés
npm run i18n:check
npm run build
npx playwright test --project=chromium
```

### Vérifier la dérive repo ↔ prod (avant tout déploiement avec migration)

`check:drift` ne peut pas être une gate CI : elle a besoin d'une introspection
**live** de la base, donc de secrets que la CI n'a pas (et un check qui exige
des secrets finit désactivé). C'est une étape manuelle en 2 temps :

```bash
npm run check:drift -- --print-sql
```

Exécuter le SQL affiché sur la prod (SQL editor ou MCP `execute_sql` — lecture
seule), sauver la réponse JSON, puis :

```bash
npm run check:drift -- introspection.json
```

Sortie ≠ 0 si un objet attendu par le dépôt **manque** en prod (= migration non
appliquée). Un objet EN TROP est un simple avertissement (héritage dashboard).

> Historique : ce script existait depuis juin 2026 et n'avait jamais été
> exécuté. Premier passage le 2026-08-07 — il a révélé une vraie dérive
> (mig. 090) **et** un faux positif de son propre SQL (le schéma `storage`
> était ignoré). Un détecteur jamais lancé ne détecte rien.

---

## 2bis. Déployer les Edge Functions

⚠️ **Vercel ne déploie PAS les Edge Functions.** Un `git push` livre le front ;
les fonctions Deno restent dans leur version précédente jusqu'à un déploiement
explicite :

```bash
supabase functions deploy stripe-webhook stripe-create-checkout delete-account
```

La CLI est la voie recommandée : elle résout seule l'arborescence des imports
relatifs (`../_shared/alert.ts`) et préserve le réglage `verify_jwt`.

Un déploiement par l'API (MCP `deploy_edge_function`) est possible mais exige
de reproduire l'arborescence **à la main** — il faut passer `_shared/alert.ts`
dans `files` ET viser `entrypoint_path: '<fonction>/index.ts'`, sinon l'import
relatif ne résout pas. Et il faut re-préciser `verify_jwt` à chaque fois.

### Smoke test après déploiement (sans effet de bord)

Une erreur d'import ne se voit PAS dans la réponse du déploiement : la fonction
est marquée `ACTIVE` et échoue au premier appel. Toujours vérifier :

```bash
BASE="https://<ref>.supabase.co/functions/v1"
curl -s -w "
%{http_code}
" -X GET  "$BASE/stripe-webhook"           # 405
curl -s -w "
%{http_code}
" -X POST "$BASE/stripe-webhook" -d '{}'   # 400 Invalid signature
curl -s -w "
%{http_code}
" -X POST "$BASE/delete-account" -H "Authorization: Bearer <anon>"  # 401
curl -s -w "
%{http_code}
" -X POST "$BASE/stripe-create-checkout" -H "Authorization: Bearer <anon>" # 401
```

Ces appels **ne suppriment rien et ne facturent rien** : ils s'arrêtent au
contrôle de méthode ou d'authentification. Mais ils prouvent que la fonction
démarre (imports résolus) — un échec de boot renverrait un 5xx `BOOT_ERROR`.
Un corps de réponse applicatif (`{"error":"Unauthorized"}`) confirme qu'on a
bien atteint le code de la fonction, et non la passerelle.

Réglages actuels, à ne PAS changer :

| Fonction | `verify_jwt` | Pourquoi |
|---|---|---|
| `stripe-webhook` | **false** | Stripe n'envoie pas de JWT — l'authentification est la signature du webhook |
| `stripe-create-checkout` | true | Appelée par un utilisateur connecté |
| `delete-account` | true | Idem, et l'id supprimé est celui du JWT |
| `report-bug` | true | Le gateway accepte aussi la clé anon : un visiteur non connecté doit pouvoir signaler un bug, il reste juste anonyme dans le mail |

### `report-bug` — formulaire « Signaler un bug » (2026-08-24)

L'icône insecte de la barre de navigation ouvre un formulaire (titre,
description, pièce jointe) que cette fonction relaie **par e-mail** à
`contact@thecosmo.app` via l'API Resend. Elle ne touche pas à la base.

Mise en service, dans cet ordre :

1. Créer un compte Resend et **vérifier le domaine `thecosmo.app`** (SPF +
   DKIM). Tant que le domaine n'est pas vérifié, Resend n'accepte que l'adresse
   de test `onboarding@resend.dev` en expéditeur.
2. Poser les secrets :

```bash
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set BUG_REPORT_TO=contact@thecosmo.app
supabase secrets set BUG_REPORT_FROM="Cosmo <bug@thecosmo.app>"
```

3. Déployer : `supabase functions deploy report-bug`

> ✅ **Déployée en production le 2026-08-29** (version 1, `verify_jwt` actif), après six
> jours où `SECURITY.md` et ce fichier la décrivaient comme livrée sans qu'elle le soit.
> Fumée passée en prod : `POST` sans corps → `503 mail_not_configured`, `GET` → `405`,
> sans JWT → `401` du gateway. **Les secrets ne sont toujours pas posés**, donc le repli
> `mailto` est ce que voit un utilisateur aujourd'hui. L'étape 1 ci-dessus dépend du même
> domaine vérifié que §2ter : les deux se débloquent ensemble.

**Tant que `RESEND_API_KEY` est absente**, la fonction répond `503
mail_not_configured` — et c'est un état prévu, pas une panne : le formulaire
affiche alors « écrivez-nous directement à contact@thecosmo.app » avec un lien
`mailto:` pré-rempli. Aucun message n'est perdu en silence.

⚠️ `BUG_REPORT_FROM` doit être une adresse **du domaine vérifié**, jamais
l'adresse de destination d'un fournisseur tiers (Gmail refuserait de signer).
L'auteur du rapport, lui, arrive en `Reply-To` — répondre au mail répond bien à
l'utilisateur, et son identité vient du JWT, jamais du corps de la requête.

---

## 2ter. Emails d'authentification (Supabase Auth) — **non configurés, re-mesuré le 2026-08-29**

> 🔴 **Ce sont les emails que Supabase envoie AUX UTILISATEURS**, pas ceux qu'envoient les Edge
> Functions. Les deux passent par Resend, mais ce sont deux chemins distincts, avec deux
> configurations distinctes : `report-bug` et `renewal-notice` appellent l'API Resend depuis du
> code que nous écrivons ; GoTrue, lui, envoie en **SMTP** depuis un serveur que nous ne
> contrôlons pas. Poser `RESEND_API_KEY` ne configure QUE le premier.

### Ce qui est vrai aujourd'hui — mesuré, pas supposé

> **Re-mesuré le 2026-08-29** : rien n'a changé. Même `28 / 1 / 3` en base, même DKIM absent.
> Le sous-domaine d'envoi `send.thecosmo.app` **n'existe pas encore du tout** : ni `MX`, ni `SPF`,
> ni `DKIM`, donc les trois `FAIL` de `npm run check:mail` sont **le même fait**, pas trois
> problèmes. La dernière inscription en prod date du 2026-08-21 : le compteur n'a pas bougé parce
> que personne ne s'est inscrit, pas parce que quelque chose a été réparé.

| Fait | Mesure du 2026-08-27, inchangée au 2026-08-29 |
|---|---|
| **Aucun SMTP applicatif n'est configuré.** GoTrue utilise donc l'expéditeur intégré de Supabase, plafonné à quelques envois par heure et explicitement présenté par Supabase comme non destiné à la production | Zéro occurrence de « SMTP » dans le dépôt et la doc |
| **Les confirmations d'inscription sont DÉSACTIVÉES** | 28 comptes, `confirmation_sent_at` renseigné sur **1** seul, délai création → confirmation de **15 ms** au minimum et < 10 min sur 27 comptes : c'est de l'auto-confirmation, pas un clic |
| **Les réinitialisations de mot de passe, elles, partent bien** par cet expéditeur | `recovery_sent_at` renseigné sur **3** comptes |
| **Le domaine n'est pas vérifié chez Resend** | `resend._domainkey.thecosmo.app` → **absent** |
| Le domaine reçoit du courrier chez IONOS | `MX` → `mx00/mx01.ionos.fr`, `SPF` → `include:_spf-eu.ionos.com`, `_dmarc` → CNAME vers `dmarc.ionos.fr` (`p=none`) |

**Les deux conséquences, dans l'ordre de gravité :**

1. **Personne ne vérifie qu'une adresse d'inscription existe.** N'importe qui peut créer un compte
   avec l'adresse d'un tiers, et une faute de frappe crée un compte définitivement injoignable —
   sans email valide, la réinitialisation de mot de passe ne peut plus rien pour lui.
2. **On ne peut pas corriger le point 1 sans SMTP.** Activer les confirmations aujourd'hui ferait
   passer chaque inscription par un expéditeur plafonné : au-delà de quelques inscriptions par
   heure, GoTrue répond `over_email_send_rate_limit`, que l'application traduit par
   « **Trop de tentatives. Réessayez dans quelques minutes.** » (`safeAuthError`). Le message est
   exact du point de vue du serveur et **trompeur** du point de vue de l'inscrit : il n'a rien
   fait de trop, c'est le quota du projet — éventuellement consommé par quelqu'un d'autre — qui
   est épuisé. Il réessaie, échoue encore, et part.

⚠️ **C'est un mode de défaillance corrélé** : il ne se déclenche que sous trafic, c'est-à-dire
exactement le jour d'une campagne, et il ressemble à « la campagne n'a pas converti ».

### Mise en service — l'ordre compte

**Le SMTP d'abord, les confirmations ensuite.** Inverser les deux, c'est ouvrir l'inscription sur
un expéditeur plafonné.

1. **Créer le sous-domaine d'envoi chez Resend** — `send.thecosmo.app`, **pas** `thecosmo.app`.
   C'est le point technique de cette procédure : la racine porte déjà les MX et le SPF d'IONOS,
   qui servent la boîte `contact@thecosmo.app`. Un sous-domaine d'envoi donne à Resend son propre
   `MX` et son propre SPF de *Return-Path* **sans toucher** à ce qui reçoit.
   ⚠️ Ne pas remplacer le SPF de la racine par celui de Resend : le courrier entrant continuerait
   d'arriver, mais IONOS cesserait d'être autorisé à émettre.

   **Les trois enregistrements à créer, tels que la console IONOS les demande** (Domaines & SSL →
   `thecosmo.app` → DNS → Ajouter un enregistrement). Resend affiche les mêmes en écriture
   absolue ; c'est la traduction qui fait perdre du temps, pas la décision :

   | Type | Champ « Nom d'hôte » chez IONOS | Valeur | D'où vient la valeur |
   |---|---|---|---|
   | `MX` | **`send.send`** | `feedback-smtp.eu-west-1.amazonses.com`, priorité `10` | Recopier depuis Resend (région lue dans la console, pas devinée) |
   | `TXT` | **`send.send`** | `v=spf1 include:amazonses.com ~all` | Dicté par Resend, identique pour tous les comptes |
   | `TXT` | `resend._domainkey.send` | `p=MIGfMA0GCSq...` (clé publique longue) | **Propre à ce domaine, uniquement lisible dans Resend.** Aucun moyen de la reconstituer |

   🔴 **`send.send`, ce n'est pas une faute de frappe.** Le Return-Path de Resend vit sur un
   sous-domaine `send.` **du domaine d'envoi** : domaine `send.thecosmo.app` → rebonds sur
   `send.send.thecosmo.app`. Seul le DKIM se pose sur le domaine d'envoi lui-même. La console
   Resend affiche déjà les noms **relatifs à `thecosmo.app`**, donc ils se recopient tels quels
   chez IONOS, sans rien retirer.
   ⚠️ `npm run check:mail` cherchait le MX et le SPF sur le domaine d'envoi : il aurait affiché
   deux échecs sur une configuration correcte. Corrigé le 2026-08-29, il interroge les deux
   emplacements.

   🔴 **IONOS ajoute le domaine tout seul.** Saisir `send`, jamais `send.thecosmo.app` : la
   seconde forme crée `send.thecosmo.app.thecosmo.app`, qui ne résout nulle part et donne
   exactement la même sortie `check:mail` qu'un enregistrement oublié. Même piège pour le DKIM :
   `resend._domainkey.send`, sans le domaine.

   ⚠️ Ces trois lignes se posent **ensemble**. Un domaine à moitié vérifié chez Resend n'envoie
   rien du tout : ce n'est pas dégradé, c'est bloqué.
2. **Attendre la validation** dans Resend (les trois enregistrements au vert). Vérifier depuis
   ici : `npm run check:mail`.
3. **Créer une clé SMTP** dans Resend (Settings → SMTP). Hôte `smtp.resend.com`, port `465`,
   utilisateur `resend`, mot de passe = la clé.
4. **Poser le SMTP dans Supabase** : Dashboard → Project Settings → Authentication → SMTP Settings.
   Expéditeur **en service depuis le 2026-08-29** : `COSMO <thecosmo@send.thecosmo.app>`.
   La partie locale est libre ; le domaine, lui, doit être celui vérifié chez Resend, sans quoi
   l'envoi est refusé. ⚠️ Cette adresse ne reçoit rien : les réponses des utilisateurs vont sur
   `contact@thecosmo.app`, qui vit chez IONOS. Les Edge Functions doivent porter le **même**
   expéditeur (`BUG_REPORT_FROM`), leur valeur par défaut `bug@thecosmo.app` étant sur un
   domaine que Resend ne signera jamais.
5. **Relever la limite d'envoi** : Authentication → Rate Limits → *Emails per hour*. Le défaut est
   celui de l'expéditeur intégré et **ne bouge pas tout seul** quand on branche un SMTP : sans ce
   réglage, on paie un SMTP et on garde le plafond qu'on voulait fuir.
6. **Coller les quatre gabarits** de [`supabase/templates/`](../supabase/templates/) dans
   Authentication → Emails. Ils ne se déploient pas depuis le dépôt, cf. le README du dossier.
7. **Seulement maintenant**, activer *Confirm email* (Authentication → Providers → Email).
   Le front est déjà prêt : `register()` rapporte `needsEmailConfirmation` quand `signUp` ne
   renvoie pas de session, et `AuthForm` affiche « Vérifiez votre boîte mail » au lieu de pousser
   l'inscrit vers un écran protégé qui le rejetterait. Verrouillé par
   `src/components/AuthForm.confirmation.test.tsx`, **avec son témoin**.

### Vérification — quatre gestes, aucun n'est facultatif

```bash
npm run check:mail          # DNS : MX, SPF, DKIM Resend, DMARC
```

1. `npm run check:mail` sort **0**.
2. Créer un compte jetable sur la prod : l'email arrive **en moins d'une minute**, depuis
   `@send.thecosmo.app`, et **hors dossier indésirables sur Gmail ET sur Outlook** — deux
   fournisseurs, parce qu'ils ne jugent pas de la même façon.
3. Demander une réinitialisation de mot de passe sur ce compte : même vérification.
4. Supprimer le compte jetable par le bouton de suppression de compte. Ça teste au passage
   `delete-account`, donc le droit à l'effacement, en conditions réelles.

> ⚠️ **Ne pas valider la délivrabilité sur une seule boîte, et surtout pas sur une adresse du
> domaine.** Un email envoyé depuis `thecosmo.app` vers une boîte `thecosmo.app` ne traverse
> aucun filtre anti-spam : il prouve que le SMTP répond, pas qu'un inconnu recevra quoi que ce
> soit.

### Passer DMARC en quarantaine, plus tard

`_dmarc.thecosmo.app` est aujourd'hui un **CNAME vers IONOS** qui publie `p=none` : le domaine est
surveillé, rien n'est rejeté. C'est le bon réglage pour démarrer. Le durcir (`p=quarantine`) exige
de retirer ce CNAME pour poser un enregistrement propre, donc de reprendre à sa charge ce qu'IONOS
gère — à faire **après** avoir constaté plusieurs semaines d'envois alignés, jamais en même temps
que la mise en service.

---

## 2quater. Protection anti-robot (Cloudflare Turnstile) — **inerte au 2026-08-28**

Le code est livré et **ne fait rien** tant que deux réglages ne sont pas posés, dans cet ordre.
Fournisseur arbitré par Axel le 2026-08-28 : **Turnstile**, moins intrusif que hCaptcha sur un
entonnoir d'inscription déjà fragile.

### Pourquoi, et pourquoi c'est lié aux emails

Le risque n'est pas le faux compte, c'est le **quota d'envoi**. Une vague de robots vide le
plafond d'emails du projet, et les inscriptions légitimes échouent alors avec « Trop de
tentatives » sans que personne ne comprenne pourquoi. C'est le même mode de défaillance que §2ter,
et les deux se corrigent ensemble ou pas du tout.

### Mise en service — l'ordre est impératif

1. **Créer un widget Turnstile** sur le compte Cloudflare (mode *Managed*). Il produit une clé
   **publique** (site key) et une clé **secrète**.
2. **Poser `VITE_TURNSTILE_SITE_KEY`** dans les variables Vercel, puis **redéployer**. À partir de
   là le widget s'affiche et produit des jetons, que le serveur **ignore encore**. Rien ne casse.
3. **Seulement ensuite**, activer côté Supabase : Authentication → Attack Protection → *Enable
   CAPTCHA protection*, fournisseur Turnstile, avec la clé **secrète**.

> 🔴 **Inverser 2 et 3 rend l'inscription ET la connexion impossibles pour tout le monde**, parce
> que GoTrue exigerait un jeton que personne n'envoie encore. C'est une panne totale de
> l'authentification, pas une dégradation.

### 🔴 Activer le CAPTCHA cassera `npm run cosmo:login`

La protection Supabase couvre aussi `signInWithOtp`, qu'utilise le **CLI agent**
(`scripts/cosmo/login.mjs`). Un script Node ne peut pas résoudre un challenge : la connexion du
CLI échouera, et avec elle tout accès agent aux données réelles.

**À savoir avant de basculer le réglage, pas à découvrir le jour où le CLI s'arrête.** Il n'y a pas
de contournement propre côté client ; les sorties sont de garder une session CLI valide (elle
survit à l'activation, seule la *reconnexion* casse), ou d'accepter que le CLI se reconnecte
depuis un navigateur.

### Ce que le code fait déjà

- `src/lib/turnstile.ts` — **aucun script tiers n'est chargé** tant que la clé publique est
  absente. Vérifié par test : un visiteur ne paie aujourd'hui aucune requête vers Cloudflare.
- Le jeton est joint à `signUp`, `signInWithPassword` **et** `resetPasswordForEmail` — les trois
  points d'entrée que Supabase protège. En oublier un le rendrait inutilisable après activation.
- Le jeton est **à usage unique** : il est réarmé après chaque tentative, sinon la deuxième
  échouerait pour une raison sans rapport avec ce que l'utilisateur vient de corriger.
- Un échec de chargement (extension, réseau filtrant, panne Cloudflare) **ne bloque pas** le
  formulaire : on laisse soumettre, et c'est le serveur qui tranche. Un CAPTCHA injoignable ne doit
  jamais devenir une porte fermée.
- `captcha_failed` est traduit dans `src/modules/auth/auth-errors.ts`.
- CSP : `challenges.cloudflare.com` est autorisé en `script-src`, `connect-src` et `frame-src`.

---

## 2. Appliquer une migration de base de données

⚠️ **Les migrations ne sont PAS appliquées par le déploiement Vercel.** Elles
doivent être poussées séparément, idéalement **avant** le déploiement front qui
en dépend (additive-first : ajouter colonnes/fonctions avant de livrer le code
qui les lit).

```bash
# Option A — CLI (préférée)
supabase db push

# Option B — MCP / dashboard, pour une migration isolée idempotente
#   apply_migration(project_id, name, query)  puis vérifier le schéma.
```

Règles (cf. [`SECURITY.md → Avant tout commit qui touche supabase/migration`](./SECURITY.md#avant-tout-commit-qui-touche-supabasemigrationsql)) :
- Idempotent : `CREATE OR REPLACE`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS … CREATE POLICY`.
- `WITH CHECK` sur tout `UPDATE` ; `SET search_path` sur tout `SECURITY DEFINER`.
- Après application : `get_advisors(security)` ne doit pas révéler de **nouveau** warning.

Projet prod actif : **`ykeugqfgklejcdbrmawy`** (cf. `list_projects` — le second
projet est inactif). Vérifier la cible avant tout `apply_migration`.

---

## 3. Rollback

### Front (Vercel)
Le déploiement est immuable et versionné. Rollback = **promouvoir le
déploiement précédent** :
- Dashboard Vercel → Deployments → déploiement vert précédent → *Promote to Production*.
- Ou `vercel rollback <deployment-url>` (CLI).
- Aucun rebuild : bascule instantanée de l'alias prod.

### Base de données
Postgres n'a pas de « rollback » automatique. Les migrations doivent donc être
**additives et rétro-compatibles** (le front N-1 doit tolérer le schéma N) :
- Ne pas `DROP COLUMN` / renommer dans la même release que le code qui l'utilise.
- Pour annuler : écrire une migration inverse (`NNN_revert_xxx.sql`) — ne jamais
  éditer un fichier de migration déjà appliqué.
- Garder une fenêtre où front N-1 et schéma N coexistent (deploy DB d'abord,
  front ensuite ; en cas de rollback front, le schéma reste compatible).

---

## 4. Réponse incident (ordre de tri)

1. **Symptôme prod** → Sentry (erreurs + tracing perf à 10 %, cf. `main.tsx`).
   Filtrer par `environment` et `release`.
2. **Régression récente** → rollback front Vercel immédiat (§3), puis investiguer
   à froid.
3. **Erreurs DB / RLS** → logs Supabase (`get_logs`) + `get_advisors`.
4. **Webhook Stripe** → table `processed_stripe_events` + logs de l'Edge
   Function `stripe-webhook`.
5. **Fuite de secret suspectée** → [`SECURITY.md → Rotation des secrets`](./SECURITY.md#rotation-des-secrets) (rotation
   immédiate + invalidation des sessions).

---

## 5. Environnements & secrets

| Variable | Front (Vercel) | Edge Functions (Supabase) |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | ✅ | — |
| `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN` | ✅ | — |
| `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL` | ❌ jamais côté client | ✅ `supabase secrets set …` |

Les mêmes secrets `VITE_*` doivent exister en **GitHub Actions secrets** (job
`build` / `e2e`).

## 6. Schéma & ledger de migration (DR / ISO 27001)

État vérifié **2026-06-07** (introspection `pg_proc` / `pg_trigger` vs migrations) :
- ✅ **Toutes** les fonctions et triggers de prod sont versionnés → la base est
  **reproductible** depuis `supabase/migration/*.sql` sur une instance vierge.
- ✅ Tables orphelines `billing` / `user_profiles` supprimées (mig. 040).
- ⚠️ **Ledger partiel** : `supabase_migrations.schema_migrations` ne liste que
  ~22 des 40 fichiers (la majorité a été appliquée via SQL dashboard, pas
  `db push`). Les objets existent tous et les migrations sont idempotentes, donc
  pas de risque data/sécu — mais `supabase db push` tenterait de rejouer les
  migrations non listées.

**⚠️ Vérité opérationnelle (audit 2026-06-10)** : le repo stocke ses migrations
dans `supabase/migration/` (singulier) avec des préfixes `NNN_` — un layout que
la CLI Supabase **ne reconnaît pas** (`db push` / `migration repair` n'opèrent
que sur `supabase/migrations/<timestamp14>_*.sql`). Le ledger n'a donc **jamais
été** la source de vérité de ce projet et ne peut pas être « réparé » tel quel :
les 23 entrées présentes viennent du dashboard et de l'outil MCP
`apply_migration` (qui, lui, enregistre une entrée à chaque application — c'est
le workflow courant et recommandé ici).

**Source de vérité réelle** : le dossier `supabase/migration/*.sql` (gardé par
`npm run validate:migrations` en CI) + l'introspection live. Pas le ledger.

**Garde anti-dérive** (ajouté 2026-06-10, suite aux findings 017/N15) :
```bash
node scripts/check-prod-drift.mjs --print-sql   # → SQL d'introspection (read-only)
# Exécuter ce SQL sur la prod (SQL editor / MCP), sauver le JSON, puis :
node scripts/check-prod-drift.mjs introspection.json   # exit ≠ 0 si objet manquant
```
À lancer **après chaque migration appliquée** et avant tout audit. Les
divergences assumées (fresh-install only) et les équivalences de noms de
policies sont documentées dans le script lui-même.

**Si un jour on veut basculer sur le workflow CLI** (à faire une seule fois) :
```bash
supabase link --project-ref ykeugqfgklejcdbrmawy
# 1. Convertir le layout : copier chaque NNN_<nom>.sql vers
#    supabase/migrations/2026MMDDHHMMSS_<nom>.sql (timestamps croissants).
# 2. Marquer comme appliquées celles dont les objets existent déjà en prod :
supabase migration repair --status applied <version>   # pour chaque fichier
supabase migration list   # vérifier l'alignement local ↔ remote
```
Tant que cette conversion n'est pas faite, **ne pas utiliser `db push`** —
passer par `apply_migration` (MCP) ou le SQL editor avec le fichier versionné.

## 7. Backup & Disaster Recovery (runbook)

**État** : backups automatiques Supabase quotidiens (rétention selon plan ;
PITR seulement à partir du plan Pro + add-on). **Aucune restauration n'a encore
été testée** — un backup non testé n'est pas un backup.

### Restauration (procédure)
1. `Dashboard → Database → Backups` → choisir le snapshot → **Restore**
   (⚠️ écrase l'instance ; pour un test, restaurer vers un **nouveau projet**).
2. Vérifier post-restore : `select count(*) from tasks;` + spot-check RLS
   (`select * from subscriptions` avec un JWT user → ne doit voir que sa ligne).
3. Re-pointer le front si projet différent : Vercel env `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` + redeploy.
4. Redéployer les Edge Functions + `supabase secrets set …` sur le nouveau ref.

### Drill trimestriel (à planifier — non fait à ce jour)
- [ ] Restaurer le dernier backup vers un projet jetable.
- [ ] Dérouler les vérifs du §2 ci-dessus + login réel + création d'une tâche.
- [ ] Chronométrer (objectif RTO < 2 h) et noter la date du drill ici.
- [ ] Supprimer le projet jetable.

### Export hors-fournisseur — automatisé le 2026-08-28

`.github/workflows/db-backup.yml`, le **1er de chaque mois**. Il produit un dump `pg_dump` au
format custom, vérifie qu'il n'est ni vide ni tronqué (`pg_restore --list`), et le dépose en
artefact avec **30 jours de rétention**.

**Mise en service** : poser le secret GitHub `SUPABASE_DB_URL` (Dashboard → Settings → Database →
Connection string, mode « session »). Sans lui le job s'arrête en **avertissement**, pas en échec —
une CI rouge en permanence finit ignorée, règle déjà appliquée à `renewal-notice`.

> ⚠️ **Ce n'est PAS un remplacement du PITR.** Un dump mensuel a un RPO de trente jours : il sert
> à ne pas TOUT perdre, pas à revenir à hier. Ce qu'il couvre et que le PITR ne couvre pas, c'est
> la perte du **compte** — suspension, litige, ou décision de partir. Les deux répondent à des
> risques différents, aucun ne dispense de l'autre.
>
> 🔴 **L'artefact contient des données personnelles** (noms, emails, contenu des tâches). Le dépôt
> est public, mais les artefacts d'un run exigent une authentification. Ne **jamais** committer un
> dump. Pour une vraie copie longue durée, le télécharger et le garder sur un disque chiffré :
> GitHub n'est pas un coffre.

Manuellement, si besoin :
```bash
pg_dump "$SUPABASE_DB_URL" --no-owner --format=custom -f cosmo-$(date +%F).dump
```

## 8. Alerting backend (Edge Functions)

`supabase/functions/_shared/alert.ts` envoie un POST JSON sur
`OPS_ALERT_WEBHOOK_URL` (Slack/Discord webhook) pour les échecs critiques :
- `stripe-webhook` : handler en échec (Stripe va retry → si répété, perte de
  revenu) et échec d'écriture du marqueur d'idempotence ;
- `delete-account` : purge RGPD avortée, ou `auth.admin.deleteUser` en échec
  après purge réussie.

**Activation** (sans le secret, no-op silencieux) :
```bash
supabase secrets set OPS_ALERT_WEBHOOK_URL=https://hooks.slack.com/services/…
```

**Prérequis déploiement `delete-account`** (fonction PAS encore déployée au
2026-06-10) : `supabase secrets set APP_URL=https://<domaine-prod>` d'abord —
sans lui l'allowlist CORS ne contient que localhost et le bouton « Supprimer le
compte » échoue au lieu de tomber sur le fallback email.

---

## 9. Sonde de disponibilité (`.github/workflows/uptime.yml`) — depuis le 2026-08-29

Le §8 alerte sur une Edge Function qui échoue. Il ne dit rien du cas où **plus rien ne
répond** : jusqu'au 2026-08-29, une panne du site ou du projet Supabase ne prévenait
personne, et se serait découverte par un utilisateur.

- **Ce qu'elle sonde**, deux fois par heure : `https://thecosmo.app/` (HTTP 200 **et** contenu
  prérendu présent, parce que Vercel sert la SPA sur toutes les URLs et qu'une page d'erreur
  répond 200 comme le reste), et `$SUPABASE_URL/auth/v1/health`. Sur ce second point, **401 est
  une preuve de vie** : sans `apikey`, GoTrue répond 401 quand il va bien. Ce qui signale une
  panne est un 5xx ou un 000.
- **Ce qu'elle fait** en cas d'échec : ouvre une issue `uptime-red`, donc un mail. Elle se
  **referme seule** au retour du vert, ce qui réarme l'alerte sans geste manuel. Même mécanique
  que `ci-alert.yml`, même raison.
- **Secret** : `SUPABASE_URL` uniquement, déjà posé pour `renewal-notice`. Sans lui, seule la
  moitié site est sondée, avec un avertissement, jamais un échec.

🔴 **Ce n'est PAS la sonde externe de T-17.** Le cron de GitHub Actions est mis en file
d'attente : il dérive de dizaines de minutes et peut sauter une exécution. Surtout, une sonde
hébergée chez GitHub ne détecte pas une panne de GitHub. La granularité réelle est « prévenu
dans l'heure ». C'est le passage de « personne n'est prévenu » à « quelqu'un est prévenu », pas
la fin du sujet.
