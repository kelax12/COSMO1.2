> ⚠️ **INSTANTANÉ daté du 2026-08-24, non maintenu.**
> Cette version **remplace intégralement** le rapport du 2026-08-12, devenu faux sur son
> point central (« zéro mention du mode Entreprise ») comme sur sa grille tarifaire.
> Le nom de fichier porte encore l'ancienne date — le contenu, lui, est vérifié au 24 août.
> Sources vivantes : [`CLAUDE.md`](../../CLAUDE.md) · [`faille.md`](../../faille.md) · [`docs/`](../README.md).

# Le mode Entreprise, brique par brique — et comment le vendre

> Rapport produit & go-to-market — usage interne · COSMO 1.2
> Faits vérifiés dans le code source et contre la prod le **2026-08-24**.

**Sommaire** : [1. Résumé exécutif](#1-résumé-exécutif) · [2. Ce qui a changé depuis le 12 août](#2-ce-qui-a-changé-depuis-le-12-août) · [3. Comment le système s'articule](#3-comment-le-système-sarticule) · [4. Les 16 briques en détail](#4-les-16-briques-en-détail) · [5. Spécifié, pas livré](#5-spécifié-pas-livré) · [6. Diagnostic marketing](#6-diagnostic-marketing-au-24-août) · [7. Stratégie de vente](#7-stratégie-de-vente--vendre-maintenant-encaisser-après) · [8. Objections & FAQ](#8-objections--faq-de-vente) · [9. Points à trancher](#9-points-à-trancher) · [10. Glossaire](#10-glossaire)

---

## 1. Résumé exécutif

Le rapport du 12 août concluait : *« le produit n'a pas un problème de fonctionnalités, il a un
problème de visibilité. »* **Cette conclusion est périmée.** La vitrine a été construite entre le
15 et le 24 août : un parcours entreprise complet sur `/entreprise-presentation`, neuf sections,
une grille tarifaire, une FAQ, une démo sans inscription. Le produit, lui, a gagné cinq briques et
en a perdu trois.

Le goulot d'étranglement a donc changé de place. Il n'est plus dans le message — il est dans
**deux verrous, l'un commercial, l'autre d'audience**.

**Chiffres clés au 24 août**
- **16** briques fonctionnelles (13 le 12 août : +5 nouvelles, −3 retirées).
- **5** paliers tarifaires **actifs** (0-5 gratuit · 20 € · 50 € · 100 € · 200 €/mois).
- **1** parcours entreprise public, contre 0 le 12 août.
- **5** visiteurs démo en août, **0** conversion, **0** inscription depuis le 21 juillet.
- **3** organisations réelles, 11 membres au total.

**Trois idées structurent ce rapport :**

1. **🔴 Le produit bloque la croissance de ses clients sans pouvoir encaisser.**
   `ENTERPRISE_BILLING_ENFORCED = true` et le drapeau serveur `enterprise_seat_limit` sont actifs
   depuis le 24 août : une organisation qui atteint 5 membres ne peut plus en ajouter un sixième.
   Mais `STRIPE_SECRET_KEY` en prod est une **clé de test** — le checkout n'accepte que des cartes
   de test. Un vrai prospect qui grandit se heurte donc à un mur **qu'il lui est physiquement
   impossible de payer**. C'est le finding n°1 de ce rapport, et il se corrige en un `UPDATE`.
2. **La vitrine existe mais ment sur trois points.** La landing vend des « labels » et un
   « historique des modifications » retirés de la modale de tâche le 24 août, et la FAQ promet
   qu'au dépassement de palier « rien n'est bloqué » — alors que c'est exactement ce qui se passe
   désormais. Trois corrections de copy, une demi-heure.
3. **Le problème n'est plus le message, c'est l'audience.** Le message est écrit, les écrans sont
   réels, le pricing est affiché. Personne ne vient le lire : 5 visiteurs démo en août, position
   moyenne 88 sur Google. Le levier n'est plus le contenu produit — c'est l'acquisition.

---

## 2. Ce qui a changé depuis le 12 août

| Brique | 12 août | 24 août |
|---|---|---|
| Landing entreprise | ❌ inexistante | ✅ `/entreprise-presentation`, 9 sections + démo |
| Facturation | dormante, 3 paliers | **active**, 5 paliers, Stripe branché (sandbox de test) |
| Onglet Pyramide | tous les membres | **managers uniquement** |
| Onglet Tâches | ❌ | ✅ table dédiée (tri, recherche, filtres, assignation) |
| Dépendances / chemin critique | ❌ | ✅ mig. 108, rendu dans la vue Planning |
| Catégories d'entreprise | ❌ (projet = seule dimension) | ✅ mig. 111, transverses aux projets |
| Responsable d'équipe | ❌ (créateur seul, non transférable) | ✅ mig. 107, transférable et multiple |
| Inviter un ami dans l'org | ❌ | ✅ mig. 105, via la boîte de réception |
| Être retiré d'une org | silencieux | ✅ notifié (mig. 106) |
| Notification de commentaire | mentions seulement | ✅ + assignés, avec badge non-lu (mig. 110) |
| Checklist de démarrage | ❌ | ✅ 5 étapes pour l'admin d'une org jeune |
| **Labels de tâche** | ✅ vendus comme différenciant | ❌ **retirés de la modale** |
| **Historique des modifications** | ✅ dans la tâche | ❌ **retiré de la modale** (le fil d'activité reste sur l'Aperçu) |
| **Export CSV des statistiques** | ✅ argument comité de direction | ❌ **désactivé** (`CSV_EXPORT_ENABLED = false`) |

> ⚠️ Les trois dernières lignes sont des **retraits assumés**, pas des régressions. Le code est
> conservé (l'export CSV tient derrière une constante). Mais **trois arguments de vente du
> rapport précédent sont morts** — et deux d'entre eux sont encore écrits sur la landing.

---

## 3. Comment le système s'articule

Un compte COSMO est particulier *ou* entreprise. Le mode Entreprise ajoute une organisation
au-dessus des données personnelles existantes : mêmes tâches, même agenda, mêmes OKR dans leur
logique — mais rattachés à une hiérarchie et à des équipes.

**La colonne vertébrale : la pyramide.** À l'adhésion, chaque membre est rattaché à un manager
(`manager_id`). Le rôle « manager » n'existe dans aucune table — il est *déduit* : quiconque a au
moins un subordonné direct devient manager de fait. C'est ce mécanisme, et lui seul, qui alimente
l'agenda managérial (4.9), les statistiques cloisonnées (4.10) et la revue hebdomadaire (4.11) —
un seul graphe, trois usages.

**L'espace entreprise compte 8 onglets**, dont trois conditionnels :

| Onglet | Qui le voit | Contenu |
|---|---|---|
| Aperçu | tous | Ma journée, checklist de démarrage (admin), fil d'activité |
| Tâches | tous | Table de toutes les tâches d'équipe accessibles |
| Projets | tous | Kanban / liste / planning par équipe |
| OKR | tous | Objectifs d'équipe et d'organisation |
| Membres | tous | Annuaire, équipes, invitations |
| Pyramide | **managers uniquement** | Organigramme éditable au glisser-déposer |
| Statistiques | **managers uniquement** | Pilotage sur le périmètre managérial |
| Facturation | **propriétaire uniquement** | Pas un onglet : une pastille de forfait dans l'en-tête |

> La facturation n'est délibérément **pas** un onglet : la barre d'onglets est lue par toute
> l'organisation alors qu'un seul compte peut payer. L'entrée est `OrgPlanChip`, montée pour le
> seul propriétaire. `?tab=billing` reste une URL valide (les Edge Functions Stripe y renvoient),
> et un non-propriétaire qui l'ouvre retombe sur l'Aperçu.

Autour de cette colonne : des **équipes transverses** (4.3) qui recoupent la pyramide, des
**catégories** (4.7) qui recoupent les projets, et un **modèle de sièges** (4.15) qui fait suivre
le prix à la taille de l'organisation.

---

## 4. Les 16 briques en détail

Pour chaque brique : ce qu'elle fait, le problème qu'elle résout, comment l'exploiter en
marketing, et des tips d'usage.

### 4.1 Multi-organisation & pyramide managériale
*La structure de l'entreprise, dessinée automatiquement — jamais redessinée à la main.*

- **Fonctionnalités** : appartenance à plusieurs organisations avec switcher · arbre hiérarchique
  reconstruit automatiquement depuis le manager de chaque membre, pas de table de rôles à
  administrer · détection des membres « non placés » · glisser-déposer · **onglet réservé aux
  managers depuis le 24 août**.
- **Problèmes résolus** : élimine l'organigramme RH séparé, jamais synchronisé avec les tâches
  réelles — ici la hiérarchie EST le système de droits · une entreprise multi-structures (agence,
  franchise, groupe) n'est pas forcée dans un seul espace.
- **Marketing** : angle « zéro administration » (« Votre organigramme se dessine tout seul ») ·
  démo forte : ajouter un membre sous un manager propage tous les droits en une action · cible :
  dirigeants PME 10-50 pers. sans outil RH léger.
- **Tips** : la restriction aux managers change l'onboarding — un simple membre ne voit plus
  l'organigramme du tout. Ne plus le montrer comme « l'écran d'accueil de l'équipe ».

### 4.2 Invitations & entrée dans l'organisation
*Quatre façons d'entrer, un seul geste de consentement — et une sortie qui se dit.*

- **Fonctionnalités** : code permanent `COSMO-XXXXXX` · lien à usage unique (7 jours) qui place
  directement la personne sous un manager choisi · demandes d'adhésion validées par un admin ·
  **invitation d'un ami COSMO via la boîte de réception** (mig. 105) · invitations en attente
  visibles · écran de consentement RGPD explicite · **notification quand on est retiré d'une
  organisation** (mig. 106) · péremption des invitations refusées (mig. 112).
- **Problèmes résolus** : supprime la friction n°1 du B2B collaboratif · le lien nominatif
  supprime l'étape « replacer tout le monde » · l'invitation par amitié fait entrer quelqu'un
  sans quitter COSMO, sans email ni copier-coller de code · un membre retiré sait qu'il l'a été,
  au lieu de voir l'entreprise disparaître entre deux chargements.
- **Marketing** : « Toute votre équipe dans COSMO en moins de 5 minutes » · le chemin
  ami → collègue est **le seul mécanisme viral du mode entreprise** : un utilisateur perso qui
  crée une org peut y faire entrer ses amis COSMO en deux clics. À instrumenter en priorité
  (aujourd'hui non mesuré).
- **Tips** : préférer le lien nominatif dès que le manager cible est connu ; le code générique
  reste utile pour un recrutement en flux continu.

### 4.3 Équipes transverses & responsables d'équipe
*Recoupe la pyramide sans la casser : « Marketing » n'est pas un niveau hiérarchique.*

- **Fonctionnalités** : équipes libres (nom, couleur) indépendantes de la ligne hiérarchique,
  appartenance multiple · filtre de visibilité pour projets et OKR · **responsable d'équipe
  explicite** (mig. 107), transférable, multiple, avec badge couronne dans l'annuaire.
- **Problèmes résolus** : sépare proprement organigramme et équipes projet · évite la fuite
  d'information entre projets confidentiels · avant la mig. 107, la gestion d'une équipe était
  réservée à son créateur, non transférable, et **disparaissait quand celui-ci quittait
  l'organisation** — l'équipe retombait alors sous la seule administration.
- **Marketing** : « chaque équipe a son espace, sans multiplier les organisations » (vs.
  concurrents à un workspace par département) · cas d'usage : agences (équipe/client), scale-up
  (équipe/produit), assos (équipe/pôle).
- **Tips** : nommer un responsable d'équipe dès la création, sinon le rôle reste attaché au
  créateur et repart avec lui.

### 4.4 Projets d'équipe
*Un Trello/Asana, mais qui parle nativement à la pyramide et à l'agenda perso de chacun.*

- **Fonctionnalités** : trois vues sur le même projet — **liste, kanban par statut**
  (à faire / en cours / en revue / bloqué / terminé), **planning chronologique** · filtres par
  équipe · multi-assignation, sous-tâches (1 niveau) · commentaires avec mentions @ (journal
  immuable) · les tâches d'équipe apparaissent automatiquement dans la To-Do perso de l'assigné.
- **⚠️ Retirés le 24 août** : les **labels** et l'**historique des modifications** ne sont plus
  rendus dans la modale de tâche. Le journal `team_task_activity` (mig. 094) continue d'écrire, et
  le fil d'activité reste visible sur l'onglet Aperçu — mais plus au niveau de la tâche.
- **Problèmes résolus** : supprime le double-emploi outil perso / outil d'équipe · trois lectures
  d'un même projet sans re-saisie.
- **Marketing** : argument central vs. Asana/Monday/ClickUp — « un seul outil pour vos tâches
  perso ET d'équipe, pas deux abonnements » · vidéo : une tâche assignée en kanban apparaît
  instantanément dans la liste perso. **Ne plus citer les labels ni l'historique de tâche** — la
  landing le fait encore, à corriger (§6.2).
- **Tips** : utiliser les mentions @ plutôt qu'un message externe (notification traçable, §4.14).

### 4.5 Onglet Tâches — la table de toutes les tâches
*Le kanban répond « où en est ce projet ». Cette table répond « qui fait quoi, partout ».*

- **Fonctionnalités** : table transverse à tous les projets accessibles, dans le style de la
  TaskTable perso · recherche, tri multi-critères, filtre par statut · pastille de statut sur
  chaque ligne · assignation de membres et **planification d'un créneau d'agenda** directement
  depuis la ligne · badge de commentaires non lus.
- **Problèmes résolus** : au-delà de 3-4 projets, le kanban ne répond plus à la question du
  manager (« qu'est-ce qui est en retard, tous projets confondus ? ») · évite d'ouvrir chaque
  projet pour reconstituer une charge.
- **Marketing** : écran à montrer juste après les statistiques en démo — il prouve que le produit
  tient à l'échelle de l'organisation, pas seulement du projet · bon argument contre le reproche
  « le kanban ne scale pas ».
- **Tips** : c'est l'écran de la revue d'équipe, plus que le kanban.

### 4.6 Dépendances & chemin critique
*Des dates qui savent enfin ce qui les contraint.*

- **Fonctionnalités** : liens « bloque / bloqué par » entre tâches d'un même projet (mig. 108) ·
  calcul du **chemin critique** — la seule chaîne dont tout retard décale le projet — rendu dans
  la vue Planning.
- **Garanties tenues par la base, pas par le client** : aucun cycle possible (trigger, pas
  vérification côté navigateur) · une dépendance ne traverse jamais deux projets — sans quoi une
  tâche d'un projet cloisonné apparaîtrait comme bloquante dans un projet accessible, donc une
  fuite par le graphe.
- **Problèmes résolus** : replanifier une tâche n'annonçait aucune des tâches qu'elle retarde en
  cascade · c'est ce qui manquait pour dire « ce projet glisse » avant la date de livraison.
- **Marketing** : **la brique la plus « premium » du lot** — c'est un argument de gestion de
  projet sérieuse, pas de to-do partagée. Cible : agences avec des livrables datés, équipes
  produit. Angle : « Déplacez une tâche, voyez immédiatement ce qui glisse avec elle. »
- **Tips** : ne poser des dépendances que sur la chaîne structurante, sinon le chemin critique
  passe par tout et n'informe plus.

### 4.7 Catégories d'entreprise
*Un projet est une unité de travail. Une catégorie est une étiquette transverse. Ce n'est pas la même chose.*

- **Fonctionnalités** : catégories propres à l'organisation (mig. 111), posables sur un projet
  **et** directement sur une tâche · vraie clé étrangère, pas un nom recopié — renommer une
  catégorie la renomme partout.
- **Problèmes résolus** : avant, le mode entreprise n'avait qu'une dimension de classement (le
  projet). Impossible de dire « tout ce qui relève du Support client », réparti sur cinq projets ·
  un projet est archivé un jour, une catégorie survit.
- **Marketing** : peu spectaculaire en démo, mais c'est un **argument de maturité** face à
  l'objection « votre outil est un kanban ». À citer en page fonctionnalités, pas en hero.
- **Tips** : créer les catégories avant les projets ; garder une liste courte (5-8), sinon elles
  redeviennent des labels.

### 4.8 OKR d'équipe
*Des objectifs qui se pondèrent et se cloisonnent comme dans une vraie entreprise.*

- **Fonctionnalités** : OKR rattachables à une/plusieurs équipes ou à toute l'organisation ·
  chaque KR a un **poids (1-10)**, une cible chiffrée, une **unité libre**, un assigné possible ·
  **échéance** et **visibilité** posées dans la modale · catégories d'OKR propres à
  l'organisation · barre de progression pilotée en direct.
- **Problèmes résolus** : remplace le tableur OKR trimestriel jamais mis à jour · la pondération
  évite le biais « 3 KR faciles sur 4 = 75 % » alors que le KR difficile est à 0 · le cloisonnement
  évite l'affichage d'OKR confidentiels à toute l'entreprise.
- **Marketing** : mot-clé B2B à fort intérêt (COO, RH, dirigeants) — bon candidat SEO ·
  différenciant vs. outils OKR mono-usage chers (Gtmhub, Ally, Perdoo) · contenu : « Pourquoi 90 %
  des OKR meurent en semaine 3 ».
- **Tips** : pondérer selon la difficulté réelle, pas à égalité par défaut ; ne rattacher à « toute
  l'entreprise » que si l'OKR concerne vraiment tout le monde.

### 4.9 Agenda managérial
*Un manager voit le planning réel de son équipe, sans demander « t'es dispo quand ? ».*

- **Fonctionnalités** : consultation **et édition** de l'agenda des subordonnés (jour/semaine/mois)
  · combine événements perso + tâches d'équipe datées · **assignation d'un événement à un membre
  depuis la tâche** · droit distinct « voir l'agenda » vs. « voir les stats ».
- **Problèmes résolus** : supprime le ping-pong « es-tu dispo jeudi ? » dans les équipes
  distribuées · permet de caler une réunion ou redistribuer une charge sans copier-coller entre
  calendriers.
- **Marketing** : angle fort remote/hybride — « Voyez l'agenda de votre équipe comme si vous étiez
  tous dans le même bureau » · cible à forte disposition à payer : managers d'équipes distribuées ·
  comparatif Google Calendar partagé (statique) vs. agenda managérial COSMO (connecté au travail
  réel).
- **Tips** : le contenu des événements privés reste masqué (seul le créneau est visible) — à
  rappeler en onboarding, c'est la réponse à l'objection « surveillance ».

### 4.10 Statistiques de pilotage
*Le tableau de bord qu'un manager ouvrirait le lundi matin, déjà rempli.*

- **Fonctionnalités** : période (7j/30j/90j/tout), synthèse (total, terminées, en cours, en retard,
  taux de complétion) · charge et complétion par membre, répartition par projet · vélocité
  hebdomadaire et tendance · avancement OKR pondéré · **temps investi** agrégé par équipe et projet
  · périmètre automatique (admin = toute l'org, manager = lui + son sous-arbre).
- **⚠️ Retiré le 24 août** : l'**export CSV** est désactivé (`CSV_EXPORT_ENABLED = false`). Le code
  est intact — c'est une constante à repasser à `true`.
- **Problèmes résolus** : remplace le reporting manuel hebdomadaire · le cloisonnement automatique
  évite qu'un manager voie des équipes hors périmètre · la tendance rend visible un ralentissement
  avant qu'il devienne un problème de livraison.
- **Marketing** : cœur de la proposition « pilotage », **écran qui vend le mieux en démo** ·
  capture à fort impact pour landing/pricing. **Ne plus promettre l'export CSV** en cycle de vente
  grand compte — ou le réactiver avant (c'est une ligne de code, et c'est un argument de comité de
  direction).
- **Tips** : les OKR restent « en direct » quel que soit le filtre de période (volontaire).

### 4.11 Revue hebdomadaire guidée
*Pas un dashboard de plus : un parcours en 4 étapes qui se termine par des décisions.*

- **Fonctionnalités** : flux guidé en 4 étapes basé sur l'activité de la semaine, débouchant sur
  des actions cliquables · réservé managers (≥1 subordonné) et admins, accessible depuis l'onglet
  Statistiques.
- **Problèmes résolus** : remplace la réunion hebdo de 30 min par un parcours de 3 min · transforme
  des chiffres passifs en décisions concrètes.
- **Marketing** : « La réunion de lundi matin, déjà faite avant que vous ouvriez l'agenda » · démo
  live très vendeuse en webinar/appel commercial · contenu blog : « On a remplacé notre stand-up
  hebdo par un parcours de 3 minutes ».
- **Tips** : à positionner explicitement comme rituel du lundi en onboarding, sinon invisible (ce
  n'est pas un onglet permanent, et il est maintenant enterré sous un onglet lui-même réservé aux
  managers).

### 4.12 Fiche membre unifiée & annuaire
*Un seul endroit pour tout savoir sur une personne — sans fouiller quatre écrans.*

- **Fonctionnalités** : fiche à 4 onglets (Profil / Tâches / Contribution / Agenda) selon droits ·
  annuaire cherchable (nom/email, insensible aux accents) · deep-link direct · badge de responsable
  d'équipe.
- **Problèmes résolus** : fusionne trois écrans historiquement séparés · l'annuaire devient
  indispensable au-delà de la taille « on connaît tout le monde par cœur ».
- **Marketing** : bon signal de maturité produit en page fonctionnalités, rassurant pour les
  organisations >20 personnes. La landing s'en sert déjà : la pyramide de démo est cliquable et
  ouvre la vraie fiche membre.
- **Tips** : partager le lien direct d'une fiche plutôt qu'expliquer par écrit.

### 4.13 Onglet Aperçu — ma journée, et le démarrage guidé
*L'écran d'accueil de l'espace entreprise. C'est là que la journée commence.*

- **Fonctionnalités** : mes tâches d'équipe assignées, prochaine échéance, carte de synthèse ·
  **fil d'activité de l'équipe** · **checklist de démarrage en 5 étapes** pour l'admin d'une
  organisation jeune (inviter → créer une équipe → créer un projet → rattacher la pyramide → poser
  un OKR), qui disparaît une fois complétée · **indices d'arrivée** pour un membre non-admin sans
  tâche assignée, qui sinon atterrit sur un écran vide.
- **Problèmes résolus** : le trou noir du premier jour, des deux côtés — l'admin ne savait pas dans
  quel ordre monter son organisation, le nouveau membre arrivait sur du vide.
- **Marketing** : **la checklist est le meilleur argument d'activation en libre-service** : elle
  rend crédible la promesse « créez votre organisation en une minute » de la landing, sans
  onboarding commercial. À filmer pour la démo produit.
- **Tips** : l'ordre des 5 étapes n'est pas cosmétique — l'équipe passe avant le projet, parce
  qu'un projet rattaché après coup demande un geste de plus et porte tout le cloisonnement.

### 4.14 Notifications & activité d'organisation
*Ce qui s'est passé pendant que vous n'étiez pas là — sans avoir à demander.*

- **Fonctionnalités** : cloche + badge de non-lues · types d'événements : tâche assignée, mention @,
  tâche en retard (générée automatiquement), **commentaire sur une tâche dont on est assigné**
  (mig. 110), **retrait de l'organisation** (mig. 106) · badge de commentaires non lus par tâche.
- **Problèmes résolus** : la mention était le seul déclencheur — un assigné que personne
  n'interpelle ne savait jamais que la conversation avançait sur SA tâche · évite qu'une assignation
  se perde faute de notification externe.
- **Marketing** : « pas de notifications qui se perdent entre Slack, email et l'outil de tâches » —
  pertinent contre la fatigue notificationnelle.
- **Tips** : les mentions @ restent le déclencheur le plus utile au quotidien — en faire un réflexe
  d'équipe.

### 4.15 Sièges & facturation — **actifs**
*Le prix suit la taille de l'organisation. Depuis le 24 août, il la contraint aussi.*

- **Grille en vigueur** (source unique : `ENTERPRISE_PRICING_TIERS`) :

  | Palier | Membres | Prix / mois |
  |---|---|---|
  | Gratuit | 0 à 5 | 0 € |
  | Équipe | 5 à 10 | 20 € |
  | Département | 10 à 20 | 50 € |
  | Entreprise | 20 à 50 | 100 € |
  | Illimité | 50 et + | 200 € |

- **État réel** : `ENTERPRISE_BILLING_ENFORCED = true`, drapeau serveur `enterprise_seat_limit`
  activé, Edge Functions `stripe-org-checkout` / `stripe-org-portal` déployées, 4 price IDs en
  secrets. Le quota est appliqué **en base** (`org_seats_allowed`), pas dans l'interface.
- **Comportement au dépassement** : on ne retire **jamais** de membre. Seule la croissance est
  bloquée. Un abonnement `past_due` ou `cancelled` retombe au palier gratuit sans perte de données.
- **🔴 Le piège** : la clé Stripe en production est une **clé de test**. Le checkout n'accepte que
  des cartes de test. Un vrai client bloqué à 5 membres **ne peut pas payer pour se débloquer**.
  Voir §7.1 — c'est la première chose à corriger.
- **Marketing** : « Gratuit jusqu'à 5 personnes, puis 20 €/mois pour toute l'équipe » — **prix par
  organisation, pas par siège**, argument fort face à des concurrents qui facturent par personne
  dès la première.
- **Tips** : les coupons sont des promotion codes Stripe natifs — COSMO ne valide aucun code et ne
  recalcule aucun montant, donc aucune surface d'abus côté produit.

### 4.16 Sécurité & confidentialité par construction
*Pas une fonctionnalité qu'on montre — un argument de confiance qu'on prouve.*

- **Fonctionnalités** : cloisonnement appliqué au niveau base de données via appartenance à
  l'organisation, rôle admin, position dans la pyramide · projets/OKR filtrés par équipe · droits
  distincts « voir l'agenda » / « voir les stats ».
- **Durcissements depuis le 12 août** : fuite inter-organisations refermée (mig. 100) · un membre
  retiré perd vraiment ses accès, ses appartenances d'équipe étant purgées (mig. 104 — avant, elles
  survivaient à l'exclusion et rouvraient l'accès aux projets) · droits d'exécution des helpers RLS
  et durcissement des triggers de garde (mig. 109) · rétention des invitations refusées (mig. 112)
  et des tables analytiques (mig. 114).
- **Problèmes résolus** : répond par avance à la question DPO/RSSI systématique en cycle B2B
  (« un bug d'interface peut-il exposer les données d'un autre service ? » → non, structurellement)
  · sépare vie privée et pilotage managérial, évite l'effet « big brother ».
- **Marketing** : la section Sécurité de la landing existe désormais et répond aux 4 questions de
  comité (isolation, non-surveillance, RGPD, réversibilité). **C'est le meilleur texte de vente du
  produit aujourd'hui** — à réutiliser tel quel en réponse d'appel d'offres.
- **Tips** : insister systématiquement sur « séparation vie perso / vie pro » — objection la plus
  fréquente à l'adoption côté salariés.

---

## 5. Spécifié, pas livré

**Flux de relecture des tâches d'équipe** — design validé avec Axel le 2026-08-24
([spec](../superpowers/specs/2026-08-24-team-task-review-flow-design.md)), **non implémenté**.

Aujourd'hui n'importe quel membre ayant accès à un projet peut cocher n'importe quelle tâche comme
terminée, y compris celles assignées à quelqu'un d'autre : le statut `review` du kanban n'est
qu'une colonne parmi d'autres, rien n'oblige à y passer. Le design prévoit qu'une tâche marquée
terminée par un employé transite obligatoirement par « en relecture », un manager de sa hiérarchie
devant **Valider** ou **Renvoyer** (avec commentaire obligatoire), la garde étant posée dans le
trigger et non dans l'interface.

⚠️ **Collision de numérotation à régler avant implémentation** : la spec réserve
`113_team_task_review_flow.sql`, mais le numéro 113 a été pris entre-temps par
`113_team_reads_indexable.sql`, déjà appliquée en prod. La prochaine migration libre est la 115.

**Valeur commerciale** : c'est la brique qui fait passer le produit de « suivi » à « validation »,
et elle répond directement à une objection de dirigeant (« qui me dit que c'est vraiment fait ? »).
À ne pas vendre avant qu'elle existe.

---

## 6. Diagnostic marketing au 24 août

### 6.1 La vitrine existe

Le rapport précédent constatait zéro occurrence du mot « entreprise » dans les pages publiques.
C'est faux depuis le 15 août. La landing est scindée en **deux parcours mutuellement exclusifs** :
`/` (perso) et `/entreprise-presentation` (entreprise), dérivés de l'URL et non d'un état local.

Le parcours entreprise compte 9 sections : hero → problème (trois raisons pour lesquelles vos
outils d'équipe ne tiennent pas) → organigramme → projets → OKR → suivi → sécurité → tarifs → FAQ
→ CTA. Les captures sont **de vrais écrans**, pas des maquettes. La pyramide de démo est cliquable
et ouvre la vraie fiche membre. Le simulateur de tarif est branché sur `ENTERPRISE_PRICING_TIERS` —
aucun montant en dur.

**C'est du bon travail, et il est fini.** Le problème est ailleurs.

### 6.2 🔴 Trois promesses que le produit ne tient plus

| Clé | Ce que la landing promet | Ce que le produit fait |
|---|---|---|
| `enterprise.projects.p3d` | « **Labels**, commentaires avec mentions et **historique des modifications**. » | Labels et historique **retirés** de la modale le 24 août. Seuls les commentaires restent. |
| `enterprise.faq.a4` | « Le forfait passe au palier suivant automatiquement. **Rien n'est bloqué**, rien n'est à redemander. » | Le quota **bloque** l'ajout de membres au-delà du palier, et le passage au palier suivant exige un checkout manuel du propriétaire. |
| `enterprise.pricing.autoAdjust` | « Le forfait s'ajuste tout seul quand l'organisation grandit. **Aucune action de votre part**. » | Idem : rien ne s'ajuste tout seul vers le haut. |

La première est une **survente** (on annonce ce qui n'existe plus). Les deux autres sont pires :
elles décrivent l'inverse du comportement réel, et le prospect le découvrira au pire moment — celui
où il essaie de faire grandir son équipe. **À corriger avant toute campagne d'acquisition.**

### 6.3 Le vrai goulot : personne ne vient

| Métrique (août 2026) | Valeur |
|---|---|
| Visiteurs démo | **5** |
| Conversions démo → compte | **0** |
| Inscriptions | **0** (dernière le 21 juillet) |
| Position moyenne Google (non-marque) | **88** |
| Organisations réelles | 3, 11 membres |

Le message est écrit, les écrans sont réels, le pricing est affiché — et l'audience est nulle. Le
levier n'est plus le contenu produit. **Il est dans l'acquisition** : autorité de domaine, backlinks
(cf. [`docs/ACQUISITION-BACKLINKS.md`](../ACQUISITION-BACKLINKS.md)), et prospection sortante.

---

## 7. Stratégie de vente — vendre maintenant, encaisser après

**Principe retenu** : on ne fait pas dépendre la prospection du passage en Stripe live. On vend et
on fait adopter dès maintenant ; l'encaissement est un chantier daté, mené en parallèle. Mais cela
n'est tenable **qu'à une condition** : que le produit cesse de bloquer les organisations qu'il ne
peut pas encore facturer.

### 7.1 🔴 Priorité absolue — débloquer la croissance (aujourd'hui)

**Le problème, en une phrase** : depuis le 24 août, une organisation de 5 membres ne peut plus en
ajouter un sixième, et l'unique porte de sortie est un checkout adossé à une clé Stripe de test
qu'aucune carte réelle ne peut franchir.

Conséquence commerciale : **toute organisation qui réussit son adoption est punie**. C'est le pire
moment possible pour un mur — celui où le produit vient de faire ses preuves.

Trois options, par ordre de préférence :

| Option | Geste | Effet | Réversibilité |
|---|---|---|---|
| **A. Désactiver le quota** (recommandé) | `UPDATE billing_flags SET enabled = false WHERE key = 'enterprise_seat_limit'` + `ENTERPRISE_BILLING_ENFORCED = false` | Plus aucun blocage. La grille reste affichée sur la landing comme prix annoncé. | Immédiate, un `UPDATE` |
| **B. Relever le palier gratuit** | `ORG_FREE_SEATS` et le quota `free` à 20 | Le mur recule au-delà de la taille des prospects réalistes | Immédiate |
| **C. Passer Stripe en live** | Recréer 4 prix, réenregistrer le webhook, remplacer 3 secrets | Le mur devient légitime : on bloque, mais on peut encaisser | ~2 h de travail + tests |

**Recommandation : A maintenant, C sous 30 jours.** Vendre le prix sans l'appliquer est cohérent
avec l'angle retenu : le palier gratuit *est* l'essai, et on ne veut aucune friction entre
« l'équipe adopte » et « l'équipe grandit ». On rallume le quota le jour où l'encaissement est réel
— l'ordre inverse coûte des clients qu'on ne récupère pas.

### 7.2 Corriger les trois promesses fausses (cette semaine)

- `enterprise.projects.p3d` : retirer « labels » et « historique des modifications ». Les remplacer
  par ce qui existe et se vend mieux — **dépendances et chemin critique** (§4.6), qui sont
  aujourd'hui absents de la landing alors que c'est la brique la plus différenciante livrée depuis
  le 12 août.
- `enterprise.faq.a4` et `enterprise.pricing.autoAdjust` : réécrire selon l'option retenue en §7.1.
  Si option A, la formulation actuelle redevient vraie. Si option C, il faut dire honnêtement que
  le passage de palier demande un paiement.

> Rappel : les catalogues `fr` et `en` doivent bouger ensemble — `npm run i18n:check` est bloquant
> en CI, et `fr` sert de repli silencieux, donc une clé anglaise oubliée ne se voit pas.

### 7.3 Personas prioritaires

| Persona | Douleur dominante | Brique qui répond | Canal |
|---|---|---|---|
| Dirigeant·e de PME (10-50 pers.) | Pas d'outil de pilotage, tout « dans la tête » | 4.1 Pyramide · 4.10 Statistiques | SEO « logiciel gestion équipe PME », prospection directe |
| Fondateur d'agence / studio | Livrables datés, projets clients cloisonnés | 4.6 Dépendances · 4.3 Équipes · 4.4 Projets | Communautés agences, LinkedIn |
| Manager d'équipe remote/hybride | Perte de temps à synchroniser les dispos | 4.9 Agenda managérial | LinkedIn, contenu « remote work » |
| Responsable produit / COO | OKR morts après 3 semaines | 4.8 OKR d'équipe | SEO « OKR équipe », comparatifs |

### 7.4 Chantiers, par priorité

1. **Débloquer la croissance** (§7.1) — aujourd'hui, un `UPDATE`.
2. **Corriger les trois promesses fausses** (§7.2) — cette semaine.
3. **Mettre les dépendances et le chemin critique sur la landing** — c'est le meilleur argument
   livré depuis le 12 août et il n'est nulle part.
4. **Instrumenter le chemin ami → collègue** (§4.2) : c'est le seul mécanisme viral du mode
   entreprise, et il n'est pas mesuré. Sans mesure, on ne saura pas s'il faut l'amplifier.
5. **Acquisition, pas contenu produit** : backlinks et autorité de domaine
   ([`docs/ACQUISITION-BACKLINKS.md`](../ACQUISITION-BACKLINKS.md)). Position 88 ne se corrige pas
   en écrivant une page de plus.
6. **Prospection sortante assumée** : à 5 visiteurs/mois, aucun levier organique ne produira de
   signal avant des mois. 10 organisations réelles valent plus que 1000 comptes perso — et c'est
   atteignable, parce qu'il n'y a personne à déloger dans une PME de 15 personnes qui n'a aucun
   outil.
7. **Passer Stripe en live sous 30 jours**, puis rallumer le quota.
8. **Preuve sociale** : dès la première organisation cliente réelle au-delà des 3 actuelles,
   capturer un témoignage court et de vrais chiffres d'usage.

> « Le produit vend déjà, et la vitrine est construite. Il manque quelqu'un devant. »

---

## 8. Objections & FAQ de vente

**« Est-ce que mes employés vont se sentir surveillés ? »**
Non : le contenu des événements personnels reste privé, seul le créneau est visible d'un manager.
Les tâches, habitudes et agenda personnels ne remontent jamais à la hiérarchie. Les statistiques
portent sur le travail d'équipe, jamais sur la vie privée.

**« On a déjà Notion/Asana, pourquoi changer ? »**
COSMO fusionne ce que ces outils séparent : vue perso ET vue équipe dans un seul produit, avec
organigramme, agenda managérial, OKR et dépendances inclus — pas des modules payants séparément.
Et le prix est par organisation, pas par personne.

**« Combien ça coûte avec 30 personnes ? »**
100 €/mois pour toute l'organisation. Pas 30 × un prix par siège.

**« Un manager intermédiaire peut-il voir toute l'entreprise ? »**
Non : il ne voit que lui-même et son sous-arbre exact dans la pyramide, automatiquement — pas de
configuration manuelle des permissions, et la règle est appliquée en base de données.

**« Que se passe-t-il si on dépasse 5 personnes ? »**
⚠️ **Réponse à figer selon la décision §7.1.** Ne pas répondre « rien n'est bloqué » tant que le
quota est actif : c'est faux aujourd'hui, et le prospect le découvrira lui-même.

**« Qui valide qu'une tâche est vraiment terminée ? »**
⚠️ **Ne pas vendre** : le flux de relecture est spécifié, pas livré (§5). Aujourd'hui n'importe quel
membre du projet peut cocher n'importe quelle tâche.

**« Est-ce qu'on peut exporter nos données pour notre comité ? »**
⚠️ L'export CSV est désactivé (§4.10). Soit on le réactive (une constante), soit on n'en parle pas.

---

## 9. Points à trancher

- **§7.1 — quota de sièges** : option A, B ou C ? C'est la seule décision qui bloque tout le reste.
- **Date de passage en Stripe live** : sans elle, l'option A n'a pas de fin et le prix affiché
  devient décoratif.
- **Réactiver l'export CSV ?** Une constante, un argument de comité de direction. Pourquoi a-t-il
  été coupé ?
- **Labels et historique de tâche** : retrait définitif ou temporaire ? La réponse change le
  discours produit ET la copy de la landing.
- **Flux de relecture** : le planifier, ou l'abandonner ? C'est la brique qui ferait passer COSMO de
  « suivi » à « validation », et la seule réponse à « qui me dit que c'est vraiment fait ? ».
- **Première organisation cliente réelle** : toute la preuve sociale en dépend, au-delà des 3
  organisations actuelles et de la démo « Nova Studio ».
- **Ton de la page sécurité** : la section actuelle est bonne pour du libre-service. Faut-il une
  page dédiée pour la vente grand compte ?

---

## 10. Glossaire

| Terme dans le code | À dire à un prospect |
|---|---|
| `manager_id` / pyramide | Organigramme automatique |
| `org_teams` / `isLead` | Équipes, responsable d'équipe |
| `teamIds` cloisonnement | Confidentialité par équipe |
| `team_tasks` / kanban | Tâches d'équipe, projets |
| `team_task_dependencies` | Dépendances, chemin critique |
| `team_categories` | Catégories transverses |
| `weight` (KR) | Pondération des objectifs |
| `is_above` / `get_subtree` | Périmètre managérial |
| RLS (Row Level Security) | Cloisonnement au niveau base — « même en cas de bug d'affichage, les données restent séparées » |
| `org_seats_allowed` | Quota de sièges du forfait |
| `ENTERPRISE_BILLING_ENFORCED` | Interrupteur de facturation (aujourd'hui : **actif**, mais sur un Stripe de test) |

---

*Rapport produit interne · COSMO 1.2 · Faits vérifiés dans le code source et contre la production
le 24 août 2026. Remplace la version du 12 août. Le finding §7.1 est à traiter avant toute
communication commerciale.*
