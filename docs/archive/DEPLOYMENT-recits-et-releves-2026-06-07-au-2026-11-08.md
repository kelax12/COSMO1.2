> ⚠️ **ARCHIVE : récits et relevés datés, extraits de `docs/DEPLOYMENT.md` le 2026-11-08 (V19.4, DOC-02), non maintenus.**
> Chaque bloc décrit l'état **à sa date** (comptes, runs, constats) ; les plus anciens sont démentis par les
> suivants. Le runbook et ses procédures sont dans [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md), qui porte
> l'état courant. Texte repris **sans une coupe**, dans l'ordre de ses lignes d'origine ; le titre de chaque
> bloc dit d'où il vient. Le code et la production font foi contre ce fichier.

# DEPLOYMENT · récits et relevés datés (2026-06-07 au 2026-11-08)

---

## Angles morts · énoncés du 2026-09-16 et colonne « État » du 2026-09-21 (préambule et tableau d'origine)

> 🔎 **Colonne « État » réécrite le 2026-09-21.** La quatrième colonne posait « Outillable ? »,
> c'est-à-dire une **prédiction** faite le 2026-09-16. La passe du 2026-09-20 au soir (`2b4c4304`)
> y a répondu : elle porte donc maintenant l'**état réel**, la garde qui couvre la ligne, et
> 🔴 **ce que cette garde ne prouve pas** — la moitié qui manque d'habitude.
>
> ❌ **La colonne « Angle mort » n'est PAS touchée.** C'est l'énoncé, daté du 2026-09-16, et
> c'est lui qui, nommé, a permis d'outiller : le réécrire effacerait la seule chose qui explique
> pourquoi la garde existe. Un seul endroit porte l'état, et c'est la colonne de droite.
>
> ⚠️ **Une garde posée n'est pas un angle mort fermé**, et `M-56` (« ce que chaque angle mort
> coûte en points ») ne change rien ici : **aucune note ne bouge** sur cette base.



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

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | ✅ **COMBLÉ le 2026-09-16 par `npm run check:deploy`** (job `Deploy SHA drift`, horaire, branché sur `ci-alert.yml`). Était : **rien ne comparait le commit déployé sur Vercel à `main`.** C'est exactement le défaut C-35 des Edge Functions, **côté front**, et il n'a jamais été nommé. `check:edge` compare le code déployé des fonctions au dépôt ; **aucun équivalent n'existe pour l'application elle-même** | la garde lit `/version.json` **sur la production**, écrit au build par `VERCEL_GIT_COMMIT_SHA`, et distingue **à jour / retard / dérive** : un `!=` confondrait un déploiement en vol avec une dérive, et une prod **en avance** avec un simple retard | ✅ **COMBLÉ le 2026-09-16** · `npm run check:deploy` (`T-8`), job horaire branché sur `ci-alert.yml`. Cycle complet observé le même jour |
| AM-2 | 🔴 **Le ROLLBACK n'a jamais été éprouvé.** Le runbook le décrit ; `restore-drill.yml` n'a qu'un `workflow_dispatch` avec confirmation. **Un chemin de récupération qui n'a pas été parcouru est une hypothèse**, et ce dépôt l'a déjà appris au prix fort avec la mig. `131` (`/admin` inaccessible deux jours) | `restore-drill.yml` : `on: workflow_dispatch` | ✅ **OUTILLÉ le 2026-09-20** · `dump-check` **trimestriel et automatique** (`C-86`) · 🔴 ne prouve PAS : qu'un dump soit restaurable, et surtout pas que le **rollback** fonctionne : personne ne l'a jamais parcouru, c'est **`M-47`** · 🔎 🔴 **2026-10-15 : l'outil lui-même ne tourne pas.** `restore-drill.yml` est désactivé à la main depuis le 2026-09-01 : `dump-check` n'a jamais été joué, et `gh run list` ne montre même pas qu'il manque |
| AM-3 | **Les variables d'environnement Vercel ne sont comparées à rien.** Une `VITE_*` manquante ou périmée ne se voit qu'à l'exécution. Le cas a déjà mordu : `VITE_SENTRY_DSN` absente changeait la forme du bundle et rendait la garde de budget aveugle à ~45 ko | aucun job ne lit la configuration Vercel | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:env` · contrat statique des 8 `VITE_*` avec l'**effet d'absence** de chacune (`C-105`) — 🔴 ne prouve PAS : les **valeurs** : la moitié Vercel vérifie une présence, jamais un contenu. ⚠️ Et elle dort tant que `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` ne sont pas posés (**`M-59`**) |
| AM-4 | **L'état réel de Turnstile n'est écrit nulle part de vérifiable.** Le code existe (`TurnstileWidget.tsx`, `AuthForm.tsx`) ; son activation dépend d'une variable posée **hors du dépôt**. Ce document le dit « inerte au 2026-08-28 », et rien ne dirait qu'il a changé | 3 fichiers sources le référencent, 0 garde | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:env` (`C-105`) — 🔴 ne prouve PAS : rien de plus qu'AM-3 : même garde, même réserve |
| AM-5 | **`uptime.yml` mesure qu'une page RÉPOND, jamais qu'elle FONCTIONNE.** Un HTTP 200 sur une coquille SPA vide est vert. C'est le même piège que la garde Lighthouse qui mesurait une 404 (`T-50`, corrigé le 2026-08-29) | `uptime.yml` : `-w '%{http_code}'` sur `/` et `/auth/v1/health` | ✅ **OUTILLÉ le 2026-09-20** · 3 marqueurs **absents de la coquille SPA** + une 2ᵉ page prérendue sondée + le corps de `/auth/v1/health` (`C-104`) — 🔴 ne prouve PAS : rien — mais ⚠️ **l'énoncé du 09-16 était périmé dans l'autre sens** : `uptime.yml` avait un marqueur (`grep -i cosmo`) qui **ne pouvait pas échouer**, la coquille contenant le mot 21 fois |
| AM-6 | **Le déploiement des Edge Functions est un geste MANUEL.** `check:edge` voit la dérive après coup ; rien ne déploie depuis `main`. Le 2026-10-23, un correctif poussé sur `main` (`c161de2b`, mention 293 B) n'a pas pu être déployé par l'agent : la dérive est ouverte jusqu'au geste suivant | `grep -l "functions deploy" .github/workflows/*` : aucun | 🟡 **CODE LIVRÉ le 2026-10-23, pas encore exécuté** · `.github/workflows/edge-deploy.yml` : après `CI` verte sur un push de `main`, déploie (`--use-api`) les fonctions modifiées depuis le dernier SHA déployé, importatrices de `_shared/` comprises, puis rejoue `check:edge` et `check:edge-smoke`. Sélection : `scripts/edge-deploy-select.mjs`, témoin `edge-deploy-select.guard.test.mjs` vu rouge sur 3 sabotages. Fermé au premier run vert sur `main` (amorçage : les 13 fonctions) |
| AM-7 | **Les artefacts de CI n'ont aucune durée de rétention.** Le quota du compte (11,5 Go) a été atteint le 2026-10-23 : c'est lui qui a bloqué la sauvegarde T11. Rien ne le borne ni ne le mesure | aucun `retention-days` sur les `upload-artifact` de rapports | 🟡 **OUTILLÉ le 2026-10-23** · `scripts/artefacts-retention.guard.test.mjs` (suite outillage) exige un `retention-days` entier de 1 à 30 sur chaque `upload-artifact` / `upload-pages-artifact`. Constat à la pose : les 8 dépôts du dépôt portaient déjà leur durée (7 à 30 jours), donc la garde protège contre une régression, pas un défaut présent. 🔴 Ne prouve PAS le quota : la taille stockée n'est mesurée nulle part ; le plafond de 30 jours est une décision à relire si un artefact doit durer plus |

---

## § 2bis · `report-bug` : déploiement du 2026-08-29

> ✅ **Déployée en production le 2026-08-29** (version 1, `verify_jwt` actif), après six
> jours où `SECURITY.md` et ce fichier la décrivaient comme livrée sans qu'elle le soit.
> Fumée passée en prod : `POST` sans corps → `503 mail_not_configured`, `GET` → `405`,
> sans JWT → `401` du gateway. **Les secrets ne sont toujours pas posés**, donc le repli
> `mailto` est ce que voit un utilisateur aujourd'hui. L'étape 1 ci-dessus dépend du même
> domaine vérifié que §2ter : les deux se débloquent ensemble.

---

## § 2ter · encadré « ce titre a dit non configurés » et mesures du 2026-09-14

> 🔴 **CE TITRE A DIT « NON CONFIGURÉS » PENDANT SEIZE JOURS APRÈS LA MISE EN SERVICE.**
> Corrigé le 2026-09-14 au soir. La section qui suit décrit l'état du **27-29 août au matin** ;
> la mise en service a eu lieu **le 29 au soir**, et elle est inscrite dans `faille.md` (ligne
> 1quater de l'ordre de priorité) sans que ce runbook soit repassé derrière.
>
> **Mesuré ce soir, `npm run check:mail`** : DKIM Resend présent sur `send.thecosmo.app`, SPF du
> Return-Path `v=spf1 include:amazonses.com ~all`, MX `feedback-smtp.eu-west-1.amazonses.com`, MX et
> SPF de la racine intacts, DMARC présent. **Un seul avertissement : `p=none`**, surveillance seule,
> correct pour démarrer. Le domaine d'envoi est donc en état de signer.
>
> ⚠️ **Ce qui reste VRAI dans la section ci-dessous, et ne doit pas être lu comme corrigé** : les
> **confirmations d'inscription sont toujours désactivées**, par décision d'Axel (finding `G-2`).
> Remesuré ce soir : **28 comptes sur 28 portent `email_confirmed_at`, dont 26 à la seconde même de
> leur création**, et **18 comptes sont créés par email + mot de passe**. Aucune de ces 18 adresses
> n'a jamais été prouvée : la colonne dit « confirmé » parce que personne n'a demandé de
> confirmation. Le point 1 des « deux conséquences » ci-dessous tient donc intégralement ; le
> point 2, lui, ne tient plus : **le SMTP qui manquait est là**, activer les confirmations ne
> dépend plus que d'une décision.
>
> ⚠️ Le DNS ne prouve toujours pas qu'un email ARRIVE. La preuve reste un compte jetable vérifié
> sur Gmail ET Outlook (§ « Vérification » plus bas).

---

## § 2quinquies · encadré « ce titre a dit non appliquée » et ordre inversé du 2026-08-31

> 🔴 **CE TITRE A DIT « NON APPLIQUéE » PENDANT QUINZE JOURS.** Corrigé le 2026-09-14 au soir.
> La mig. `131` est au ledger de production, et `auth.mfa_factors` porte un facteur `totp` en statut
> `verified` sur le compte admin depuis le 2026-09-01 à 14:20:27 UTC.
>
> 🔴 **Et elle a été appliquée dans l'ordre que la procédure ci-dessous déconseille**, à la
> demande explicite d'Axel : migration d'abord, enrôlement ensuite. Le coût a été réel et il est
> exactement celui que l'avertissement de bas de section annonçait à moitié : `/admin` est resté
> **inaccessible du 2026-08-31 au 2026-09-01**, parce que l'écran d'enrôlement, censé rester
> atteignable, levait en phase de rendu. La procédure ci-dessous reste la bonne ; c'est de ne pas
> l'avoir suivie qui a coûté une journée.

---

## § 3 · répétition du retour arrière par `git revert`, 2026-10-16 (commits, heures, tableau)

Fait par un agent, sur `main`, avec un commit sans effet : `42ee5006` ajoute
`public/repetition-retour-arriere.txt`, `2b9ad9d` le défait. Heures lues dans les statuts de
déploiement que Vercel publie sur GitHub (`gh api repos/.../deployments?sha=…`) :

| | Poussé (UTC) | Servi en production | Délai |
|---|---|---|---|
| Commit A | 19:01:16 | 19:01:56 | **40 s** |
| Revert | 19:13:09 | 19:13:42 | **33 s** |

Vérifié de l'extérieur : `version.json` rend le nouveau commit, et l'URL du fichier renvoie
ensuite la page d'app générique.


---

## § 6 · état vérifié du 2026-06-07 et audit du 2026-06-10

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

---

## § 7 · encadré d'état du 2026-11-07 (avant les runs de `main`)

> 🔎 **État au 2026-11-07 (ROB-01, vague 4.4).** Le dump quotidien est désormais **restauré
> chaque mois, sans humain**, par le job `drill-auto` de `restore-drill.yml` (le 9 à 05:43 UTC),
> et une garde d'**absence** (`restore-drill-fraicheur.yml`, hebdomadaire) rougit si aucun drill
> n'est vert depuis 35 jours. Les deux sonnent par `ci-alert.yml`. Premier drill vert : **2026-11-07**
> (run `42380272895`, 91 tables comptées, comptages identiques au manifeste).
> Le `dump-check` trimestriel (C-86), qui ne lisait qu'une table des matières, est fondu dans ce
> drill. Détail : § « Drill automatique mensuel » ci-dessous.

---

## § 7 · états du 2026-10-15 et du 2026-09-01 (réactivation de `restore-drill.yml`, dump-check chiffré)

> 🔎 **État au 2026-10-15.** `db-backup` est vert tous les jours, **chiffré** depuis le 2026-10-13.
> `restore-drill.yml` était **désactivé à la main du 2026-09-01 au 2026-10-15** (rangement
> d'après-drill, rendu caduc par `C-86`) : le premier `dump-check` trimestriel, le 2026-10-05,
> n'a pas eu lieu. ✅ **Réactivé le 2026-10-15**, et la relecture passe par
> `scripts/dump-check.mjs` (témoin `dump-check.guard.test.mjs`) : elle refusait mal un `.gpg`
> non chiffré et un clair posé à côté du chiffré.
> ✅ **2026-10-15, run [`38787097174`](https://github.com/kelax12/COSMO1.2/actions/runs/38787097174)** :
> `dump-check` **vert sur le dump CHIFFRÉ** du run db-backup `38711418682` (déchiffré,
> 1 594 147 octets en clair, 2 214 objets, toutes les tables attendues). `drill` arrêté à sa
> première garde (confirmation absente), rien écrit : c'est le rouge attendu.

**État au 2026-09-01** : le plan Free n'offre **aucune sauvegarde native**, et le PITR a été
écarté avec le plan Pro (T-01). La seule copie de la base qui existe est le dump quotidien de
`.github/workflows/db-backup.yml`. **La restauration a été testée le 2026-09-01** (drill
ci-dessous) : le dump se restaure, en 163 s, et l'isolation RLS survit.

---

## § 7 · drill manuel : premier run au chiffre faux, résultat du 2026-09-01, test humain sauté

> ⚠️ **Le tout premier run (2026-09-01, avant celui du tableau) a réussi avec un chiffre faux.**
> `VISIBLES=$(tail -1 iso.txt)` capturait le mot `ROLLBACK` (tag de commande imprimé par `psql`
> après `BEGIN`/`SET`/`SELECT`/`ROLLBACK`, même en `-tA`), jamais le compte réel : la comparaison
> `VISIBLES = TOTAL` était donc garantie fausse quel que soit le vrai résultat, et ce contrôle ne
> pouvait **jamais** déclencher — même si l'isolation avait été cassée par la restauration.
> Corrigé par `grep -E '^[0-9]+$' iso.txt | tail -1`. Le run rejoué ensuite (celui du tableau) a
> mesuré un vrai chiffre.

**Résultat du dernier drill** : ✅ réussi. RTO mesuré 163 s, objectif < 2 h très large.

| Date | Run db-backup | Durée | Tables sans RLS | Policies | Tâches visibles / total |
|---|---|---|---|---|---|
| 2026-09-01 | `33384797200` | 163 s | 0 | 129 | 289 / 724 |

Le test humain (login + création d'une tâche sur le projet restauré) a été **volontairement
sauté** (décision d'Axel, 2026-09-01) : l'app a chargé sans erreur sur le projet restauré
(écran de connexion atteint, aucune erreur réseau/RLS), et le contrôle d'isolation automatisé
avait déjà prouvé qu'un utilisateur authentifié ne voit que ses propres tâches. Le risque résiduel
non couvert : un parcours applicatif complet (mutation, pas seulement lecture) n'a pas été rejoué.

**Reste à faire, à la main, avant de clore le drill** : **supprimer le projet jetable ET le secret
`DRILL_DB_URL`.**

---

## § 7 · export hors-fournisseur : récit de la violation `BK-1`

> 🔴 **L'artefact contient des données personnelles** (noms, emails, empreintes de mots de passe,
> contenu des tâches). ❌ **Corrigé le 2026-10-15 : ce paragraphe disait « le dépôt est public, mais
> les artefacts d'un run exigent une authentification ».** C'est faux : sur un dépôt public,
> **n'importe quel compte GitHub connecté** télécharge un artefact. Cette phrase, recopiée du
> commentaire du workflow, est exactement ce qui a produit la violation **`BK-1`** (dumps en clair
> exposés du 2026-08-29 au 2026-10-13, cf. `faille.md` (hors dépôt)). Depuis `8c6a971d`
> (2026-10-13), **seul un dump chiffré** (`gpg`, AES-256, phrase secrète `BACKUP_PASSPHRASE`) part
> en artefact, relu à l'identique par sha256 avant dépôt ; sans la phrase secrète, le job
> **échoue**. Ne **jamais** committer un dump. Pour une vraie copie longue durée, la télécharger et
> la garder sur un disque chiffré : GitHub n'est pas un coffre.

---

## Délivrabilité des emails Auth · commentaires datés de `check:mail` (2026-09-02)

> Commentaires de la section `## Scripts` de `CLAUDE.md`, où ils étaient chargés à chaque
> session. Déplacés ici **sans une coupe**. La racine ne garde que la commande.

```bash
npm run check:mail          # Délivrabilité des emails Auth : MX, SPF, DKIM Resend, DMARC.
                            # ✅ VERT au 2026-09-02 (remesuré) : DKIM, SPF et MX du Return-Path
                            # en place sur `send.thecosmo.app`. Reste 1 avertissement, DMARC
                            # `p=none` (surveillance seule), correct pour démarrer.
                            # ⚠️ Le DNS ne prouve pas qu'un email ARRIVE : la preuve reste un
                            # compte jetable vérifié sur Gmail ET Outlook (docs/DEPLOYMENT.md §2ter).
                            # 🔴 Les confirmations d'inscription restent DÉSACTIVÉES, décision
                            # d'Axel — cf. finding G-2 de faille.md.
                            # PAS une gate CI — dépend d'un état DNS externe.
```
