# Registre des activités de traitement

**Article 30 du RGPD.** Établi le 2026-08-26. Document interne, à présenter sur demande de la
CNIL ou d'un client dans le cadre d'une due diligence.

> 🔴 **À mettre à jour** à chaque nouveau traitement, nouveau sous-traitant, ou changement de
> durée de conservation. Un registre périmé est pire qu'absent : il atteste qu'on savait.

---

## Responsable du traitement

| | |
|---|---|
| Identité | Axel Longatte |
| Statut | **Personne physique.** Aucune structure juridique n'est immatriculée au 2026-08-26. |
| Contact | axellongattepro@gmail.com |
| Délégué à la protection des données | Non désigné. Non obligatoire : pas de suivi systématique à grande échelle, pas de données sensibles au sens de l'art. 9. |

> ⚠️ **À compléter après immatriculation** : dénomination, SIREN, adresse de domiciliation,
> et report de ces mentions dans les mentions légales (ligne A3 de [`LEGAL.md`](./LEGAL.md)).

---

## Vue d'ensemble

Dix traitements, sur 47 tables applicatives, **toutes protégées par Row Level Security**.

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

---

## T1 · Comptes et authentification

- **Finalité** : créer et sécuriser l'accès au service.
- **Base légale** : exécution du contrat (art. 6.1.b).
- **Données** : adresse email, mot de passe **haché** (bcrypt, géré par Supabase Auth), nom
  d'affichage, avatar, identifiant Google si connexion OAuth, dates de création et de dernière
  connexion.
- **Tables** : `profiles`, schéma `auth` de Supabase, `email_lookup_global`,
  `email_lookup_quota`, `demo_devices`.
- **Destinataires** : Supabase (hébergeur et fournisseur d'authentification), Google
  uniquement si l'utilisateur choisit la connexion Google.
- **Conservation** : durée de vie du compte, puis suppression définitive sous 90 jours après
  clôture. La suppression est exécutée par la fonction `delete-account`.
- **Sécurité** : mot de passe jamais stocké en clair, RLS, jetons de session à expiration.

## T2 · Service de productivité personnelle

- **Finalité** : fournir la fonctionnalité achetée ou utilisée gratuitement (tâches, agenda,
  habitudes, objectifs).
- **Base légale** : exécution du contrat.
- **Données** : contenu librement saisi par la personne. **Ce contenu peut contenir tout ce que
  l'utilisateur y met**, y compris des informations personnelles ou sensibles qu'il choisit
  d'inscrire dans une tâche. COSMO ne l'analyse pas et ne le lit pas.
- **Tables** : `tasks`, `events`, `habits`, `okrs`, `key_results`, `kr_completions`,
  `categories`, `lists`, `user_activity_days`.
- **Destinataires** : Supabase. Aucun autre.
- **Conservation** : durée de vie du compte. Effacement immédiat à la demande.
- **Portabilité** : export CSV depuis Paramètres, onglet Mes données (7 fichiers).

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
- **Conservation** : jusqu'au départ de l'organisation ou à sa suppression.

## T5 · Abonnements et facturation

- **Finalité** : gérer les abonnements payants.
- **Base légale** : exécution du contrat, et obligation légale pour la conservation.
- **Données** : identifiants client et abonnement Stripe, palier, statut, périodicité, échéance.
  **Aucune coordonnée bancaire n'est stockée par COSMO** : elles ne transitent que par Stripe.
- **Tables** : `subscriptions`, `org_subscriptions`, `billing_flags`,
  `processed_stripe_events`.
- **Destinataires** : Stripe, qui agit aussi comme responsable de traitement autonome pour ses
  propres finalités antifraude.
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
- **Données** : contenu du message et contexte technique fournis par la personne.
- **Destinataires** : Supabase (fonction `report-bug`).
- **Conservation** : le temps du traitement, puis suppression.

## T8 · Mesure d'audience

- **Finalité** : comprendre la fréquentation des pages publiques.
- **Base légale** : **consentement** (art. 6.1.a et art. 82 loi Informatique et Libertés).
- **Données** : adresse de la page, page référente, adresse IP, navigateur. **Sans cookie.**
- **Sous-traitants** : Vesk, Vercel Analytics.
- **Recueil du consentement** : bandeau. **Rien n'est chargé tant que la personne n'a pas
  accepté**, et un refus ne charge jamais rien. Le choix est conservé sur l'appareil.
- **Périmètre** : pages publiques uniquement. Le script n'est jamais monté sur une session
  ouverte, pour qu'un compromis du fournisseur ne puisse pas lire un jeton de session.

## T9 · Supervision technique

- **Finalité** : détecter et corriger les erreurs en production.
- **Base légale** : intérêt légitime (sécurité et continuité du service).
- **Données** : trace d'erreur, page concernée, version du navigateur. **Les adresses email et
  les identifiants sont retirés automatiquement** des messages, des exceptions et des
  breadcrumbs avant tout envoi (`beforeSend`), et `sendDefaultPii` est désactivé.
- **Sous-traitant** : Sentry (États-Unis).
- **Conservation** : selon la rétention Sentry, 90 jours par défaut.

## T10 · Administration de la plateforme

- **Finalité** : suivre l'activité globale du service.
- **Base légale** : intérêt légitime.
- **Données** : agrégats. La console `/admin` passe par la RPC `get_admin_stats`, qui **rejette
  les non-administrateurs côté serveur** : la protection n'est pas l'URL, qui n'est pas
  référencée, mais le contrôle en base.
- **Tables** : `admin_users`, `user_activity_days`.

---

## Transferts hors Union européenne

| Sous-traitant | Localisation | Encadrement |
|---|---|---|
| **Supabase** | `eu-west-1` (Irlande) | **Aucun transfert.** Les données restent dans l'Union. |
| Vercel | États-Unis | Clauses contractuelles types ou mécanisme d'adéquation, via le DPA du prestataire |
| Sentry | États-Unis | Idem, avec minimisation préalable par `beforeSend` |
| Stripe | Irlande et États-Unis | Idem |
| Google | Irlande et États-Unis | Uniquement si l'utilisateur choisit la connexion Google |

> ❌ **Ligne A5 de [`LEGAL.md`](./LEGAL.md) : les DPA ne sont pas encore collectés et archivés.**
> Ils se signent en tant qu'entreprise, donc après immatriculation. C'est la pièce manquante de
> ce registre.

---

## Mesures de sécurité

Détaillées dans l'annexe article 32 de [`LEGAL.md`](./LEGAL.md), avec leurs limites assumées.
En résumé : chiffrement en transit avec HSTS preload, RLS sur **les 47 tables**, CSP stricte,
moindre privilège sur les fonctions, minimisation dans le monitoring, et gates d'intégration
continue bloquantes sur les invariants RLS et les migrations.
