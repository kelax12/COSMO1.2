> ⚠️ **ARCHIVE : récits datés, extraits de `docs/SECURITY.md` le 2026-11-08 (V19.4, DOC-02), non maintenus.**
> Chaque bloc décrit l'état **à sa date** ; les plus anciens sont démentis par les suivants (comptes de
> fichiers, de migrations, d'entrées de ledger, notes de garde). Les règles, elles, sont dans
> [`docs/SECURITY.md`](../SECURITY.md) : § « Angles morts », § « Base de données », § « Gardes SQL et Edge
> Functions », § « Garde-fous transversaux » et § « AM-5 ». Le code et la production font foi contre ce fichier.
> Texte repris **sans une coupe** des lignes d'origine, dans l'ordre de leur apparition.

# SECURITY · récits datés (angles morts, base de données, gardes, garde-fous, AM-5)

---

## A. Angles morts · énoncés du 2026-09-16, colonne « État » du 2026-09-21 au 2026-10-24

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
| AM-1 | 🔴 **Les RÈGLES de sécurité ne sont notées nulle part.** La note de sécurité (88) vit dans `faille.md` (hors dépôt), qui porte les **findings ouverts**. Ce document porte les **règles** : RLS, migrations, Edge Functions, secrets, CSP. Un finding se ferme et fait monter la note ; une règle qui se périme ici ne coûte rien à personne | `faille.md` porte la note, `SECURITY.md` n'en a aucune | ✅ **SANS OBJET le 2026-11-08** : les notes /100 ont cessé (ADR 0012) et `check:docs-scored` (`C-109`) est retirée ; `npm run check:docs` refuse leur retour. L'énoncé de gauche est celui du 2026-09-16, conservé |
| AM-2 | 🔴 **Les réglages du Dashboard Supabase ne sont surveillés par AUCUNE garde.** Protection des mots de passe compromis, expiration des OTP, politiques d'auth : ils se modifient **hors du dépôt**, sans commit, sans revue et sans trace. Un réglage désactivé par erreur ne se voit qu'au prochain audit manuel | aucun workflow ni script ne lit ces réglages ; seul un commentaire contient le mot « dashboard » | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:supabase-posture` · juge un **écart** à une référence commitée, jamais un absolu (`C-88`) · 🔴 ne prouve PAS : 🔴 rien pour l'instant : `reglages_auth` est à `null`, la référence exige un jeton. **La garde ÉCHOUE tant que ce n'est pas fait, exprès** · c'est **`M-58`** · 🔎 ✅ **2026-10-15 : `M-58` fait le 2026-10-08.** La référence porte huit réglages d'Auth (`password_hibp_enabled`, expiration des OTP, rotation des jetons, MFA, Google…) et `Posture` est vert chaque jour depuis |
| AM-3 | **La rotation des secrets n'avait ni échéance ni rappel.** Le § « Rotation des secrets » disait comment faire, jamais quand, et rien ne mesurait l'âge d'un secret | `.github/secrets-registry.json` (noms seulement : propriétaire, criticité, échéance, dernière rotation), `scripts/check-secrets-age.mjs`, `.github/workflows/secrets-age.yml` (hebdomadaire, relié à `ci-alert.yml`) | 🟡 **OUTILLÉ le 2026-10-24, `M-54`**, rouge tant que les dates ne sont pas posées. La garde échoue sur un secret échu, de date **inconnue (= échu)**, vivant sans entrée au registre, ou inscrit sans exister ; jeton absent = exit 1. Témoin : `scripts/check-secrets-age.guard.test.mjs`. ⚠️ **Reste à Axel** : créer `SECRETS_AUDIT_TOKEN` (PAT fin, lecture des secrets du dépôt), puis renseigner `lastRotated` des secrets que ni GitHub ni Vercel ne datent (Edge, `SERVICE_ROLE_KEY`) ou les faire tourner. Le premier run réel dira aussi si le registre colle à la réalité (inventaire non relu en ligne le 10-24, l'API GitHub répondait en TLS timeout) |
| AM-4 | **La checklist « avant tout commit qui touche `supabase/migration/*.sql` » est MANUELLE.** `validate:migrations` et `check:rls` en couvrent une partie ; le reste repose sur la lecture | les deux gardes vérifient des motifs nommés, pas la checklist entière | ✅ **OUTILLÉ le 2026-10-24** (ouvert du 09-16 au 10-23) · tableau ligne par ligne au § [« Avant tout commit qui touche `supabase/migration/*.sql` »](#avant-tout-commit-qui-touche-supabasemigrationsql) : sur **24** lignes, **16** ont une garde (`validate:migrations` règles 2, 5 et 6 à 16, `check:rls` règles 1 à 3, `check:erasure`), **8** restent **manuel** et le disent. Les onze règles neuves sont un cliquet à partir de la mig. `227`, chacune avec un témoin vu rouge et un sabotage rejoué par `check:sabotages` · 🔴 ne prouve PAS : l'historique `000` à `226` (non jugé, il diverge de la prod), ni qu'une migration fait ce qu'elle dit : la preuve en transaction annulée (mig. `150`, 2026-09-21) reste une discipline, pas une garde |
| AM-5 | **Les advisors Supabase ne sont lus qu'à la main** (T-7 du tableau de bord). Dans `ci.yml`, le mot « advisor » désigne `npm audit` | aucun workflow n'interroge l'API Management | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:supabase-posture` · advisors relus par l'API Management (`C-88`) · 🔴 ne prouve PAS : idem AM-2 : elle échoue tant que `M-58` n'est pas fait. ⚠️ Écart **attendu** depuis la mig. `150` : 9 → 10 et 52 → 53 · 🔎 🔴 **2026-10-02 : elle lisait ZÉRO partout depuis sa pose** (une entrée par occurrence dans la réponse de l'API, un `count` absent lu à la place) : corrigée, témoin à la forme réelle de l'API. Écart attendu au premier `--update` : **9 → 11** et **52 → 80**, objets identifiés dans `../faille.md` · 🔎 ✅ **2026-10-15 : remboursé** (+1 à la note de sécurité). Référence posée le 10-08, recalée le 10-10 à **82** (`claim_acquisition_source`, mig. `217`) ; relu par l'API ce jour : `11 / 82 / 2 / 1`, exactement la référence |
| AM-6 | **Aucune analyse statique de sécurité (SAST).** Les gardes vérifient des invariants **nommés**, jamais des motifs inconnus. Le dépôt est **public**, donc CodeQL y serait gratuit | aucun CodeQL ni Semgrep dans `.github/workflows/` | ✅ **OUTILLÉ le 2026-09-20** · `codeql.yml`, `security-extended`, JS/TS **et** `actions` (`C-89`) · 🔴 ne prouve PAS : 🔴 un job vert. L'item n'est fini que quand **chaque alerte ouverte porte une décision** · c'est **`M-60`** · 🔎 **2026-10-15** : une alerte `high` sans décision depuis le 2026-10-12 (n° 13, `js/double-escaping`, `scripts/capture-og-images.mjs`, triée par lecture dans `../faille.md`, −1). Et la réciproque de l'énoncé s'est vérifiée : dépôt **privé** du 10-13 au 10-14, CodeQL rouge sur quatre pushs (« Code scanning is not enabled »), revenu avec le dépôt public |
| AM-7 | **Le recalage de `Posture` ne peut être fait que par Axel.** `--update` exige `SUPABASE_ACCESS_TOKEN`, présent dans la CI mais pas sur le poste : `Posture` est rouge depuis le 2026-10-23 09:57 pour cinq objets **légitimes** (mig. `221`, `222`, `226`), relus un par un le 2026-10-23. Une garde rouge pour une raison connue cache la suivante | `posture.yml` : `workflow_dispatch` sans entrée | 🟡 **OUTIL POSÉ le 2026-10-23, geste de prod restant** : `posture.yml` a une entrée `regenerer` (job `recaler-reference`, `main` seulement, rejoue la garde puis commite la référence, comme `visual.yml`) ; `--update` conserve désormais les `_note` (`fusionnerReference`, témoin dans `gardes-posture.guard.test.mjs`) et les cinq objets ont leur raison de légitimité. Reste à lancer, après fusion : `gh workflow run posture.yml -f regenerer=true` |

---

## B. Base de données · récits repris de `CLAUDE.md` (déplacés le 2026-09-16)

> Ces blocs vivaient dans `CLAUDE.md`, chargés à chaque session. Déplacés ici **sans une
> coupe**. Les règles courtes vivent dans
> [`supabase/migration/CLAUDE.md`](../supabase/migration/CLAUDE.md).

## Base de données Supabase

Migrations dans `supabase/migration/*.sql`, convention `NNN_<feature>.sql`.
État courant : § « État des migrations » plus bas (dépôt `000` → `240` au 2026-11-05). Les
paragraphes qui suivent sont des récits datés, gardés pour leurs leçons ; leurs comptes (153
fichiers, 140 entrées au ledger) sont ceux du 2026-09-20.

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
⚠️ L'ancien `check:drift` (retiré le 2026-11-08) ne comblait pas ce trou non plus.

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
sortie, et elle n'a pas d'autre gardien. *(2026-11-08, V5.4 : la check-list d'arrivée d'un second
administrateur et celle de départ sont dans [`CONTINUITE.md`](./CONTINUITE.md) ; le coffre et son
accès d'urgence, § « Coffre et accès d'urgence » plus haut. Tant que la seconde ligne n'est pas
écrite, ce constat tient.)*
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

---

## C. Gardes SQL et Edge Functions · commentaires datés des commandes (déplacés le 2026-09-16)

> Commentaires de la section `## Scripts` de `CLAUDE.md`, où ils étaient chargés à chaque
> session. Déplacés ici **sans une coupe**. La racine ne garde que la commande.

```bash
npm run validate:migrations # Garde statique sur supabase/migration/*.sql (CI)
npm run check:rls           # Invariants RLS : auth.uid() wrappé, 1 seule policy PERMISSIVE,
                            # + toute fonction citée par une policy exécutable par authenticated (CI)
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

---

## D. Garde-fous transversaux · récits d'origine (déplacés le 2026-10-11)

> Texte d'origine, **à l'identique**. `CLAUDE.md` n'en garde que l'interdit, en une ligne.
> ⚠️ Une ligne a vieilli depuis : B-1 (mig. `107`) est **refermé** par la mig. `109`, cf. `faille.md`.

### Journal fiscal et consentement (2026-08-26)

- ❌ **Ne JAMAIS ajouter de policy UPDATE ou DELETE sur `payment_records` ou `payment_closures`,
  ni les inclure dans une purge.** C'est le journal d'encaissement inaltérable (mig. `125`,
  CGI art. 286-I-3° bis). L'immuabilité est portée par un **trigger**, pas par la RLS, parce que
  `service_role` contourne la RLS mais pas les triggers.
  🔴 **CORRIGÉ le 2026-09-02** : ce paragraphe demandait d'« anonymiser `user_id` » à la purge.
  C'est **inapplicable**. `row_hash` scelle `user_id` dans le chaînage, et
  `verify_payment_chain()` recalcule chaque hash depuis les colonnes : écrire NULL casserait la
  chaîne, donc produirait exactement le signal de falsification qu'on montre à un contrôleur.
  Le trigger refuse d'ailleurs l'UPDATE. Ce qui rend la conservation acceptable est ailleurs :
  `user_id` cesse d'identifier quiconque dès que la ligne `auth.users` disparaît, il ne reste
  qu'un UUID que COSMO ne sait plus rattacher. `delete-account` ne touche donc PAS cette table,
  et le commentaire qui l'explique est dans la fonction.
  Une erreur se corrige par une ligne compensatoire, comme en comptabilité.
- ❌ **Ne jamais lire `cosmo_cookie_consent` directement.** Passer par
  `src/lib/cookie-consent.ts`, et par `useCookieConsent()` dans React. La dispersion est
  exactement ce qui a permis au bandeau de proposer un choix qu'aucune ligne de code
  n'appliquait. **Tout nouveau traceur doit être conditionné** : `null` n'est pas une
  acceptation tacite.
- ❌ **Ne jamais rendre une garde conditionnelle à la présence de son propre secret.**
  `if (SECRET && header !== SECRET)` laisse passer tout le monde tant que le secret n'est pas
  posé : on ne se protège que quand on est déjà protégé. Bug introduit puis corrigé le
  2026-08-26 dans `renewal-notice`.
- ⚠️ **`renewal_notices` est une PREUVE**, pas un cache. Ne jamais la purger : c'est ce qu'on
  produit si un client conteste une reconduction (Conso. art. L215-1).

### Sécurité & env

- ❌ `VITE_SUPABASE_SERVICE_ROLE_KEY` côté client
- ❌ Committer sans vérifier que `.env` reste gitignored
- ❌ Écrire en base via le MCP Supabase (contourne la RLS)
- ❌ **Appeler `get_subtree` / `has_subordinates` / `org_admin_count` depuis une policy.** La
  mig. `100` leur a révoqué `EXECUTE` à `authenticated` pour fermer une fuite inter-organisations,
  et une policy s'évalue avec le **rôle courant** : l'appel échoue par `permission denied`. Dans
  une policy, utiliser `is_above(org_id, user_id)` ou `i_have_subordinates(org_id)`. À l'intérieur
  d'une fonction `SECURITY DEFINER`, les helpers restent appelables (rôle = propriétaire).
  Régression en cours en prod : mig. `107`, finding B-1 de `faille.md` (hors dépôt).
- ❌ **Garder une surface admin par `admin_allowlisted()`.** Depuis la mig. `131`, deux fonctions
  répondent à deux questions différentes : `admin_allowlisted()` dit « ce compte est admin »
  (AFFICHAGE, ignore volontairement le niveau d'assurance, sinon l'écran d'enrôlement TOTP
  devient inatteignable) et `is_admin()` dit « cette requête est autorisée » (GARDE : allowlist
  ET `auth.jwt() ->> 'aal' = 'aal2'`). Les intervertir annule la migration. Et ne jamais tester
  « ce compte a activé la 2FA » : `aal2` porte sur la SESSION, or c'est précisément la session
  ouverte avec un mot de passe volé qu'il faut refuser. Détail : `docs/SECURITY.md`.
- ❌ **Une fonction de trigger en `SECURITY DEFINER`.** Une garde doit être `SECURITY INVOKER`
  (défaut) et `REVOKE`-ée pour `anon` (mig. `064b` / `094b`). Un trigger `BEFORE` s'exécutant
  **avant** le `WITH CHECK` de la RLS, en DEFINER ses messages d'erreur deviennent un oracle sur
  des lignes non lisibles (mig. `108`, finding B-3).
- 🔴 **En CSP, un schéma écrit explicitement doit correspondre : `https:` ne couvre PAS `wss:`.**
  `connect-src` autorisait `https://*.supabase.co` sans `wss://*.supabase.co` : le navigateur
  bloquait **toutes** les connexions Realtime **en production**, en silence (la console disait
  « The action has been blocked », l'écran ne disait rien). Les trois canaux d'`App.tsx` étaient
  coupés, et comme ils ont justement REMPLACÉ huit sondages, il n'y avait plus aucun filet
  derrière eux : une tâche partagée n'arrivait jamais. Trouvé le 2026-09-01 dans la console
  d'Axel, **en cherchant autre chose**. Garde : `src/csp.guard.test.ts` (schéma `wss`, directives
  de confinement, absence d'`unsafe-eval`, et `data:` dans `img-src` dont dépend le QR code TOTP).
- 🔴 **Une migration qui crée une dépendance à un chemin de récupération : PARCOURIR ce chemin
  avant de l'appliquer.** La mig. `131` exige une session `aal2` ; l'écran d'enrôlement TOTP levait
  en phase de rendu et son QR portait un double préfixe `data:`. `/admin` est resté inaccessible du
  2026-08-31 au 2026-09-01, et **un seul compte au monde** ouvre cette console. Le raisonnement
  « ce n'est pas un verrouillage, l'écran reste atteignable » était juste sur la garde et faux dans
  les faits. Il suffisait d'ouvrir l'écran une fois.
- ⚠️ **Le dépôt est PUBLIC**, avec secret scanning, push protection et Dependabot actifs depuis le
  2026-09-01. Une fuite réelle est confirmée dans l'historique (`.env` au commit initial), **inerte**
  car elle vise un projet supprimé depuis. Retirer un fichier du suivi n'efface pas l'historique.

### Documentation

- ❌ Traiter un fichier de `docs/archive/**` comme l'état courant du projet
- ❌ Citer un numéro de ligne d'un autre fichier `.md` — les fichiers bougent, les liens de
  section survivent
- ❌ **Recopier un « avant » au lieu de le relire à sa source.** Le tableau de bord des audits est
  parti d'une note RGPD de 84 le 2026-09-02 alors qu'elle valait 86 depuis le 08-29 : la colonne
  avait été reprise du tableau du 25. Troisième occurrence, après les `refetchInterval` du 08-25 et
  la garde `architecture.guard` du 08-27 (« antérieure à mon travail », déclarée depuis un
  `git stash` qui contenait déjà le commit fautif). **Un « avant » se reconstruit à un commit
  nommé, jamais dans un arbre de travail ni depuis un tableau plus ancien.**
- ❌ **Chercher le symptôme cité par la doc plutôt que la chose décrite.** Une note du 2026-09-02
  n'a corrigé qu'un nom sur six sur la sélection de modules : elle constatait l'absence de
  `RequireModule` sans voir que la fonctionnalité entière avait disparu, ce qui laisse la dérive
  presque intacte **et la fait paraître vérifiée**.

---

## E. AM-5 · écart de `check:supabase-posture` : relevés des 2026-11-05 et 2026-11-07

Rouge au 2026-11-05 (référence du 10-26, descendu de `scripts/CLAUDE.md`) : `rls_enabled_no_policy`
24/14, DEFINER exposées 87/84, `unindexed_foreign_keys` nouveau (3). Écarts nés des mig. `229` → `240` :
relire au catalogue AVANT `--update`. `supabase/rpc-inventory.md` (généré, MAI-01/API-01) donne l'état
des droits `EXECUTE` de chaque fonction depuis les migrations.

**Relu et recalé le 2026-11-07 (V9.4, TST-05).** Rouge chaque jour depuis le 2026-10-30
(`42220903077` le 11-06). ⚠️ **Pas** « rouge pour une amélioration » comme l'a lu l'audit externe :
la baisse d'`unused_index` (75 → 56) est imprimée sans rougir ; le workflow annotait les 20
dernières lignes du journal, améliorations comprises (corrigé : seul le verdict est annoté).
Objets relus dans leurs migrations et par `get_advisors` le même jour, noms écrits dans les `_note` :
- `rls_enabled_no_policy` 14 → 24 : les sept `affiliate_*` (mig. `236`), `billing_acceptances` et
  `org_withdrawals` (`237`), `org_seat_alerts` (`240`). RLS sans policy et `REVOKE ALL` à `anon` et
  `authenticated` dans chaque migration : voulu, comme les 14 premières.
- DEFINER exposées 84 → 87 : `affiliate_backfill`, `affiliate_attach` (`is_admin()` ou
  `service_role` en première instruction), `claim_affiliate` (profil de `auth.uid()` seul, compte
  de moins d'une heure). Légitimes.
- `unindexed_foreign_keys` 0 → 3 : **défaut**. `org_settings.default_role_id` (`230`),
  `team_tasks.validator_id` (`233`, parcourue par la suppression de compte),
  `org_withdrawals.org_id` (`237`). Correctif : mig. **`247`**. Le compte de 3 a été une **dette
  datée** dans la référence du 2026-11-07 au 11-08 (la garde refusait la quatrième).
  ✅ **Soldée le 2026-11-08** : 247 appliquée (ledger `20261108001203`), trois index valides relus
  dans `pg_indexes`, `unindexed_foreign_keys` absent de `get_advisors` ; référence recalée par
  `regenerer` (run `42429102316`, commit `00ad13fd`) : l'advisor n'y figure plus, la garde refuse
  de nouveau toute FK sans index. `unused_index` 56 → 59 : les trois index neufs, pas encore lus.

Comptes recalés par le job `regenerer` du workflow Posture sur `main` (jamais à la main). Témoin :
« la référence COMMITÉE rougit encore sur un objet de plus » (`gardes-posture.guard.test.mjs`).
