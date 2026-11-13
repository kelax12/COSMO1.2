> ⚠️ **ARCHIVE : récits et relevés datés, extraits de `docs/DEPLOYMENT.md` le 2026-11-13 (DOC-02), non maintenus.**
> Chaque bloc décrit l'état **à sa date**. Le runbook est dans [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md) et
> [`docs/MISES-EN-SERVICE.md`](../MISES-EN-SERVICE.md), qui portent l'état courant. Texte repris **sans une coupe** ;
> le titre de chaque bloc dit d'où il vient. Le code et la production font foi contre ce fichier.

# DEPLOYMENT · journal (extraits du 2026-11-13)

---
## § 1 · `check:drift` retiré (V18.1)

`check:drift` (deux étapes à la main, jamais lancé en CI) est retiré le
2026-11-08 (V18.1) : son seul verdict d'échec, « objet attendu absent de la
prod », est celui d'`ABSENT DES DEUX` dans `check:migration-coverage`.

## § 1 · Hook `pre-push`, justification (CI-01, vague 2.3)

🔴 **Aucun contournement** (vague 2.3) : la variable qui forçait la poussée, banalisée (CI-01), est

## § 1 · Porte de déploiement, avant 2026-11-07

Jusqu'au 2026-11-07, Vercel construisait et publiait chaque poussée sur `main` en ~40 s, avant le
verdict de `CI noyau` (~5 min) : un commit rouge partait en production. Désormais :

## § 1 · Porte de déploiement, pourquoi `git ls-remote`, délai normal

Pourquoi `git ls-remote` et pas l'API REST : sans jeton, l'API est limitée à 60 requêtes par heure
et par IP, et les IP de build de Vercel sont partagées. Le protocole git d'un dépôt public n'a pas
ce plafond et ne demande aucun jeton.

Délai normal : la poussée sur `main` d'un SHA déjà vert sur `noyau/<nom>` construit tout de suite
(le tag existe) ; une poussée directe attend le noyau, soit ~5 min de plus qu'avant. Le build en
attente occupe le slot de build Vercel : un aperçu poussé pendant ce temps patiente.

## § 2bis · Déploiement par l'API (MCP), détail

Un déploiement par l'API (MCP `deploy_edge_function`) est possible mais exige
de reproduire l'arborescence **à la main** — il faut passer `_shared/alert.ts`
dans `files` ET viser `entrypoint_path: '<fonction>/index.ts'`, sinon l'import
relatif ne résout pas. Et il faut re-préciser `verify_jwt` à chaque fois.

## § 2bis · `report-bug`, note de mise en service

> ✅ Déployée en production depuis le 2026-08-29 (`verify_jwt` actif). Fumée de référence : `POST` sans
> corps → `503 mail_not_configured` quand les secrets manquent, `GET` → `405`, sans JWT → `401` du
> gateway. L'étape 1 dépend du même domaine vérifié que § 2ter. *(Pourquoi cette ligne : la doc l'a dite
> livrée six jours avant qu'elle le soit ; le récit est archivé.)*

## § 2ter · Encadrés d'état (2026-08-29 et 2026-09-14)

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

## § 2ter · Correctif de `check:mail` (2026-08-29)

   ⚠️ `npm run check:mail` cherchait le MX et le SPF sur le domaine d'envoi : il aurait affiché
   deux échecs sur une configuration correcte. Corrigé le 2026-08-29, il interroge les deux
   emplacements.

## § 2quater · Pourquoi, et pourquoi c'est lié aux emails

### Pourquoi, et pourquoi c'est lié aux emails

Le risque n'est pas le faux compte, c'est le **quota d'envoi**. Une vague de robots vide le
plafond d'emails du projet, et les inscriptions légitimes échouent alors avec « Trop de
tentatives » sans que personne ne comprenne pourquoi. C'est le même mode de défaillance que §2ter,
et les deux se corrigent ensemble ou pas du tout.


## § 2quinquies · Encadré d'incident (2026-08-31 au 2026-09-01)

> 🔴 **Suivre l'ordre ci-dessous.** La mig. `131` est au ledger de production et un facteur `totp` est
> vérifié sur le compte admin depuis le 2026-09-01. Appliquée avant l'enrôlement, à la demande d'Axel, elle a
> rendu `/admin` inaccessible du 2026-08-31 au 2026-09-01 : l'écran d'enrôlement, censé rester atteignable,
> levait en phase de rendu. Ne pas suivre la procédure a coûté une journée ; le récit est archivé.


## § 2sexies · État relu le 2026-11-09, migrations au 2026-11-13, preuves

**État relu le 2026-11-09, production `ykeugqfgklejcdbrmawy`, lecture seule** : `pg_cron` 1.6.4 installé
(`cron.timezone = GMT`, onze jobs `cosmo-*`), `pg_net` disponible en 0.19.5 mais **non installé** (la `245`
le crée), `supabase_vault` installé avec **zéro secret**, ni `cron_runs` ni `cron_leases`, ledger jusqu'à
`247`, aucune trace de `245` ni `246`. Les cinq Edge Functions sont `ACTIVE` avec `verify_jwt = false`
(pg_net n'envoie pas de JWT, les workflows non plus : même porte, `x-cron-secret`).

**État des migrations au 2026-11-13**, chacune appliquée après sa preuve à 0 ECHEC, relue au catalogue,
texte du ledger identique au fichier :

- `245_cron_journal` : appliquée (`20261113070725`), `pg_net` installée.
- `246_cron_planification` : appliquée (`20261113124319`) après pose des deux secrets Vault ; dix-huit jobs
  pg_cron relus.
- `248_habit_completions` : appliquée (`20261113070621`), 1 421 lignes rétro-remplies.
- `249_taches_echeance_priorite_facultatives` : appliquée (`20261113070529`).
- `250_friend_requests_forme_prod` : appliquée (`20261113083206`) ; plus aucune migration ne manque.

**Preuves.** Rejouées à chaque commit par `e2e/rls/cron-journal.test.ts` sur une pile Supabase réelle
(`pg_cron` et `pg_net` vrais) : `245` avec et sans secrets Vault, `246`, chacune `PREUVE-ANNULEE 0 ECHEC`,
et un job pg_cron de test qui écrit dans `cron_runs` puis se ferme sur la réponse de pg_net (job
`rls-integration` du run `42664142079`, sur `edf90d80`). **Pas encore jouées en production** : c'est l'étape 3
ci-dessous, et ce qu'elle seule peut dire (droits de `postgres` sur `net._http_response` et sur
`vault.decrypted_secrets` dans le projet hébergé).

## § 2sexies · Étape 8 (lecture historique)

8. **Retirer les `schedule:` GitHub** (lecture historique, remplacé par la bascule en deux temps ci-dessus) : le commit existe sur `noyau/cron-bascule-2` (garde les
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

## § 3 · Répétition du 2026-10-16

Un commit sans effet puis son revert, sur `main`, par un agent : **40 s** puis **33 s** de la poussée à la
production (heures lues dans les statuts de déploiement GitHub), vérifiés de l'extérieur par `version.json`.
Commits, heures et tableau : archive.

## § 3 · Leçon « Vercel déploie sans attendre la CI » (fermée le 2026-11-07)

- 🔴 **Vercel déploie sans attendre la CI.** Un revert est en ligne en ~35 s, mais un mauvais
  commit l'est tout aussi vite : la CI (25 min) juge APRÈS la mise en production. Le retour
  arrière est donc le vrai filet, pas la CI. ✅ **Fermé le 2026-11-07** par la porte de
  déploiement (§ 1) : un revert part désormais après le vert du noyau (~5 min), pas en 35 s.
  Le retour arrière immédiat reste le **Promote** ci-dessous, qui ne reconstruit rien.

## § 7 · État au 2026-11-08 et preuve sur `main`

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

## § 7 · Runs du drill automatique (2026-11-07, 2026-11-08)

| Date | Run drill | Run db-backup | Restauration | Tables comptées | Erreurs tolérées | Verdict |
|---|---|---|---|---|---|---|
| 2026-11-07 | `42380272895` (branche `noyau/drill-auto`) | `42378846309` | 1 s (job 39 s) | 91 : 90 de `public` + `auth.users` | 27 : pg_cron et Vault | ✅ comptages identiques, 205 policies, 90 tables sous RLS, isolation 289 / 940 |
| 2026-11-08 | `42463160221` (`main`, SHA `88699890`) | `42463066645` (avec manifeste) | 1 s (drill complet 2 s) | 91 : 90 de `public` + `auth.users` | 27 : extensions Supabase absentes de l'image officielle, 0 bloquante | ✅ comptages identiques, 205 policies, 90 tables sous RLS, isolation 289 / 941 |
| 2026-11-08 | `42463289640` (`main`, **témoin**, case *temoin* cochée) | `42463066645` | n/a | n/a | n/a | ❌ **voulu** : `public.tasks`, manifeste 942 contre 941 restaurées : « la restauration ne rend pas la base du dump » |

## § 7 · Premier run du drill manuel, contrôle qui ne pouvait pas échouer

> ⚠️ **Un contrôle qui ne peut pas échouer ne contrôle rien.** Le tout premier run (2026-09-01) a réussi avec
> un chiffre faux : `VISIBLES=$(tail -1 iso.txt)` capturait le tag `ROLLBACK` de `psql`, jamais le compte,
> donc `VISIBLES = TOTAL` était garanti faux. Corrigé par `grep -E '^[0-9]+$' iso.txt | tail -1`.

**Dernier drill manuel** : 2026-09-01, RTO mesuré **163 s** (objectif < 2 h), 0 table sans RLS, 129 policies,
289 tâches visibles sur 724. Le parcours applicatif (login, création d'une tâche) a été volontairement sauté
(décision d'Axel). Détail et tableau : archive.

## Délivrabilité des emails Auth · état mesuré le 2026-09-02

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

