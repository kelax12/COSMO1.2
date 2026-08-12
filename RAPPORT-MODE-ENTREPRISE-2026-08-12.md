# Le mode Entreprise, brique par brique — et comment en faire un moteur d'acquisition

> Rapport produit & go-to-market — usage interne · COSMO 1.2
> Faits vérifiés dans le code source le 2026-08-12 · Version enrichie disponible en artifact (voir lien partagé dans la conversation).

**Sommaire** : [1. Résumé exécutif](#1-résumé-exécutif) · [2. Comment le système s'articule](#2-comment-le-système-sarticule) · [3. Les 13 briques en détail](#3-les-13-briques-en-détail) · [4. Diagnostic marketing actuel](#4-diagnostic-marketing-actuel) · [5. Stratégie d'acquisition](#5-stratégie-dacquisition-proposée) · [6. Objections & FAQ de vente](#6-objections--faq-de-vente) · [7. Points à approfondir](#7-points-à-approfondir) · [8. Glossaire](#8-glossaire)

---

## 1. Résumé exécutif

Le mode Entreprise de COSMO n'est pas une case « équipe » ajoutée à un outil perso : c'est une deuxième application complète — organisation, pyramide managériale, projets, OKR, agenda, statistiques — qui vit à côté de la partie individuelle et la réutilise. Le problème : personne ne le sait, parce qu'aucune page publique n'en parle.

**Chiffres clés**
- **13** briques fonctionnelles distinctes, toutes livrées et vérifiées dans le code.
- **0** mention du mode Entreprise sur la landing page ou les pages produit.
- **5** membres gratuits par organisation avant palier payant.
- **20 € / 100 €** par mois, paliers 5-50 et 50+ sièges (modèle codé, non activé).

**Trois idées structurent ce rapport :**

1. **Le produit est en avance sur le message.** Pyramide managériale dérivée automatiquement, cloisonnement fin par équipe, agenda managérial, revue hebdomadaire guidée : ce sont des fonctionnalités qu'un Asana ou un Monday facturent cher ou n'ont pas. Aucune n'est aujourd'hui racontée à un prospect.
2. **Chaque brique technique correspond à une douleur managériale nommable.** « Je ne sais pas qui est en retard », « je perds une heure par semaine à faire un point d'équipe », « je ne sais pas où en sont mes OKR » — ce rapport traduit systématiquement la fonctionnalité en douleur, puis la douleur en angle marketing.
3. **Le modèle économique est prêt mais éteint.** `ENTERPRISE_BILLING_ENFORCED = false` : la grille tarifaire (gratuit <5, 20 €/mois de 5 à 50, 100 €/mois au-delà) est codée, calculée, mais ne bloque rien. C'est une chance pour l'acquisition : on peut vendre l'accès complet sans friction de paiement dès maintenant, et activer la facturation une fois la boucle d'acquisition validée.

---

## 2. Comment le système s'articule

Un compte COSMO est particulier *ou* entreprise. Le mode Entreprise ajoute une organisation au-dessus des données personnelles existantes : mêmes tâches, même agenda, mêmes OKR dans leur logique — mais rattachés à une hiérarchie et à des équipes.

**La colonne vertébrale : la pyramide.** À l'adhésion, chaque membre est rattaché à un manager (`manager_id`). Le rôle « manager » n'existe dans aucune base de données — il est *déduit* : quiconque a au moins un subordonné direct devient manager de fait, avec les droits qui vont avec (voir son agenda, ses statistiques, sa charge). C'est ce mécanisme, et lui seul, qui alimente ensuite l'agenda managérial (3.6), les statistiques cloisonnées (3.7) et la revue hebdomadaire (3.8) — un seul graphe, trois usages.

Autour de cette colonne : des **équipes transverses** (3.3) qui recoupent la pyramide (un projet ou un OKR peut être rattaché à une équipe plutôt qu'à toute l'entreprise), et un **modèle de sièges** (3.12) qui donne au produit un chemin de monétisation naturel — le prix suit la taille de l'organisation, pas des fonctionnalités bridées.

---

## 3. Les 13 briques en détail

Pour chaque brique : ce qu'elle fait, le problème qu'elle résout, comment l'exploiter en marketing (angles, copy, canaux), et des tips d'usage.

### 3.1 Multi-organisation & pyramide managériale
*La structure de l'entreprise, dessinée automatiquement — jamais redessinée à la main.*

- **Fonctionnalités** : appartenance à plusieurs organisations avec switcher (badge admin visible) · arbre hiérarchique reconstruit automatiquement depuis le manager de chaque membre, pas de table de rôles à administrer · détection des membres « non placés » · onglet Pyramide avec glisser-déposer.
- **Problèmes résolus** : élimine l'organigramme RH séparé, souvent payant, jamais synchronisé avec les tâches réelles — ici la hiérarchie EST le système de droits · supprime la ressaisie « qui gère qui » dans un outil tiers · une entreprise multi-structures (agence, franchise, groupe) n'est pas forcée dans un seul espace.
- **Marketing** : angle « zéro administration » (« Votre organigramme se dessine tout seul ») · démo forte : ajouter un membre sous un manager propage tous les droits en une action · cible : dirigeants PME 10-50 pers. sans outil RH léger · page comparatif « COSMO vs. le tableur RH ».
- **Tips** : placer chaque nouveau membre au bon endroit dès l'invitation évite le nettoyage a posteriori ; un membre sans subordonné ne voit jamais les onglets managériaux, c'est normal.

### 3.2 Invitations & entrée dans l'organisation
*Deux façons d'entrer, un seul geste de consentement.*

- **Fonctionnalités** : code permanent `COSMO-XXXXXX` partageable à l'oral/en interne · lien à usage unique (7 jours) qui place directement la personne sous un manager choisi · demandes d'adhésion validées par un admin · écran de consentement RGPD explicite avant toute entrée.
- **Problèmes résolus** : supprime la friction n°1 du B2B collaboratif (faire entrer 15 personnes sans 15 emails) · le lien nominatif supprime l'étape « replacer tout le monde » · le consentement désamorce l'objection RGPD avant qu'elle soit posée.
- **Marketing** : « Toute votre équipe dans COSMO en moins de 5 minutes, avec un seul lien » · GIF du flux lien → consentement → arrivée directe : efficace en post LinkedIn/page produit · argument confiance DPO/RH face à des outils US qui ignorent ce sujet.
- **Tips** : préférer le lien nominatif dès que le manager cible est connu ; le code générique reste utile pour un recrutement en flux continu.

### 3.3 Équipes transverses
*Recoupe la pyramide sans la casser : « Marketing » n'est pas un niveau hiérarchique.*

- **Fonctionnalités** : équipes libres (nom, couleur) indépendantes de la ligne hiérarchique, appartenance multiple · filtre de visibilité pour projets et OKR (rattaché à une équipe = visible par elle + hiérarchie + admins).
- **Problèmes résolus** : sépare proprement organigramme et équipes projet (jamais parfaitement superposés en réalité) · évite la fuite d'information entre projets confidentiels d'équipes différentes.
- **Marketing** : « chaque équipe a son espace, sans multiplier les organisations » (vs. concurrents à un workspace par département) · cas d'usage : agences (équipe/client), scale-up (équipe/produit), assos (équipe/pôle).
- **Tips** : créer les équipes avant les premiers projets ; un projet « toute l'entreprise » reste le bon défaut pour les initiatives transverses.

### 3.4 Projets d'équipe
*Un Trello/Asana complet, mais qui parle nativement à la pyramide et à l'agenda perso de chacun.*

- **Fonctionnalités** : kanban par statut (à faire/en cours/en revue/bloqué/terminé), filtres par équipe · multi-assignation, sous-tâches (1 niveau), labels réservés aux managers · commentaires avec mentions @ (journal immuable) et historique d'activité complet · les tâches d'équipe apparaissent automatiquement dans la To-Do perso de l'assigné.
- **Problèmes résolus** : supprime le double-emploi outil perso / outil d'équipe · l'historique répond seul à « qui a changé ça et quand » · les labels réservés aux managers évitent la prolifération de tags incohérents.
- **Marketing** : argument central vs. Asana/Monday/ClickUp — « un seul outil pour vos tâches perso ET d'équipe, pas deux abonnements » · vidéo : une tâche assignée en kanban apparaît instantanément dans la liste perso · cas d'usage : agence (kanban client), équipe produit (sous-tâches + labels), studio créatif (commentaires + mentions).
- **Tips** : définir les labels dès la création du projet ; utiliser les mentions @ plutôt qu'un message externe (notification traçable, §3.11).

### 3.5 OKR d'équipe
*Des objectifs qui se pondèrent et se cloisonnent comme dans une vraie entreprise, pas un tableur partagé.*

- **Fonctionnalités** : OKR rattachables à une/plusieurs équipes ou à toute l'entreprise · chaque KR a un poids (1-10), une cible chiffrée, une unité, un assigné possible · catégories d'OKR propres à l'organisation · barre de progression pilotée en direct.
- **Problèmes résolus** : remplace le tableur OKR trimestriel jamais mis à jour · la pondération évite le biais « 3 KR faciles sur 4 = 75 % » alors que le KR difficile est à 0 · le cloisonnement évite l'affichage d'OKR confidentiels à toute l'entreprise.
- **Marketing** : mot-clé B2B à fort intérêt (COO, RH, dirigeants) — bon candidat SEO + page produit dédiée · différenciant vs. outils OKR mono-usage chers (Gtmhub, Ally, Perdoo) · contenu : « Pourquoi 90 % des OKR meurent en semaine 3 ».
- **Tips** : pondérer selon la difficulté réelle, pas à égalité par défaut ; ne rattacher à « toute l'entreprise » que si l'OKR concerne vraiment tout le monde.

### 3.6 Agenda managérial
*Un manager voit le planning réel de son équipe, sans demander « t'es dispo quand ? ».*

- **Fonctionnalités** : consultation/édition de l'agenda complet des subordonnés (jour/semaine/mois) · combine événements perso + tâches d'équipe datées · droit distinct « voir l'agenda » vs. « voir les stats ».
- **Problèmes résolus** : supprime le ping-pong « es-tu dispo jeudi ? » dans les équipes distribuées/hybrides · permet de caler une réunion ou redistribuer une charge sans copier-coller entre calendriers.
- **Marketing** : angle fort remote/hybride — « Voyez l'agenda de votre équipe comme si vous étiez tous dans le même bureau » · cible à forte disposition à payer : managers d'équipes distribuées · comparatif Google Calendar partagé (statique) vs. agenda managérial COSMO (connecté au travail réel).
- **Tips** : le contenu des événements privés reste masqué (seul le créneau est visible) — à rappeler en onboarding ; accessible directement depuis la fiche membre (§3.9).

### 3.7 Statistiques de pilotage
*Le tableau de bord qu'un manager ouvrirait le lundi matin, déjà rempli.*

- **Fonctionnalités** : période (7j/30j/90j/tout), synthèse (total, terminées, en cours, en retard, taux de complétion) · charge et complétion par membre, répartition par projet · vélocité hebdomadaire et tendance du taux de complétion · avancement OKR pondéré, retards par membre · export CSV · périmètre automatique (admin = toute l'org, manager = lui + son sous-arbre).
- **Problèmes résolus** : remplace le reporting manuel hebdomadaire · le cloisonnement automatique évite qu'un manager voie des équipes hors périmètre · la vélocité/tendance rend visible un ralentissement avant qu'il devienne un problème de livraison.
- **Marketing** : cœur de la proposition « pilotage », écran qui vend le mieux en démo commerciale · capture à fort impact pour landing/pricing · angle : « Le reporting d'équipe que vous n'avez plus besoin de préparer ».
- **Tips** : les OKR restent « en direct » quel que soit le filtre de période (volontaire) ; utiliser l'export CSV pour les comités de direction plutôt qu'une capture d'écran.

### 3.8 Revue hebdomadaire guidée
*Pas un dashboard de plus : un parcours en 4 étapes qui se termine par des décisions.*

- **Fonctionnalités** : flux guidé en 4 étapes basé sur l'activité de la semaine, débouchant sur des actions cliquables · réservé managers (≥1 subordonné) et admins, accessible depuis l'onglet Statistiques.
- **Problèmes résolus** : remplace la réunion hebdo de 30 min par un parcours de 3 min qu'un manager peut faire seul ou avant la réunion · transforme des chiffres passifs en décisions concrètes.
- **Marketing** : « La réunion de lundi matin, déjà faite avant que vous ouvriez l'agenda » · démo live très vendeuse en webinar/appel commercial · contenu blog : « On a remplacé notre stand-up hebdo par un parcours de 3 minutes ».
- **Tips** : à positionner explicitement comme rituel du lundi en onboarding, sinon invisible (pas un onglet permanent).

### 3.9 Fiche membre unifiée & annuaire
*Un seul endroit pour tout savoir sur une personne — sans fouiller quatre écrans.*

- **Fonctionnalités** : fiche à 4 onglets (Profil/Tâches/Contribution/Agenda) selon droits · annuaire cherchable (nom/email, insensible aux accents) dès 3+ membres · deep-link direct.
- **Problèmes résolus** : fusionne trois écrans historiquement séparés · l'annuaire devient indispensable au-delà de la taille « on connaît tout le monde par cœur ».
- **Marketing** : bon signal de maturité produit en page fonctionnalités, rassurant pour les organisations >20 personnes.
- **Tips** : partager le lien direct d'une fiche (onglet ouvert) plutôt qu'expliquer par écrit — utile aussi en support interne.

### 3.10 Vue « Aujourd'hui »
*La question « qu'est-ce que je dois faire là, maintenant » — répondue en un écran.*

- **Fonctionnalités** : section du dashboard fusionnant en lecture tâches perso + tâches d'équipe du jour (échéance aujourd'hui ou en retard) · chaque élément renvoie vers son écran d'origine, pas d'édition directe.
- **Problèmes résolus** : évite d'ouvrir deux écrans chaque matin pour reconstituer sa journée.
- **Marketing** : bon « premier écran » de démo (première impression à la connexion) · « Votre journée, perso et équipe confondus, sur un seul écran — pas deux apps à ouvrir avant le café ».
- **Tips** : ne pas s'attendre à éditer une tâche depuis cette vue — tableau de synthèse assumé.

### 3.11 Notifications & activité d'organisation
*Ce qui s'est passé pendant que vous n'étiez pas là — sans avoir à demander.*

- **Fonctionnalités** : cloche + badge de non-lues · 3 types d'événements (tâche assignée, mention, tâche en retard générée automatiquement) · badge de navigation dérivé.
- **Problèmes résolus** : évite qu'une assignation/mention se perde faute de notification externe (email, Slack).
- **Marketing** : « pas de notifications qui se perdent entre Slack, email et l'outil de tâches » — pertinent contre la fatigue notificationnelle.
- **Tips** : les mentions @ (§3.4) sont le principal déclencheur utile au quotidien — en faire un réflexe d'équipe.

### 3.12 Sièges & modèle de tarification
*Le prix suit la taille de l'organisation — pas une fonctionnalité verrouillée derrière un mur.*

- **Fonctionnalités** : palier gratuit jusqu'à 5 membres (bannière non bloquante) · grille prête : gratuit <5, 20 €/mois de 5 à 50, 100 €/mois au-delà — **codée mais non activée** (`ENTERPRISE_BILLING_ENFORCED = false`) · un non-paiement ne bloquerait que l'ajout de nouveaux membres, jamais l'accès aux données existantes.
- **Problèmes résolus** : modèle par siège simple et prévisible, évite la négociation « quelle fonctionnalité dans quel plan » · pas d'essai à activer/désactiver — le palier gratuit <5 EST l'essai en conditions réelles.
- **Marketing** : **le levier d'acquisition le plus direct disponible aujourd'hui** — tant que le kill-switch reste désactivé, on peut faire essayer le produit en entier à n'importe quelle organisation, sans mur de paiement · une fois la traction validée : « Gratuit jusqu'à 5 personnes, ensuite 20 €/mois pour toute l'équipe » — prix par organisation, pas par utilisateur, argument fort vs. concurrents facturant par siège · page pricing à créer en priorité.
- **Tips** : ne pas communiquer publiquement ces prix comme définitifs avant d'avoir tranché la date d'activation.

### 3.13 Sécurité & confidentialité par construction
*Pas une fonctionnalité qu'on montre — un argument de confiance qu'on prouve.*

- **Fonctionnalités** : cloisonnement appliqué au niveau base de données (pas seulement l'interface) via appartenance à l'organisation, rôle admin, position dans la pyramide · projets/OKR filtrés par équipe · droits distincts « voir l'agenda » / « voir les stats ».
- **Problèmes résolus** : répond par avance à la question DPO/RSSI systématique en cycle B2B (« un bug d'interface peut-il exposer les données d'un autre service ? » → non, structurellement) · sépare vie privée et pilotage managérial, évite l'effet « big brother ».
- **Marketing** : matière pour une page Sécurité/Confiance dédiée (quasi absente aujourd'hui, critère d'achat décisif dès 20-30 personnes) · argument sur le consentement RGPD explicite à l'entrée (§3.2).
- **Tips** : insister systématiquement sur « séparation vie perso/vie pro » — objection la plus fréquente à l'adoption côté salariés.

---

## 4. Diagnostic marketing actuel

Recherche exhaustive du mot « entreprise » dans la landing page et l'ensemble des pages marketing du dépôt : **zéro occurrence**. Le mode Entreprise n'existe, pour un visiteur extérieur, nulle part.

Ce que ça signifie concrètement :
- Aucun mot-clé SEO « logiciel gestion équipe », « OKR équipe », « pyramide managériale » n'est capté par aucune page — le trafic organique sur ces intentions va entièrement aux concurrents.
- Aucune preuve sociale (capture, cas d'usage, témoignage) ne montre le produit en contexte d'équipe.
- Aucun chemin de conversion dédié (pricing entreprise, formulaire démo, CTA « créer mon organisation ») n'existe.

**Conclusion la plus importante du rapport : le produit n'a pas de problème de fonctionnalités, il a un problème de visibilité.**

---

## 5. Stratégie d'acquisition proposée

### Personas prioritaires

| Persona | Douleur dominante | Brique qui répond | Canal probable |
|---|---|---|---|
| Dirigeant·e de PME (10-50 pers.) | Pas d'outil RH/pilotage, tout « dans la tête » | 3.1 Pyramide, 3.7 Statistiques | SEO « logiciel gestion équipe PME », bouche-à-oreille |
| Manager d'équipe remote/hybride | Perte de temps à synchroniser les dispos | 3.6 Agenda managérial | LinkedIn, contenu « remote work » |
| Responsable produit / COO | OKR morts après 3 semaines | 3.5 OKR d'équipe | SEO « OKR équipe », comparatifs |
| Fondateur d'agence / studio | Un projet par client, cloisonnement, facturation | 3.3 Équipes, 3.4 Projets, 3.12 Sièges | Communautés agences, SEO |

### Chantiers, par priorité

1. **Page `/entreprise` côté marketing (landing dédiée).** Hero avec l'écran de statistiques (3.7) comme preuve visuelle → 4-5 briques les plus vendeuses (pyramide, agenda managérial, OKR, revue hebdo) → section sécurité/confidentialité (3.13) → pricing (3.12) → CTA « créer mon organisation gratuitement ».
2. **Pages de cas d'usage par persona**, titrées sur la douleur plutôt que la fonctionnalité (« Arrêtez de demander qui est dispo » plutôt que « Agenda managérial »).
3. **Page pricing dédiée**, grille 3.12 telle quelle, avec l'argument implicite « pas de prix par personne — un prix par organisation ».
4. **Contenu SEO ciblé** : « OKR d'équipe : comment les rendre vivants », « Agenda managérial : voir le planning de son équipe sans lui demander », « Organigramme automatique : arrêter le tableur RH ».
5. **Preuve sociale** : dès les premières organisations réelles actives (au-delà de la démo « Nova Studio »), capturer témoignages courts et vrais chiffres d'usage.
6. **Activer la facturation seulement après traction** — laisser `ENTERPRISE_BILLING_ENFORCED` désactivé pendant toute la phase d'acquisition initiale, pour maximiser le taux de conversion « essai → usage réel » avant de parler prix.

> « Le produit vend déjà. Il lui manque juste une vitrine. »

---

## 6. Objections & FAQ de vente

**« Est-ce que mes employés vont se sentir surveillés ? »**
Non : le contenu des événements personnels reste privé, seul le créneau est visible d'un manager. La revue hebdo et les statistiques portent sur les tâches, jamais sur le contenu de l'agenda perso.

**« On a déjà Notion/Asana, pourquoi changer ? »**
COSMO fusionne ce que ces outils séparent : vue perso ET vue équipe dans un seul produit, avec pyramide, agenda managérial et OKR inclus — pas des modules payants séparément.

**« Combien ça va coûter avec 30 personnes ? »**
Un tarif fixe par organisation (20 €/mois), pas par utilisateur — contrairement à la majorité des outils du marché qui facturent par siège dès la première personne.

**« Un manager intermédiaire peut-il voir toute l'entreprise ? »**
Non : il ne voit que lui-même et son sous-arbre exact dans la pyramide, automatiquement — pas de configuration manuelle des permissions.

---

## 7. Points à approfondir

- **Date d'activation de la facturation** : nombre d'organisations réelles ou durée fixe avant d'activer `ENTERPRISE_BILLING_ENFORCED` ?
- **Sous-tâches, labels, jalons avancés** : chantier de schéma plus lourd déjà identifié en interne — à cadrer séparément avant d'en faire un argument marketing.
- **Événements d'entreprise partagés** : pas de modèle d'événement partagé à l'échelle de l'organisation aujourd'hui (uniquement événements personnels + tâches d'équipe datées) — à trancher si un futur argument « agenda d'entreprise » est souhaité.
- **Première organisation cliente réelle** : toute la preuve sociale dépend d'avoir au moins une organisation active au-delà de la démo interne « Nova Studio ».
- **Choix des 2-3 premiers mots-clés SEO** : à arbitrer avec la stratégie SEO globale déjà en cours, pour éviter la cannibalisation entre pages.
- **Ton de la page sécurité** : page « Sécurité » complète et technique (vente directe grande organisation) ou section intégrée à la landing (suffisante en libre-service) ?

---

## 8. Glossaire — du terme technique au terme grand public

| Terme dans le code | À dire à un prospect |
|---|---|
| `manager_id` / pyramide | Organigramme automatique |
| `org_teams` | Équipes / départements |
| `teamIds` cloisonnement | Confidentialité par équipe |
| `team_tasks` / kanban | Tâches d'équipe, projets |
| `weight` (KR) | Pondération des objectifs |
| `canSeeAgenda` / `canSeeInsights` | Droits managériaux |
| RLS (Row Level Security) | Cloisonnement des données au niveau base — « même en cas de bug d'affichage, les données restent séparées » |
| `ENTERPRISE_BILLING_ENFORCED` | Interrupteur de facturation (aujourd'hui : accès complet gratuit) |

---

*Rapport produit interne · COSMO 1.2 · Faits vérifiés dans le code source le 12 août 2026 — les paliers tarifaires et le calendrier restent à confirmer par Axel avant toute communication publique.*
