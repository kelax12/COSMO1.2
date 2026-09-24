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
| AM-3 | **La liste des sous-traitants est tenue à la main.** Un service SaaS ajouté au produit (analytics, mail, hébergement d'images) est un sous-traitant au sens de l'art. 28, et rien ne le signale | liste statique dans ce document | 🟠 **TOUJOURS OUVERT** au 2026-09-21 · **aucun item ne le porte.** La liste des sous-traitants reste tenue à la main : un SaaS ajouté au produit est un sous-traitant art. 28, et rien ne le signale. Le geste de collecte est `M-04` — *(jugé outillable le 09-16 : partiellement : croiser avec les origines autorisées par la CSP)* |

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
  uniquement si l'utilisateur choisit la connexion Google, **Cloudflare Turnstile** (anti-robot
  des formulaires de connexion et d'inscription, adresse IP et signaux du navigateur) lorsque
  `VITE_TURNSTILE_SITE_KEY` est posée. *Ajouté le 2026-09-24 : le composant existait sans que
  le registre le déclare.*
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
- **Données** : adresse de la page, page référente, adresse IP, navigateur, indicateurs
  d'engagement (profondeur de défilement, temps passé, clics sur liens et boutons), et un
  **identifiant aléatoire déposé dans le `localStorage`** du navigateur (`_a_cid`), qui permet
  de rattacher les pages d'une même visite.
  > ⚠️ **Ne pas réécrire « sans cookie » ici.** La mention y a figuré jusqu'au 2026-09-01 et
  > elle était trompeuse : `localStorage` n'est effectivement pas un cookie, mais l'art. 82
  > couvre toute information déposée sur le terminal, et un identifiant persistant est
  > exactement ce que la personne a le droit de connaître. Une formulation littéralement vraie
  > qui laisse croire à l'absence de traceur est une formulation fausse.
- **Sous-traitants** : Vesk, Vercel Analytics.
- **Recueil du consentement** : bandeau. **Rien n'est chargé tant que la personne n'a pas
  accepté**, et un refus ne charge jamais rien. Le choix est conservé **six mois** sur l'appareil
  (`cosmo_cookie_consent_at`), puis redemandé. **Retrait** : « Gérer les cookies » (pied de page,
  Paramètres, politique) rouvre le bandeau ; refuser après avoir accepté efface `_a_cid`,
  `_a_sid`, `_a_sact` et recharge la page (RGPD art. 7.3, livré le 2026-09-24).
- **Périmètre** : pages de contenu public uniquement. Le script n'est jamais monté sur une
  session ouverte, pour qu'un compromis du fournisseur ne puisse pas lire un jeton de session,
  **ni sur une page portant un formulaire d'identifiants** (création de compte, connexion,
  réinitialisation, invitation).
  > 🔴 **Cette dernière exclusion est une garde de conformité, pas un détail d'implémentation.**
  > Le script de Vesk contient un `tryIdentify()` qui lit les champs d'un formulaire
  > d'inscription et en extrait l'**adresse email** et le **nom** pour les envoyer au
  > fournisseur (détecté le 2026-09-01 par `vendor-watch.yml`). Ces données ne relèvent pas de
  > la mesure d'audience et **ne sont pas couvertes par le consentement recueilli ici**. La
  > seule chose qui les empêche d'être transmises est que le script n'est pas chargé sur ces
  > pages : `CREDENTIAL_FORM_SEGMENTS` dans `src/lib/audience.ts`, verrouillé par
  > `src/lib/audience.test.ts`. Retirer cette exclusion rendrait ce traitement non conforme.
- **Point ouvert** : aucun DPA (art. 28) n'a été signé avec Vesk. À obtenir — cf. T-43 de la
  roadmap, dont la liste ne le mentionnait pas.

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
| Resend | États-Unis | Clauses contractuelles types via le DPA du prestataire, **non archivé**. Ajouté le 2026-09-24 |
| Cloudflare (Turnstile) | États-Unis | Idem, **non archivé**, seulement si la clé Turnstile est posée. Ajouté le 2026-09-24 |

> ❌ **Ligne A5 de [`LEGAL.md`](./LEGAL.md) : les DPA ne sont pas encore collectés et archivés.**
> Ils se signent en tant qu'entreprise, donc après immatriculation. C'est la pièce manquante de
> ce registre.

---

## Mesures de sécurité

Détaillées dans l'annexe article 32 de [`LEGAL.md`](./LEGAL.md), avec leurs limites assumées.
En résumé : chiffrement en transit avec HSTS preload, RLS sur **les 47 tables**, CSP stricte,
moindre privilège sur les fonctions, minimisation dans le monitoring, et gates d'intégration
continue bloquantes sur les invariants RLS et les migrations.
