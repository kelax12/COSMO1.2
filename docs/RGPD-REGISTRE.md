<!-- note-audit: couvert-par=RGPD.md -->
<!--
  🔴 C-109 · CE MARQUEUR EST LU PAR `npm run check:docs-scored`.
  Douze documents de fond n'étaient notés par RIEN : ils ne pouvaient ni monter
  ni baisser, donc **rien ne signalait qu'ils avaient vieilli**.
  Chaque document de `docs/` déclare donc soit sa note, soit la note qui le
  couvre, soit qu'il n'est pas noté ET pourquoi.
  ❌ Ne JAMAIS inventer une note sans avoir audité le domaine : `non-note` est
     une réponse honnête, un chiffre faux ne l'est pas.
-->
> **Note d'audit** — Couvert par la note de [`RGPD.md`](./RGPD.md) : c'est la pièce que cet audit examine.

# Registre des activités de traitement

**Article 30 du RGPD.** Établi le 2026-08-26. Document interne, à présenter sur demande de la
CNIL ou d'un client dans le cadre d'une due diligence.

> 🔴 **À mettre à jour** à chaque nouveau traitement, nouveau sous-traitant, ou changement de
> durée de conservation. Un registre périmé est pire qu'absent : il atteste qu'on savait.

---


## 🕳️ Angles morts · ce que ce document NE mesure PAS (2026-09-16)

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
| AM-1 | 🔴 **Les durées de conservation déclarées ne sont confrontées à AUCUNE donnée réelle.** Dix traitements annoncent une durée ; rien ne vérifie qu'aucune ligne ne la dépasse. C'est pourtant la pièce produite en contrôle CNIL, donc celle où un écart se paie | aucun script ne lit les dates de création par table | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:retention` (`C-93`) — 🔴 ne prouve PAS : que ce registre soit juste : la garde confronte la base à ce qu'il déclare, pas l'inverse |
| AM-2 | **Un traitement NOUVEAU n'entre pas au registre tout seul.** Une table de données personnelles ajoutée par migration, ou un sous-traitant ajouté par une dépendance, ne déclenche rien | ni `validate:migrations` ni la CI ne testent ce lien | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:erasure` (`C-92`) — 🔴 ne prouve PAS : dérivé des migrations, pas de la base |
| AM-3 | **La liste des sous-traitants est tenue à la main.** Un service SaaS ajouté au produit (analytics, mail, hébergement d'images) est un sous-traitant au sens de l'art. 28, et rien ne le signale | liste statique dans ce document | ✅ **OUTILLÉ le 2026-10-24** · `npm run check:subprocessors` (étape `ci.yml`, témoin `scripts/check-subprocessors.guard.test.mjs`, vu rouge) : les tiers sont dérivés de la CSP, des hôtes en littéral (`api/`, `supabase/functions/`, `src/`), des SDK et des workflows de sauvegarde, puis comparés au tableau des transferts de ce registre et au § 6 de `LEGAL.md`, dans les deux sens. Première exécution : **écart réel**, Resend, Cloudflare Turnstile, Google et GitHub étaient au registre mais absents de `LEGAL.md` § 6 (corrigé). 🔴 ne prouve PAS : qu'un DPA soit signé (ligne A5), ni les tiers à hôte non littéral (URL de webhook d'organisation, `OPS_ALERT_WEBHOOK_URL`), ni le SMTP et l'OAuth portés par le serveur Supabase ; Anthropic et IONOS (T11) vivent hors dépôt et sont déclarés tels quels dans la garde |

---

## Responsable du traitement

| | |
|---|---|
| Identité | Axel Longatte, 138 avenue Victor Hugo, 75016 Paris (domiciliation Les Tricolores) |
| Statut | **Personne physique.** Aucune structure juridique n'est immatriculée au 2026-08-26. |
| Contact | axellongattepro@gmail.com |
| Délégué à la protection des données | Non désigné. Non obligatoire : pas de suivi systématique à grande échelle, pas de données sensibles au sens de l'art. 9. |

> ⚠️ **À compléter après immatriculation** : dénomination, SIREN, adresse de domiciliation,
> et report de ces mentions dans les mentions légales (ligne A3 de [`LEGAL.md`](./LEGAL.md)).

---

## Vue d'ensemble

Onze traitements. Les dix premiers vivent sur 47 tables applicatives de COSMO, **toutes protégées
par Row Level Security** ; le onzième (T11, 2026-10-18) vit dans un projet Supabase séparé.

| # | Traitement | Base légale | Personnes concernées |
|---|---|---|---|
| T1 | Comptes et authentification | Contrat | Utilisateurs inscrits |
| T2 | Service de productivité personnelle | Contrat | Utilisateurs inscrits |
| T3 | Collaboration entre particuliers | Contrat | Utilisateurs et leurs invités |
| T4 | Mode entreprise | Contrat | Membres d'une organisation |
| T5 | Abonnements et facturation | Contrat + obligation légale | Clients payants |
| T6 | Journal fiscal d'encaissement | **Obligation légale** | Clients payants |
| T7 | Support et signalement de bug | Intérêt légitime | Utilisateurs qui écrivent |
| T8 | Mesure d'audience | **Consentement** | Visiteurs du site public |
| T9 | Supervision technique | Intérêt légitime | Utilisateurs rencontrant une erreur |
| T10 | Administration de la plateforme | Intérêt légitime | Tous, sous forme agrégée |
| T11 | Prospection commerciale B2B par email | Intérêt légitime | Professionnels prospectés |

---

## T1 · Comptes et authentification

- **Finalité** : créer et sécuriser l'accès au service.
- **Base légale** : exécution du contrat (art. 6.1.b).
- **Données** : adresse email, mot de passe **haché** (bcrypt, géré par Supabase Auth), nom
  d'affichage, avatar, identifiant Google si connexion OAuth, dates de création et de dernière
  connexion.
- **Tables** : `profiles`, schéma `auth` de Supabase, `email_lookup_global`,
  `email_lookup_quota`, `demo_devices`, `account_inactivity_notices` (mig. `226` : date d'un
  avertissement d'inactivité, aucune adresse stockée).
- **Destinataires** : Supabase (hébergeur et fournisseur d'authentification), Google
  uniquement si l'utilisateur choisit la connexion Google, **Cloudflare Turnstile** (anti-robot
  des formulaires de connexion et d'inscription, adresse IP et signaux du navigateur) lorsque
  `VITE_TURNSTILE_SITE_KEY` est posée. *Ajouté le 2026-09-24 : le composant existait sans que
  le registre le déclare.*
- **Conservation** : durée de vie du compte, puis suppression définitive sous 90 jours après
  clôture. La suppression est exécutée par la fonction `delete-account`.
  **Compte inactif** (art. 5.1.e, `C-121`, appliqué le 2026-10-22) : sans activité pendant
  **3 ans** (dernière connexion ou dernière ouverture de l'application, `profiles.last_seen_at`),
  un e-mail prévient **30 jours avant** ; sans retour, le compte est supprimé par le même chemin
  `delete-account`. Jamais un compte qui paie. Job quotidien `inactive-accounts.yml` →
  Edge Function `inactive-accounts`, sélection en base (mig. `226`, preuve
  `supabase/proofs/226.proof.sql`).
- **Sécurité** : mot de passe jamais stocké en clair, RLS, jetons de session à expiration.

## T2 · Service de productivité personnelle

- **Finalité** : fournir la fonctionnalité achetée ou utilisée gratuitement (tâches, agenda,
  habitudes, objectifs).
- **Base légale** : exécution du contrat.
- **Données** : contenu librement saisi par la personne. **Ce contenu peut contenir tout ce que
  l'utilisateur y met**, y compris des informations personnelles ou sensibles qu'il choisit
  d'inscrire dans une tâche. COSMO ne l'analyse pas et ne le lit pas.
- **Tables** : `tasks`, `task_dependencies`, `events`, `habits`, `okrs`, `key_results`,
  `kr_completions`, `categories`, `lists`, `user_activity_days`.
- **Destinataires** : Supabase. Aucun autre.
- **Conservation** : durée de vie du compte. Effacement immédiat à la demande.
- **Portabilité** : export CSV depuis Paramètres, onglet Mes données (10 fichiers depuis le 2026-10-22, dont les dépendances entre tâches, le journal des résultats clés `kr_completions` et les rôles reçus en entreprise `org_member_roles`).

## T3 · Collaboration entre particuliers

- **Finalité** : permettre le partage de tâches et de listes entre comptes.
- **Base légale** : exécution du contrat.
- **Données** : relations entre comptes, invitations, éléments partagés, jetons de lien.
- **Tables** : `friends`, `friend_requests`, `shared_tasks`, `shared_lists`, `share_links`.
- **Point d'attention** : partager expose le contenu partagé au destinataire. C'est l'objet
  même de la fonctionnalité, et la personne l'initie elle-même.
- **Conservation** : jusqu'à retrait du partage ou suppression du compte.

## T4 · Mode entreprise

- **Finalité** : organiser le travail collectif au sein d'une organisation.
- **Base légale** : exécution du contrat. **L'organisation est co-responsable** du traitement
  des données de ses propres membres.
- **Données** : appartenance à une organisation et à une équipe, position dans la pyramide
  managériale, permissions, tâches et projets d'équipe, commentaires, journal d'activité.
- **Tables** : `organizations`, `organization_members`, `org_teams`, `org_team_members`,
  `org_member_permissions`, `org_invitations`, `org_invite_links`,
  `organization_join_requests`, `org_notifications`, `org_okr_categories`, `team_projects`,
  `team_tasks`, `team_okrs`, `team_key_results`, `team_okr_teams`, `team_task_comments`,
  `team_task_activity`, `team_task_dependencies`, `team_task_subtasks`, `team_task_labels`,
  `team_categories`, `team_labels`.
- **Cloisonnement** : deux branches sœurs de l'organigramme ne se voient pas, et la règle est
  appliquée **en base** par la RLS, pas seulement masquée dans l'interface.
- **Séparation stricte** : un manager ne voit **jamais** les tâches, habitudes ou agenda
  personnels d'un membre. Ce sont deux univers de tables distincts.
- **Export de l'annuaire** (2026-09-24) : un **admin** de l'organisation peut télécharger en CSV
  le résultat filtré de l'annuaire. Six colonnes fermées : nom, e-mail, rôle, manager direct,
  équipes, date d'arrivée. Aucun identifiant interne, aucune activité. C'est un export de
  données **de tiers** fait pour administrer l'organisation (base : exécution du contrat,
  l'organisation co-responsable désigne ses admins), **pas** l'export de portabilité de l'art. 20.
  Le fichier quitte COSMO : sa conservation relève ensuite de l'organisation.
- **Dernière activité** (mig. 170) : date de la dernière trace de **travail d'équipe** (journal de
  tâche, commentaire, tâche assignée terminée), visible des admins et des managers pour leur
  sous-arbre seulement. ❌ Jamais la date de connexion (`auth.users.last_sign_in_at`, traitement
  T1) : un annuaire d'entreprise n'est pas un outil de surveillance des connexions. Aucune donnée
  nouvelle n'est stockée, la date est calculée à la lecture.
- **Configuration d'organisation** (mig. 195-199, 2026-09-26, **non appliquées**) : réglages,
  domaines vérifiés, capacité hebdomadaire (`org_member_capacity`), liens hiérarchiques
  secondaires (`org_member_secondary_managers`), champs personnalisés et leurs valeurs, statuts
  de projet, automatisations. Capacité et liens partent avec l'appartenance (clé étrangère en
  cascade sur `organization_members`) et avec le compte.
- **Webhooks** (mig. 199) : un **admin** peut faire sortir, vers une adresse HTTPS **qu'il
  choisit** (Slack ou son propre service), le nom, le statut, la priorité et l'échéance des
  tâches et le nom du projet. Jamais d'e-mail, de description, de commentaire ni d'identifiant
  de personne. **Destinataire choisi par l'organisation**, co-responsable : c'est elle qui
  répond de ce tiers. File d'envoi purgée à 7 jours (pg_cron).
- **Export complet** (2026-09-26) : un admin télécharge projets, tâches, objectifs, équipes et
  membres (nom, e-mail, rôle, responsable) en CSV. Même régime que l'export de l'annuaire.
- **Conservation** : jusqu'au départ de l'organisation ou à sa suppression.
  **Tâches supprimées : 30 jours en corbeille, puis effacement** (`purge_team_task_trash`,
  pg_cron quotidien, mig. 152). *Ajouté le 2026-09-24.*

## T5 · Abonnements et facturation

- **Finalité** : gérer les abonnements payants.
- **Base légale** : exécution du contrat, et obligation légale pour la conservation.
- **Données** : identifiants client et abonnement Stripe, palier, statut, périodicité, échéance.
  **Aucune coordonnée bancaire n'est stockée par COSMO** : elles ne transitent que par Stripe.
- **Tables** : `subscriptions`, `org_subscriptions`, `billing_flags`,
  `processed_stripe_events`.
- **Destinataires** : Stripe, qui agit aussi comme responsable de traitement autonome pour ses
  propres finalités antifraude. **Resend** pour l'avis avant reconduction (`renewal-notice`,
  adresse email du propriétaire de l'organisation). *Ajouté le 2026-09-24.*
- **Conservation** : durée de l'abonnement, puis obligations comptables.

## T6 · Journal fiscal d'encaissement

- **Finalité** : satisfaire l'obligation d'inaltérabilité, sécurisation, conservation et
  archivage des règlements (CGI art. 286-I-3° bis).
- **Base légale** : **obligation légale** (art. 6.1.c).
- **Données** : identifiant d'événement Stripe, montant, devise, date, identifiant de facture,
  rattachement à une organisation ou à un utilisateur.
- **Tables** : `payment_records`, `payment_closures`.
- **Conservation** : **dix ans**, et le droit à l'effacement ne s'y applique pas (RGPD
  art. 17.3.b). Une demande de suppression de compte **anonymise** `user_id`, elle ne supprime
  jamais la ligne.
- **Sécurité** : append-only garanti par trigger, chaînage de hash SHA-256, vérifiable par
  `verify_payment_chain()`.

## T7 · Support et signalement de bug

- **Finalité** : traiter les demandes et corriger les anomalies.
- **Base légale** : intérêt légitime (améliorer et maintenir le service).
- **Données** : contenu du message, captures jointes, contexte technique de la page, et
  l'adresse email du compte si la personne est connectée (posée en `reply_to`).
- **Destinataires** : Supabase (fonction `report-bug`), puis **Resend**, qui achemine le message
  par email vers `contact@thecosmo.app`. 🔴 *Corrigé le 2026-09-24* : cette ligne ne nommait que
  Supabase, alors que le signalement quitte la base par un sous-traitant américain.
- **Conservation** : le temps du traitement, puis suppression. ⚠️ Le message vit dans une boîte
  email : cette durée n'est appliquée par aucun automatisme, elle dépend d'un tri manuel.

## T8 · Mesure d'audience

- **Finalité** : comprendre la fréquentation des pages publiques.
- **Base légale** : **consentement** (art. 6.1.a et art. 82 loi Informatique et Libertés).
- **Données** : pages vues et page référente, collectées par Vercel Analytics sans cookie.
- **Mesure maison (mig. 222, 2026-10-18)**, même consentement, pages publiques seulement, jamais
  sur un formulaire d'identifiants ni avec une session ouverte : chemin de la page (sans query
  string), hôte du référent, paramètres `utm_*`, pays/région/ville déduits de l'adresse IP par
  Vercel, famille de navigateur et de système, type d'appareil, langue, durée et profondeur de
  scroll, clics sur les boutons marqués `data-cta`. **L'adresse IP n'est pas conservée** : elle
  sert seulement à calculer un identifiant du jour (sel aléatoire supprimé le lendemain), qui ne
  relie ni deux jours ni une personne. Aucun cookie ni stockage sur l'appareil. Table
  `traffic_hits`, **conservée 13 mois** (job `cosmo-purge-traffic`). Lecture : administrateurs
  seulement (`get_admin_traffic`, `is_admin()`).
- **Sous-traitant** : Vercel (Analytics, et hébergement du collecteur `api/collect.ts`). Les
  statistiques d'usage de l'application sont calculées en interne, depuis la base COSMO (aucun
  outil de mesure tiers). *Fournisseur de mesure tiers débranché le 2026-10-18.*
- **Même base, même bandeau (2026-10-13)** : la **source d'acquisition** (`cosmo_first_touch`,
  30 jours, puis `profiles.acquisition_source`) et l'**identifiant d'appareil de la démo**
  (`cosmo_demo_device_id`, `demo_devices.converted_user_id`). Ils étaient posés SANS
  consentement et finissaient rattachés au compte : hors de toute exemption. Depuis, rien n'est
  écrit ni envoyé sans « Accepter », et tout s'efface au refus. Depuis le 2026-10-18, sans
  `?ref=` ni `utm_source`, la source est **déduite de l'hôte du site référent** (`google`,
  `linkedin`…, sinon l'hôte lui-même), ou vaut `direct` : jamais le chemin ni la query string
  du référent (`src/lib/attribution.ts`).
- **Recueil du consentement** : bandeau. **Rien n'est chargé tant que la personne n'a pas
  accepté**, et un refus ne charge jamais rien. Le choix est conservé **six mois** sur l'appareil
  (`cosmo_cookie_consent_at`), puis redemandé. **Retrait** : « Gérer les cookies » (pied de page,
  Paramètres, politique) rouvre le bandeau ; refuser après avoir accepté recharge la page sans
  la mesure (RGPD art. 7.3).

## T9 · Supervision technique

- **Finalité** : détecter et corriger les erreurs en production.
- **Base légale** : intérêt légitime (sécurité et continuité du service).
- **Données** : trace d'erreur, page concernée (jetons d'invitation et codes OAuth retirés de
  l'adresse, `src/lib/sentry-scrub.ts`, 2026-10-13), version du navigateur, et l'**identifiant
  technique du compte** (`monitoring.setUser({ id })`). 🔴 Ce registre disait « les identifiants
  sont retirés » : c'est vrai des identifiants présents dans les TEXTES, faux pour celui du
  compte, joint volontairement pour relier les erreurs. Corrigé le 2026-10-13. `sendDefaultPii`
  est désactivé.
- **Sous-traitant** : Sentry (société américaine ; ingestion dans la région UE, Allemagne).
- **Conservation** : selon la rétention Sentry, 90 jours par défaut.

## T10 · Administration de la plateforme

- **Finalité** : suivre l'activité globale du service.
- **Base légale** : intérêt légitime.
- **Données** : agrégats. La console `/admin` passe par la RPC `get_admin_stats`, qui **rejette
  les non-administrateurs côté serveur** : la protection n'est pas l'URL, qui n'est pas
  référencée, mais le contrôle en base.
- **Tables** : `admin_users`, `user_activity_days`.
- **Sauvegardes** (2026-10-13) : dump quotidien de la base, **chiffré avant dépôt** (AES-256),
  conservé 30 jours en artefact GitHub (`db-backup.yml`). Sous-traitant : GitHub (États-Unis),
  qui ne détient pas la clé. 🔴 Ces dumps sont partis EN CLAIR, dans un dépôt public, du
  2026-08-29 au 2026-10-13 : violation consignée au registre des violations (hors dépôt).

## T11 · Prospection commerciale B2B par email

*Ouvert le 2026-10-18.*

- **Finalité** : suivre une campagne de cold email, de l'envoi à la conversion (Kanban de la
  page Prospection de COSMO Analytics).
- **Base légale** : intérêt légitime (art. 6.1.f). La prospection B2B par email ne demande pas
  de consentement préalable si le message se rapporte à la **fonction professionnelle** de la
  personne et si chaque mail offre un moyen **simple et gratuit** de s'y opposer (CNIL, art.
  L34-5 CPCE). Les deux conditions sont à tenir dans chaque modèle de mail.
- **Personnes concernées** : professionnels contactés, jamais des clients COSMO à ce titre.
- **Données** : email professionnel, nom, entreprise, poste, source du contact, étape du
  parcours, notes libres, date du dernier contact, journal des changements d'étape.
  🔴 Les notes sont libres : n'y écrire **aucune donnée sensible** (art. 9) ni d'appréciation
  qu'on ne montrerait pas à la personne, qui peut en demander copie (art. 15).
- **Opposition** : `suppression_list`. Une adresse qui refuse ou se désinscrit y entre, et la
  base **refuse** ensuite de la réinscrire (trigger, pas une règle d'interface). La glisser en
  corbeille l'y inscrit aussi.
- **Où** : projet Supabase **séparé** `cosmo-prospection` (`eu-west-1`, Irlande), tables
  `prospects`, `prospect_events`, `suppression_list`, et depuis le 2026-10-18 `send_log`
  (journal d'envoi) et `inbound_messages` (réponses : objet et 2 000 premiers caractères).
  RLS : un seul administrateur, session `aal2` exigée. Migrations dans le dépôt `analytics`
  (`supabase/migrations/`), privé (vérifié sur GitHub le 2026-10-18). Aucune donnée de prospect
  dans un fichier versionné.
- **Envoi automatique (2026-10-18)** : des tâches programmées envoient les emails validés depuis
  les boîtes IONOS d'Axel et lisent les réponses. Seul un message **rattaché à un prospect** est
  lu jusqu'au corps et stocké ; le reste de la boîte n'est ni lu ni gardé. Envoi désactivé par
  défaut, validation manuelle de chaque fiche, coupure d'urgence dans COSMO Analytics.
- **Destinataires** : Supabase ; **IONOS** (hébergement des boîtes d'envoi, Allemagne) ;
  **Anthropic** (classement de chaque réponse par Claude Haiku : objet et texte de la réponse,
  seulement si la clé API est posée). 🔴 DPA Anthropic et IONOS à archiver (ligne A5 de `LEGAL.md`).
- **Conservation** : **3 ans après le dernier contact** (recommandation CNIL), puis effacement.
  Le « dernier contact » est la date la plus récente entre la création de la fiche, le dernier
  envoi et la dernière réponse reçue. **Appliquée par** la fonction
  `private.purge_prospects_expires()` du projet `cosmo-prospection`, lancée chaque jour à
  03:17 UTC par la tâche `pg_cron` `prospection-purge-3-ans` (migration
  `20261022000001_purge_conservation_3_ans.sql` du dépôt `analytics`). Chaque passage laisse
  une trace sans donnée personnelle (date, nombre de fiches) dans `private.purge_runs`.
  L'effacement d'une fiche emporte son journal, ses envois et ses réponses (cascade).
  **La liste d'opposition n'est jamais purgée** : elle ne garde que l'adresse, le motif et la
  date, et c'est elle qui garantit qu'on ne recontacte pas la personne (réimport refusé).
  Preuve en transaction annulée le 2026-10-22 : une fiche à 3 ans et 1 jour est visée et
  effacée avec son journal ; un envoi d'hier, une réponse d'hier et une fiche créée hier ne le
  sont pas ; l'opposition d'une fiche purgée reste et bloque le réimport.
  ⚠️ **Active seulement une fois la migration appliquée en production** (geste d'Axel). Tant
  que `select * from cron.job where jobname = 'prospection-purge-3-ans'` ne renvoie rien, la
  durée n'est pas appliquée.
- **Sauvegardes** : export quotidien (04:41 UTC) par le workflow
  `.github/workflows/prospection-backup.yml` du dépôt `analytics` (privé). Le dump est
  **chiffré dans le même flux** (`pg_dump | gpg`, AES-256) : aucun octet en clair n'est écrit
  sur le disque du runner ni déposé en artefact (leçon de `BK-1`, violation du 2026-10-13).
  Seul `prospection-AAAA-MM-JJ.dump.gpg` est conservé, en artefact GitHub du dépôt
  `analytics`, **30 jours**. Une fiche effacée (purge ou demande d'effacement) peut donc
  survivre au plus 30 jours dans une sauvegarde chiffrée. Phrase de chiffrement propre à ce
  projet (secret `PROSPECTION_BACKUP_PASSPHRASE`), copie hors dépôt chez Axel ; sans elle le
  job échoue, jamais de repli en clair.
  ⚠️ **Aucune sauvegarde n'existe encore** tant que les secrets `PROSPECTION_DB_URL` et
  `PROSPECTION_BACKUP_PASSPHRASE` ne sont pas posés et qu'un premier passage n'a pas été
  déchiffré pour vérification.

---

## Transferts hors Union européenne

| Sous-traitant | Localisation | Encadrement |
|---|---|---|
| **Supabase** | `eu-west-1` (Irlande) | **Aucun transfert.** Les données restent dans l'Union. |
| Vercel | États-Unis | Clauses contractuelles types ou mécanisme d'adéquation, via le DPA du prestataire |
| Sentry | États-Unis | Idem, avec minimisation préalable par `beforeSend` |
| Stripe | Irlande et États-Unis | Idem |
| Google | Irlande et États-Unis | Uniquement si l'utilisateur choisit la connexion Google |
| Resend | États-Unis | Clauses contractuelles types via le DPA du prestataire, **non archivé**. Ajouté le 2026-09-24 |
| Cloudflare (Turnstile) | États-Unis | Idem, **non archivé**, seulement si la clé Turnstile est posée. Ajouté le 2026-09-24 |
| GitHub | États-Unis | Sauvegardes **chiffrées**, clé hors de GitHub. Ajouté le 2026-10-13 |
| Supabase Inc. | société non européenne | Données en Irlande ; accès possible des équipes pour maintenance et support, encadré par le DPA (clauses types acceptées avec les conditions). Ajouté le 2026-10-13 |
| Anthropic | États-Unis | T11 seulement : texte des réponses de prospects, pour les classer. Clauses contractuelles types via le DPA du prestataire, **non archivé**. Ajouté le 2026-10-18 |
| IONOS | Allemagne | T11 : boîtes d'envoi de la prospection. Aucun transfert. Ajouté le 2026-10-18 |

> ❌ **Ligne A5 de [`LEGAL.md`](./LEGAL.md) : les DPA ne sont pas encore collectés et archivés.**
> ⚠️ « Ils se signent en tant qu'entreprise » est **faux pour Sentry** (relu le 2026-10-13) : le
> propriétaire du compte l'accepte en ligne, dès maintenant. C'est la pièce manquante de ce registre.

---

## Mesures de sécurité

Détaillées dans l'annexe article 32 de [`LEGAL.md`](./LEGAL.md), avec leurs limites assumées.
En résumé : chiffrement en transit avec HSTS preload, RLS sur **toutes les tables** (77 dans
`public` au 2026-10-15, relu en base ; ce document en annonçait 47), sauvegardes chiffrées avant
dépôt depuis le 2026-10-13, CSP stricte,
moindre privilège sur les fonctions, minimisation dans le monitoring, et gates d'intégration
continue bloquantes sur les invariants RLS et les migrations.
