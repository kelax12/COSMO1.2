# Registre des activités de traitement (art. 30 RGPD)

Lire avant d'ajouter une table de données personnelles, un sous-traitant, un traceur ou de changer une durée de conservation. Fait foi : ce registre (pièce produite à la CNIL ou à un client en due diligence), confronté à la base et au code par `check:retention`, `check:erasure`, `check:subprocessors`. Récits et angles morts datés : [`archive/ANGLES-MORTS-2026-09-16-docs-vivantes.md`](./archive/ANGLES-MORTS-2026-09-16-docs-vivantes.md).

- 🔴 Mettre à jour à chaque nouveau traitement, nouveau sous-traitant ou changement de durée de conservation : un registre périmé est pire qu'absent, il atteste qu'on savait.
- ✅ `npm run check:retention` confronte la base aux durées déclarées ; ne prouve pas que le registre soit juste, ni rien sur Sentry ou Stripe.
- ✅ `npm run check:erasure` détecte une table de données personnelles ajoutée par migration sans entrée au registre (dérivé des migrations, pas de la base).
- ✅ `npm run check:subprocessors` compare dans les deux sens les tiers appelés par le code (CSP, hôtes en littéral dans `api/`, `supabase/functions/`, `src/`, SDK, workflows de sauvegarde) au tableau « Transferts hors Union européenne » de ce registre et au § 6 de [`LEGAL.md`](./LEGAL.md). Témoin : `scripts/check-subprocessors.guard.test.mjs`.
- ⚠️ `check:subprocessors` ne prouve ni qu'un DPA est signé (ligne A5 de `LEGAL.md`), ni les tiers à hôte non littéral (URL de webhook d'organisation, `OPS_ALERT_WEBHOOK_URL`), ni le serveur d'envoi et l'OAuth portés par le serveur Supabase ; Anthropic et IONOS (T11) sont hors dépôt, déclarés tels quels dans la garde.
- ❌ Le titre de la section « Transferts hors Union européenne » et sa table (premier champ = nom du tiers) sont lus par `check:subprocessors` : ne pas les renommer.
- ❌ Ne jamais retirer le mot « Destinataires » des fiches : `landing-promises` s'en sert de preuve (« aucune donnée revendue »).

## Responsable du traitement

| | |
|---|---|
| Identité | Axel Longatte, 138 avenue Victor Hugo, 75016 Paris (domiciliation Les Tricolores) |
| Statut | Personne physique. Aucune structure juridique n'est immatriculée à ce jour. |
| Contact | axellongattepro@gmail.com |
| Délégué à la protection des données | Non désigné. Non obligatoire : pas de suivi systématique à grande échelle, pas de données sensibles au sens de l'art. 9. |

- ⚠️ À compléter après immatriculation : dénomination, SIREN, adresse de domiciliation, et report dans les mentions légales (ligne A3 de [`LEGAL.md`](./LEGAL.md)).

## Vue d'ensemble

T1 à T10 vivent sur les tables applicatives de COSMO (nombre : [`FAITS.md`](./FAITS.md)), toutes protégées par Row Level Security ; T11 vit dans un projet Supabase séparé.

| # | Traitement | Base légale | Personnes concernées |
|---|---|---|---|
| T1 | Comptes et authentification | Contrat | Utilisateurs inscrits |
| T2 | Service de productivité personnelle | Contrat | Utilisateurs inscrits |
| T3 | Collaboration entre particuliers | Contrat | Utilisateurs et leurs invités |
| T4 | Mode entreprise | Contrat | Membres d'une organisation |
| T5 | Abonnements et facturation | Contrat + obligation légale | Clients payants |
| T6 | Journal fiscal d'encaissement | Obligation légale | Clients payants |
| T7 | Support et signalement de bug | Intérêt légitime | Utilisateurs qui écrivent |
| T8 | Mesure d'audience | Consentement | Visiteurs du site public |
| T9 | Supervision technique | Intérêt légitime | Utilisateurs rencontrant une erreur |
| T10 | Administration de la plateforme | Intérêt légitime | Tous, sous forme agrégée |
| T11 | Prospection commerciale B2B par email | Intérêt légitime | Professionnels prospectés |

## T1 · Comptes et authentification

- **Finalité** : créer et sécuriser l'accès au service.
- **Base légale** : exécution du contrat (art. 6.1.b).
- **Données** : adresse email, mot de passe haché (bcrypt, géré par Supabase Auth), nom d'affichage, avatar, identifiant Google si connexion OAuth, dates de création et de dernière connexion.
- **Tables** : `profiles`, schéma `auth` de Supabase, `email_lookup_global`, `email_lookup_quota`, `demo_devices`, `account_inactivity_notices` (mig. `226` : date d'un avertissement d'inactivité, aucune adresse stockée).
- **Destinataires** : Supabase (hébergeur et authentification) ; Google, uniquement si l'utilisateur choisit la connexion Google ; Cloudflare Turnstile (anti-robot des formulaires de connexion et d'inscription : adresse IP et signaux du navigateur) lorsque `VITE_TURNSTILE_SITE_KEY` est posée.
- **Conservation** : durée de vie du compte, puis suppression définitive sous 90 jours après clôture, exécutée par `delete-account`.
- **Compte inactif** (art. 5.1.e, `C-121`) : sans activité pendant 3 ans (dernière connexion ou ouverture de l'application, `profiles.last_seen_at`), un e-mail prévient 30 jours avant ; sans retour, suppression par le même chemin `delete-account`. Jamais un compte qui paie. Job quotidien `inactive-accounts.yml` puis Edge Function `inactive-accounts`, sélection en base (mig. `226`, preuve `supabase/proofs/226.proof.sql`).
- **Sécurité** : mot de passe jamais stocké en clair, RLS, jetons de session à expiration.

## T2 · Service de productivité personnelle

- **Finalité** : fournir la fonctionnalité utilisée (tâches, agenda, habitudes, objectifs).
- **Base légale** : exécution du contrat.
- **Données** : contenu librement saisi, qui peut contenir tout ce que l'utilisateur y met, y compris des informations personnelles ou sensibles. COSMO ne l'analyse pas et ne le lit pas.
- **Tables** : `tasks`, `task_dependencies`, `events`, `habits`, `okrs`, `key_results`, `kr_completions`, `categories`, `lists`, `user_activity_days`.
- **Destinataires** : Supabase. Aucun autre.
- **Conservation** : durée de vie du compte. Effacement immédiat à la demande.
- **Portabilité** : export CSV depuis Paramètres, onglet Mes données, dont les dépendances entre tâches, le journal des résultats clés `kr_completions` et les rôles reçus en entreprise `org_member_roles` (détail : [`RGPD.md`](./RGPD.md)).

## T3 · Collaboration entre particuliers

- **Finalité** : permettre le partage de tâches et de listes entre comptes.
- **Base légale** : exécution du contrat.
- **Données** : relations entre comptes, invitations, éléments partagés, jetons de lien.
- **Tables** : `friends`, `friend_requests`, `shared_tasks`, `shared_lists`, `share_links`.
- **Point d'attention** : partager expose le contenu partagé au destinataire ; c'est l'objet de la fonctionnalité et la personne l'initie.
- **Conservation** : jusqu'à retrait du partage ou suppression du compte.

## T4 · Mode entreprise

- **Finalité** : organiser le travail collectif au sein d'une organisation.
- **Base légale** : exécution du contrat. L'organisation est co-responsable du traitement des données de ses propres membres.
- **Données** : appartenance à une organisation et à une équipe, position dans la pyramide managériale, permissions, tâches et projets d'équipe, commentaires, journal d'activité.
- **Tables** : `organizations`, `organization_members`, `org_teams`, `org_team_members`, `org_member_permissions`, `org_invitations`, `org_invite_links`, `organization_join_requests`, `org_notifications`, `org_okr_categories`, `team_projects`, `team_tasks`, `team_okrs`, `team_key_results`, `team_okr_teams`, `team_task_comments`, `team_task_activity`, `team_task_dependencies`, `team_task_subtasks`, `team_task_labels`, `team_categories`, `team_labels`.
- **Cloisonnement** : deux branches sœurs de l'organigramme ne se voient pas, règle appliquée en base par la RLS, pas seulement masquée dans l'interface.
- **Séparation stricte** : un manager ne voit jamais les tâches, habitudes ou agenda personnels d'un membre (deux univers de tables distincts).
- **Export de l'annuaire** : un admin télécharge en CSV le résultat filtré de l'annuaire. Six colonnes fermées : nom, e-mail, rôle, manager direct, équipes, date d'arrivée. Aucun identifiant interne, aucune activité. C'est un export de données de tiers fait pour administrer l'organisation (base : exécution du contrat, l'organisation co-responsable désigne ses admins), pas l'export de portabilité de l'art. 20. Le fichier quitte COSMO : sa conservation relève ensuite de l'organisation.
- **Dernière activité** (mig. `170`) : date de la dernière trace de travail d'équipe (journal de tâche, commentaire, tâche assignée terminée), visible des admins et des managers pour leur sous-arbre seulement. ❌ Jamais la date de connexion (`auth.users.last_sign_in_at`, T1) : un annuaire d'entreprise n'est pas un outil de surveillance des connexions. Aucune donnée nouvelle stockée, la date est calculée à la lecture.
- **Configuration d'organisation** (mig. `195` à `199`) : réglages, domaines vérifiés, statuts de projet, automatisations. La capacité hebdomadaire, les liens hiérarchiques secondaires (mig. `200`) et les champs personnalisés (mig. `211`) n'existent plus.
- **Webhooks** (mig. `199`) : un admin peut faire sortir, vers une adresse HTTPS qu'il choisit (Slack ou son propre service), le nom, le statut, la priorité et l'échéance des tâches et le nom du projet. Jamais d'e-mail, de description, de commentaire ni d'identifiant de personne. Destinataire choisi par l'organisation, co-responsable : elle répond de ce tiers. File d'envoi purgée à 7 jours (pg_cron).
- **Export complet** : un admin télécharge projets, tâches, objectifs, équipes et membres (nom, e-mail, rôle, responsable) en CSV. Même régime que l'export de l'annuaire.
- **Conservation** : jusqu'au départ de l'organisation ou à sa suppression. Tâches supprimées : 30 jours en corbeille, puis effacement (`purge_team_task_trash`, pg_cron quotidien, mig. `152`).

## T5 · Abonnements et facturation

- **Finalité** : gérer les abonnements payants.
- **Base légale** : exécution du contrat, et obligation légale pour la conservation.
- **Données** : identifiants client et abonnement Stripe, palier, statut, périodicité, échéance. Aucune coordonnée bancaire n'est stockée par COSMO : elles ne transitent que par Stripe.
- **Tables** : `subscriptions`, `org_subscriptions`, `billing_flags`, `processed_stripe_events`.
- **Destinataires** : Stripe, qui agit aussi comme responsable de traitement autonome pour ses finalités antifraude ; Resend, pour l'avis avant reconduction (`renewal-notice`, adresse email du propriétaire de l'organisation).
- **Conservation** : durée de l'abonnement, puis obligations comptables.

## T6 · Journal fiscal d'encaissement

- **Finalité** : satisfaire l'obligation d'inaltérabilité, sécurisation, conservation et archivage des règlements (CGI art. 286-I-3° bis).
- **Base légale** : obligation légale (art. 6.1.c).
- **Données** : identifiant d'événement Stripe, montant, devise, date, identifiant de facture, rattachement à une organisation ou à un utilisateur.
- **Tables** : `payment_records`, `payment_closures`.
- **Conservation** : dix ans ; le droit à l'effacement ne s'y applique pas (RGPD art. 17.3.b). Une demande de suppression de compte anonymise `user_id`, elle ne supprime jamais la ligne.
- **Sécurité** : append-only garanti par trigger, chaînage de hash SHA-256, vérifiable par `verify_payment_chain()`.

## T7 · Support et signalement de bug

- **Finalité** : traiter les demandes et corriger les anomalies.
- **Base légale** : intérêt légitime (améliorer et maintenir le service).
- **Données** : contenu du message, captures jointes, contexte technique de la page, et adresse email du compte si la personne est connectée (posée en `reply_to`).
- **Destinataires** : Supabase (fonction `report-bug`), puis Resend (sous-traitant américain), qui achemine le message par email vers `contact@thecosmo.app`.
- **Conservation** : le temps du traitement, puis suppression. ⚠️ Le message vit dans une boîte email : cette durée n'est appliquée par aucun automatisme, elle dépend d'un tri manuel.

## T8 · Mesure d'audience

- **Finalité** : comprendre la fréquentation des pages publiques.
- **Base légale** : consentement (art. 6.1.a et art. 82 loi Informatique et Libertés).
- **Données** : pages vues et page référente, collectées par Vercel Analytics sans cookie.
- **Mesure maison** (mig. `222`), même consentement, pages publiques seulement, jamais sur un formulaire d'identifiants ni avec une session ouverte : chemin de la page (sans query string), hôte du référent, paramètres `utm_*`, pays/région/ville déduits de l'adresse IP par Vercel, famille de navigateur et de système, type d'appareil, langue, durée et profondeur de scroll, clics sur les boutons marqués `data-cta`. L'adresse IP n'est pas conservée : elle sert à calculer un identifiant du jour (sel aléatoire supprimé le lendemain) qui ne relie ni deux jours ni une personne. Aucun cookie ni stockage sur l'appareil. Table `traffic_hits`, conservée 13 mois (job `cosmo-purge-traffic`). Lecture : administrateurs seulement (`get_admin_traffic`, `is_admin()`).
- **Sous-traitant** : Vercel (Analytics, et hébergement du collecteur `api/collect.ts`). Les statistiques d'usage de l'application sont calculées en interne depuis la base COSMO : aucun outil de mesure tiers.
- **Même base, même bandeau** : la source d'acquisition (`cosmo_first_touch`, 30 jours, puis `profiles.acquisition_source`) et l'identifiant d'appareil de la démo (`cosmo_demo_device_id`, `demo_devices.converted_user_id`). Rien n'est écrit ni envoyé sans « Accepter », et tout s'efface au refus. Sans `?ref=` ni `utm_source`, la source est déduite de l'hôte du site référent (`google`, `linkedin`…, sinon l'hôte lui-même) ou vaut `direct` : jamais le chemin ni la query string du référent (`src/lib/attribution.ts`).
- **Recueil du consentement** : bandeau. Rien n'est chargé tant que la personne n'a pas accepté, et un refus ne charge jamais rien. Le choix est conservé six mois sur l'appareil (`cosmo_cookie_consent_at`), puis redemandé. Retrait : « Gérer les cookies » (pied de page, Paramètres, politique) rouvre le bandeau ; refuser après avoir accepté recharge la page sans la mesure (RGPD art. 7.3).

## T9 · Supervision technique

- **Finalité** : détecter et corriger les erreurs en production.
- **Base légale** : intérêt légitime (sécurité et continuité du service).
- **Données** : trace d'erreur, page concernée (jetons d'invitation et codes OAuth retirés de l'adresse, `src/lib/sentry-scrub.ts`), version du navigateur, et l'identifiant technique du compte (`monitoring.setUser({ id })`). 🔴 Les identifiants présents dans les TEXTES sont retirés ; celui du compte est joint volontairement pour relier les erreurs. `sendDefaultPii` est désactivé.
- **Mesure de performance** (OBS-02) : navigations, requêtes vers Supabase, interactions lentes, échantillonnées (10 % par défaut). Base légale : consentement, le même bandeau que l'audience ; sans « Accepter », aucune intégration de traçage n'est chargée, et le retrait recharge la page. Noms de route paramétrés, adresses privées de leur chaîne de requête, e-mails et UUID masqués, ni utilisateur ni en-tête (`src/lib/sentry-tracing.ts`). Décision et motifs : `OBSERVABILITE.md`.
- **Edge Functions** : les fonctions de facturation et d'effacement envoient à Sentry un span par requête (nom de la fonction, méthode, code de réponse, durée) et les exceptions non gérées, vers le DSN `SENTRY_DSN_EDGE`. Aucune donnée de visiteur : pas d'URL, d'en-tête, de corps, d'IP ni d'identifiant de compte, d'organisation ou de client Stripe (`supabase/functions/_shared/trace-core.ts`). Base légale : intérêt légitime, comme les erreurs.
- **Sous-traitant** : Sentry (société américaine ; ingestion dans la région UE, Allemagne).
- **Conservation** : selon la rétention Sentry, 90 jours par défaut.

## T10 · Administration de la plateforme

- **Finalité** : suivre l'activité globale du service.
- **Base légale** : intérêt légitime.
- **Données** : agrégats. La console `/admin` passe par la RPC `get_admin_stats`, qui rejette les non-administrateurs côté serveur : la protection est le contrôle en base, pas l'URL.
- **Tables** : `admin_users`, `user_activity_days`.
- **Sauvegardes** : dump quotidien de la base, chiffré avant dépôt (AES-256), conservé 30 jours en artefact GitHub (`db-backup.yml`). Sous-traitant : GitHub (États-Unis), qui ne détient pas la clé. 🔴 Des dumps sont déjà partis en clair dans un dépôt public : violation consignée au registre des violations (hors dépôt) ; ❌ aucun dump ne doit jamais être écrit en clair.

## T11 · Prospection commerciale B2B par email

- **Finalité** : suivre une campagne de cold email, de l'envoi à la conversion (Kanban de la page Prospection de COSMO Analytics).
- **Base légale** : intérêt légitime (art. 6.1.f). La prospection B2B par email ne demande pas de consentement préalable si le message se rapporte à la fonction professionnelle de la personne et si chaque mail offre un moyen simple et gratuit de s'y opposer (CNIL, art. L34-5 CPCE). Les deux conditions sont à tenir dans chaque modèle de mail.
- **Personnes concernées** : professionnels contactés, jamais des clients COSMO à ce titre.
- **Données** : email professionnel, nom, entreprise, poste, source du contact, étape du parcours, notes libres, date du dernier contact, journal des changements d'étape. 🔴 Les notes sont libres : n'y écrire aucune donnée sensible (art. 9) ni d'appréciation qu'on ne montrerait pas à la personne, qui peut en demander copie (art. 15).
- **Opposition** : `suppression_list`. Une adresse qui refuse ou se désinscrit y entre, et la base refuse ensuite de la réinscrire (trigger, pas une règle d'interface). La glisser en corbeille l'y inscrit aussi.
- **Où** : projet Supabase séparé `cosmo-prospection` (`eu-west-1`, Irlande), tables `prospects`, `prospect_events`, `suppression_list`, `send_log` (journal d'envoi) et `inbound_messages` (réponses : objet et 2 000 premiers caractères). RLS : un seul administrateur, session `aal2` exigée. Migrations dans le dépôt privé `analytics` (`supabase/migrations/`). Aucune donnée de prospect dans un fichier versionné.
- **Envoi automatique** : des tâches programmées envoient les emails validés depuis les boîtes IONOS d'Axel et lisent les réponses. Seul un message rattaché à un prospect est lu jusqu'au corps et stocké ; le reste de la boîte n'est ni lu ni gardé. Envoi désactivé par défaut, validation manuelle de chaque fiche, coupure d'urgence dans COSMO Analytics.
- **Destinataires** : Supabase ; IONOS (hébergement des boîtes d'envoi, Allemagne) ; Anthropic (classement de chaque réponse par Claude Haiku : objet et texte de la réponse, seulement si la clé API est posée). 🔴 DPA Anthropic et IONOS à archiver (ligne A5 de `LEGAL.md`).
- **Conservation** : 3 ans après le dernier contact (recommandation CNIL), puis effacement. Le « dernier contact » est la date la plus récente entre la création de la fiche, le dernier envoi et la dernière réponse reçue. Appliquée par `private.purge_prospects_expires()` du projet `cosmo-prospection`, lancée chaque jour à 03:17 UTC par la tâche `pg_cron` `prospection-purge-3-ans` (migration `20261022000001_purge_conservation_3_ans.sql` du dépôt `analytics`). Chaque passage laisse une trace sans donnée personnelle (date, nombre de fiches) dans `private.purge_runs`. L'effacement d'une fiche emporte son journal, ses envois et ses réponses (cascade). La liste d'opposition n'est jamais purgée : elle ne garde que l'adresse, le motif et la date, et garantit qu'on ne recontacte pas la personne (réimport refusé). Preuve en transaction annulée : une fiche à 3 ans et 1 jour est visée et effacée avec son journal ; un envoi, une réponse ou une fiche d'hier ne le sont pas ; l'opposition d'une fiche purgée reste et bloque le réimport.
- ⚠️ La durée n'est appliquée que si la migration est appliquée en production (geste d'Axel) : tant que `select * from cron.job where jobname = 'prospection-purge-3-ans'` ne renvoie rien, elle ne l'est pas.
- **Sauvegardes** : export quotidien (04:41 UTC) par `.github/workflows/prospection-backup.yml` du dépôt `analytics` (privé). Le dump est chiffré dans le même flux (`pg_dump | gpg`, AES-256) : aucun octet en clair n'est écrit sur le disque du runner ni déposé en artefact. Seul `prospection-AAAA-MM-JJ.dump.gpg` est conservé, en artefact GitHub du dépôt `analytics`, 30 jours : une fiche effacée peut survivre au plus 30 jours dans une sauvegarde chiffrée. Phrase de chiffrement propre à ce projet (secret `PROSPECTION_BACKUP_PASSPHRASE`), copie hors dépôt chez Axel ; sans elle le job échoue, jamais de repli en clair.
- ⚠️ Aucune sauvegarde n'existe tant que les secrets `PROSPECTION_DB_URL` et `PROSPECTION_BACKUP_PASSPHRASE` ne sont pas posés et qu'un premier passage n'a pas été déchiffré pour vérification.

## Transferts hors Union européenne

| Sous-traitant | Localisation | Encadrement |
|---|---|---|
| **Supabase** | `eu-west-1` (Irlande) | Aucun transfert. Les données restent dans l'Union. |
| Vercel | États-Unis | Clauses contractuelles types ou mécanisme d'adéquation, via le DPA du prestataire |
| Sentry | États-Unis | Idem, avec minimisation préalable par `beforeSend` |
| Stripe | Irlande et États-Unis | Idem |
| Google | Irlande et États-Unis | Uniquement si l'utilisateur choisit la connexion Google |
| Resend | États-Unis | Clauses contractuelles types via le DPA du prestataire, non archivé |
| Cloudflare (Turnstile) | États-Unis | Idem, non archivé, seulement si la clé Turnstile est posée |
| GitHub | États-Unis | Sauvegardes chiffrées, clé hors de GitHub |
| Supabase Inc. | société non européenne | Données en Irlande ; accès possible des équipes pour maintenance et support, encadré par le DPA (clauses types acceptées avec les conditions) |
| Anthropic | États-Unis | T11 seulement : texte des réponses de prospects, pour les classer. Clauses contractuelles types via le DPA du prestataire, non archivé |
| IONOS | Allemagne | T11 : boîtes d'envoi de la prospection. Aucun transfert |

- ❌ Ligne A5 de [`LEGAL.md`](./LEGAL.md) : les DPA ne sont pas collectés et archivés.
- ⚠️ « Les DPA se signent en tant qu'entreprise » est faux pour Sentry : le propriétaire du compte l'accepte en ligne, dès maintenant. C'est la pièce manquante de ce registre.

## Mesures de sécurité

Détaillées, avec leurs limites assumées, dans l'annexe article 32 de [`LEGAL.md`](./LEGAL.md). En résumé : chiffrement en transit avec HSTS preload, RLS sur toutes les tables (nombre : [`FAITS.md`](./FAITS.md)), sauvegardes chiffrées avant dépôt, CSP stricte, moindre privilège sur les fonctions, minimisation dans le monitoring, gates d'intégration continue bloquantes sur les invariants RLS et les migrations.
