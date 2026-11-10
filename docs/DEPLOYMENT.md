# Déploiement & Runbook — COSMO

Procédures opérationnelles : déployer, appliquer une migration DB, rollback,
réagir à un incident. À lire avant toute mise en prod.

> Sécurité des secrets & rotation : voir [`SECURITY.md → Rotation des secrets`](./SECURITY.md#rotation-des-secrets).
> Coffre, accès d'urgence, second administrateur, gestes qui restent manuels :
> [`SECURITY.md` § Coffre](./SECURITY.md#coffre-et-accès-durgence-v42-sec-04) et [`CONTINUITE.md`](./CONTINUITE.md).
> Failles connues / posture : `faille.md`.

---


## 🕳️ Angles morts · ce que ce document NE mesure PAS (2026-09-16)

> Ce document affirme des procédures que rien ne pèse : chaque ligne nomme une affirmation qui n'était
> vérifiée par rien, et la garde qui la vérifie depuis. 🔴 **Une garde posée n'est pas un angle mort
> fermé** : la dernière colonne dit ce que son vert ne prouve pas. L'énoncé du 2026-09-16, la colonne
> « État » du 2026-09-21 et les mesures datées sont archivés sans une coupe :
> [`archive/DEPLOYMENT-recits-et-releves-2026-06-07-au-2026-11-08.md`](./archive/DEPLOYMENT-recits-et-releves-2026-06-07-au-2026-11-08.md).

| # | Angle mort (énoncé du 2026-09-16) | Garde qui le couvre | 🔴 Ce qu'elle ne prouve pas |
|---|---|---|---|
| AM-1 | **Rien ne comparait le commit déployé sur Vercel à `main`** (le défaut C-35 des Edge Functions, côté front) | `npm run check:deploy` (`T-8`), job `Deploy SHA drift` horaire branché sur `ci-alert.yml` : lit `/version.json` en production et distingue à jour, retard et dérive. Il compare au dernier commit **tagué vert** (§ 1) | Rien de plus que le SHA servi : pas que le déploiement fonctionne (voir AM-5) |
| AM-2 | Le **rollback** n'avait jamais été éprouvé | `restore-drill.yml` › `drill-auto`, mensuel (`ROB-01`, § 7), qui a fondu le `dump-check` trimestriel (`C-86`) ; retour par `git revert` répété le 2026-10-16 (§ 3) | Que le **« Promote » de Vercel** fonctionne : geste d'Axel, jamais joué (`M-47`, § 3). Ni un vrai sinistre (§ 7) |
| AM-3 | Les **variables d'environnement Vercel** ne sont comparées à rien (une `VITE_*` absente a déjà changé la forme du bundle et aveuglé la garde de budget de ~45 ko) | `npm run check:env` (`C-105`) : contrat statique des 8 `VITE_*` avec l'**effet d'absence** de chacune ; la moitié Vercel dort tant que `VERCEL_TOKEN` et `VERCEL_PROJECT_ID` ne sont pas posés (`M-59`) | Les **valeurs** : une présence, jamais un contenu |
| AM-4 | L'**état réel de Turnstile** n'était écrit nulle part de vérifiable | `npm run check:env` (`C-105`) | Idem AM-3 |
| AM-5 | `uptime.yml` mesure qu'une page **répond**, jamais qu'elle **fonctionne** (une coquille SPA vide rend 200) | `uptime.yml` (`C-104`) : trois marqueurs **absents de la coquille SPA**, une 2ᵉ page prérendue, le corps de `/auth/v1/health` (§ 9). L'ancien marqueur `grep -i cosmo` ne pouvait pas échouer (la coquille contient le mot 21 fois) | Rien de plus que le contenu servi |
| AM-6 | Le **déploiement des Edge Functions** était un geste manuel (`check:edge` voit la dérive après coup, rien ne déployait depuis `main`) | `.github/workflows/edge-deploy.yml` (§ 2bis) ; sélection `scripts/edge-deploy-select.mjs`, témoin `edge-deploy-select.guard.test.mjs` | Une fonction déployée à la main hors `main` : c'est `check:edge` qui la voit, après coup |
| AM-7 | Les **artefacts de CI** n'avaient aucune durée de rétention (le quota de 11,5 Go a été atteint le 2026-10-23 et a bloqué la sauvegarde) | `scripts/artefacts-retention.guard.test.mjs` : un `retention-days` entier de 1 à 30 sur chaque `upload-artifact` et `upload-pages-artifact` | Le **quota** : la taille stockée n'est mesurée nulle part ; le plafond de 30 jours se relit si un artefact doit durer plus |

---

## 1. Pipeline CI/CD

| Étape | Où | Bloquant |
|---|---|---|
| Le noyau : lint, `tsc -b`, tests + couverture, gardes statiques, i18n, build + budget, fichiers sensibles, RLS d'intégration | `ci-noyau.yml` (`CI noyau`, 4 jobs, ~5 min) | ✅ seul bloquant |
| `npm audit` prod deps (high+) | `ci.yml` (`CI etendue`), job `audit` | ❌ |
| Playwright E2E + a11y (critical=0), Lighthouse | `ci.yml`, jobs `e2e`, `lighthouse` | ❌ |
| Déploiement front | Vercel, sur push `main`, **après** le tag `ci-vert/<sha>` (porte ci-dessous) | attend le noyau |

Un `git push origin main` déclenche la CI **et** un build Vercel du **front uniquement**, qui
attend le verdict vert du noyau avant de construire. La base de données n'est **jamais** touchée
par ce push.

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

### Vérifier la dérive repo ↔ prod (après toute migration appliquée)

1. Relire au catalogue l'objet que la migration crée (`pg_get_functiondef`,
   `information_schema`, `pg_policies`) : c'est la seule preuve forte.
2. `Migration coverage` (`migration-coverage.yml`, quotidien, lecture seule)
   range chaque fichier contre le ledger ET le catalogue de prod, et rougit sur
   un fichier dont aucun objet n'existe (= migration non appliquée).

`check:drift` (deux étapes à la main, jamais lancé en CI) est retiré le
2026-11-08 (V18.1) : son seul verdict d'échec, « objet attendu absent de la
prod », est celui d'`ABSENT DES DEUX` dans `check:migration-coverage`.

---

### Hook `pre-push` : pas de poussée sur un noyau rouge (2026-10-21, sans contournement depuis le 2026-11-06)

`.githooks/pre-push` lance `scripts/pre-push-main-red.mjs` : une poussée vers `main` est refusée si
le dernier run `CI noyau` de `main` est rouge, ou si son état est illisible (`gh` absent ou non
authentifié). Il s'installe une fois par clone : `git config core.hooksPath .githooks`.

🔴 **Aucun contournement** (vague 2.3) : la variable qui forçait la poussée, banalisée (CI-01), est
retirée, et le script ne lit aucune variable d'environnement. Le seul chemin pour réparer un noyau
rouge passe par un verdict vert sur le correctif lui-même :

1. `git push origin HEAD:refs/heads/noyau/<nom>` : le noyau tourne sur la branche ;
2. une fois ce run `CI noyau` vert, `git push origin HEAD:main` : le hook laisse passer ce SHA, et
   lui seul, parce qu'il a déjà un verdict vert ;
3. `git push origin --delete noyau/<nom>`.

⚠️ `--no-verify` saute tout hook local : ❌ interdit (`CLAUDE.md`). Seule une protection de branche
côté GitHub (statut `CI noyau` requis) fermerait ce dernier chemin ; c'est un réglage du dépôt.
Témoins : `scripts/pre-push-main-red.test.mjs` (noyau rouge + ancienne variable posée = refus ;
gh illisible = refus ; la variable n'existe plus hors `docs/archive/`).

### Porte de déploiement : la production n'attend plus que le noyau (CI-02, 2026-11-07)

Jusqu'au 2026-11-07, Vercel construisait et publiait chaque poussée sur `main` en ~40 s, avant le
verdict de `CI noyau` (~5 min) : un commit rouge partait en production. Désormais :

1. `CI noyau` rend son verdict sur la poussée (`main` ou `noyau/<nom>`).
2. `.github/workflows/ci-vert.yml` (`workflow_run`) pose un tag léger : `ci-vert/<sha>` sur un
   vert, `ci-rouge/<sha>` sur un rouge de `main` seulement. Il garde les 50 plus récents de chaque
   sorte. `GITHUB_TOKEN` seul (`contents: write` sur ce job), aucun secret.
3. Vercel lance `vercel.json` → `ignoreCommand` :
   `node scripts/vercel-ignore-build.mjs; test $? -ne 78`. Pour un build de **production**
   (`VERCEL_ENV=production` ou branche `main`), le script sonde
   `git ls-remote https://github.com/kelax12/COSMO1.2 refs/tags/ci-vert/<sha>` toutes les 20 s,
   15 min au plus. Tag vert : il sort en 78, `test` rend 1, **Vercel construit**. Tout le reste
   rend 0 et Vercel **ignore** le build (déploiement `CANCELED`) : tag `ci-rouge`, délai dépassé,
   GitHub injoignable, SHA illisible, et même un Node qui plante (il sort en 1, pas en 78). La
   raison est écrite dans le journal du build, lignes `[porte]`.
4. Les builds d'**aperçu** (branches `noyau/*` et autres) construisent tout de suite, comme avant.

Pourquoi `git ls-remote` et pas l'API REST : sans jeton, l'API est limitée à 60 requêtes par heure
et par IP, et les IP de build de Vercel sont partagées. Le protocole git d'un dépôt public n'a pas
ce plafond et ne demande aucun jeton.

Délai normal : la poussée sur `main` d'un SHA déjà vert sur `noyau/<nom>` construit tout de suite
(le tag existe) ; une poussée directe attend le noyau, soit ~5 min de plus qu'avant. Le build en
attente occupe le slot de build Vercel : un aperçu poussé pendant ce temps patiente.

**Si le noyau est rouge** : le build de production est ignoré dès le tag `ci-rouge` (au plus
15 min sans verdict), la production reste sur le dernier déploiement vert, `CI noyau` sonne
(`ci-alert.yml`) et le hook `pre-push` bloque `main` jusqu'au correctif (§ Hook ci-dessus). Le
correctif, une fois vert, part en production comme n'importe quel commit. Un **Re-run** vert après
coup pose `ci-vert/<sha>` mais ne relance pas le build déjà ignoré : pousser un commit, ou
redéployer depuis Vercel (case **cochée**, le tag existe désormais).

**Si `CI vert` est rouge** (tag non posé) : `ci-alert.yml` sonne, rien ne part en production.
Réparer, puis Re-run de `CI vert` et redéploiement Vercel case cochée.

**Urgence, déployer un SHA sans verdict vert** (geste d'Axel, tableau de bord Vercel, aucun
réglage du projet à changer) : Deployments → le déploiement du SHA voulu → **⋯ → Redeploy** →
**décocher « Use project's Ignore Build Step »** → Redeploy. Revenir en arrière ne passe pas par
la porte : **Promote** / Instant Rollback d'un déploiement existant ne reconstruit rien (§ 3).
⚠️ Un SHA servi sans tag vert rend `Deploy SHA drift` rouge (`prod_en_avance`) jusqu'au prochain
déploiement vert : c'est la trace voulue du contournement.

`Deploy SHA drift` compare la production au **dernier commit tagué vert** de `main`, plus à sa
tête : un `main` rouge hors production est l'état normal. Aucun tag `ci-vert/*` dans les
500 derniers commits rend la garde rouge (`aucun_vert`).
Témoins : `scripts/porte-deploiement.guard.test.mjs` (décision, commande de `vercel.json` jouée
sous `sh`, câblage de `ci-vert.yml`), `scripts/check-deploy-sha.guard.test.mjs`.

## 2bis. Déployer les Edge Functions

⚠️ **Vercel ne déploie PAS les Edge Functions.** Un `git push` livre le front ;
les fonctions Deno, elles, partent par `.github/workflows/edge-deploy.yml` (AM-6,
2026-10-23) :

- **Quand** : après un run `CI noyau` **vert** (le noyau bloquant : lint, `tsc -b`, tests et
  couvertures, gardes statiques, i18n, build et budget, fichiers sensibles, RLS d'intégration ;
  `ci-noyau.yml`, vague 2.2 du 2026-11-06) issu d'un push sur `main`, sur le SHA
  qu'il a validé. Un déploiement à la fois (`concurrency: edge-deploy`).
- **Quoi** : `scripts/edge-deploy-select.mjs` diffe le dernier SHA déployé (lu
  dans le titre du dernier run vert) contre ce SHA. Une fonction part si un de
  ses fichiers change, si un `_shared/` qu'elle embarque change (directement ou
  par un autre `_shared`), ou si `supabase/config.toml` change (toutes). Une
  fonction sans section `config.toml` ou sans sonde fait échouer le run.
- **Puis** : `check:edge` et `check:edge-smoke`. Un rouge sonne par `ci-alert.yml`,
  et le run suivant repart de la dernière base **verte** : ce qui n'est pas parti
  repart.
- **Secret** : `SUPABASE_ACCESS_TOKEN` (le même que `edge-deploy-drift.yml`).
- ❌ Pas de déclenchement manuel du workflow : il contournerait « `CI noyau` verte
  sur ce SHA ». Un run rouge se rejoue par « Re-run ».

Déploiement à la main (secours, depuis la racine, sur `main` à jour) :

```bash
supabase functions deploy stripe-webhook --use-api --project-ref ykeugqfgklejcdbrmawy
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

> ✅ Déployée en production depuis le 2026-08-29 (`verify_jwt` actif). Fumée de référence : `POST` sans
> corps → `503 mail_not_configured` quand les secrets manquent, `GET` → `405`, sans JWT → `401` du
> gateway. L'étape 1 dépend du même domaine vérifié que § 2ter. *(Pourquoi cette ligne : la doc l'a dite
> livrée six jours avant qu'elle le soit ; le récit est archivé.)*

**Tant que `RESEND_API_KEY` est absente**, la fonction répond `503
mail_not_configured` — et c'est un état prévu, pas une panne : le formulaire
affiche alors « écrivez-nous directement à contact@thecosmo.app » avec un lien
`mailto:` pré-rempli. Aucun message n'est perdu en silence.

⚠️ `BUG_REPORT_FROM` doit être une adresse **du domaine vérifié**, jamais
l'adresse de destination d'un fournisseur tiers (Gmail refuserait de signer).
L'auteur du rapport, lui, arrive en `Reply-To` — répondre au mail répond bien à
l'utilisateur, et son identité vient du JWT, jamais du corps de la requête.

---

## 2ter. Emails d'authentification (Supabase Auth) · **SMTP EN SERVICE depuis le 2026-08-29 au soir ; les confirmations restent désactivées**

> 🔴 **État à lire avant la procédure.** Le serveur d'envoi d'Auth est en service depuis le 2026-08-29 au soir
> (domaine d'envoi `send.thecosmo.app`, `npm run check:mail` vert, seul avertissement : DMARC `p=none`,
> correct pour démarrer). Les **confirmations d'inscription restent désactivées**, par décision d'Axel
> (finding `G-2`) : aucune adresse inscrite par e-mail et mot de passe n'a jamais été prouvée, la colonne
> `email_confirmed_at` dit « confirmé » parce que personne n'a demandé de confirmation. Activer les
> confirmations ne dépend plus que d'une décision.
>
> ⚠️ Le DNS ne prouve toujours pas qu'un e-mail ARRIVE : la preuve reste un compte jetable vérifié sur
> Gmail ET Outlook (§ « Vérification » plus bas). *(Pourquoi cet encadré : le titre de cette section a dit
> « non configurés » seize jours après la mise en service ; la mesure du 2026-09-14 est archivée.)*

> 🔴 **Ce sont les emails que Supabase envoie AUX UTILISATEURS**, pas ceux qu'envoient les Edge
> Functions. Les deux passent par Resend, mais ce sont deux chemins distincts, avec deux
> configurations distinctes : `report-bug` et `renewal-notice` appellent l'API Resend depuis du
> code que nous écrivons ; GoTrue, lui, envoie en **SMTP** depuis un serveur que nous ne
> contrôlons pas. Poser `RESEND_API_KEY` ne configure QUE le premier.

### État des emails Auth avant la mise en service (27 au 29 août 2026) : archivé

Le constat d'avant la mise en service (comptes en base, DKIM absent, sous-domaine d'envoi inexistant, mode de défaillance corrélé sous trafic) est conservé à sa date dans [`archive/DEPLOYMENT-emails-auth-avant-mise-en-service-2026-08-27-au-2026-08-29.md`](./archive/DEPLOYMENT-emails-auth-avant-mise-en-service-2026-08-27-au-2026-08-29.md). Il fonde l'ordre des gestes ci-dessous : le serveur d'envoi dédié se règle **avant** toute campagne, parce que la défaillance ne se déclenche que sous trafic.

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

## 2quinquies. Second facteur sur `/admin` · **EN VIGUEUR : mig. `131` appliquée le 2026-08-31, TOTP enrôlé le 2026-09-01**

> 🔴 **Suivre l'ordre ci-dessous.** La mig. `131` est au ledger de production et un facteur `totp` est
> vérifié sur le compte admin depuis le 2026-09-01. Appliquée avant l'enrôlement, à la demande d'Axel, elle a
> rendu `/admin` inaccessible du 2026-08-31 au 2026-09-01 : l'écran d'enrôlement, censé rester atteignable,
> levait en phase de rendu. Ne pas suivre la procédure a coûté une journée ; le récit est archivé.

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

Secrets Vault (noms fixés, jamais de valeur dans le dépôt) : `cosmo_project_url`
(`https://<ref>.supabase.co`) et `cosmo_cron_secret` (**même valeur** que `CRON_SECRET` des Edge
Functions et des secrets Actions). Rattrapage d'un passage manqué : `select public.cron_invoke('<job>');`
en `postgres`, ou le `workflow_dispatch` du workflow d'origine : sûrs tous les deux (bail + rejeu idempotent).

**État relu le 2026-11-09, production `ykeugqfgklejcdbrmawy`, lecture seule** : `pg_cron` 1.6.4 installé
(`cron.timezone = GMT`, onze jobs `cosmo-*`), `pg_net` disponible en 0.19.5 mais **non installé** (la `245`
le crée), `supabase_vault` installé avec **zéro secret**, ni `cron_runs` ni `cron_leases`, ledger jusqu'à
`247`, aucune trace de `245` ni `246`. Les cinq Edge Functions sont `ACTIVE` avec `verify_jwt = false`
(pg_net n'envoie pas de JWT, les workflows non plus : même porte, `x-cron-secret`).

**Preuves.** Rejouées à chaque commit par `e2e/rls/cron-journal.test.ts` sur une pile Supabase réelle
(`pg_cron` et `pg_net` vrais) : `245` avec et sans secrets Vault, `246`, chacune `PREUVE-ANNULEE 0 ECHEC`,
et un job pg_cron de test qui écrit dans `cron_runs` puis se ferme sur la réponse de pg_net (job
`rls-integration` du run `42664142079`, sur `edf90d80`). **Pas encore jouées en production** : c'est l'étape 3
ci-dessous, et ce qu'elle seule peut dire (droits de `postgres` sur `net._http_response` et sur
`vault.decrypted_secrets` dans le projet hébergé).

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
Une garde le refuse (`src/edge-cron-lease.guard.test.ts`, constante `BASCULE_FAITE`).

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
8. **Retirer les `schedule:` GitHub** : le commit existe sur `noyau/cron-bascule-2` (garde les
   `workflow_dispatch`, planifie `Journal des crons` à la minute 51, retourne `BASCULE_FAITE`, régénère
   `FAITS.md`, corrige la table des classes de `TESTING.md`). Après les étapes 1 à 7 seulement :

   ```bash
   git fetch origin
   git switch -c bascule origin/noyau/cron-bascule-2
   git rebase origin/main
   git push origin HEAD:noyau/cron-bascule-final
   ```

   Attendre `CI noyau` vert **sur ce SHA**, puis `git push origin HEAD:main`. Le lendemain :
   `gh run list --workflow renewal-notice.yml --event schedule --limit 3` ne montre plus de run planifié,
   et `Journal des crons` est vert deux heures de suite.

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

## 2. Appliquer une migration de base de données

⚠️ **Les migrations ne sont PAS appliquées par le déploiement Vercel.** Elles
doivent être poussées séparément, idéalement **avant** le déploiement front qui
en dépend (additive-first : ajouter colonnes/fonctions avant de livrer le code
qui les lit).

Une migration s'écrit dans `supabase/migrations/<AAAAMMJJHHMMSS>_nom.sql` (§ 6), plus jamais dans
`supabase/migration/`. Tant que la V8.3 n'a pas aligné le ledger de prod (§ 6), elle s'applique comme
avant, en passant au MCP le nom du fichier SANS horodatage (`base-egale-prod` la reconnaît par ce nom) :

```bash
# apply_migration(project_id, name: '<nom>', query: <texte du fichier>), puis relire au catalogue.
# ❌ Pas de `supabase db push` avant la V8.3 : le ledger de prod ne connaît pas encore la baseline.
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

### ✅ Répété le 2026-10-16 : le retour arrière par `git revert` (moitié de `M-47`)

Un commit sans effet puis son revert, sur `main`, par un agent : **40 s** puis **33 s** de la poussée à la
production (heures lues dans les statuts de déploiement GitHub), vérifiés de l'extérieur par `version.json`.
Commits, heures et tableau : archive.

**Ce que la répétition a appris :**
- 🔴 **Vercel déploie sans attendre la CI.** Un revert est en ligne en ~35 s, mais un mauvais
  commit l'est tout aussi vite : la CI (25 min) juge APRÈS la mise en production. Le retour
  arrière est donc le vrai filet, pas la CI. ✅ **Fermé le 2026-11-07** par la porte de
  déploiement (§ 1) : un revert part désormais après le vert du noyau (~5 min), pas en 35 s.
  Le retour arrière immédiat reste le **Promote** ci-dessous, qui ne reconstruit rien.
- ⚠️ **Une URL inconnue répond 200** (repli SPA, limite assumée) : pour prouver qu'un fichier a
  disparu, lire son contenu, jamais son code HTTP.
- ❌ **Ne pas enchaîner `git revert -q` et `git commit --amend`** : si le revert échoue en silence,
  l'amend réécrit le commit précédent. C'est arrivé ici ; le push a été refusé (pas d'avance
  rapide) et rien de faux n'est parti. Lancer le revert sans `-q`, lire sa sortie, puis seulement
  pousser.

### À faire par Axel : l'autre moitié de `M-47`, le « Promote » de Vercel (5 min)

Pas de jeton Vercel côté agent (`M-59`) : ce geste est le tien. À jouer une fois, à froid :

1. Vercel → projet COSMO → **Deployments**. Repérer le déploiement de production courant et le
   précédent (vert).
2. Sur le précédent : **⋯ → Promote to Production** (ou « Instant Rollback »). Noter l'heure.
3. Vérifier : `curl -s https://thecosmo.app/version.json` doit rendre le commit du déploiement
   promu. Noter l'heure : c'est le délai réel.
4. ⚠️ Après un « Promote », Vercel **ne redéploie plus automatiquement** les pushs suivants tant
   que le déploiement courant n'est pas re-promu. Re-promouvoir le plus récent, puis revérifier
   `version.json`, et attendre le prochain run `Deploy SHA drift` (vert attendu).
5. Écrire les deux heures ici, sous ce paragraphe, et fermer `M-47` dans `a-faire-manuel.md`.

La contrepartie base de données n'a rien à rejouer tant qu'aucune migration n'accompagne le
déploiement défait : les migrations sont additives (ci-dessous), et un retour arrière du front ne
touche pas la base.

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
| `SUPABASE_SECRET_KEY` (clé secrète, rôle `service_role`) | ⚠️ **serveur seulement** : lue par la fonction `api/collect.ts`, jamais préfixée `VITE_`. Posée par l'intégration Vercel ↔ Supabase, en `production` seulement. Sans elle, la mesure d'audience n'écrit plus rien (mig. `223`, `TR-1`) ; `check:env --vercel` vérifie sa présence | — |

Les mêmes secrets `VITE_*` doivent exister en **GitHub Actions secrets** (job
`build` / `e2e`).

## 6. Schéma & ledger de migration (DR / ISO 27001)

**Depuis le 2026-11-09 (ROB-02, V8.1-8.2), le dépôt suit le format de la CLI Supabase.**

| Dossier | Rôle |
|---|---|
| `supabase/migrations/` | **Le seul où l'on écrit.** `<AAAAMMJJHHMMSS>_snake_case.sql`. Premier fichier : `20261109120000_baseline.sql`, schéma de PRODUCTION du 2026-11-09 (schéma seul, aucune donnée). Puis les migrations postérieures (`206`, `245`, `246`, jamais appliquées en prod, y ont été déplacées). |
| `supabase/migration/` | Historique figé `000` à `247` et ses preuves (`supabase/proofs/`, `proofs/`). Lu par les gardes statiques, plus jamais appliqué. |

**Construire une base** : `supabase start` (ou `supabase db reset`) applique `supabase/migrations/` et
inscrit chaque version au ledger LOCAL ; `node scripts/verifier-migrations.mjs` relit ce ledger. C'est ce que
font `contrat-donnees` et `rls-integration` (`CI noyau`), `e2e-supabase.yml` et `scalability-volume.yml`.

**La preuve que la base fraîche EST la prod** : `schema-prod.yml` › `base-egale-prod` (quotidien, et à
chaque push qui touche `supabase/migrations/`). Il retire de l'arbre du runner les migrations que le ledger de
prod ne connaît ni par version ni par nom (listées au résumé), construit la base par la CLI, puis compare
objet par objet (schéma `public`, triggers sur `auth.users`, policies et bucket de storage, `pg_cron`,
publication Realtime) à la prod, lue en lecture seule (`scripts/schema-prod.mjs`). Diff vide attendu.

### Écarts trouvés le 2026-11-09 (rejeu de `supabase/migration/` contre la prod)

Premier passage, run `42718089378` : **6** objets en prod seulement, **23** dans le dépôt seulement,
**73** définitions différentes. La baseline suit la PROD sur chacun ; les corriger est un autre chantier,
par migration postérieure.

- **Tables cœur** (`tasks`, `habits`, `events`, `lists`, `okrs`, `friends`, `categories`, `shared_tasks`,
  `friend_requests`) : créées au Dashboard avant le dépôt. En prod, `user_id` est **nullable**, plusieurs
  `NOT NULL`, défauts et `CHECK` (`end_after_start`, `okrs_progress_check`, `tasks_priority_check`) manquent,
  `okrs.start_date` est un `timestamptz`, l'ordre des colonnes diffère. `affiliate_settings` et
  `affiliate_commissions` portent la déduction de `238_affiliation_deduction`, **en prod sans fichier**.
- **Triggers absents de la prod** : `update_*_updated_at` (`tasks`, `events`, `habits`, `lists`, `okrs`),
  `subscriptions.trg_prevent_user_id_change`, et `on_auth_user_created_seed_categories` sur `auth.users`.
- **Index** : 9 du dépôt absents de la prod, 3 de la prod absents du dépôt (`idx_friend_requests_receiver`,
  `_sender`, `idx_shared_tasks_friend`) ; `friend_requests` sans `user_id` ni sa contrainte unique.
- **50 fonctions** : le plus souvent le même corps sans ses commentaires (appliqué par `apply_migration`
  après nettoyage), parfois un corps différent (`get_my_habits`, `toggle_habit_completion_v2`,
  `affiliate_process`, `affiliate_compute` à 6 arguments en prod contre 5 au dépôt). 8 commentaires d'objets.
- `164` (en prod hors ledger) : son effet est dans la baseline, comme le reste ; il n'y a plus rien à rejouer.

### Ce qui reste pour la V8.3 (application par la CI) · décrit, NON exécuté

❌ Aucune de ces commandes n'a été lancée : chacune écrit dans le ledger de production.

1. Axel pose un secret d'APPLICATION distinct de `SUPABASE_DB_URL` (lecture) : `SUPABASE_ACCESS_TOKEN` +
   mot de passe de base, ou une URL dédiée. Déclaré dans `scripts/artefacts-donnees-prod.guard.test.mjs`.
2. Aligner le ledger de prod sur le dossier, une seule fois :
   ```bash
   supabase link --project-ref ykeugqfgklejcdbrmawy
   supabase migration list                                   # attendu : les ~200 versions distantes sans fichier
   supabase migration repair --status reverted <v1> <v2> …   # chaque version distante antérieure à la baseline
   supabase migration repair --status applied 20261109120000 # la baseline EST la prod
   supabase migration list                                   # local = distant, puis 206/245/246 « en attente »
   ```
   `repair` n'exécute aucun SQL : il écrit des lignes de ledger. Les anciennes versions restent lisibles à
   l'historique git et dans `supabase/migration/`.
3. Le job d'application (`supabase db push`, après le noyau vert) ne pousse que ce que le ledger ne
   connaît pas. `206` attend le front qui ne lit plus les jalons ; `245`-`246`, la procédure § 2sexies.
4. Après chaque application : `base-egale-prod` doit rester vert. Un rouge = une migration posée à côté du
   dossier (Dashboard, SQL editor) : la versionner, jamais éditer la baseline.

**Garde complémentaire** : `Migration coverage` (quotidien) range encore chaque fichier de l'historique
contre le ledger et le catalogue ; `base-egale-prod` juge l'état entier.

## 7. Backup & Disaster Recovery (runbook)

> 🔎 **État au 2026-11-08 (ROB-01, vague 4.4).** Le dump quotidien est **restauré chaque mois, sans humain**,
> par le job `drill-auto` de `restore-drill.yml` (le 9 à 05:43 UTC), et une garde d'**absence**
> (`restore-drill-fraicheur.yml`, hebdomadaire) rougit si aucun drill n'est vert depuis 35 jours. Les deux
> sonnent par `ci-alert.yml`. Le `dump-check` trimestriel (C-86), qui ne lisait qu'une table des matières,
> est fondu dans ce drill. Détail : § « Drill automatique mensuel » ci-dessous.
>
> **Preuve sur `main`** (2026-11-08, SHA `88699890`) : sauvegarde avec manifeste (`db-backup`, run
> `42463066645`), puis drill vert (`restore-drill`, run `42463160221` : 91 tables comptées, comptages
> identiques au manifeste), puis **témoin rouge** (run `42463289640` : `public.tasks` altérée d'une unité dans
> le manifeste lu, le drill rougit). Le premier drill vert, du 2026-11-07, avait tourné sur la branche
> `noyau/drill-auto` (run `42380272895`) ; ces trois runs sont les premiers sur `main`.

### Drill automatique mensuel · `restore-drill.yml` › `drill-auto` (ROB-01, 2026-11-07)

**Le mécanisme.** `db-backup.yml` ouvre une transaction `REPEATABLE READ` en lecture seule,
exporte son snapshot, y compte les lignes de chaque table (`scripts/sql/comptages-sauvegarde.sql`),
puis lance `pg_dump --snapshot` sur ce même snapshot : le manifeste décrit **exactement** les
lignes du dump. Il part chiffré comme le dump (artefact `db-comptages`, 30 jours). Chaque mois,
`drill-auto` télécharge les deux, déchiffre sur le runner, restaure dans un **Postgres 17
jetable** (service container détruit avec le job, `PGHOST=localhost` imposé par
`scripts/restore-drill.mjs`), recompte avec la **même** requête, et compare.

| Ce que le drill PROUVE | Comment |
|---|---|
| le dernier dump se **déchiffre** avec `BACKUP_PASSPHRASE` | mêmes refus que `dump-check.mjs` : clair déguisé, phrase fausse, fichier tronqué |
| il se **restaure** sur un Postgres 17 vierge, et en combien de temps | `pg_restore --no-owner`, durée au résumé du job |
| **chaque table** de `public` et `auth.users` revient avec **exactement** ses lignes | comptages comparés au manifeste du même snapshot : une ligne, une table de plus ou de moins = rouge |
| la RLS revient : même nombre de policies et de tables sous RLS | compteurs du manifeste |
| l'isolation est **effective** | le rôle `authenticated`, avec les claims d'un vrai propriétaire, voit ses tâches et seulement elles |
| aucune erreur de restauration n'est avalée | chaque erreur de `pg_restore` est classée ; seules sont tolérées celles des extensions propres à Supabase absentes de l'image officielle (liste fermée), jamais sur un objet de `public` ou `auth`, et leur nombre doit égaler celui que `pg_restore` annonce |

| Ce qu'il NE PROUVE PAS | Qui le couvre |
|---|---|
| **pg_cron, pg_net, Vault, pg_graphql** : absents de `postgres:17`, leurs objets et données (jobs planifiés de la mig. `246`, secrets du Vault) ne sont **pas** restaurés, et c'est dit au résumé | le drill **manuel** vers un projet Supabase jetable (job `drill`, ci-dessous) |
| la restauration sur la **plateforme Supabase** (rôles gérés, `supabase_admin`, Auth qui redémarre sur le schéma restauré) | le drill manuel |
| les **Edge Functions**, leurs secrets, le **Storage** (fichiers), la config du Dashboard | aucun dump ne les contient : § Restauration réelle, étape 4 |
| un **parcours applicatif** (se connecter, créer une tâche) | geste humain, jamais rejoué depuis le 2026-09-01 |
| le **RTO réel** d'un sinistre (création du projet, re-pointage Vercel, redéploiements) | le drill manuel chronomètre la seule restauration |
| un **RPO** meilleur que 24 h | rien : c'est la limite d'un dump quotidien sans PITR (plan Free) |
| que les **comptages** de la prod sont justes | le drill prouve que la restauration rend le dump, pas que le dump rend la vérité métier |

**Le témoin.** `Run workflow` avec la case *temoin* cochée altère d'une unité le comptage de
`public.tasks` dans le manifeste lu : le drill doit rougir, et l'alerte partir. Témoins de code :
`scripts/restore-drill.guard.test.mjs`, `scripts/restore-drill-fraicheur.guard.test.mjs`.

**Données personnelles.** Le journal et le résumé d'un dépôt public se lisent par tous : n'en
sortent que des noms de tables et des comptes. Aucun `upload-artifact` dans `restore-drill.yml`,
le déchiffré est effacé en fin de job, et une erreur de `COPY` n'imprime que sa table, jamais son
message (il peut citer une valeur).

| Date | Run drill | Run db-backup | Restauration | Tables comptées | Erreurs tolérées | Verdict |
|---|---|---|---|---|---|---|
| 2026-11-07 | `42380272895` (branche `noyau/drill-auto`) | `42378846309` | 1 s (job 39 s) | 91 : 90 de `public` + `auth.users` | 27 : pg_cron et Vault | ✅ comptages identiques, 205 policies, 90 tables sous RLS, isolation 289 / 940 |
| 2026-11-08 | `42463160221` (`main`, SHA `88699890`) | `42463066645` (avec manifeste) | 1 s (drill complet 2 s) | 91 : 90 de `public` + `auth.users` | 27 : extensions Supabase absentes de l'image officielle, 0 bloquante | ✅ comptages identiques, 205 policies, 90 tables sous RLS, isolation 289 / 941 |
| 2026-11-08 | `42463289640` (`main`, **témoin**, case *temoin* cochée) | `42463066645` | n/a | n/a | n/a | ❌ **voulu** : `public.tasks`, manifeste 942 contre 941 restaurées : « la restauration ne rend pas la base du dump » |

### Au passage en Pro (décision d'Axel, au premier client payant)

Le drill reste utile en Pro : il prouve **notre** dump, celui qui vit hors de Supabase et couvre
la perte du compte. Le passage ajoute une seconde copie, il ne remplace pas la première. Le geste
de passer en Pro est celui d'Axel ; ce qui suit est la liste à cocher le jour même.

- [ ] **Sauvegardes quotidiennes de Supabase** : vérifier dans le tableau de bord (Database →
  Backups) qu'elles apparaissent. C'est une seconde copie, indépendante du dépôt et de
  `BACKUP_PASSPHRASE`. Noter ici la date du premier point visible.
- [ ] **PITR** : option payante en plus du Pro, à décider (RPO de quelques minutes au lieu de
  24 h). Tant qu'elle n'est pas prise, le RPO reste celui du dump quotidien.
- [ ] **Refus des mots de passe fuités** (V5.3) : à activer (Auth → mots de passe). C'est
  l'avertissement `auth_leaked_password_protection` des advisors, que `check:supabase-posture`
  verra disparaître ; recaler sa référence ensuite, avec le nom de la règle dans la `_note`.
- [ ] **Confirmation de l'adresse e-mail** à l'inscription : à rediscuter avec Axel (elle avait
  été écartée sur le plan Free).

Plan Free : **aucune sauvegarde native**, PITR écarté avec le plan Pro (`T-01`). La seule copie de la base
est le dump quotidien chiffré de `.github/workflows/db-backup.yml`. *(Relevés du 2026-09-01 et du
2026-10-15, dont la réactivation de `restore-drill.yml` : archive.)*

### Restauration réelle (sinistre)
1. Créer un projet Supabase neuf, récupérer sa chaîne de connexion en mode **session**.
2. Déchiffrer puis restaurer le dernier dump (chiffré depuis le 2026-10-13) :
   `gpg --batch --passphrase-file <fichier> -o cosmo.dump -d cosmo-<date>.dump.gpg`, puis
   `pg_restore --no-owner --no-privileges --dbname "<url>" cosmo.dump`
   (client PostgreSQL **17** obligatoire, cf. le piège de version plus bas).
3. Re-pointer le front : Vercel `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, puis redéployer.
4. Redéployer les Edge Functions et reposer les secrets sur le nouveau ref : **le dump ne les
   contient pas**. C'est la partie que personne n'anticipe le jour J.

### Drill — `.github/workflows/restore-drill.yml` (livré le 2026-08-30, exécuté avec succès le 2026-09-01)

Le drill tourne **dans GitHub Actions**, pas sur un poste : c'est là que vivent déjà le dump et un
client PostgreSQL 17, et le chronomètre y devient une mesure machine. Il restaure, mesure, puis
juge sur ce qui compte vraiment.

| Ce qu'il vérifie | Pourquoi |
|---|---|
| `pg_restore --list` | un fichier tronqué échoue à l'en-tête, pas au milieu |
| durée de la restauration | c'est le RTO, la seule raison de faire un drill |
| volumes par table | des lignes sont revenues |
| **0 table publique sans RLS**, et > 50 policies | une restauration qui rend les données mais perd l'isolation est une fuite totale, invisible sur un compteur de volume |
| **un utilisateur ne voit que ses tâches** | l'isolation est *effective*, pas seulement déclarée : on se place dans le rôle `authenticated` avec ses claims, `postgres` contournant la RLS |

**Marche à suivre** (et à défaire juste après) :

1. créer un projet Supabase jetable. ⚠️ Le plan Free plafonne à **2 projets actifs** : il faudra le
   supprimer, pas l'oublier ;
2. poser sa chaîne de connexion en mode session dans le secret de dépôt `DRILL_DB_URL` ;
3. Actions → **restore-drill** → *Run workflow*, en tapant `RESTAURER` ;
4. reporter le tableau du résumé de job ci-dessous, avec sa date ;
5. **supprimer le projet jetable ET le secret `DRILL_DB_URL`.**

> 🔴 **Trois gardes s'exécutent avant la moindre connexion** : la confirmation tapée, le refus
> catégorique si l'URL désigne le projet de production (par l'hôte **ou** par l'utilisateur), et
> l'obligation d'une chaîne en mode session. Testées sur cinq cibles, dont deux formes de l'URL de
> production. Un drill qui se trompe de cible ne perd pas un projet jetable, il perd la seule base
> qui existe.

**Ce que le workflow ne prouve pas**, et qui reste un geste humain : pointer l'application sur le
projet restauré, se connecter, créer une tâche. Un `select` réussi ne dit rien du parcours réel.

> ⚠️ **Un contrôle qui ne peut pas échouer ne contrôle rien.** Le tout premier run (2026-09-01) a réussi avec
> un chiffre faux : `VISIBLES=$(tail -1 iso.txt)` capturait le tag `ROLLBACK` de `psql`, jamais le compte,
> donc `VISIBLES = TOTAL` était garanti faux. Corrigé par `grep -E '^[0-9]+$' iso.txt | tail -1`.

**Dernier drill manuel** : 2026-09-01, RTO mesuré **163 s** (objectif < 2 h), 0 table sans RLS, 129 policies,
289 tâches visibles sur 724. Le parcours applicatif (login, création d'une tâche) a été volontairement sauté
(décision d'Axel). Détail et tableau : archive.

### Export hors-fournisseur — automatisé le 2026-08-28

`.github/workflows/db-backup.yml`, **tous les jours à 04:26 UTC** (mensuel jusqu'au 2026-08-29,
passé en quotidien le jour où il est devenu la seule sauvegarde). Il produit un dump `pg_dump` au
format custom, vérifie qu'il n'est ni vide ni tronqué (`pg_restore --list`), et le dépose en
artefact avec **30 jours de rétention**.

**Mise en service** : poser le secret GitHub `SUPABASE_DB_URL` (Dashboard → Settings → Database →
Connection string, mode « session »). Sans lui le job s'arrête en **avertissement**, pas en échec —
une CI rouge en permanence finit ignorée, règle déjà appliquée à `renewal-notice`.
**Depuis le 2026-10-13**, le secret `BACKUP_PASSPHRASE` (32 caractères au moins) est obligatoire :
sans lui le job **échoue**, parce que c'est la seule absence qui exposerait. Sa copie hors de
GitHub est le geste `M-71` : un secret Actions ne se relit pas, et sans elle aucune sauvegarde ne
se restaure.

> ⚠️ **Ce n'est PAS l'équivalent d'un PITR.** Un dump quotidien a un RPO de 24 h : il sert à ne
> pas TOUT perdre, pas à revenir à l'état d'il y a une heure, et il ne se restaure pas en un clic. Ce qu'il couvre et que le PITR ne couvre pas, c'est
> la perte du **compte** — suspension, litige, ou décision de partir. Les deux répondent à des
> risques différents, aucun ne dispense de l'autre.
>
> 🔴 **L'artefact contient des données personnelles** (noms, e-mails, empreintes de mots de passe, contenu
> des tâches). Sur un dépôt public, **n'importe quel compte GitHub connecté** télécharge un artefact : « les
> artefacts d'un run exigent une authentification » est faux. **Seul un dump chiffré** (`gpg`, AES-256,
> `BACKUP_PASSPHRASE`) part en artefact, relu à l'identique par sha256 avant dépôt ; sans la phrase secrète,
> le job **échoue**. ❌ Ne **jamais** committer un dump. Pour une copie longue durée, la télécharger et la
> garder sur un disque chiffré : GitHub n'est pas un coffre.
> *Pourquoi : cette phrase fausse, recopiée du commentaire du workflow, a produit la violation `BK-1`
> (dumps en clair exposés du 2026-08-29 au 2026-10-13) ; le récit est archivé et dans `faille.md`.*

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

**Prérequis d'un (re)déploiement de `delete-account`** (déployée, v34 au 2026-11-05) :
`supabase secrets set APP_URL=https://<domaine-prod>` d'abord —
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

---

## Délivrabilité des emails Auth · repris de `CLAUDE.md` (déplacé le 2026-09-16)

> Les commentaires datés de la commande (mesures du 2026-09-02) sont archivés sans une coupe. La racine
> ne garde que la commande.

```bash
npm run check:mail          # Délivrabilité des emails Auth : MX, SPF, DKIM Resend, DMARC
```

- ⚠️ Le DNS ne prouve pas qu'un email ARRIVE : la preuve reste un compte jetable vérifié sur Gmail ET Outlook
  (§ 2ter).
- 🔴 Les confirmations d'inscription restent **désactivées**, décision d'Axel (finding `G-2` de `faille.md`).
- Pas une gate CI : la commande dépend d'un état DNS externe. Dernier état mesuré (2026-09-02) : DKIM, SPF et
  MX du Return-Path en place sur `send.thecosmo.app`, un seul avertissement, DMARC `p=none`.
