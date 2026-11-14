> ⚠️ **ARCHIVE : récits, relevés et états datés retirés le 2026-11-13 des docs d'exploitation et de sécurité (DOC-02), non maintenus.**
> Chaque bloc est repris **sans une coupe** depuis le commit `26544321`, sous le titre qui dit son fichier et ses lignes d'origine.
> Les règles qu'ils portaient vivent, en une ligne, dans `docs/SECURITY.md`, `docs/DEPLOYMENT.md`, `docs/STRIPE-LIVE.md`,
> `docs/OBSERVABILITE.md`, `docs/CONTINUITE.md` et les `CLAUDE.md` de `supabase/migration`, `supabase/functions`, `api`, `src/modules/billing`.
> Le code et la production font foi contre ce fichier.

# Exploitation et sécurité · récits et états datés (jusqu'au 2026-11-13)

## `docs/DEPLOYMENT.md`, lignes 14 à 30

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

## `docs/DEPLOYMENT.md`, lignes 93 à 141

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

## `docs/DEPLOYMENT.md`, lignes 236 à 239

> ✅ Déployée en production depuis le 2026-08-29 (`verify_jwt` actif). Fumée de référence : `POST` sans
> corps → `503 mail_not_configured` quand les secrets manquent, `GET` → `405`, sans JWT → `401` du
> gateway. L'étape 1 dépend du même domaine vérifié que § 2ter. *(Pourquoi cette ligne : la doc l'a dite
> livrée six jours avant qu'elle le soit ; le récit est archivé.)*

## `docs/DEPLOYMENT.md`, lignes 253 à 264

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

## `docs/DEPLOYMENT.md`, lignes 418 à 423

## 2quinquies. Second facteur sur `/admin` · **EN VIGUEUR : mig. `131` appliquée le 2026-08-31, TOTP enrôlé le 2026-09-01**

> 🔴 **Suivre l'ordre ci-dessous.** La mig. `131` est au ledger de production et un facteur `totp` est
> vérifié sur le compte admin depuis le 2026-09-01. Appliquée avant l'enrôlement, à la demande d'Axel, elle a
> rendu `/admin` inaccessible du 2026-08-31 au 2026-09-01 : l'écran d'enrôlement, censé rester atteignable,
> levait en phase de rendu. Ne pas suivre la procédure a coûté une journée ; le récit est archivé.

## `docs/DEPLOYMENT.md`, lignes 465 à 511

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

**État des migrations au 2026-11-13**, chacune appliquée après sa preuve à 0 ECHEC, relue au catalogue,
texte du ledger identique au fichier :

- `245_cron_journal` : appliquée (`20261113070725`), `pg_net` installée.
- `246_cron_planification` : **non appliquée**, sa preuve rend `ECHEC Vault : 0 secret(s) sur 2` ; attend
  les deux secrets Vault (étape 2 ci-dessous).
- `248_habit_completions` : appliquée (`20261113070621`), 1 421 lignes rétro-remplies.
- `249_taches_echeance_priorite_facultatives` : appliquée (`20261113070529`).
- `250_friend_requests_forme_prod` : commitée, **non appliquée**. Jusqu'à son application, la porte
  `edge-deploy.yml` (CI-05) refuse le lot : c'est attendu.

**Preuves.** Rejouées à chaque commit par `e2e/rls/cron-journal.test.ts` sur une pile Supabase réelle
(`pg_cron` et `pg_net` vrais) : `245` avec et sans secrets Vault, `246`, chacune `PREUVE-ANNULEE 0 ECHEC`,
et un job pg_cron de test qui écrit dans `cron_runs` puis se ferme sur la réponse de pg_net (job
`rls-integration` du run `42664142079`, sur `edf90d80`). **Pas encore jouées en production** : c'est l'étape 3
ci-dessous, et ce qu'elle seule peut dire (droits de `postgres` sur `net._http_response` et sur
`vault.decrypted_secrets` dans le projet hébergé).

## `docs/DEPLOYMENT.md`, lignes 603 à 624

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

## `docs/DEPLOYMENT.md`, lignes 637 à 672

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

## `docs/DEPLOYMENT.md`, lignes 744 à 754

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

## `docs/DEPLOYMENT.md`, lignes 794 à 819

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

## `docs/DEPLOYMENT.md`, lignes 831 à 898

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

## `docs/DEPLOYMENT.md`, lignes 951 à 964

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

## `docs/SECURITY.md`, lignes 8 à 26

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

## `docs/SECURITY.md`, lignes 294 à 299

```bash
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy delete-account
supabase db push  # applique 017_processed_stripe_events.sql
```

## `docs/SECURITY.md`, lignes 375 à 391

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

## `docs/SECURITY.md`, lignes 619 à 630

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

## `docs/SECURITY.md`, lignes 646 à 665

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

## `docs/SECURITY.md`, lignes 792 à 809

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

## `docs/CONTINUITE.md`, lignes 127 à 188

## Inventaire des gestes de production

Cherché dans `docs/README.md` (« Gestes d'Axel »), `docs/DEPLOYMENT.md`, `supabase/migration/CLAUDE.md`
et `scripts/CLAUDE.md`, relu au 2026-11-08 sur `99564c19` et au-delà. Trois statuts :

- ✅ **Automatisé** : une garde ou un workflow le fait sans personne ;
- 🔁 **Converti ici** : rendu exécutable ou rappelé par la CI, sans secret nouveau et sans écriture
  en production ;
- 🖐️ **Manuel, avec sa raison** : il reste un geste, parce qu'il écrit en production, crée un secret,
  ou demande un jugement.

### ✅ Déjà automatisés

| Geste | Par quoi |
|---|---|
| Déployer le front | Vercel, derrière la porte `CI vert` (tag `ci-vert/<sha>`, [`DEPLOYMENT.md`](./DEPLOYMENT.md) § 1) |
| Redéployer les Edge Functions | `edge-deploy.yml` après un `CI noyau` vert sur `main`, sélection par `scripts/edge-deploy-select.mjs`, puis `check:edge` et `check:edge-smoke` ; secours manuel (`supabase functions deploy`) documenté en § 2bis |
| Détecter la dérive Edge et front | `Edge deploy drift`, `Deploy SHA drift`, relayés par `ci-alert.yml` |
| Sauvegarder la base | `db-backup.yml`, quotidien, chiffré, avec manifeste de comptages |
| **Jouer `restore-drill`** | `restore-drill.yml`, job `drill-auto`, **mensuel** (le 9, V4.4, `99564c19`) : restaure le dernier dump dans un Postgres jetable du runner et compare au manifeste ; `restore-drill-fraicheur.yml` rougit sans drill vert depuis 35 jours. Aucun secret de connexion |
| Mesurer l'âge des secrets | `secrets-age.yml`, hebdomadaire : dates **vivantes** lues par l'API GitHub, Vercel et Supabase (le geste « dater les rotations » ne subsiste que pour la clé `service_role` de la plateforme) |
| Recaler `Posture` | `posture.yml` : job `regenerer` par `workflow_dispatch` (`-f regenerer=true`), exécutable par **toute personne** qui a l'écriture sur le dépôt ; voir la ligne manuelle pour la décision |
| Traitements planifiés de production | pg_cron et `Journal des crons` (mig. `245`, `246`, ARC-06) |
| Tenir les échéances datées | `gardes-calendrier.yml` (lecteurs d'écran, exercice de violation, chantiers, acquisition) |

### 🔁 Convertis dans cette passe

| Geste | Devient | Garde-fou |
|---|---|---|
| « Penser à vérifier le coffre » | `check:coffre`, dans `gardes-calendrier.yml`, quotidien : rouge au-delà de 92 jours, élément oublié, ou première échéance (2026-12-08) dépassée ; alerte par l'issue `calendrier-red` | ne prouve pas le contenu du coffre, seulement qu'une vérification complète a été consignée ; ❌ aucune période relevable |
| « Tenir le registre des secrets à jour, complet, sans valeur » | `check:secrets-age` refuse désormais une entrée sans `readers`, `leak` ou procédure, une procédure de moins de trois étapes, et toute forme de valeur | le registre est le seul : pas de second fichier |
| « Savoir comment faire tourner un secret » | une procédure pas à pas par entrée (`procedures` du registre), exécutable par n'importe quelle personne qui a les droits | l'écriture du secret reste humaine (ci-dessous) |
| « Retrouver ce qui se passe si la personne manque » | les check-lists d'arrivée et de départ ci-dessus | la CI ne les joue pas : elles écrivent des droits |

Constat de la passe : sur les gestes restants, **aucun** n'est convertible sans secret nouveau ni
écriture en production. C'est la raison de leur statut manuel, pas un oubli.

### 🖐️ Restent manuels, avec la raison

| Geste | Raison |
|---|---|
| Appliquer les migrations (`supabase db push`) | écriture en production par la voie qui contourne le déploiement du front. **Son passage en CI est la vague 8.3**, menée à part : pas traité ici |
| Poser `SECRETS_AUDIT_TOKEN` | un jeton personnel fin se crée dans le compte du propriétaire (`jeton-audit-github`) ; c'est un secret nouveau |
| Dater ou faire tourner la `service_role` de la plateforme | aucune API ne la date ; la rotation est une action de console (`cle-service-plateforme`) |
| Faire tourner un secret (toute entrée du registre) | écrit un secret chez Supabase, GitHub, Vercel ou Stripe ; la CI ne porte que des jetons de **lecture**. Les procédures sont écrites, l'exécution est humaine |
| Retirer chez Vercel les variables de l'intégration que rien ne lit | écriture dans la console Vercel, pas de jeton d'écriture côté CI (`variable-orpheline`) |
| Décider du recalage de `Posture` | le bouton existe (ci-dessus) ; **le jugement** est humain : relire les nouveaux objets au catalogue avant de recaler, jamais pour faire taire |
| Trier le signal du détecteur de violation, sort de la PR n° 125 | jugement sur des données personnelles, échéance légale de 72 h : un responsable de traitement ne délègue pas ce tri à un job |
| Arbitrer le périmètre de l'affiliation au registre art. 30 | décision de périmètre |
| Séances VoiceOver (avant le 2026-12-15) et NVDA (avant le 2027-01-15) | appareils et lecteurs d'écran réels ; `check:lecteurs-ecran` mesure l'échéance, il ne joue pas la séance |
| « Promote » Vercel, M-47 (`DEPLOYMENT.md` § 3) | console Vercel, à froid, une fois |
| Redéployer sans verdict vert (urgence) | console Vercel, **voulu** : le contournement de la porte doit rester un geste conscient et laisse sa trace (`prod_en_avance`) |
| Bascule pg_cron : secrets Vault, mig. `245` et `246`, retrait des `schedule:` GitHub | écritures en production et valeur de `CRON_SECRET` dans le Vault (`DEPLOYMENT.md` § 2sexies) |
| Drill **manuel** vers un projet Supabase jetable | seul à restaurer sur la plateforme réelle (pg_cron, Vault, rôles gérés) et à chronométrer le RTO d'un sinistre ; crée puis détruit un projet et un secret `DRILL_DB_URL` le jour même |
| Mettre le coffre en place, désigner la personne de confiance, inviter le second administrateur, inscrire l'allowlist | droits sur des comptes et écriture en base ; pas de valeur dans le dépôt |
| Rédiger le préavis de modification des CGU, rembourser (M-08) | message sortant et argent réel |

### Piste volontairement non posée

Une fois le second administrateur inscrit, `Posture` pourra compter les lignes de `public.admin_users`
et rougir à moins de deux : la lecture existe déjà (`SUPABASE_DB_URL`, lecture seule). Elle n'est
**pas** posée avant, parce qu'une garde rouge dès sa pose ne signale plus rien.

## `docs/STRIPE-LIVE.md`, lignes 6 à 55

## 🕳️ Angles morts · ce que ce document NE mesure PAS (2026-09-16)

> Ce document affirme des choses que rien ne pèse : chaque ligne nomme une affirmation qui n'était vérifiée
> par rien, et la garde qui la vérifie depuis. 🔴 **Une garde posée n'est pas un angle mort fermé** : la
> dernière colonne dit ce que son vert ne prouve pas. L'énoncé du 2026-09-16, la colonne « État » du
> 2026-09-21 et les mesures datées sont archivés sans une coupe :
> [`archive/ANGLES-MORTS-2026-09-16-docs-vivantes.md`](./archive/ANGLES-MORTS-2026-09-16-docs-vivantes.md).

| # | Angle mort (énoncé du 2026-09-16) | Garde qui le couvre | 🔴 Ce qu'elle ne prouve pas |
|---|---|---|---|
| AM-1 | **AUCUNE garde ne comparait la grille STRIPE au code** (`org-tiers.parity.test.ts` ne confronte que deux copies du dépôt, jamais les prix enregistrés chez Stripe) | `npm run check:stripe-prices` (`C-106`) : grille **lue** dans `premium-config.ts`, planifiée depuis la bascule du 2026-10-20 (secret live posé, `schedule:` actif, `Grille Stripe` dans `ci-alert.yml`) | Un encaissement réel : elle compare des prix enregistrés |
| AM-2 | **Les 8 prix live n'avaient été vérifiés qu'une fois** (2026-08-26) ; la dérivation annuelle refuse de choisir entre deux candidates (`yearly_unavailable`), donc un doublon **coupe l'encaissement annuel en silence** | `check:stripe-prices` : doublon de prix et `tax_behavior` vérifiés (`C-106`) | Idem AM-1 |
| AM-3 | **La liste des events du webhook live n'est vérifiée par rien après enregistrement** : ils sont **SIX**, en enregistrer 5 couperait le **remboursement** sans signal | `check:stripe-prices` (`C-106`) | Idem AM-1 |
| AM-4 | **Le passage en live n'avait pas de répétition à blanc** (mig. `140`, prix recréés, webhook réenregistré, trois secrets remplacés : chaque étape manquante échoue **après** encaissement) | **Parcouru le 2026-10-20** (bascule réelle, § « Ce qui reste à faire avant d'encaisser ») ; `M-48` | Une répétition à blanc : elle n'a jamais eu lieu, la bascule réelle l'a remplacée |

---

## Deux comptes, la production est sur le LIVE depuis le 2026-10-20

| Compte | ID | Rôle |
|---|---|---|
| `COSMO` | `acct_1TQVVnHJLweDSN4F` | **live**, servi par la production depuis le 2026-10-20 |
| `Environnement de test COSMO` | `acct_1TQVWFHEm0kmXgy9` | test, **clôturé par Axel** une fois les tests validés (relevé le 2026-11-05) |

Bascule : § « Bascule live, jouée le 2026-10-20 » plus bas. **Il n'existe plus qu'un compte**, le
live : toute vérification Stripe se fait dessus. Un connecteur qui ne voit qu'un bac à sable ne
voit donc rien de COSMO.

## Grille live — les 10 prix (créés le 2026-10-25)

Tous en EUR, `tax_behavior: inclusive` (prix TTC, cf. plus bas). Décision d'Axel du
2026-10-25 : prix de lancement, appelés à bouger. Palier `t100` nouveau (mig. `228`),
remise annuelle ramenée de 30 % à 25 %. Aucun abonnement live n'existait ce jour-là.

| Palier | Produit | Mensuel | Annuel (−25 %) |
|---|---|---|---|
| `t10` Équipe | `prod_V8kusrLcKpPYrC` | `price_1UUSv1HJLweDSN4F1cuaFdAy` · 70 € | `price_1UUSvTHJLweDSN4FAOK6j1ri` · 630 € |
| `t20` Département | `prod_V8kvSx9WNnuzfk` | `price_1UUSvUHJLweDSN4Fuk2T8ioT` · 150 € | `price_1UUSvVHJLweDSN4FSTO7V1fH` · 1 350 € |
| `t50` Entreprise | `prod_V8kvRAJaEAyuSY` | `price_1UUSvXHJLweDSN4F22MOazIx` · 350 € | `price_1UUSvZHJLweDSN4FM8RSQbto` · 3 150 € |
| `t100` Grande entreprise | `prod_VVTs7gwGuJIojd` | `price_1UUSvaHJLweDSN4FSDuxVniS` · 700 € | `price_1UUSvcHJLweDSN4F0r3KtHAr` · 6 300 € |
| `tmax` Illimité (100+) | `prod_V8kw1gh0f4HJx4` | `price_1UUSvdHJLweDSN4FeUJPsa7I` · 1 000 € | `price_1UUSvgHJLweDSN4FZVV0sHjZ` · 9 000 € |

Relevé du 2026-10-25 : les 8 prix de la grille du 2026-08-26 (20/50/100/200 €, −30 %)
**n'existaient plus** dans le compte live (ni actifs ni archivés), rien à archiver ; seuls les 10 prix
ci-dessus existent. Un produit
ne doit porter qu'UN prix annuel actif : la dérivation refuse de choisir (`ambiguous`).

Montants conformes à `ENTERPRISE_PRICING_TIERS` et à `yearlyTotalEur()`
(`src/modules/billing/premium-config.ts`). Le palier est porté par
`product.metadata.cosmo_tier`, comme dans le compte de test.

## `docs/STRIPE-LIVE.md`, lignes 75 à 145

## Portail client · configuré le 2026-09-01, changement d'offre ouvert par Axel le 2026-11-05

Sans configuration de portail, `billingPortal.sessions.create({ customer, return_url })`
échoue : l'application n'envoie **aucun** paramètre `configuration`, donc Stripe cherche la
configuration **par défaut du compte**, et il n'en existait aucune. Conséquence mesurée le
2026-09-01 : le bouton « Gérer mon abonnement » existait, et **un client abonné ne pouvait pas
résilier**. La landing promet « résiliable à tout moment » (Conso. art. L215-1).

| Compte | Configuration | `active` / `is_default` |
|---|---|---|
| `COSMO` (live) | `bpc_1UAv9vHJLweDSN4F4xssO3OQ` | `true` / `true` |
| ~~`Environnement de test COSMO` (sandbox)~~ | ~~`bpc_1UAvS2HEm0kmXgy9XO4s1MM6`~~ | compte clôturé |

Réglages du compte live (posés le 2026-09-01) :

- `subscription_cancel` : **activé**, `mode: at_period_end`. On ne résilie pas au milieu d'une
  période payée : le client garde ce qu'il a acheté, et rien n'est remboursé au prorata.
- `payment_method_update` et `invoice_history` : activés.
- `default_return_url` : `https://thecosmo.app/entreprise?tab=billing`.
- `subscription_update` : **désactivé du 2026-09-01 au 2026-11-05**, puis ✅ **activé sur le compte
  LIVE par Axel le 2026-11-05** (réglages ci-dessous, capture du tableau de bord).
  🔴 **Le défaut que cela referme** : depuis le 2026-11-02, un propriétaire abonné qui choisit un
  autre palier est envoyé au portail (`OrgBillingTab`, `chooseTier`). Du 2026-11-02 au 2026-11-05,
  ce portail ne proposait **aucun** changement d'offre : la montée en gamme était impossible en
  libre-service. Le code et le portail ne s'accordaient pas, et rien ne le mesurait.
  - **Changement de plan : calcul au prorata des frais et des crédits**, facturé **immédiatement**
    au moment de la mise à jour (synchronisation de la charge). Une montée en gamme est donc
    débitée tout de suite pour le temps restant ; une descente émet un crédit sur le compte client.
  - **Passage à un forfait moins cher : mis à jour immédiatement.** Le quota de sièges baisse le
    jour même ; aucun membre n'est retiré (`org_seats_allowed`). Si l'effectif DÉPASSE le nouveau
    quota, l'espace entreprise se verrouille (2026-11-05) : seuls Membres, Paramètres et, pour le
    propriétaire, la facturation restent ouverts, jusqu'à ce que l'effectif rentre dans le quota.
  - **Passage à une période plus courte (annuel → mensuel) : mis à jour immédiatement.**
  - Fin des essais en cas de modification : activée. Codes promotionnels : activés.

### ❌ Ne jamais activer « modifier la quantité » dans le portail

Le nombre de sièges est porté par le **palier** (`max_members`), jamais par la quantité Stripe.
Un client qui passerait la quantité de 1 à 3 paierait trois fois le prix et n'obtiendrait
**aucun siège de plus**. C'est un bug de facturation en libre-service, et il serait de notre
fait.

Le changement d'offre (`subscription_update`) est **ouvert depuis le 2026-11-05** : `tierFromPriceId`
redérive le palier ET la périodicité depuis le price ID, précisément parce qu'un changement fait
depuis le portail ne repasse pas par notre checkout. ⚠️ **Jamais éprouvé contre un vrai
paiement** : la recette `M-08` doit inclure une montée ET une descente de palier par le portail,
et vérifier que le webhook (`customer.subscription.updated`) applique le nouveau quota, que la
facture de prorata arrive au journal `payment_records`, et qu'un crédit de descente n'y passe pas
pour un encaissement.

### ⚠️ `dashboard.stripe.com/test/...` n'est pas un compte de test COSMO

Le sandbox `acct_1TQVWFHEm0kmXgy9` est clôturé. `dashboard.stripe.com/test/...` ouvre le **mode test
du compte live**, un contexte vide et sans intérêt : une configuration posée là ne s'applique pas à
la production. Les réglages qui comptent se posent en mode **live**.

### ⚠️ Les deux liens juridiques ne sont pas confirmés

`business_profile.terms_of_service_url` et `privacy_policy_url` remontent `null` par l'API sur les
deux comptes, alors que les informations publiques ont été saisies. Deux explications possibles,
**non départagées** : soit Stripe rattache ces liens à l'affichage sans les recopier dans l'objet
`billing_portal.configuration`, soit l'enregistrement n'a pas pris. Aucune opération de lecture du
profil de compte n'est exposée pour trancher par API.

Ça se vérifie à l'œil, bloc « Politiques juridiques » de la page du portail. Les URL attendues,
vérifiées contre `src/i18n/route-slugs.json` plutôt que de mémoire : `https://thecosmo.app/cgu`
(`terms` → `cgu`) et `https://thecosmo.app/politique-confidentialite` (`privacy`). Ce n'est pas
bloquant pour la résiliation, c'est un point de conformité.

✅ **Refermé sur le compte LIVE le 2026-10-20** : les deux URL ci-dessus ont été posées par l'API
sur `bpc_1UAv9vHJLweDSN4F4xssO3OQ`, et la réponse les relit.

## `docs/STRIPE-LIVE.md`, lignes 147 à 180

## Bascule live, jouée le 2026-10-20

> 🔎 **Bascule ouverte le 2026-10-20** : SIREN obtenu (déclaré par Axel). Mig. `140` appliquée
> (ledger `20261020204838`), essai à blanc : 5 customers de test à effacer. Endpoint webhook live
> `we_1USka0HJLweDSN4FyEBTJZ6n`, les 6 events, **API `2024-06-20`** (celle du code) vers
> `https://ykeugqfgklejcdbrmawy.supabase.co/functions/v1/stripe-webhook`.
> 🔴 Un premier endpoint (`we_1USk5Y…`, supprimé) avait pris la version par défaut du compte
> (`2026-04-22.dahlia`) : ❌ **toujours passer `api_version` à la création**, sinon `invoice.subscription`
> et `current_period_end` n'arrivent plus là où le code les lit.
> ✅ **BASCULE TERMINÉE le 2026-10-20** : secrets live posés (empreintes SHA-256 comparées pour le
> webhook et les 4 prix), `reset_stripe_identifiers(true)` joué (5 customers effacés, journal
> intact), mig. `224` + `ENTERPRISE_BILLING_ENFORCED = true` + `PRICES_VISIBLE = true`,
> `stripe-prices.yml` planifié et ajouté à `ci-alert.yml`. Reste : recette réelle (paiement 20 €
> puis rétractation ou remboursement admin), geste d'Axel (`a-faire-manuel.md` `M-08`). Mention 293 B : ✅ posée par le code le 2026-10-23 (point 4).

Les étapes 1 à 3bis de la séquence (structure juridique, secrets live, endpoint webhook à six
events, `reset_stripe_identifiers(true)`) sont **jouées** : voir l'encart ci-dessus. Leur
rédaction d'avant la bascule se relit dans l'historique git de ce fichier.

4. Mention « TVA non applicable, art. 293 B du CGI » sur les factures tant que la franchise
   en base s'applique.
   ✅ **Posée par le CODE le 2026-10-23** : `INVOICE_FOOTER` (`_shared/org-billing-contact.ts`) est
   écrit dans `invoice_settings.footer` de chaque customer d'organisation, à sa création par
   `stripe-org-checkout` et à chaque passage par le checkout ou le portail. Verrouillé par
   `org-billing-contact.test.ts`. Relu le même jour sur le compte live : **0 customer**, endpoint
   `we_1USka0…` toujours à 6 events et API `2024-06-20`. 🔴 À retirer au premier dépassement du
   seuil de franchise.
5. `tax_code` des produits : non renseigné (comme en test). À poser avec l'expert-comptable
   avant d'activer Stripe Tax ; il détermine le taux appliqué par pays.
6. **Ne pas activer la collecte Stripe Tax** tant que la franchise en base s'applique : aucun
   enregistrement fiscal n'existe (`/v1/tax/registrations` est vide), il n'y a rien à collecter.

> Stripe Tax ne connaît que les VENTES. La TVA sur les ACHATS (autoliquidation sur Supabase,
> Vercel, Sentry, prestataires hors France) est entièrement hors de son champ et reste due.

## `docs/STRIPE-LIVE.md`, lignes 199 à 405

#### Modèle Premium

> 🟢 **Premium NON APPLIQUÉ** — kill-switch `PREMIUM_ENFORCED = false` dans
> `src/modules/billing/premium-config.ts` (vérifié 2026-08-14). Tant qu'il vaut `false` :
> `isPremium()` renvoie `true` pour tous et la route `/premium` **redirige vers `/`**.
> Le code de gating reste dormant, il n'est pas supprimé.
> Réactivation : passer le flag à `true`, puis finaliser Stripe (`docs/POST-AUDIT-GUIDE.md`).

Comportement **quand `PREMIUM_ENFORCED = true`** :

- **Partage de tâches → 100 % gratuit** (acquisition virale). Aucun gate `isPremium()` sur la
  collaboration. **Ne PAS réintroduire** ces gates.
- **Statistiques → premium** (`StatisticsPage`).
- **Habitudes → gratuites pour tout le monde**, sans condition.
- 🗑️ **Le système de jetons premium et le mur-pub Habitudes N'EXISTENT PLUS** (C-04, supprimés le
  2026-09-04 sur décision d'Axel du 09-03). Sont partis ensemble : `HabitsAdGate`, `AdModal` et
  tout AdSense (y compris ses origines dans la CSP), `useDailyAdGate` et la clé
  `cosmo_adwall_habits`, `addTokens`, les RPC `consume_premium_token` /
  `credit_premium_token_from_ad` / `bump_win_streak`, et les colonnes `premium_tokens` /
  `win_streak` / `ad_credits_*` de `subscriptions` (mig. **141**).
  ❌ **Ne jamais réintroduire une monnaie interne** : elle n'a jamais été câblée, un jeton crédité
  ne servait à rien, et le mur qu'elle prétendait garder était piloté par un flag `localStorage`,
  donc contournable en une manipulation le jour où `PREMIUM_ENFORCED` passerait à `true`.
- ⚠️ **La définition de « premium » a changé avec** : c'est désormais `plan='premium'` +
  `status='active'` + période non dépassée (`subscription.logic.ts`), les jetons n'y entrent plus.
  Vérifiée ligne par ligne contre les 54 lignes de prod avant la bascule : **même verdict pour
  chacune**. ⚠️ **7** comptes portent un `premium` sans fin de période, hérité des jetons gagnés par
  pub, et non 8 : recompté en base le 2026-09-14 au soir (`plan='premium'`, `status='active'`,
  `current_period_end IS NULL`), contre 3 qui portent bien une fin de période, sur **54** lignes ;
  ils restent premium, et aucune écriture ne produit plus cette forme.
- Le client ne peut pas écrire `subscriptions` : aucune policy UPDATE, et l'INSERT ne permet
  qu'une ligne gratuite sans identifiant Stripe.

#### Facturation entreprise — plomberie Stripe COMPLÈTE, facturation DÉSACTIVÉE (2026-08-24)

`org_subscriptions` (mig. 101) porte l'abonnement d'une **organisation** : un palier
(`ENTERPRISE_PRICING_TIERS`), un quota de sièges (`max_members`), un statut. Ne jamais la
confondre avec `subscriptions`, qui porte l'abonnement **particulier** (plan, statut, période) —
les deux ne partagent aucune colonne.

- La table n'a **aucune policy d'écriture**. Seul le webhook Stripe (`service_role`) écrit ;
  la lecture est réservée aux membres. Pas de trigger-guard : rien n'est écrivable, il n'y a
  rien à garder.
- Souscription et gestion : **propriétaire de l'org uniquement**, vérifié dans
  `stripe-org-checkout` / `stripe-org-portal`. Le front ne fait que masquer un onglet.
- Coupons : **promotion codes Stripe natifs** (`allow_promotion_codes`). COSMO ne valide aucun
  code et ne recalcule aucun montant — donc aucune surface de brute-force côté COSMO.
- **Périodicité mensuelle ou annuelle** (2026-08-25), sélecteur dans `/entreprise?tab=billing`.
  L'annuel vaut le mensuel **moins 30 %** (`ENTERPRISE_YEARLY_DISCOUNT`) : 14/35/70/140 € par mois
  en équivalent, débités 168/420/840/1 680 € une fois par an. Huit price IDs Stripe au total
  (`STRIPE_ORG_PRICE_*` et `STRIPE_ORG_PRICE_*_YEARLY`). La colonne descriptive
  `org_subscriptions.billing_interval` (mig. **123**) dit laquelle est facturée.
- Le quota réel est `org_seats_allowed()` (mig. 101), déjà appelé par `claim_org_invite` et
  `respond_join_request`. Un abonnement `past_due` ou `cancelled` retombe au palier gratuit
  **sans jamais retirer de membre** : on bloque la croissance, on ne retire rien.
- UI : vue `/entreprise?tab=billing` (`OrgBillingTab`), grille `EnterpriseTierGrid`. **Ce n'est
  pas un onglet** — la barre d'onglets est lue par toute l'organisation alors qu'un seul compte
  peut payer. L'entrée est la pastille de forfait de l'en-tête (`OrgPlanChip`), montée pour le
  seul propriétaire ; `?tab=billing` reste une valeur d'URL valide (les Edge Functions Stripe y
  renvoient) et un non-propriétaire qui l'ouvre retombe sur l'aperçu.
  Le CTA de paiement n'est monté que si `ENTERPRISE_BILLING_ENFORCED === true` — le flag est la
  **seule** condition, jamais « actif si les variables d'environnement existent ».

Garde-fous propres à cette zone :

- 🟢 **Le price ID ANNUEL se dérive, il ne se configure pas** (`_shared/org-stripe-prices.ts`) :
  c'est le prix récurrent `year`, actif, de la devise du mensuel et **du montant exact annoncé**,
  porté par le MÊME produit Stripe que le prix mensuel. Zéro candidate ou plusieurs → on n'ouvre
  aucune session de paiement (`yearly_unavailable`). Conséquence directe : les 4
  `STRIPE_ORG_PRICE_*_YEARLY` ne sont **pas** nécessaires, et le jour du passage en compte live il
  n'y a que les 4 mensuels à re-poser. Le secret annuel reste lu en premier, comme porte de sortie
  pour épingler un prix qui vivrait ailleurs.
- ❌ **Ne jamais faire deviner un prix à la résolution annuelle.** Le montant est vérifié contre
  `yearlyTotalEur` AVANT toute session, dans les deux sens (checkout et webhook). C'est le seul
  endroit où COSMO choisit un prix au lieu de se le faire désigner, donc le seul endroit où il
  peut se tromper de montant.
- ❌ **Ne jamais écrire une grille de tarifs annuels à la main.** Le montant annuel est DÉRIVÉ du
  mensuel, front et Deno, par la même formule. Deux grilles, c'est une seconde occasion d'annoncer
  un prix et d'en facturer un autre, le risque qui a déjà imposé `org-tiers.parity.test.ts`.
- ❌ **Ne jamais faire dépendre le quota de sièges de la périodicité.** `max_members` est porté par
  le palier SEUL : un client annuel achète le même palier moins cher, pas plus de sièges. Un
  « palier annuel » distinct côté Stripe casserait `tierFromPriceId`, donc le portail.
- ❌ **Ne jamais dériver le palier des metadata Stripe.** Un changement de palier OU DE PÉRIODICITÉ
  fait depuis le Billing Portal ne repasse pas par notre checkout : les deux se redérivent du
  **price ID** (`tierFromPriceId`, `supabase/functions/_shared/org-tiers.ts`, qui rend le palier ET
  la périodicité). Sans ça, un client paie 100 € et reste bloqué au quota de 20 sièges.
- ❌ **Ne jamais avaler l'erreur d'une lecture qui décide d'un routage** (audit Stripe 2026-09-02).
  `getUidFromCustomer` et le pré-contrôle d'idempotence jetaient tous deux leur `error`. Une panne
  de lecture devenait « pas d'utilisateur » ou « jamais traité » : dans le premier cas un paiement
  encaissé sans abonnement appliqué et un marqueur d'idempotence écrit, donc aucune re-livraison ;
  dans le second le rejeu d'un handler non idempotent (à l'époque `bump_win_streak`, qui
  incrémentait ; supprimé depuis par C-04). Les deux relancent maintenant, comme `orgIdFromInvoice`
  le faisait déjà. **En cas de doute, faire retenter Stripe, jamais deviner.**
- ❌ **Un event Stripe qui DÉGRADE ne s'applique qu'à l'abonnement enregistré** (finding S-5).
  La garde d'`applyOrgSubscription` est asymétrique, et c'est voulu : un event qui **active** fait
  autorité d'où qu'il vienne (une nouvelle souscription supersède la précédente) ; un event
  `cancelled` ou `past_due` venant d'un AUTRE abonnement que celui en base parle d'un abonnement
  abandonné, et remettrait au gratuit une organisation qui vient de repayer. Ne pas remplacer par
  un `.eq()` sur l'upsert : il empêcherait la toute première écriture.
- ❌ **AUCUN REJEU AUTOMATIQUE sur une mutation qui déplace de l'argent.** Le `QueryClient` de
  l'app pose `mutations: { retry: 1 }` pour tout le monde : un `refund_failed` faisait donc repartir
  un **second** appel à `stripe-org-refund`, sans que personne ne clique et sans que rien ne le dise
  (mesuré le 2026-09-08 sur l'ancien parcours « résilier et rembourser » : deux appels pour un clic).
  Depuis le 2026-11-01 ce bouton n'existe plus ; `useOrgSubscriptionAction` (rétractation,
  résiliation) pose `retry: 0`, et `stripe-org-refund` n'est appelé que par l'admin. Ce que la borne serveur absorbe (clé d'idempotence sur
  l'`invoice_id`, pré-contrôle qui retranche) ne rend pas ce rejeu anodin : l'échec arrive **après**
  le point de non-retour, donc le second appel peut trouver le remboursement déjà posé et résilier
  un abonnement dont l'écran vient d'annoncer que rien n'avait été résilié. **On fait retenter la
  PERSONNE, jamais le navigateur.**
- 🔴 **Les deux verrous anti-rejeu du remboursement ne se remplacent PAS, et c'est contre-intuitif.**
  La clé d'idempotence Stripe dérivée de l'`invoice_id` (verrou 1) **expire** : elle n'arrête que
  deux appels **concurrents**. Un rejeu à quelques minutes n'est arrêté que par le pré-contrôle qui
  RETRANCHE le déjà-rendu (verrou 2), dont l'arithmétique vit dans
  `supabase/functions/_shared/refund-replay.ts`.
  ❌ **Ne jamais remettre cette arithmétique dans l'entrypoint Deno.** Mélangée aux appels Stripe,
  elle n'est exécutable par aucun test — et elle ne l'a été par aucun jusqu'au 2026-09-14, pendant
  tout le temps où le dépôt déclarait « une borne ». C'est un module TS pur, couvert par 10 cas
  (`src/modules/billing/refund-replay.test.ts`), et `src/refund.guard.test.ts` **interdit** de le
  recopier sur place. Déployée en **v6** le 2026-09-14, identique au dépôt (`check:edge` vert).
  ⚠️ **Deux erreurs symétriques y sont couvertes nommément** : un remboursement `pending` compte
  comme rendu (sinon on rembourse par-dessus un virement en vol), un `failed` ou `canceled` ne
  compte pas (sinon on prive la personne de son argent après un échec bancaire). ❌ Ne jamais
  l'écrire « par exclusion » (`status !== 'succeeded'`) : `pending` serait alors ignoré.
- ⚠️ **Après un remboursement, l'abonnement se RELIT.** Sans invalidation, l'écran continuait
  d'afficher le forfait payant *et* son bouton de remboursement : il invitait exactement le rejeu
  que la borne serveur existe pour absorber. Le bloc est par ailleurs conditionné à
  `effectiveTierKey(subscription)`, pas à `subscription.tierKey` — un abonnement résilié retombe à
  « Gratuit », il n'y a plus rien à y résilier.
- 🟢 **Plus aucune renonciation au droit de rétractation n'est recueillie** (décision d'Axel du
  2026-10-30). `stripe-org-checkout` n'exige plus `immediateExecution` ni `waivesWithdrawal` et
  n'écrit plus dans `withdrawal_consents`. Le client garde ses 14 jours et est remboursé en entier
  s'il se rétracte. Les lignes passées de la table (mig. `135`) restent : append-only, immuables
  par trigger, **une pièce à produire, jamais un cache.**
- 🔴 **Le passage en compte live doit remettre à zéro les identifiants Stripe en base.**
  `stripe-org-checkout` et `stripe-org-portal` réutilisent `stripe_customer_id` et
  `stripe_subscription_id` tels quels ; un identifiant du compte de TEST présenté à une clé live
  répond 404, donc 500. Outillé par la mig. `140`, ✅ **appliquée et jouée le 2026-10-20** (ledger `20261020204838`) :
  `SELECT * FROM public.reset_stripe_identifiers(true);`, à jouer **dans** la fenêtre de bascule,
  jamais avant : tant que la clé est une clé de test, chaque checkout réécrit un identifiant de
  test. À blanc sans argument.
  ⚠️ **« Les tables sont vides » était faux d'une table sur deux.** Mesuré le 2026-09-04 :
  `org_subscriptions` = 0 ligne, mais `subscriptions` porte **5 `cus_…` et 2 `sub_…`** du compte
  de test. Le geste a donc un objet réel dès aujourd'hui.
  ⚠️ Effacer les deux colonnes d'une org PAYANTE sans la redescendre au palier gratuit
  créerait un état sans issue : quota conservé, plus rien pour le payer, et un portail qui répond
  `no_subscription` faute de customer. La fonction rétrograde ces lignes-là, et elles seules.
- ❌ **Ne jamais laisser un event d'organisation retomber sur la branche particulier.** Le
  customer Stripe d'une org porte `org_owner_uid` (jamais `supabase_uid`) et
  `getUidFromCustomer` refuse tout customer portant `org_id` — sinon la facture d'une entreprise
  écrit dans l'abonnement personnel de son propriétaire, et le marqueur d'idempotence empêche
  Stripe de réessayer.
- ❌ **Ne jamais écrire un montant en dur** côté Deno : `_shared/org-tiers.ts` est verrouillé sur
  `ENTERPRISE_PRICING_TIERS` par `src/modules/billing/org-tiers.parity.test.ts`.
- Les **noms** des paliers (Gratuit · Équipe · Département · Entreprise · Illimité) vivent dans le
  namespace `common` (`orgTier.*`), pas dans `org` ni `landing` : la landing et le produit doivent
  dire le même mot pour le même palier, comme ils annoncent déjà le même montant. Le mapping
  palier → clé est `src/modules/billing/org-tier-labels.ts` (`Record<OrgTierKey, …>`, donc un
  palier ajouté sans nom ne compile pas).
- 🔴 **DÉSARMÉ le 2026-08-26** (mig. `124` appliquée en prod). `ENTERPRISE_BILLING_ENFORCED = false`
  **et** `billing_flags.enterprise_seat_limit = false`, rebasculés ensemble. **Pourquoi** : les
  deux étaient à `true` avec une clé Stripe de TEST, et une organisation sur quatre était déjà au
  plafond. Son parcours : invitation refusée, écran qui propose de payer, clic, checkout en mode
  test, vraie carte refusée. Ni grandir, ni payer, ni résilier. Impasse produit, pas risque
  juridique — aucun euro n'étant encaissé, ni travail dissimulé ni TVA due.
  Réarmement : les deux drapeaux, **après** immatriculation et passage de Stripe en compte live.
  Contexte du 2026-08-25 conservé ci-dessous pour mémoire, il décrivait l'état activé où
  `org_seats_allowed()` renvoyait `false` pour la seule
  organisation qui dépasse le palier gratuit. Aucun membre n'est retiré, c'est la croissance qui
  est bloquée.
- 🔴 **Deux réserves restent ouvertes à cette date :**
  1. `STRIPE_SECRET_KEY` est une clé de TEST, donc le checkout n'accepte que des cartes de test.
     **Le quota est réel, l'encaissement ne l'est pas.**
  2. Les 4 prix ANNUELS n'existent pas encore côté Stripe. Il n'y a **aucun secret à poser** (cf.
     règle de dérivation ci-dessous) : il suffit d'ajouter, sur chacun des 4 produits qui portent
     déjà un prix mensuel, un prix récurrent `year` de 168 / 420 / 840 / 1 680 €. Le checkout
     annuel répond `yearly_unavailable` d'ici là, la grille rebascule seule sur le mensuel, et
     l'annuel se met à marcher tout seul dès que les prix existent.
- **La plomberie reste entière et déployée** : `stripe-org-checkout` / `stripe-org-portal`, les
  `org_subscriptions` (mig. 101 + 123), `org_seats_allowed()`, et `stripe-webhook`. Les deux
  fonctions qui portent la périodicité, `stripe-org-checkout` (v2) et `stripe-webhook` (v17), ont
  été **redéployées en prod le 2026-08-25** et fument-testées (webhook : 400 « Invalid
  signature » ; checkout : 401 JSON de la fonction elle-même, donc les modules `_shared` se
  chargent). Réactiver = rebasculer les deux drapeaux, rien à reconstruire.
- ⚠️ **Corrigé le 2026-08-26 : les 4 prix ANNUELS existent bel et bien** dans le compte de test
  (168 / 420 / 840 / 1 680 €), contrairement à ce que ce fichier affirmait depuis le 2026-08-25.
  Vérifié par API, pas déduit. La dérivation `resolveYearlyPriceId` n'a donc pas besoin des
  secrets `STRIPE_ORG_PRICE_*_YEARLY`.
- 🔴 **Le compte Stripe LIVE est désormais équipé** (2026-08-26) : 4 produits et 8 prix créés,
  tous en `tax_behavior: inclusive`, réglage **DÉFINITIF** chez Stripe. Les 8 prix du compte de
  TEST restent sur `unspecified`, valeur à ne jamais reproduire. Détail et identifiants :
  ce document.
  ❌ **Ne jamais créer un prix Stripe sans `tax_behavior` explicite** : il ne se modifie plus, il
  faut créer un nouveau prix et migrer les abonnements.
- 🔴 **Les deux drapeaux se déplacent ensemble.** Le flag TS ne masque que les CTA ; le blocage
  réel est `billing_flags.enterprise_seat_limit`. Serveur `true` + client `false` = un
  propriétaire se voit refuser une invitation (`seat_limit_reached`) sans qu'aucun écran ne lui
  propose de payer : impasse. Client `true` + serveur `false` = on encaisse sans rien débloquer.
- ✅ **La grille branchée est celle du compte LIVE** depuis le 2026-10-20 (secrets live, endpoint
  webhook live à six events). Le sandbox de test, qui servait avant, est clôturé.
- ⚠️ `APP_URL` vaut `https://thecosmo.app` et **est la seule origine CORS autorisée** par toutes
  les Edge Functions appelées du navigateur (politique unique `_shared/cors.ts` depuis le
  2026-11-06) : le checkout entreprise **ne peut pas être testé depuis `localhost:5173`** en
  production. En local, `CORS_DEV_ORIGINS=http://localhost:5173` (origines locales seulement).
  Sans `APP_URL`, les fonctions refusent de démarrer : plus de valeur par défaut `localhost`.
- Facturation armée depuis le 2026-10-20 : `ENTERPRISE_BILLING_ENFORCED = true` et
  `billing_flags.enterprise_seat_limit = true` (mig. `224`).
  Contexte historique : [`POST-AUDIT-GUIDE.md`](./POST-AUDIT-GUIDE.md).

## `docs/OBSERVABILITE.md`, lignes 1 à 31

# Observabilité de la production

> **Vivant.** Créé le 2026-10-23. Répond à une seule question : **quand la production se trompe,
> qui le sait, et en combien de temps ?** Le reste du dépôt sait très bien dire si le CODE est
> juste (tests, gardes, CI) ; ce document porte ce qui se passe une fois le code déployé.

## Pourquoi un audit à part

**Arbitrage du 2026-10-23.** Les signaux de production étaient éparpillés dans quatre documents
sans qu'aucun ne les porte : `uptime.yml` dans [`DEPLOYMENT.md`](./DEPLOYMENT.md), Sentry cité dans
`CLAUDE.md` sans aucune garde, la détection d'une violation dans
`RGPD-VIOLATION.md` (hors dépôt) AM-2, les journaux Supabase dans aucun. Une surface que
quatre documents effleurent et qu'aucun ne mesure est exactement la définition d'un angle mort.
Les ajouter à un audit existant aurait noyé la question sous un autre sujet.

## Ce qui a été lu le 2026-10-23, et comment

| Source | Lu par | Résultat |
|---|---|---|
| Sentry (`VITE_SENTRY_DSN`) | **rien** : aucun outil, aucune garde, aucun digest | ❌ inconnu |
| Erreurs d'exécution Vercel (`api/`) | API Vercel refusée (403) depuis l'agent ; CLI non connecté | ❌ inconnu |
| Journaux Supabase, 24 h | API Management (`query_logs`), à la main | ✅ **0 réponse 5xx** à la passerelle. ~230 `Warp server error: Thread killed by timeout manager` côté PostgREST, corrélés à l'activité, sans réponse d'erreur au client. 5 appels à `stripe-webhook` **sans signature**, tous refusés. **4 réponses 409** sur `/rest/v1/events`, non expliquées. 10 × 403 `missing sub claim` sur `/auth/v1/user` (jeton anonyme présenté à `getUser`) |
| Disponibilité | `uptime.yml` (C-104) | ✅ vert |

## 🕳️ Angles morts · ce que ce document NE mesure PAS (2026-10-23)

| # | Angle mort | Vérifié le 2026-10-23 | 🔎 État au 2026-10-23 |
|---|---|---|---|
| AM-1 | 🔴 **Les erreurs Sentry ne sont lues par personne.** Le SDK remonte, le tableau de bord existe, rien ne le relit : une régression vue par cent utilisateurs ne fait échouer aucun job et n'arrive dans aucun digest | `grep -ril sentry .github/workflows` : seul `ci.yml` (build) | 🟡 **OUTILLÉ, NON MESURÉ** au 2026-10-23 · `npm run check:prod-errors` (job planifié `Erreurs de prod`, relié à `ci-alert.yml`) lit les issues nouvelles ou en régression sur 24 h, plafond **0**, échec fermé sans jeton. 🔴 `SENTRY_AUTH_TOKEN` n'est pas posé (`gh secret list`) : le job est ROUGE tant qu'il manque, et ne se ferme qu'au premier run vert. Témoin : `check-prod-errors.guard.test.mjs`, 9 sabotages vus rouges · ✅ **MESURÉ le 2026-10-26** (runs `40321521546` et `40322248378`) : `SENTRY_AUTH_TOKEN` posé, la lecture fonctionne et trouve dès son premier passage COSMO-40, « pagination truncated: kr_completions » (1 utilisateur) : l'historique des résultats clés d'un compte était tronqué à l'affichage. Corrigé : `getAll()` de `kr-completions/supabase.repository.ts` pagine. Le job ne se ferme qu'une fois l'issue résolue dans Sentry |
| AM-2 | **Les erreurs d'exécution des fonctions Vercel (`api/collect.ts`) ne sont lues par rien.** Le collecteur d'audience peut échouer en silence : l'audience tombe à zéro sans alerte | aucun appel à l'API Vercel dans `scripts/` | 🟡 **OUTILLÉ, NON MESURÉ** au 2026-10-23 · même job : requêtes de production en `error`/`fatal` OU en 5xx, plafond **0** (`collect.ts` répond 204 même quand son écriture échoue : le journal est compté, pas seulement le statut). Point d'accès de la CLI officielle (`vercel logs`), jamais appelé avec `VERCEL_TOKEN` depuis le dépôt : le premier run planifié dit si le jeton y a droit · ✅ **MESURÉ le 2026-10-26** : le premier run a rendu 403 (le jeton Vercel n'avait pas le droit de lire les journaux) ; jeton remplacé avec la portée de l'équipe, la lecture passe (run `40322248378`) |
| AM-3 | **Les journaux Supabase ne sont lus qu'à la main**, le jour où quelqu'un y pense. Un pic de 5xx, de 409 ou de refus d'authentification ne remonte nulle part | relevé manuel ci-dessus | 🟡 **OUTILLÉ** au 2026-10-23 · même job : `edge_logs` ET `function_edge_logs` (la première ne porte AUCUNE requête `/functions/v1/*`), six familles (5xx, sondes uptime, sondes `edge-smoke`, refus d'auth, webhook Stripe non signé, 4xx métier) et couples chemin/statut, contre `scripts/prod-errors.reference.json` posée sur trois fenêtres de 24 h. Les « 5 appels sans signature » du relevé ci-dessus étaient les sondes de `check:edge-smoke`. Fermé au premier run planifié vert · ✅ **MESURÉ le 2026-10-26** : 3 112 requêtes lues sur 24 h, familles dans leur plafond ; un seul couple nouveau, 2 × 401 sur `/rest/v1/rpc/get_my_tasks`, portant la clé publique seule (aucun jeton utilisateur) : rotation du jeton forcée par `mobileFocus` en double de celle d'auth-js. Corrigé (`getSession()` au lieu de `refreshSession()`) ; à vérifier : le couple doit disparaître de la prochaine fenêtre de 24 h |

## `docs/OBSERVABILITE.md`, lignes 33 à 62

| AM-6 | **Les traitements planifiés de production n'avaient aucun journal** (ARC-06, audit du 2026-11-06). Six appels d'Edge Functions (avis L215-1, alertes de sièges, comptes inactifs, notifications d'entreprise horaires et quotidiennes, webhooks) partaient du cron de GitHub, qui ne garantit ni l'heure ni l'exécution : un passage manqué ne laissait aucune trace | `grep -l "schedule:" .github/workflows/*.yml`, 2026-11-07 : 22 workflows planifiés, dont 5 qui écrivent en production | 🟡 **OUTILLÉ, NON APPLIQUÉ** au 2026-11-07 · mig. `245` (journal `cron_runs`, bail `cron_leases`, `cron_invoke` par pg_net et Vault) et `246` (planifications pg_cron), prouvées sur base vierge par `e2e/rls/cron-journal.test.ts` (un job pg_cron écrit dans le journal). Surveillance : `cron-journal.yml` (`Journal des crons`, relié à `ci-alert.yml`) lit `cron_runs_verdict()` et rougit sur un job `absent` ou en `echec` dans sa fenêtre. Reste sur GitHub exprès : une sonde logée dans pg_cron se tairait avec lui. Témoin : `scripts/check-cron-runs.guard.test.mjs`. Fermé quand les deux migrations sont en prod et la sonde planifiée verte (gestes : [`DEPLOYMENT.md`](./DEPLOYMENT.md) § 2sexies) |
| AM-5 | **La DÉTECTION d'une violation de données n'est mesurée par rien** (repris de `RGPD-VIOLATION.md` (hors dépôt) AM-2, qui en garde l'énoncé). Le délai de 72 h court depuis la détection ; `BK-1` a été trouvée par un audit, six semaines après | aucune alerte sur un export massif, un pic d'échecs de connexion ou une alerte de secret scanning | 🟡 **OUTILLÉ** au 2026-11-08 (vague 6.1, OBS-01 : « des signaux produits et jamais traités », le premier signal de la PR n° 125 n'ayant été trié par personne) · `detection-violation.yml`, quotidien. Job `detecter` (lecture seule) : alertes de secret scanning ouvertes (`SECURITY_ALERTS_TOKEN`), contenu des artefacts de 26 h, journaux Supabase en agrégats seulement (aucune requête exécutée ne rend un compte ni une IP ; tri à la main par `SQL_TRI`). Mesure d'export en lignes DISTINCTES par forme de requête, plancher 20 000 : la somme des lignes rendues comptait chaque page relue par l'application. Job `alerter` (aucun secret de production) : issue `detection-violation` assignée à Axel, échéance de tri 72 h, une seule ouverte, au plus 3 publications sur 7 jours, puis le salon ops. Revue : la règle des 7 jours de `ci-alert.yml` liste les issues échues, republiées chaque lundi. PR n° 125 fermée, réécrite. Témoin : `detection-violation.guard.test.mjs`. Fermé au premier mois de runs planifiés lus |
| AM-6 | **Aucune mesure de performance.** On sait si une action échoue, pas laquelle est lente ni pourquoi. Le front n'avait qu'un `tracesSampleRate: 0.1` en dur, branché sans condition, sans nettoyage des noms de span ; les Edge Functions n'avaient aucun traçage (audit externe du 2026-11-06, OBS-02) | `grep -n tracesSampleRate src/main.tsx` et `grep -rl sentry supabase/functions` | 🟡 **OUTILLÉ, NON MESURÉ** au 2026-11-07 · voir § Mesure de performance. Reste à voir : une première transaction dans Sentry, front (après un « Accepter ») et Edge (après la pose de `SENTRY_DSN_EDGE`) |

## Mesure de performance (OBS-02, vague 10.4, 2026-11-07)

> **Vivant.** Répond à AM-6. Code : `src/lib/sentry-tracing.ts` (front), `supabase/functions/_shared/trace.ts`
> et `trace-core.ts` (Edge). Témoins : `src/lib/sentry-tracing.test.ts`, `src/edge-trace.guard.test.ts`.

### Front

- **Ce qui est mesuré** : navigations (noms de route paramétrés), requêtes vers Supabase (PostgREST,
  Auth), interactions lentes (INP), tâches longues et images d'animation longues.
- **Échantillonnage** : `VITE_SENTRY_TRACES_SAMPLE_RATE`, entre 0 et 1, **0,1 par défaut**. Absent, illisible
  ou hors de [0, 1] : 0,1 (jamais un plafonnement silencieux à 1). Les erreurs ne sont pas échantillonnées.
- **Poids** : l'intégration se charge avec `sentry-client`, déjà différé après le premier rendu. Le
  chunk d'entrée ne grandit que de `sentry-tracing.ts` (texte seul, pas de SDK). Mesuré le 2026-11-07, build avec DSN : `sentry-client`
  49,4 ko gzip pour 52,0 de plafond (49,3 avant), entrée 69,3 ko pour 70,5, chemin critique 305,3 ko
  pour 323,0. Aucun plafond de `check:bundle` n'a bougé.
- **Aucune PII** : `parameterizeRoute` ramène chaque route à un gabarit (`/invite/:token`,
  `/entreprise/okr/:id`) AVANT la création du span ; `scrubTransaction` (dans `beforeSendTransaction`)
  retire ensuite la chaîne de requête et le fragment de toute adresse, masque e-mails et UUID, et
  supprime l'utilisateur, les en-têtes et les cookies. Le test rejoue un évènement rempli d'un e-mail,
  d'un UUID et d'un jeton et exige qu'aucun ne survive, avec un témoin qui prouve que l'évènement brut
  les contient.
- **Sentry 11 (V18.2)** : deux reculs muets écartés dans `init`. `traceLifecycle: 'static'`, parce
  que le mode diffusé par défaut ignore `beforeSendTransaction`, donc `scrubTransaction`.
  `dataCollection` posé clé par clé à faux, parce qu'absent il vaut tout collecter ; seul
  `User-Agent` passe. La v10 envoyait aussi `Referer`, qui peut porter un jeton d'invitation : retiré. Garde :
  `sentry-tracing.test.ts`. `attachStacktrace: false` garde les groupes d'incidents de la v10.

## `docs/OBSERVABILITE.md`, lignes 129 à 134

  de chargement est avalé (la fonction répond sans traçage) ; il se voit à l'absence de spans dans
  Sentry. Premier geste après la pose du secret : provoquer un appel à `stripe-org-portal` et chercher
  le span `POST stripe-org-portal`.

> ❌ **Ne jamais noter ce document avant la première mesure en CI.** `non-note` est la réponse
> honnête tant qu'aucune de ces lignes n'est outillée.

## `supabase/migration/CLAUDE.md`, lignes 31 à 75

## 🔴 Commiter n'est pas appliquer, et le dépôt l'a payé dix-sept jours

**`C-77`** : la mig. `136` est restée **commitée et dormante du 2026-09-03 au 09-20**. Pendant
tout ce temps `okrTime` valait **0** sur `/statistics` pour tous les comptes réels, la démo
affichait juste, et **aucune garde ne pouvait le voir** — le fichier était au dépôt, le produit
compilait, la suite passait.

- ❌ **Ne jamais écrire « la migration est faite » en parlant d'un commit.** Le seul énoncé qui
  vaut cite une **entrée de ledger** ET une relecture par `pg_get_functiondef` / `information_schema`.
- ⚠️ **Et citer la bonne entrée** : le numéro publié le 2026-09-20 pour la `136` était
  `20260920105113`, qui n'existe au ledger d **aucune** migration. Le vrai est `20260920104729`,
  relu en base le 09-21. Un numéro de ledger se copie depuis la base, jamais depuis une note.
- ✅ **État au 2026-11-05, relu au ledger de production** : le dépôt va de `000` à `241`, et
  tout est en prod **sauf `206`** (suppression des jalons : à appliquer APRÈS le front qui ne les
  lit plus). `164`, `181`, `190`-`195`, `197`-`199` sont en prod **sans** ligne ; `196` est
  retirée par la `200`. ❌ **Ne jamais réappliquer la `164`** : elle retire la branche « membre du
  projet » de la `190`. Dernière entrée : `241_billing_history_reason` (`20261105204321`, relue au catalogue : colonne `billing_reason`, DEFINER, `search_path` vide, `anon` sans EXECUTE). ✅ **`242`
  à `244`** en prod le 2026-11-07, preuve rejouée en prod avant chacune (0 ECHEC), relues au
  catalogue : `242` (`20261107091512`, `anon` hors des défauts tables et séquences de `postgres`),
  `243` (`20261107091727`, corps de `can_access_team_project` = fichier, ACL inchangée), `244`
  (`20261107091936`, une SELECT permissive par table ; la prod n'avait déjà plus les doublons).
  ✅ `245` (ARC-06, journal des crons) en prod le 2026-11-13 (`20261113070725`, `pg_net` installée).
  `246` (planification pg_cron) **non appliquée** : sa preuve rend `ECHEC Vault : 0 secret(s) sur 2`, elle
  attend les deux secrets Vault d'Axel (`DEPLOYMENT.md` § 2sexies).
  ✅ `247` (index des 3 FK nées par 230, 233, 237 ; V9.4) en prod le 2026-11-08 (`20261108001203`),
  relue au catalogue : trois index valides, définition = fichier ; `unindexed_foreign_keys` disparu.
  ✅ `248` (`habit_completions`, DAT-02) en prod le 2026-11-13 (`20261113070621`, 1 421 lignes
  rétro-remplies). ✅ `249` (échéance et priorité facultatives sur `tasks`) en prod le 2026-11-13
  (`20261113070529`). Les deux après preuve à 0 ECHEC, relues au catalogue, ledger = fichier.
  `250` (`friend_requests` sans `user_id` comme la prod, et `sender_id` NOT NULL) commitée,
  **non appliquée** : procédure en tête de `proofs/250.proof.sql`.
  Prochain numéro libre : **`251`**. Journal daté de chaque application (preuves, relectures au catalogue) :
  [`docs/archive/SECURITY-journal-migrations-150-223.md`](../../docs/archive/SECURITY-journal-migrations-150-223.md).
- ✅ **Forme de preuve à reprendre** : un seul bloc `DO` terminé par `RAISE EXCEPTION`
  (`proofs/208-210.proof.sql`). L'annulation n'est pas une instruction qu'on peut oublier, c'est la
  seule issue, et le verdict est le texte de l'exception. ⚠️ En PL/pgSQL `N` et `n`, `OK` et `ok`
  sont le MÊME identifiant : « duplicate declaration ».
- ⚠️ **Plusieurs sessions écrivent des migrations en parallèle** : **relire le ledger ET
  `ls supabase/migration` avant de choisir un numéro**, jamais la fin de ce fichier.
- ✅ **La preuve AVANT a servi à quelque chose, et c'est l'argument de cette section** : la `150` a
  été jouée dans une transaction annulée, acteur par acteur, avant d'être appliquée — insertion,
  catégorie hors énumération refusée (`23514`), non-admin refusé (`42501`), droits effectifs
  relevés. Puis l'annulation elle-même a été vérifiée : ni table ni fonction laissées derrière.
  ⚠️ Un `ROLLBACK` qu'on ne contrôle pas est une hypothèse comme une autre.


## `supabase/functions/CLAUDE.md`, lignes 52 à 59

## ✅ Le code déployé ≠ le comportement déployé (C-91, 2026-09-20)

`check:edge` relit les **sources** en ligne et les compare au dépôt. Il ne dit rien de ce que la
fonction **fait**. C est `npm run check:edge-smoke` qui touche les premiers mètres : **13 sondes** (12 jusqu au 2026-10-22, `inactive-accounts` en plus)
(8 jusqu au 2026-09-30, A-2), dans `edge-deploy-drift.yml`. Les fonctions cron sont sondées **sans
jeton**, comme la CI les appelle : c'est ce qui voit un `verify_jwt` faux.
⚠️ Treize sondes ne sont pas treize fonctions vérifiées : elles prouvent qu'une fonction répond et
comment elle refuse, jamais qu'elle fait son travail.

## `src/modules/billing/CLAUDE.md`, lignes 16 à 27

## État courant

- (historique) `PRICES_VISIBLE = false` du 2026-10-16 au 10-20 (acquisition sans monétisation) : aucun montant affiché, ni sur
  la landing ni dans l'onglet Abonnement ni dans le prérendu (miroir `PRIX_VISIBLES` de `prerender/flags.ts`).
  Rien n'est supprimé. Les surfaces entreprise testent `PRICES_VISIBLE || ENTERPRISE_BILLING_ENFORCED`.
- 🟢 `PREMIUM_ENFORCED = false` (`premium-config.ts`) : `isPremium()` rend `true` pour tous,
  `/premium` redirige vers `/`. Le code de gating reste dormant, il ne se supprime pas.
- 🟢 `ENTERPRISE_BILLING_ENFORCED = true` **et** `billing_flags.enterprise_seat_limit = true`,
  réarmés ensemble le 2026-10-20 (mig. 224), après désarmement du 2026-08-26 (mig. 124).
  `PRICES_VISIBLE = true` le même jour (on ne vend pas sans afficher de prix).
- 🟢 Stripe en compte **LIVE** depuis le 2026-10-20 : on encaisse de l'argent réel.
  Détail de la bascule : [`docs/STRIPE-LIVE.md`](../../../docs/STRIPE-LIVE.md).
