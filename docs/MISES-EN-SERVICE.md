# Mises en service : emails Auth, Turnstile, second facteur, crons

Procédures de mise en service et d'exploitation des services branchés sur le projet, sorties de
[`DEPLOYMENT.md`](./DEPLOYMENT.md) (mêmes numéros de section : les commentaires du code les citent).
Récits et relevés datés : [`archive/DEPLOYMENT-journal-2026-11-13.md`](./archive/DEPLOYMENT-journal-2026-11-13.md).

---
## 2ter. Emails d'authentification (Supabase Auth) · **SMTP EN SERVICE depuis le 2026-08-29 au soir ; les confirmations restent désactivées**

> 🔴 Envoi en service depuis le 2026-08-29 (domaine d'envoi `send.thecosmo.app`, `npm run check:mail` vert,
> DMARC `p=none`). Les **confirmations d'inscription restent désactivées** (décision d'Axel, finding `G-2`).
> ⚠️ Le DNS ne prouve pas qu'un e-mail ARRIVE : la preuve est un compte jetable vérifié sur Gmail ET Outlook.

> 🔴 **Ce sont les emails que Supabase envoie AUX UTILISATEURS**, pas ceux qu'envoient les Edge
> Functions. Les deux passent par Resend, mais ce sont deux chemins distincts, avec deux
> configurations distinctes : `report-bug` et `renewal-notice` appellent l'API Resend depuis du
> code que nous écrivons ; GoTrue, lui, envoie en **SMTP** depuis un serveur que nous ne
> contrôlons pas. Poser `RESEND_API_KEY` ne configure QUE le premier.

### Avant la mise en service : archivé

Le serveur d'envoi dédié se règle **avant** toute campagne, parce que la défaillance (quota) ne se déclenche que sous trafic.
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

Risque : le **quota d'envoi**. Une vague de robots vide le plafond d'emails et les inscriptions légitimes
échouent (« Trop de tentatives »). Même mode de défaillance que § 2ter : les deux se corrigent ensemble.
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

`src/lib/turnstile.ts` : aucun script tiers tant que la clé publique est absente. Le jeton (à usage unique,
réarmé après chaque tentative) est joint à `signUp`, `signInWithPassword` **et** `resetPasswordForEmail`.
Un échec de chargement **ne bloque pas** le formulaire (le serveur tranche). `captcha_failed` est traduit dans
`src/modules/auth/auth-errors.ts`. CSP : `challenges.cloudflare.com` en `script-src`, `connect-src`, `frame-src`.

---
## 2quinquies. Second facteur sur `/admin` · **EN VIGUEUR : mig. `131` appliquée le 2026-08-31, TOTP enrôlé le 2026-09-01**

> 🔴 Suivre l'ordre ci-dessous : la mig. `131` appliquée avant l'enrôlement rend `/admin` inaccessible.
`/admin` rend toute la volumétrie business du produit. Depuis T-06 (b), la garde serveur
`public.is_admin()` exige que la **session** ait présenté un second facteur (`aal2`), pas
seulement que le compte figure dans `admin_users`.

### Mise en service — l'ordre évite toute coupure

1. **Déployer le front.** `/admin` affiche alors un écran d'enrôlement : bouton, QR code, et une
   clé en clair si le QR ne passe pas.
2. **Enrôler un authentificateur** (Google Authenticator, Aegis, 1Password, Bitwarden…) et saisir
   le code à six chiffres. La session passe en `aal2` et les statistiques s'affichent.
3. **Appliquer la migration `131`.** Rien ne change à l'écran : la session est déjà `aal2`.

Fait dans l'autre sens, rien n'est cassé, mais `/admin` ne rend plus de statistiques entre
l'application de la migration et le premier code vérifié. L'écran d'enrôlement, lui, reste
atteignable : il ne dépend ni de la migration ni de `is_admin()`.

### Vérification

```sql
-- Depuis l'application, connecté en admin, APRÈS enrôlement :
SELECT auth.jwt() ->> 'aal';   -- attendu : 'aal2'
SELECT public.is_admin();      -- attendu : true
```

Et le contrôle qui prouve vraiment la garde : se déconnecter, se reconnecter par mot de passe
seul, s'arrêter avant de saisir le code. `/admin` doit demander le code et **ne rien afficher**.

### 🔑 Téléphone perdu

Aucun verrouillage définitif, donc aucun code de récupération à conserver :

```sql
-- SQL editor Supabase (rôle service_role, hors de portée de la garde)
DELETE FROM auth.mfa_factors WHERE user_id = '<uid>';
```

La session retombe en `aal1` et l'écran d'enrôlement reparaît au prochain passage sur `/admin`.

---

## 2sexies. Traitements planifiés : pg_cron, Vault, journal (ARC-06, 2026-11-07)

**Inventaire du 2026-11-07** (le nombre de workflows planifiés est dans [`FAITS.md`](./FAITS.md)). Cinq écrivent en production, par une Edge
Function à `x-cron-secret`, et quittent GitHub : `renewal-notice.yml` (deux jobs : `renewal-notice`,
`seat-alert`), `inactive-accounts.yml`, `org-digest.yml` (deux modes), `org-webhook-dispatch.yml`.
Les dix-sept autres **restent** : ils lisent, comparent ou sondent (`uptime`, `posture`,
`migration-coverage`, `edge-deploy-drift`, `deploy-sha-drift`, `prod-errors`, `stripe-prices`,
`secrets-age`, `seo-signals`, `daily-digest`, `weekly-digest`), testent le dépôt (`codeql`,
`mutation`, `sabotages`, `gardes-calendrier`, `scalability-volume`, sur une stack jetable) ou
exportent hors fournisseur (`db-backup`, `restore-drill` vers un projet jetable).

| Pièce | Où | Rôle |
|---|---|---|
| `cron_invoke(job)` | mig. `245` | pg_net + `x-cron-secret` lu dans Vault, une ligne `cron_runs` par appel |
| `cron_runs` | mig. `245` | job, début, fin, statut, code HTTP. RLS sans policy, rien pour `anon`/`authenticated` |
| `cron_leases` | mig. `245` + `_shared/cron-lease.ts` | un bail par job : deux passages simultanés ne travaillent jamais ensemble |
| 7 jobs `cosmo-*` | mig. `246` | six appels + `cosmo-cron-runs-close` (relevé des réponses pg_net, toutes les 5 min) |
| `Journal des crons` | `cron-journal.yml` → `ci-alert.yml` | rougit sur un job `absent` ou en `echec` dans sa fenêtre |
| `cosmo-uptime` + `cron_probe()` | mig. `252` | sonde de disponibilité toutes les 5 min (contrôles d'`uptime.yml`), trois lignes `sonde-*` par passage, fenêtre 20 min |

Secrets Vault (noms fixés, jamais de valeur dans le dépôt) : `cosmo_project_url`
(`https://<ref>.supabase.co`) et `cosmo_cron_secret` (**même valeur** que `CRON_SECRET` des Edge
Functions et des secrets Actions). Rattrapage d'un passage manqué : `select public.cron_invoke('<job>');`
en `postgres`, ou le `workflow_dispatch` du workflow d'origine : sûrs tous les deux (bail + rejeu idempotent).

**Sonde pg_cron (mig. `252`, OBS-02)** : voit toutes les 5 min le site Vercel (home et `/guide` prérendus) et GoTrue ; `echec` = la cible répond mal, `absent` = la sonde n'a pas tourné ; `cron_runs_verdict()` rend alors **neuf** lignes.
Elle ne voit PAS une panne de la base elle-même (Postgres ou pg_cron arrêté : seul `absent` le dit) et l'alerte part encore par GitHub : `uptime.yml` garde son `schedule:`, regard extérieur.

**État** : `245` et `246` appliquées et prouvées en production (2026-11-13). Preuves rejouées à chaque commit par
`e2e/rls/cron-journal.test.ts` ; relevés datés : archive.

**Chaque traitement a son équivalent** (aucun ne disparaît, aucun n'est ajouté) :

| Workflow GitHub (heure UTC) | Job pg_cron (`246`) | Appel `cron_invoke` | Fenêtre de la sonde |
|---|---|---|---|
| `org-webhook-dispatch` (`7-59/10 * * * *`) | `cosmo-org-webhook-dispatch`, même heure | `org-webhook-dispatch` | 35 min |
| `org-digest` mode `hourly` (`23 * * * *`) | `cosmo-org-digest-hourly`, même heure | `org-digest?mode=hourly` | 2 h 15 |
| `org-digest` mode `daily` (`41 7 * * *`) | `cosmo-org-digest-daily`, même heure | `org-digest?mode=daily` | 26 h |
| `renewal-notice`, job `renewal-notice` (`12 7 * * *`) | `cosmo-renewal-notice`, même heure | `renewal-notice` | 26 h |
| `renewal-notice`, job `seat-alert` (même déclencheur) | `cosmo-seat-alert`, **07:14** (deux minutes plus tard) | `seat-alert` | 26 h |
| `inactive-accounts` (`37 6 * * *`) | `cosmo-inactive-accounts`, même heure | `inactive-accounts` | 26 h |
| (nouveau) | `cosmo-cron-runs-close` (`*/5 * * * *`) | relevé des réponses pg_net | sans objet |

Les autres workflows planifiés lisent, comparent ou sondent : ils restent sur GitHub, `daily-digest` et
`weekly-digest` aussi (lecture seule, hors périmètre). Les onze jobs pg_cron d'avant ne sont pas touchés.

**Bascule, dans l'ordre (gestes d'Axel).** Les deux ordonnanceurs tournent ensemble entre les étapes 4 et 8 :
c'est voulu, il n'y a ni trou ni doublon (bail). ❌ **Ne jamais retirer les `schedule:` avant l'étape 7.**
Une garde le refuse (`src/edge-cron-lease.guard.test.ts`, job par job d'après `JOBS_BASCULES`).

1. **Edge Functions avec bail déployées** : `Edge deploy` le fait au push sur `main` (`success` sur
   `edf90d80`). Contrôle : `Edge deploy drift` vert, ou `npm run check:edge`. Sans la `245`, elles travaillent
   sans bail comme avant (RPC absente reconnue).
2. **Secrets Vault**, SQL editor, **avant** la preuve de la `246` :
   `select vault.create_secret('https://ykeugqfgklejcdbrmawy.supabase.co', 'cosmo_project_url', 'lue par cron_invoke (mig. 245)');`
   puis `select vault.create_secret('<valeur de CRON_SECRET>', 'cosmo_cron_secret', 'x-cron-secret des fonctions planifiees (mig. 245)');`.
   ⚠️ Une valeur de Supabase ne se relit pas : sans copie, faire tourner `CRON_SECRET` aux trois endroits
   (`supabase secrets set`, `gh secret set`, Vault) et dater `.github/secrets-registry.json`.
   Contrôle : `select name from vault.secrets where name like 'cosmo\_%' order by 1;` rend deux lignes.
3. **Preuve de la `245` en production** (elle s'annule d'elle-même, extension et tables comprises) :
   `supabase db query --linked -f supabase/proofs/245.proof.sql`. **L'erreur est le succès** : le message doit
   commencer par `PREUVE-ANNULEE 0 ECHEC |`. Puis constater l'annulation :
   `select (select count(*) from pg_extension where extname = 'pg_net') as pg_net, to_regclass('public.cron_runs') as journal;`
   doit rendre `0` et `NULL`. Un seul `ECHEC` : on s'arrête, on n'applique pas.
4. **Appliquer la `245`** (SQL editor ou `apply_migration`, **jamais** `supabase db push`), sous le nom
   `245_cron_journal`. Relire au catalogue : `pg_net` installée, RLS active et zéro policy sur `cron_runs` et
   `cron_leases`, `has_function_privilege` des six fonctions (`anon` non, `authenticated` non, `service_role` oui
   sur le bail seul).
5. **Preuve de la `246`** : `supabase db query --linked -f supabase/proofs/246.proof.sql`, même lecture
   (`PREUVE-ANNULEE 0 ECHEC |`, Vault présent). **Appliquer la `246`** sous le nom `246_cron_planification`,
   puis `select jobname, schedule, command, active from cron.job order by jobname;` : **dix-huit lignes**
   (onze d'avant, sept nouvelles), toutes actives.
6. **Après 15 minutes** : `select job, status, http_code, started_at from public.cron_runs order by id desc limit 10;`
   montre `org-webhook-dispatch` en `ok` / `200`. `config_missing` : un secret Vault manque. `error` / `401` : la
   valeur de `cosmo_cron_secret` n'est pas celle de `CRON_SECRET`. Dans les deux cas **on s'arrête**, GitHub
   tient encore tout, rien n'est perdu.
7. **Un tour de chaque job** (heures UTC : `inactive-accounts` 06:37, `renewal-notice` 07:12, `seat-alert` 07:14,
   `org-digest-daily` 07:41, `org-digest-hourly` à la minute 23, webhooks toutes les dix minutes). Appliquer
   `245` et `246` en fin de journée : le lendemain à 07:45 UTC, les six ont tourné. Condition de passage,
   **toutes** vraies :
   - `select * from public.cron_runs_verdict();` rend six lignes, verdict `ok` partout ;
   - `select job, count(*) filter (where status = 'ok') as ok, max(started_at) from public.cron_runs group by job order by job;`
     montre au moins un `ok` pour chacun des six jobs ;
   - `gh workflow run cron-journal.yml` puis le run sort vert.

   ⚠️ Un `ok` veut dire « l'Edge Function a répondu 2xx », y compris `skipped: already_running` pendant la
   double planification. Il prouve que la chaîne pg_cron, Vault, pg_net, fonction marche, pas qu'un envoi réel a
   eu lieu : le contrôle d'envoi reste celui des fonctions (`renewal_notices`, `org_webhook_deliveries`).
   **Bascule en deux temps** (2026-11-13) : un job quitte GitHub le jour de son premier `ok`, en l'ajoutant à
   `JOBS_BASCULES` (`scripts/check-cron-runs.mjs`, source unique de la garde et de la sonde). Faits le
   2026-11-13 : `org-webhook-dispatch` et `org-digest-hourly`, `Journal des crons` planifié (minute 51).
   **Reste** : `inactive-accounts`, `renewal-notice` + `seat-alert` (un seul déclencheur, ensemble),
   `org-digest-daily`, à basculer après leur premier `ok`, lisible dès 07:45 UTC le 2026-11-14.
8. **Retirer les `schedule:` GitHub** : un job à la fois, par la bascule en deux temps ci-dessus (`JOBS_BASCULES`).

**Retour arrière, écrit avant d'en avoir besoin.** Deux ordonnanceurs en même temps sont sûrs (bail) ; un trou ne
l'est pas. Donc **toujours rendre la main à GitHub d'abord, retirer pg_cron ensuite**.

- *Avant l'étape 8* (`245` et `246` appliquées, GitHub encore planifié) : rien n'est cassé. Pour arrêter pg_cron :
  `select cron.unschedule(jobname) from cron.job where jobname in ('cosmo-org-webhook-dispatch', 'cosmo-org-digest-hourly', 'cosmo-org-digest-daily', 'cosmo-renewal-notice', 'cosmo-seat-alert', 'cosmo-inactive-accounts', 'cosmo-cron-runs-close');`
  Tables, fonctions et extension peuvent rester, inertes. Un arrêt durable se versionne sous son propre
  numéro (`248` ou suivant), jamais par édition de la `246`. Le `Journal des crons` n'est pas encore planifié :
  rien ne rougit.
- *Après l'étape 8* (GitHub ne planifie plus) : **d'abord** `git revert <SHA de la bascule>` puis
  `git push origin HEAD:main` (les `schedule:` reviennent, la garde revient avec ; environ 40 s jusqu'en
  production, voir § 3). **Ensuite seulement**, si pg_cron doit s'arrêter, la commande `cron.unschedule` ci-dessus.
  Entre les deux, le bail évite le doublon. Passage manqué entre-temps : `workflow_dispatch` du workflow concerné
  ou `select public.cron_invoke('<job>');` en `postgres`, sûrs tous les deux.
- *`CRON_SECRET` tourné* : les trois endroits (Supabase, GitHub, Vault) ensemble. Le Vault oublié donne des
  `error` / `401` dans `cron_runs`, un verdict `echec`, et `Journal des crons` rouge en moins de deux heures.

---
