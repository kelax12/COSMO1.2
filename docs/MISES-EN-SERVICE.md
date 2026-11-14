# Mises en service : e-mails Auth, Turnstile, second facteur, crons

> **Quand lire** : avant un réglage Supabase Auth, Resend, IONOS ou Cloudflare, une écriture sur `admin_users` / `auth.mfa_factors`, ou un geste pg_cron et Vault. **Fait foi** : les consoles des services et la production (`check:mail`, `cron_runs_verdict()`).
> Mêmes numéros de section que dans [`DEPLOYMENT.md`](./DEPLOYMENT.md) : le code les cite. Récits : [`archive/DEPLOYMENT-journal-2026-11-13.md`](./archive/DEPLOYMENT-journal-2026-11-13.md), [`archive/OPS-SECURITE-recits-2026-11-13.md`](./archive/OPS-SECURITE-recits-2026-11-13.md).

## 2ter. E-mails d'authentification (SMTP de Supabase Auth)

- État courant : SMTP Resend en service sur `send.thecosmo.app` ; confirmations d'inscription **désactivées** (décision d'Axel, finding `G-2`). Activer = une décision, puis étape 7.
- 🔴 Deux chemins distincts : GoTrue envoie en **SMTP** ; `report-bug`, `renewal-notice` et consorts appellent l'API Resend. Poser `RESEND_API_KEY` ne configure que le second.
- Avant mise en service : [`archive/DEPLOYMENT-emails-auth-avant-mise-en-service-2026-08-27-au-2026-08-29.md`](./archive/DEPLOYMENT-emails-auth-avant-mise-en-service-2026-08-27-au-2026-08-29.md).

Mise en service, dans l'ordre (SMTP d'abord, confirmations ensuite) :
1. Créer chez Resend le domaine `send.thecosmo.app`, jamais `thecosmo.app` (la racine porte MX et SPF d'IONOS pour `contact@`). ⚠️ Ne pas remplacer le SPF de la racine.
2. Poser chez IONOS (Domaines & SSL → `thecosmo.app` → DNS), les trois **ensemble** (un domaine à moitié vérifié n'envoie rien) :

| Type | Nom d'hôte saisi chez IONOS | Valeur |
|---|---|---|
| `MX` | `send.send` | `feedback-smtp.<région>.amazonses.com`, priorité `10`, région lue chez Resend |
| `TXT` | `send.send` | `v=spf1 include:amazonses.com ~all` |
| `TXT` | `resend._domainkey.send` | clé publique DKIM, lisible seulement chez Resend |

   - 🔴 `send.send` n'est pas une faute : le Return-Path vit sur `send.` du domaine d'envoi.
   - 🔴 IONOS ajoute le domaine : saisir `send`, jamais `send.thecosmo.app` (crée `send.thecosmo.app.thecosmo.app`).
3. Attendre les trois verts chez Resend ; vérifier `npm run check:mail` (sort 0).
4. Clé SMTP Resend : hôte `smtp.resend.com`, port `465`, utilisateur `resend`, mot de passe = la clé.
5. Supabase → Authentication → SMTP Settings : expéditeur `COSMO <thecosmo@send.thecosmo.app>` (domaine vérifié obligatoire ; cette adresse ne reçoit rien, les réponses vont à `contact@thecosmo.app`).
6. Authentication → Rate Limits → *Emails per hour* : relever (le défaut ne bouge pas avec un SMTP).
7. Coller les quatre gabarits de [`supabase/templates/`](../supabase/templates/) dans Authentication → Emails.
8. Seulement maintenant : *Confirm email* (Authentication → Providers → Email). Le front gère `needsEmailConfirmation` (témoin `src/components/AuthForm.confirmation.test.tsx`).

Vérification, quatre gestes :
1. `npm run check:mail` sort 0 (MX, SPF, DKIM, DMARC).
2. Compte jetable en prod : e-mail en moins d'une minute, depuis `@send.thecosmo.app`, hors indésirables sur Gmail ET Outlook.
3. Réinitialisation de mot de passe sur ce compte : même contrôle.
4. Supprimer le compte par le bouton de l'app (éprouve `delete-account`).

- ⚠️ Le DNS ne prouve pas qu'un e-mail arrive. ❌ Jamais valider sur une boîte du domaine : elle ne traverse aucun filtre.
- `check:mail` n'est pas une gate CI (état DNS externe).
- DMARC : `_dmarc.thecosmo.app` est un CNAME vers IONOS (`p=none`). Passer en `p=quarantine` = retirer le CNAME et poser un enregistrement propre, après plusieurs semaines d'envois alignés, jamais pendant une mise en service.

## 2quater. Anti-robot (Cloudflare Turnstile)

- État courant : code livré et inerte tant que `VITE_TURNSTILE_SITE_KEY` est absente (`npm run check:env` l'imprime). Fournisseur arbitré : Turnstile.
- Le risque visé est le quota d'envoi d'e-mails vidé par des robots (inscriptions légitimes refusées) : se règle avec § 2ter.

Mise en service, ordre impératif :
1. Widget Turnstile *Managed* : clé publique et clé secrète.
2. `VITE_TURNSTILE_SITE_KEY` dans Vercel, redéployer : le widget produit des jetons que le serveur ignore encore.
3. Ensuite seulement : Authentication → Attack Protection → CAPTCHA Turnstile avec la clé secrète.

- 🔴 Inverser 2 et 3 coupe inscription ET connexion pour tous.
- 🔴 Le CAPTCHA casse la **reconnexion** de `npm run cosmo:login` (OTP sans challenge) : garder une session CLI valide, ou se reconnecter par navigateur.
- Code (`src/lib/turnstile.ts`) : aucun script tiers sans clé ; jeton sur `signUp`, `signInWithPassword` ET `resetPasswordForEmail` ; jeton à usage unique réarmé après chaque tentative ; échec de chargement ne bloque pas le formulaire ; `captcha_failed` traduit dans `src/modules/auth/auth-errors.ts` ; CSP `challenges.cloudflare.com` en `script-src`, `connect-src`, `frame-src`.

## 2quinquies. Second facteur sur `/admin` (mig. `131`)

- `public.is_admin()` exige une session `aal2` ([`SECURITY.md`](./SECURITY.md) § `/admin`). Mig. `131` en prod.
- 🔴 Ordre pour un nouvel environnement : 1. déployer le front (écran d'enrôlement : QR et clé en clair) ; 2. enrôler un authentificateur, saisir le code ; 3. appliquer la `131`. Dans l'autre ordre, `/admin` ne rend rien jusqu'au premier code.

Vérification, connecté en admin après enrôlement :
```sql
SELECT auth.jwt() ->> 'aal';   -- 'aal2'
SELECT public.is_admin();      -- true
```

- Contrôle qui prouve la garde : se reconnecter par mot de passe seul, s'arrêter avant le code : `/admin` demande le code et n'affiche rien.

Téléphone perdu (aucun code de récupération à garder) :
```sql
-- SQL editor Supabase, rôle service_role
DELETE FROM auth.mfa_factors WHERE user_id = '<uid>';
```

- Attendu : session `aal1`, écran d'enrôlement au prochain passage sur `/admin`.

## 2sexies. Traitements planifiés : pg_cron, Vault, journal (ARC-06)

| Pièce | Où | Rôle |
|---|---|---|
| `cron_invoke(job)` | mig. `245` | pg_net + `x-cron-secret` lu dans Vault, une ligne `cron_runs` par appel |
| `cron_runs` | mig. `245` | journal ; RLS sans policy, rien pour `anon` / `authenticated` |
| `cron_leases` | mig. `245`, `_shared/cron-lease.ts` | un bail par job : deux passages ne travaillent jamais ensemble |
| jobs `cosmo-*` | mig. `246` | six appels + `cosmo-cron-runs-close` (relevé pg_net toutes les 5 min) |
| `cosmo-uptime`, `cron_probe()` | mig. `252` | sonde de disponibilité toutes les 5 min (contrôles d'`uptime.yml`), lignes `sonde-site`, `sonde-guide`, `sonde-auth`, fenêtre 20 min |
| `Journal des crons` | `cron-journal.yml` → `ci-alert.yml` | rouge sur un job ou une sonde `absent` ou en `echec` dans sa fenêtre |

| Workflow GitHub (UTC) | Job pg_cron | `cron_invoke` | Fenêtre |
|---|---|---|---|
| `org-webhook-dispatch` (`7-59/10 * * * *`) | `cosmo-org-webhook-dispatch` | `org-webhook-dispatch` | 35 min |
| `org-digest` horaire (`23 * * * *`) | `cosmo-org-digest-hourly` | `org-digest?mode=hourly` | 2 h 15 |
| `org-digest` quotidien (`41 7 * * *`) | `cosmo-org-digest-daily` | `org-digest?mode=daily` | 26 h |
| `renewal-notice` (`12 7 * * *`) | `cosmo-renewal-notice` | `renewal-notice` | 26 h |
| `renewal-notice`, job `seat-alert` | `cosmo-seat-alert` (07:14) | `seat-alert` | 26 h |
| `inactive-accounts` (`37 6 * * *`) | `cosmo-inactive-accounts` | `inactive-accounts` | 26 h |

- Secrets Vault (noms fixes) : `cosmo_project_url`, `cosmo_cron_secret` (= `CRON_SECRET` des Edge Functions et d'Actions).
- Rattrapage d'un passage : `select public.cron_invoke('<job>');` en `postgres`, ou le `workflow_dispatch` d'origine (bail + rejeu idempotent).
- État courant : `JOBS_BASCULES` de `scripts/check-cron-runs.mjs` (source unique de la garde et de la sonde) dit quels jobs ont quitté GitHub ; le ledger de prod dit les migrations.
- 🔴 Bascule job par job : un job entre dans `JOBS_BASCULES` et perd son `schedule:` GitHub dans le même commit, le jour de son premier `ok` dans `cron_runs`. `src/edge-cron-lease.guard.test.ts` refuse l'un sans l'autre.
- ❌ `renewal-notice` et `seat-alert` partagent un déclencheur : ils basculent ensemble.
- ✅ Deux ordonnanceurs ensemble sont sûrs (bail) ; un trou ne l'est pas.
- ⚠️ La sonde pg_cron ne voit pas une panne de la base elle-même (seul `absent` la dit), et l'alerte part par GitHub : `uptime.yml` garde son `schedule:`.
- Preuves rejouées par `e2e/rls/cron-journal.test.ts` sur pile réelle.

Mise en place sur un projet neuf (gestes d'Axel), chaque étape vérifiée avant la suivante :
1. Edge Functions avec bail déployées par `Edge deploy`. Vérifier : `npm run check:edge` vert.
2. Secrets Vault, SQL editor :
   `select vault.create_secret('https://<ref>.supabase.co', 'cosmo_project_url', 'lue par cron_invoke (mig. 245)');`
   `select vault.create_secret('<valeur de CRON_SECRET>', 'cosmo_cron_secret', 'x-cron-secret des fonctions planifiees (mig. 245)');`
   Vérifier : `select name from vault.secrets where name like 'cosmo\_%' order by 1;` rend deux lignes.
   ⚠️ Sans copie de `CRON_SECRET` (illisible chez Supabase) : le faire tourner aux trois endroits (`supabase secrets set`, `gh secret set`, Vault) et dater `.github/secrets-registry.json`.
3. Preuve de la `245` : `supabase db query --linked -f supabase/proofs/245.proof.sql`. Attendu : erreur commençant par `PREUVE-ANNULEE 0 ECHEC |`, puis `select (select count(*) from pg_extension where extname = 'pg_net') as pg_net, to_regclass('public.cron_runs') as journal;` rend `0` et `NULL`. Un `ECHEC` : arrêt.
4. Appliquer `245_cron_journal` (SQL editor ou `apply_migration`). Relire : `pg_net` installée, RLS active et zéro policy sur `cron_runs` et `cron_leases`, `has_function_privilege` des six fonctions (`anon` non, `authenticated` non, `service_role` oui sur le bail seul).
5. Preuve puis application de `246_cron_planification`, même lecture. Vérifier : `select jobname, schedule, command, active from cron.job order by jobname;` montre les sept `cosmo-*`, actifs.
6. Après 15 min : `select job, status, http_code, started_at from public.cron_runs order by id desc limit 10;` montre `org-webhook-dispatch` en `ok` / `200`. `config_missing` = secret Vault manquant ; `error` / `401` = `cosmo_cron_secret` ≠ `CRON_SECRET`. Dans les deux cas : arrêt, GitHub tient tout.
7. Premier `ok` de chaque job (heures UTC : `inactive-accounts` 06:37, `renewal-notice` 07:12, `seat-alert` 07:14, `org-digest-daily` 07:41, horaire à la minute 23, webhooks toutes les dix minutes) :
   - `select * from public.cron_runs_verdict();` : verdict `ok` pour le job ;
   - `select job, count(*) filter (where status = 'ok') as ok, max(started_at) from public.cron_runs group by job order by job;` : au moins un `ok`.
   ⚠️ `ok` = l'Edge Function a répondu 2xx (y compris `skipped: already_running`) ; l'envoi réel se lit dans `renewal_notices`, `org_webhook_deliveries`.
8. Basculer ce job : l'ajouter à `JOBS_BASCULES`, retirer son `schedule:`, pousser par `noyau/<nom>` puis `main`. Vérifier le lendemain : `gh run list --workflow <workflow>.yml --event schedule --limit 3` ne montre plus de run planifié ; `Journal des crons` vert.

Retour arrière : rendre la main à GitHub d'abord, retirer pg_cron ensuite.

- Job encore planifié sur GitHub : `select cron.unschedule('<jobname>');` suffit. Tables et extension peuvent rester. Un arrêt durable = nouvelle migration, jamais une édition de la `246`.
- Job basculé : `git revert <SHA de sa bascule>` puis push (le `schedule:` revient, la garde avec) ; ensuite seulement `cron.unschedule`.
- `CRON_SECRET` tourné : Supabase, GitHub et Vault ensemble ; Vault oublié = `error` / `401` dans `cron_runs` et `Journal des crons` rouge sous deux heures.
