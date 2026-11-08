# RGPD — inventaire, droits des personnes et dette

**Audit du 2026-08-14, inventaire complété le 2026-08-24, revérifié le 2026-08-25** (mig. 116 et
119 : effacement et portabilité). Premier audit dédié de ce domaine. Jusqu'ici, la conformité était
traitée par fragments dans les audits sécurité. Mesuré sur le schéma de prod et le code.

## Historique des notes et des audits : archivé

Les notes /100 de ce document ont cessé (ADR 0012, [`INDICATEURS.md`](./INDICATEURS.md)). Leur journal daté, les angles morts mesurés et les récits d'incident qui fondent les règles ci-dessous sont déplacés, sans coupe, dans [`archive/RGPD-journal-des-notes-2026-04-06-au-2026-11-06.md`](./archive/RGPD-journal-des-notes-2026-04-06-au-2026-11-06.md). Une règle de ce document qui cite une date ou un incident s'y retrouve.

## 1. Inventaire des données personnelles

| Table | Données personnelles | Origine |
|---|---|---|
| `auth.users` | email, horodatages de connexion | Supabase Auth |
| `profiles` | email, `display_name`, `avatar_url` | copie applicative |
| **`friends`** | **email, nom, avatar d'un TIERS** | copié dans la ligne d'un autre utilisateur |
| `friend_requests` | email du destinataire, email de l'expéditeur | saisie utilisateur |
| `subscriptions` | `stripe_customer_id`, `stripe_subscription_id` | Stripe |
| `tasks`, `habits`, `events`, `okrs`, `team_tasks` | contenu libre (`name`, `description`) | saisie utilisateur |
| `demo_devices` | identifiant d'appareil, horodatages | analytique |
| `user_activity_days` | jours d'activité par compte | analytique |
| **`org_invitations`** *(mig. 105, 2026-08-23)* | **UUID d'un tiers invité, et trace d'un refus (`declined_at`)** | saisie d'un membre de l'organisation |
| `org_removal_notices` *(mig. 106)* | UUID du membre retiré et de l'auteur du retrait | action d'un admin |
| `team_task_dependencies` *(mig. 108)* | `created_by` | action utilisateur |
| **`team_task_comments`** *(mig. 082)* | **contenu libre écrit par une personne** + `author_id` | saisie utilisateur |
| `team_task_activity` *(mig. 094)* | `actor_id`, nature de l'action, horodatage | trace applicative |
| `org_notifications` *(mig. 095, 110)* | `user_id`, `actor_id`, libellé de l'événement | trace applicative |

> ⚠️ **Les trois dernières lignes ont été ajoutées le 2026-09-14 au soir.** Elles figuraient déjà
> dans [`RGPD-REGISTRE.md`](./RGPD-REGISTRE.md) (la pièce art. 30), jamais ici. Leur `author_id` /
> `actor_id` est en `ON DELETE SET NULL`, donc **le contenu survit au départ de son auteur, désormais
> anonyme**. C'est le régime voulu pour du travail d'équipe, et il n'est défendable que s'il est
> écrit : une donnée dont on ne sait pas qu'on la garde n'a pas de durée de conservation.

> ✅ **Traité et APPLIQUÉ en prod le 2026-08-24 — migration `112`.** Elle ajoute une purge
> quotidienne (pg_cron, 03:30 UTC) des invitations **refusées** de plus de 30 jours, sur le
> modèle de `prune_processed_stripe_events` (mig. 089). Les lignes **acceptées** ne sont pas
> purgées : elles disent qui a fait entrer qui, ce qui est l'historique légitime de la
> composition de l'organisation, et elles tombent de toute façon avec le membre
> (`ON DELETE CASCADE`). Les invitations **en attente** non plus : c'est l'action en cours.
> Cette migration **supprime des lignes** — contrairement aux `109`/`110` qui ne faisaient que
> redéfinir des objets, elle a attendu une décision explicite avant d'être appliquée. Vérifié en
> base après coup : job `cosmo-prune-declined-invitations` planifié et actif (`30 3 * * *`).
>
> Le constat qui l'a motivée — la policy `org_invitations_select` autorise
> **tout membre** de l'organisation à lire l'`invitee_id` de **toutes** les invitations, y compris
> celles qui ont été **refusées**. Ce ne sont que des UUID (ni email, ni nom : la policy de
> `profiles` reste la frontière), mais c'est une trace persistante et partagée d'un refus, sans
> date de péremption. Aligner sur la règle maison : *toute donnée personnelle conservée doit avoir
> une date de péremption* (A-11). Piste minimale : purger les lignes `declined_at IS NOT NULL` de
> plus de 30 jours, comme `processed_stripe_events`. Cf. finding B-2 de
> `faille.md` (hors dépôt).
>
> 🟠 **2026-08-27 · la moitié manquante est écrite, pas appliquée (mig. `130`).** La purge traitait
> la **durée**, pas le **public** : pendant les 30 jours de rétention, et pour toute invitation en
> attente, l'organisation entière lit la ligne. La mig. `130` restreint la lecture au
> destinataire, à l'inviteur et aux admins (minimisation, **art. 5.1.c**). Elle est dans le dépôt
> et **n'a pas été appliquée en production** au 2026-08-27 : ce point reste donc **ouvert en
> prod**. Suivi complet : finding G-1 de `faille.md` (hors dépôt).
>
> ⚠️ Leçon à garder au-delà de cette table : *borner la durée de vie d'une donnée personnelle et
> borner son public sont deux gestes distincts.* Le premier a été fait le 24 et a donné, trois
> jours durant, le sentiment que le sujet était traité.

**Hébergement** : Supabase, région **eu-west-1 (Irlande)** — dans l'UE, pas de transfert hors UE
au niveau base. Sous-traitants : Supabase (hébergement), Vercel (diffusion), Sentry (erreurs),
Stripe (paiement, non activé à ce jour).

**Minimisation côté Sentry** : `beforeSend` retire emails et UUID avant envoi. Bonne pratique déjà
en place.

## 2. ✅ Droit à l'effacement — corrigé le 2026-08-24

> **Corrigé.** `delete-account` purge désormais `friends` sur ses DEUX colonnes
> (`.or('user_id.eq.X,friend_user_id.eq.X')`), comme `friend_requests` et `shared_tasks`.
> Garde de non-régression : `src/rgpd-erasure.guard.test.ts` (les trois tables symétriques).
>
> ✅ **Divergence dépôt ↔ prod refermée le 2026-08-24 (mig. 116).** La contrainte
> passe de `ON DELETE SET NULL` à `ON DELETE CASCADE` en production, ce que le dépôt
> déclarait depuis toujours. C'est de la **défense en profondeur** : la purge explicite
> de `delete-account` reste le rempart principal, la FK couvre les suppressions qui ne
> passent pas par la Edge Function (dashboard Supabase, script de maintenance).
> Effet sur les données : aucun (11 lignes, 0 avec `friend_user_id IS NULL`).
>
> ⚠️ **Un détail de ce diagnostic était faux, et il aggravait le finding plutôt que l'inverse.**
> Ce document affirmait « la table `friends` n'a aucune clé étrangère (vérifié : zéro FK) ».
> Vérification sur `pg_constraint` en prod le 2026-08-24 : il y en a bien une,
> `friends_friend_user_id_fkey`, mais elle est **`ON DELETE SET NULL`**. Elle ne supprime donc
> rien — elle coupe le lien et laisse la ligne, avec l'email et le nom en clair, désormais
> **introuvable par identifiant**. Le dépôt, lui, déclare `ON DELETE CASCADE` (mig. `007_out_of_band_columns`) :
> comme cette migration est en `ADD COLUMN IF NOT EXISTS` sur une colonne déjà présente, la
> contrainte n'a jamais été appliquée. **Le dépôt et la prod divergent sur la sémantique
> d'effacement d'une table qui porte des données personnelles.**

### Ce que c'était

La fonction `delete-account` est sérieuse : elle purge 12 tables, transfère la propriété des
organisations à un successeur avant suppression, nettoie les affectations d'équipe sans clé
étrangère, alerte en cas d'échec (`opsAlert`), puis appelle `auth.admin.deleteUser`.

**Mais la table `friends` n'a aucune clé étrangère** (vérifié : zéro FK sur cette table), et le
nettoyage générique filtre sur `user_id` :

```ts
await supabaseAdmin.from(table).delete().eq('user_id', user.id)
```

Or `friends` stocke **l'email, le nom et l'avatar de l'ami** dans la ligne de l'autre utilisateur.
Quand A supprime son compte :

- les lignes où **A est propriétaire** (`user_id = A`) sont supprimées ✅ ;
- les lignes où **A est l'ami de B** (`friend_user_id = A`, contenant l'email et le nom de A)
  **subsistent** — ni cascade (pas de FK), ni filtre sur cette colonne ❌.

**Impact** : après exercice du droit à l'effacement (art. 17), l'email et le nom de la personne
restent dans les données de ses anciens contacts, sans limite de durée.

**Vérifié en prod** : **0 ligne orpheline** aujourd'hui — le défaut n'est **pas matérialisé**.
C'est cohérent : aucun compte ayant des amis n'a encore été supprimé (11 lignes dans `friends`,
27 comptes). Le risque est structurel, pas constaté.

**Correction** : traiter `friends` comme `friend_requests` et `shared_tasks`, qui utilisent déjà
`.or('user_id.eq.X,friend_user_id.eq.X')`. Les deux tables symétriques ont été correctement
gérées ; `friends` est restée dans la boucle générique. ~15 min.

## 3. 🟡 Rétention : deux tables analytiques sans expiration

> **Corrigé le 2026-08-24 (mig. 114) — et l'un des deux constats était faux.**

| Table | Lignes | Politique de rétention |
|---|---|---|
| `processed_stripe_events` | — | ✅ purge à 90 jours (`prune_processed_stripe_events`, finding A-6) |
| `demo_devices` | 24 | ✅ **90 j depuis la mig. 084** — ce document avait tort. Vérifié sur `pg_get_functiondef` en prod : la purge est en ligne dans `record_demo_visit`. En revanche elle EXCLUAIT `converted_at IS NOT NULL` : l'appareil d'un visiteur qui **s'inscrit** était conservé sans limite, avec son `converted_user_id` — le cas le plus sensible avait la rétention la plus longue, exactement à l'envers. Borné à 400 j par la mig. 114 |
| `user_activity_days` | 69 | ✅ **400 j (mig. 114)** — c'était le seul écart réel. Purge portée par `touch_last_seen`, bornée à l'appelant (Index Scan sur le pkey), donc à coût constant. 400 j = le plus petit seuil qui préserve une comparaison d'une année sur l'autre dans `get_admin_stats` |

Le principe de limitation de conservation (art. 5.1.e) demande une durée définie. Les volumes sont
dérisoires, mais la règle a déjà été appliquée une fois (A-6, A-11) : elle doit valoir pour toutes
les tables analytiques, sans quoi elle n'est pas une règle.

`demo_devices` est le cas le plus sensible des deux : c'est un identifiant d'appareil posé **avant
tout consentement à un compte**. Une rétention de 12 mois maximum serait cohérente.

## 4. ✅ Ce qui est en place

- **Droit d'accès et portabilité** : export CSV disponible (`src/lib/csv-export.ts`, onglet
  Données des Paramètres), **dix fichiers** depuis le 2026-10-22. Trois y sont entrés ce jour-là,
  chacun déclaré jusque-là hors export dans `check:portability`, et y sont désormais **mesurés**
  comme tables exportées :
  - les **dépendances entre tâches personnelles** (`task_dependencies`, mig. `132`), saisies par
    la personne et absentes depuis leur livraison le 2026-08-30 (« dette reconnue ») ;
  - le **journal des résultats clés** (`kr_completions`), seule trace de QUAND chaque résultat clé
    a été atteint. Il était exclu comme « dérivé, discutable ». Lu en entier (`getAllForExport`,
    paginé), jamais borné aux 500 lignes du tableau de bord ;
  - les **rôles reçus dans une organisation** (`org_member_roles`, mig. `219`) : rôle, droits
    accordés, début et fin. `granted_by` ne sort pas (il désigne un tiers).
    🔴 **La RLS ne suffit pas ici** : la policy SELECT est `is_org_member(org_id)` (relue en
    production le 2026-10-22), elle rend les attributions de **tous** les membres. Le filtre sur
    la personne vit dans `getMyAssignments` (`.eq('user_id', moi)`), verrouillé par
    `src/lib/csv-export.kr-roles.test.ts`. ❌ Ne jamais exporter `getAssignments(orgId)`.
- **Droit à l'effacement** : suppression de compte en libre-service, exécutée côté serveur —
  sous réserve du §2.
- **Consentement cookies** : bannière avec choix, l'option la plus protectrice par défaut.
- **Information** : pages politique de confidentialité, mentions légales et CGU, en `noindex`
  mais crawlables (choix correct : Google doit pouvoir lire le `noindex`).
- **Sécurité du traitement** (art. 32) : RLS sur toutes les tables, chiffrement en transit,
  minimisation Sentry, mots de passe délégués à Supabase Auth.
- **Localisation UE** : eu-west-1.

## 5. Ce qui manque pour une vente B2B

Le [rapport mode entreprise](./archive/RAPPORT-MODE-ENTREPRISE-2026-08-12.md) identifie la
confidentialité comme argument de vente. Trois éléments manquent, tous non techniques :

1. **Registre des traitements** (art. 30) — obligatoire dès qu'on traite des données pour le
   compte d'organisations clientes.
2. **DPA / accord de sous-traitance** à proposer aux organisations clientes : COSMO devient
   sous-traitant de l'employeur pour les données de ses salariés.
3. **Durées de conservation publiées** dans la politique de confidentialité — impossible tant que
   le §3 n'est pas tranché.

C'est le chaînon manquant : le §3 (technique, 30 minutes) débloque le point 3 (commercial).

## 6. Ordre de traitement

1. ✅ **`friends` dans l'effacement** (§2) — fait le 2026-08-24, avec garde.
2. ✅ **Rétention `user_activity_days` + `demo_devices` converties** (§3) — mig. 114,
   **appliquée en prod le 2026-08-24**. Débloque la publication des durées.
3. 🟠 **Publier les durées** dans la politique de confidentialité : 90 j (visite démo non
   convertie), 400 j (activité, visite démo convertie), 90 j (marqueurs Stripe). **C'est
   désormais le SEUL point restant** avant de pouvoir répondre à un acheteur B2B sur ce
   chapitre, et le seul du dossier qui n'attende plus rien d'autre que d'être écrit.
4. ✅ **Aligner la FK `friends_friend_user_id_fkey`** entre le dépôt (`CASCADE`) et la prod
   (`SET NULL`), **fait le 2026-08-25, mig. 116, appliquée et vérifiée en prod**. Effet sur les
   données : aucun (11 lignes, 0 avec `friend_user_id IS NULL`). Le code ne dépendait plus de la
   FK depuis le correctif de `delete-account` ; c'est le replay des migrations qui redevient
   fidèle.
5. Registre des traitements et DPA (§5) — quand une organisation cliente le demandera.

> ✅ **Point de vigilance traité le 2026-08-25, la portabilité a failli être cassée par un
> correctif de performance.** La mig. 119 borne `habits.completions` aux 400 derniers jours à la
> lecture. L'export CSV (`src/lib/csv-export.ts`) comptait les complétions **en itérant sur ce
> champ** : borné, il aurait exporté un total faux, en silence, sur le document même qui matérialise
> le droit d'accès et de portabilité (art. 15 et 20). Il utilise désormais `completionsTotal`,
> agrégat calculé serveur sur l'historique **entier**.
>
> **Règle qui en sort** : une optimisation de lecture doit énumérer ses consommateurs *avant*
> d'être appliquée, et **tout export de données personnelles compte comme un consommateur
> critique**. Un chiffre faux dans un export n'est pas un bug d'affichage : c'est une réponse
> inexacte à l'exercice d'un droit.
