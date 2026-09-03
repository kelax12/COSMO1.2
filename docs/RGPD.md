# RGPD — inventaire, droits des personnes et dette

**Audit du 2026-08-14, inventaire complété le 2026-08-24, revérifié le 2026-08-25** (mig. 116 et
119 : effacement et portabilité). Premier audit dédié de ce domaine. Jusqu'ici, la conformité était
traitée par fragments dans les audits sécurité. Mesuré sur le schéma de prod et le code.

## Note RGPD : 78 → 84 → **86 / 100** (2026-08-24 → 2026-08-25 → 2026-08-29) · inchangée aux 2026-08-27, 2026-09-02 et 2026-09-03

> ### 🔴 2026-09-03 · une correction de base, puis une journée qui s'annule elle-même
>
> **La correction d'abord.** Le tableau de bord du 2026-09-02 ([`README.md`](./README.md)) fait
> partir cette note de **84** et annonce **86** en arrivée, alors que la passe du 08-29 l'avait
> déjà portée à 86. Le +2 de la journée était justifié ligne par ligne ; c'est la colonne de
> départ qui était périmée, recopiée depuis le tableau du 25. *Un « avant » se relit à sa source,
> il ne se recopie pas.*
>
> **Ce que la journée du 09-02 a réellement apporté**, et qui vaut bien ses deux points :
>
> - le fichier d'avatar part enfin **avec** la référence, au retrait de la photo comme à la
>   suppression du compte. Le bucket est **public** : une photo restait accessible à une URL
>   devinable après la suppression du compte ;
> - l'export de portabilité (art. 20) gagne dix colonnes réellement saisies ;
> - la politique de confidentialité cesse d'annoncer une **anonymisation du journal
>   d'encaissement** que le scellement rend impossible. `row_hash` scelle `user_id` dans le
>   chaînage : écrire `NULL` produirait exactement le signal de falsification qu'on montre à un
>   contrôleur. Ce qui rend la conservation acceptable est ailleurs, et c'est maintenant écrit :
>   `user_id` cesse d'identifier quiconque dès que la ligne `auth.users` disparaît.
>
> **Ce qui les compense exactement, et pourquoi la note ne monte pas :**
>
> - le script de mesure d'audience chargé sur les pages publiques s'est mis à extraire l'**adresse
>   email et le nom** saisis à l'inscription et à les transmettre au fournisseur, sur `/signup`,
>   **en production**. Le registre art. 30 déclarait « adresse de la page, page référente, adresse
>   IP, navigateur, sans cookie » : ni email, ni nom, ni identifiant persistant, alors que le
>   script dépose aussi un UUID en `localStorage`. Un consentement recueilli pour une **mesure
>   d'audience** ne couvre pas la transmission de l'identité ;
> - la garde `vendor-watch.yml` l'a détecté et a échoué **chaque jour du 2026-08-29 au
>   2026-09-01** sans que personne n'ouvre son issue ;
> - le bandeau de consentement annonçait « uniquement des cookies strictement nécessaires » alors
>   qu'accepter chargeait deux mesures et déposait un identifiant : il décrivait le cas du **refus**
>   en le présentant comme la description de l'**acceptation**. Un consentement ainsi recueilli
>   n'est pas éclairé (art. 4.11 RGPD, art. 82 loi I&L).
>
> Tout cela est corrigé : le script n'est plus monté sur les pages portant un formulaire
> d'identifiants, le registre et la politique disent ce que le script fait vraiment, et le bandeau
> est réécrit en phrases complètes. **Mais un écart de cette nature, resté quatre jours en
> production et signalé sans être lu, retire ce que la journée avait gagné.** Et il reste ouvert
> par un bout qui n'appartient qu'à Axel : **le DPA du fournisseur (art. 28) n'est pas obtenu**,
> cf. finding `V-1` de [`../faille.md`](../faille.md).

> ### 2026-08-29 · +2, les durées de conservation sont publiées
>
> Les trois durées mesurées sont désormais **dans la politique de confidentialité**, à la portée du
> lecteur et plus seulement dans le dépôt : 90 jours pour une visite de démonstration non
> convertie, 400 jours pour les jours d'activité et une démonstration convertie, 90 jours pour les
> marqueurs techniques de paiement. ~~La mention que le journal d'encaissement est **anonymisé et
> non supprimé** y figure aussi, ce qui est la seule formulation exacte~~ 🔴 **Faux, corrigé le
> 2026-09-02** : le journal n'est **pas** anonymisable, `row_hash` scelle `user_id` dans le
> chaînage et le trigger refuse l'UPDATE. La formulation exacte est celle du bloc du 09-03
> ci-dessus. Ce qui reste vrai : l'obligation de conservation fiscale prime sur l'effacement
> (RGPD art. 17.3.b).
>
> C'était le dernier point du dossier qui n'attendait rien d'autre que d'être écrit, et il débloque
> la réponse à un acheteur B2B.
>
> ⚠️ **Ce qui reste, et qui ne s'obtient qu'en tant qu'entreprise** : les DPA des sous-traitants
> (Supabase, Vercel, Sentry, Stripe, Resend) ne sont ni collectés ni archivés ~~et G-1
> (minimisation d'`org_invitations`, mig. 130) est écrit mais **non appliqué en production**~~ →
> ✅ **la mig. 130 a été appliquée en production le 2026-08-29 au soir**, quelques heures après
> cette passe, et G-1 est refermé. La liste des DPA à collecter s'est en revanche **allongée** le
> 2026-09-02 : le fournisseur de mesure d'audience y manquait (finding `V-1`).

> **2026-08-27 · note inchangée, et le tableau ci-dessous non plus.** Un seul mouvement dans le
> périmètre RGPD ce jour-là : la mig. `130` (minimisation de `org_invitations`, art. 5.1.c) est
> **écrite dans le dépôt et non appliquée en production**. Une migration non appliquée ne referme
> rien, donc rien ne bouge. Le point bloquant reste le même qu'au 25, et il n'est toujours pas
> technique : **les durées de conservation ne sont pas publiées** dans la politique de
> confidentialité. Détail : §1 et finding G-1 de [`../faille.md`](../faille.md).

| Ce qui compose la note | 08-24 | 08-25 |
|---|---|---|
| Droit à l'effacement (art. 17) | ✅ code corrigé + garde | ✅ **+ FK alignée en base** (mig. 116) |
| Divergence dépôt ↔ prod sur la sémantique d'effacement | ❌ ouverte (`SET NULL` vs `CASCADE`) | ✅ **refermée** |
| Rétention des tables analytiques (art. 5.1.e) | ✅ mig. 114 | ✅ |
| Droit à la portabilité (art. 20) | ✅ export CSV | ✅ **préservé** malgré la troncature du payload (mig. 119) |
| Durées de conservation **publiées** | ❌ | ❌ **inchangé, c'est le point bloquant** |
| Registre des traitements (art. 30) + DPA | ❌ | ❌ |

**+6.** Deux gestes, tous deux techniques et tous deux du même genre : **faire que la base dise ce
que le code promet**. La FK de `friends` déclarait `CASCADE` dans le dépôt et valait `SET NULL` en
production, la ligne survivait à l'effacement, avec l'email et le nom en clair, désormais
introuvable par identifiant. Et la borne posée sur `habits.completions` aurait tronqué l'export
CSV, c'est-à-dire le support même du droit à la portabilité, si trois dérivations n'avaient pas été
reprises en même temps (§4).

**Ce qui plafonne la note n'a rien de technique et n'a pas bougé** : les durées de conservation ne
sont **toujours pas publiées** dans la politique de confidentialité, alors que les trois valeurs
sont désormais connues et appliquées en base (90 j / 400 j / 90 j). C'est trente minutes de
rédaction, et c'est le seul point qui sépare le dossier d'une réponse tenable à un acheteur B2B.

> Ce document décrit l'état technique. Il ne remplace pas un avis juridique, et la
> [politique de confidentialité](../src/pages/PolitiqueConfidentialitePage.tsx) reste le document
> opposable.

---

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
> [`../faille.md`](../faille.md).
>
> 🟠 **2026-08-27 · la moitié manquante est écrite, pas appliquée (mig. `130`).** La purge traitait
> la **durée**, pas le **public** : pendant les 30 jours de rétention, et pour toute invitation en
> attente, l'organisation entière lit la ligne. La mig. `130` restreint la lecture au
> destinataire, à l'inviteur et aux admins (minimisation, **art. 5.1.c**). Elle est dans le dépôt
> et **n'a pas été appliquée en production** au 2026-08-27 : ce point reste donc **ouvert en
> prod**. Suivi complet : finding G-1 de [`../faille.md`](../faille.md).
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
  Données des Paramètres).
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
