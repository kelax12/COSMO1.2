> ⚠️ **ARCHIVE : instantané daté, non maintenu.** Audit du mode Entreprise rédigé le 2026-09-24,
> annoté le **2026-09-26** avec l'état de réalisation relu dans le code de `main` après la fusion
> des branches `feat/entreprise-popups`, `claude/recommandations-mode-entreprise-swgi0u`,
> `claude/recommandations-mode-entreprise-do9du9`, `coherence/journal-181` et du travail
> interrompu de `.worktrees/entreprise-gov` (sauvé sur `wip/entreprise-gov-ui`).
> **Mise à jour du 2026-09-26 (après-midi)** : les 🔴 des onglets Tâches et OKR sont réalisés
> sur la branche `feat/entreprise-audit-rouges` (non fusionnée) ; les pastilles
> concernées portent la mention « branche `audit-rouges` ».
> Le code fait foi contre ce document. Sources vivantes : [`CLAUDE.md`](../../CLAUDE.md) ·
> [`faille.md`](../../faille.md) · [`docs/`](../README.md).

# Audit du mode Entreprise de COSMO : UI, UX, fonctionnalités et passage à l'échelle

## Légende de l'annotation (2026-09-26)

| Pastille | Sens |
|---|---|
| ✅ | Pleinement réalisé dans le code |
| 🟠 | Partiellement réalisé (ce qui manque est dit à côté) |
| 🔴 | Pas commencé |
| ⏳ `mig. N` | Livré dans le code, mais dépend d'une migration **écrite et non appliquée** en production |

**Migrations à appliquer, dans cet ordre, AVANT de déployer ce front** (relu au ledger le
2026-09-26 : la dernière appliquée est `180`) :

1. `164_entreprise_cas_limites` : équipes associées, purge d'un projet archivé, mode `transfer` du
   départ, `release_member_work`, notifications `project_archived` et `role_changed`.
2. `181_team_task_creation_journal` : la création d'une tâche entre au journal. Sans elle, le fil de
   l'Aperçu ne montre plus les créations.
3. `190` à `193` : rôles par projet et santé, chiffres serveur et recherche `search_org`, vues
   enregistrées, corbeille des objectifs.
4. `194_reconcile_164_190` : **écrite le 2026-09-26 pendant la fusion.** 164 et 190 redéfinissaient
   toutes deux `can_access_team_project`, `my_team_project_ids`, `member_departure_impact` et
   `offboard_org_member` : appliquée en second, chacune effaçait l'ajout de l'autre. 194 en fait
   l'union. Non prouvée en transaction annulée.

**Bilan** : sur les 14 faiblesses macro, 10 ✅, 4 🟠, 0 🔴 (M8 passe ✅ avec la branche `audit-rouges`). Les 4 problèmes critiques de la
synthèse : 3 ✅, 1 🟠 (M1, lectures côté serveur). Restent 🔴 surtout des fonctionnalités de
l'étape 6 classées « optionnelles » (capacité, champs personnalisés, automatisations,
intégrations, SSO) et quelques détails d'écran (lien hiérarchique secondaire, pastille de
visibilité, rubrique Sécurité). La colonne Assignés et les autres 🔴 de l'onglet Tâches sont
faits (branche `audit-rouges`).

**Méthode.** J'ai lu le code du mode Entreprise, soit environ 17 500 lignes : les 70 composants de
src/components/organization/, les modules organizations, org-teams, team-projects, team-okrs et
team-categories, ainsi que les migrations concernées. Je n'ai ouvert aucune session dans le
navigateur. Les constats visuels (espacements, contraste) viennent donc de la lecture du code, pas
d'une mesure à l'écran. Je n'ai modifié aucun fichier.

---

## ÉTAPE 1 · Analyse macro

### 1. Le modèle produit tel qu'il existe

| Concept | Ce qu'il est dans le code | Ce qui lui manque | État 2026-09-26 |
|---|---|---|---|
| Organisation | Nom, description, secteur, avatar, un propriétaire, des admins, un code permanent COSMO-XXXXXX | Paramètres propres à l'organisation (langue, fuseau, semaine de travail, règles par défaut) | 🔴 Toujours aucun réglage propre à l'organisation |
| Rôle stocké | admin ou member, rien d'autre | | |
| Manager | Rôle calculé : toute personne qui a au moins un subordonné dans la pyramide | Rien ne l'annonce à l'utilisateur | ✅ Toast « vous encadrez maintenant… », glossaire, info-bulle au premier affichage du rôle |
| Pyramide | Un seul manager_id par membre, 50 niveaux au plus. Ceux qui ne sont pas placés apparaissent à part | Pas de lien hiérarchique secondaire (organisation matricielle) | 🔴 |
| Équipe | org_teams : nom, couleur, membres, un ou plusieurs responsables (isLead). Équipes transverses | Pas de description, pas de page d'équipe, pas de liste de ses projets | ✅ Page d'équipe `/entreprise/teams/:id` avec description, responsables, projets, OKR, activité (mig. 163) |
| Projet | Nom, couleur, 0 ou 1 équipe, une catégorie, archivé ou non | Pas de responsable, de membres, de dates, de statut, de description, d'objectif | ✅ Responsable, dates, statut, santé, description (mig. 153) ; membres et rôles ⏳ mig. 190 ; plusieurs équipes ⏳ mig. 164 |
| Tâche d'équipe | Un seul projet, cinq statuts, plusieurs assignés, etc. | Étiquettes (mig. 093) et historique (mig. 094) sans interface | ✅ Étiquettes et onglet Historique dans la fiche de tâche |
| OKR d'équipe | 0 ou plusieurs équipes, KR à un assigné, poids, estimation | Aucun lien avec les projets ni les tâches | ✅ KR reliés à des projets, progression calculée par les tâches (mig. 160) |
| Catégorie d'entreprise | Arborescence transverse | Elle se gère depuis l'onglet OKR | ✅ Gestion dans Paramètres → Catégories ; l'onglet OKR ne fait plus que filtrer |
| Permissions | Dix droits pour toute l'organisation, surchargeables membre par membre | Aucun droit limité à un projet ou à une équipe | ✅ ⏳ mig. 190 : rôles par projet (co-pilote, contributeur, lecteur) |

**La hiérarchie réelle.** L'application superpose trois axes indépendants : les personnes rangées
par la pyramide, les personnes rangées par équipe, le travail rangé par projet puis par tâche.

Concepts implicites que l'utilisateur ne voit pas :

- ✅ « Manager » n'est jamais expliqué → toast à la première position de manager, glossaire,
  info-bulle `RoleTerm`.
- 🟠 Qui voit un projet ? → l'audience est chiffrée **à la création** (`NewTeamProjectModal`) et
  confirmée à chaque changement d'équipe ; aucune pastille permanente sur un projet existant (M12).
- 🟠 Un « projet d'organisation » est un projet sans équipe → rendu explicite à la création
  (« Visible par toute l'entreprise, soit N personnes ») ; reste une absence de valeur en base.
- ✅ Catégorie, projet, équipe, étiquette : quatre façons de classer → glossaire dans le produit.
- ✅ Responsable d'équipe et manager → glossaire, et M3 donne au responsable d'équipe les
  statistiques de son équipe.

### 2. Cohérence du modèle mental

| Question que se pose l'utilisateur | Constat de l'audit | État 2026-09-26 |
|---|---|---|
| « Où dois-je faire cette action ? » | Projet et équipe créés de 3 endroits, avec des résultats différents | ✅ Un seul formulaire de projet et un seul d'équipe (`org-create.context`), ouvrables de partout, même résultat |
| « Pourquoi cet élément est-il ici ? » | Catégories dans OKR, zone de danger dans Membres, facturation derrière une pastille | ✅ Section Paramètres : profil, catégories, rôles et permissions, notifications, forfait, invitations, journal d'audit, zone de danger |
| « Cette modification vaut-elle pour mon projet, mon équipe ou toute l'entreprise ? » | Changer l'équipe d'un projet ou supprimer une équipe change la visibilité sans rien dire | ✅ Confirmation qui nomme la nouvelle audience ; suppression d'équipe par modale d'impact (mig. 151) |
| « Qui peut voir ou modifier ceci ? » | Pas affiché ; droits par défaut très larges | 🟠 Droits grisés avec leur raison, « Mes droits » dans Paramètres, `deleteAny` retiré des défauts ; pas de pastille de visibilité permanente |
| « Quelle est la source de vérité ? » | Fil d'activité reconstruit à partir des tâches | ✅ ⏳ mig. 181 : le fil ne lit que le journal |

### 3. Workflows fondamentaux

| Workflow | Constat de l'audit | État 2026-09-26 |
|---|---|---|
| Créer une équipe | Trois points d'entrée, ni description ni responsable à la création | 🟠 Un seul formulaire, responsable choisi à la création ; la description se saisit sur la page d'équipe, pas à la création |
| Inviter un utilisateur | Pas d'invitation par e-mail | ✅ Invitation par e-mail (liste collée, placement, équipes, accès borné, relance), Edge Function `send-org-invite` déployée |
| Gérer les membres | Recherche seule, sans filtre ni action groupée ni export | ✅ Filtres (équipe, rôle, manager, non placé, arrivée), actions groupées, export CSV, dernière activité |
| Créer un projet | Modale correcte, projet trop pauvre | ✅ |
| Affecter une équipe à un projet | Une seule équipe par projet | ✅ ⏳ mig. 164 : équipes associées |
| Affecter des personnes à un projet | La notion n'existe pas | ✅ ⏳ mig. 190 : membres et rôles de projet |
| Mener plusieurs projets de front | Pas de portefeuille | ✅ Portefeuille (santé, dates, responsable, tri, recherche) |
| Suivre l'avancement | Pas de jalons, de santé, de lien OKR | ✅ Jalons, santé déclarée (⏳ mig. 190), KR reliés aux projets |
| Gérer les responsabilités | Personne n'est responsable d'un projet ; KR à un seul assigné | 🟠 Responsable et co-pilotes de projet ; KR toujours à un seul assigné dans l'interface |
| Gérer les permissions | Jamais par projet | ✅ ⏳ mig. 190 |
| Gérer la charge | Pas de capacité | 🟠 Charge comptée en base (⏳ mig. 191) et calque de charge dans la pyramide ; pas de capacité par personne |
| Naviguer entre projets | Pas de page, d'URL, de favoris, de récents | ✅ Page projet, URL d'objet, Épinglés et Récents |
| Retrouver une information | Pas de recherche globale | ✅ ⏳ mig. 191 : Ctrl+K sur `search_org` |
| Suivre les changements | Journal visible seulement dans la revue ; aucun historique par tâche | ✅ Historique par tâche, historique par membre, journal d'audit dans Paramètres |
| Gérer les dépendances | Rien entre projets | ✅ Dépendances entre projets et jalons (mig. 153) |
| Administrer | Réglages éparpillés, aucun journal d'audit | ✅ Paramètres + journal d'audit (filtres, pagination, export CSV) |
| Départ d'un collaborateur | Retrait immédiat, rien n'est transféré | ✅ Assistant de départ (mig. 161), mode `transfer` ⏳ mig. 164 |

### 4. Passage à l'échelle

| Lecture | Plafond constaté | État 2026-09-26 |
|---|---|---|
| Membres | 500 | 🔴 Toujours 500 ; ce sont désormais les plus récents qui restent (`reverse`), mais les suivants restent invisibles |
| Projets | 200, les plus récents disparaissaient | ✅ Lecture paginée, tri décroissant, plafond porté à 5 000 |
| Tâches | 1 000, extrait tous projets confondus | 🟠 « Mes tâches » lues filtrées côté serveur ; onglet Tâches paginé (« Charger plus », ⏳ mig. 191) ; Statistiques toujours calculées dans le navigateur sur un ensemble de travail |
| OKR, équipes | 200 | 🟠 OKR en lecture paginée ; équipes toujours plafonnées à 200 |
| Journal d'activité | 500 sur la période | ✅ Journal d'audit paginé par curseur |

| Élément à 1 000 personnes | Constat | État 2026-09-26 |
|---|---|---|
| Puces de projets (onglet Tâches) | 500 puces à la suite | 🟠 12 puces puis « +N projets » ; le filtre de projet est aussi dans la barre de filtres ; pas de sélecteur avec recherche dédié |
| Tableau des tâches | 1 000 lignes sans virtualisation ni pagination | ✅ Pagination serveur et tableau virtualisé (`useWindowVirtualizer`, branche `audit-rouges`) |
| Sélecteurs de membres | Sans recherche | ✅ `MemberPickList` : recherche, groupes d'équipe, tranches de 50 |
| Liste des équipes | 100 cartes au-dessus de l'annuaire | ✅ Section Équipes à part, recherche, six cartes puis « voir plus » |
| Pyramide | Arbre de 1 000 nœuds sans replier | ✅ Branches repliées à grande échelle, recherche |
| Statistiques | Calculées sur l'extrait | 🟠 Chiffres des projets et charge comptés en base (⏳ mig. 191) ; onglet Statistiques encore calculé dans le navigateur |
| Notifications | Quatre types, application seulement | ✅ Neuf types, préférences par type et par canal, résumé e-mail (`org-digest` déployée) |
| Droits | Tout membre supprime définitivement n'importe quelle tâche | ✅ Corbeille de 30 jours, `deleteAny` réservé aux managers |

### 5. Faiblesses macro

#### M1 · Les données sont chargées en entier dans le navigateur, avec des plafonds (Critique) · 🟠

Pourquoi c'est un problème : ce n'est pas une limite d'affichage, c'est une limite de vérité.
Solution proposée :

1. ✅ Lectures filtrées côté serveur, l'Aperçu ne lit que MES tâches ouvertes (`get_my_team_tasks`,
   `useTeamTaskSlice`), pagination de l'onglet Tâches (⏳ mig. 191).
2. 🟠 Agrégats par RPC : avancement des projets et charge des membres comptés en base
   (⏳ mig. 191) ; l'onglet Statistiques calcule encore dans le navigateur.
3. ✅ Projets triés du plus récent, paginés, archivés inclus sur demande.
4. ✅ Sélecteurs de membres avec recherche (seuil 8, pas 50). La recherche reste locale ;
   l'annuaire reste plafonné à 500 membres.
5. ✅ Virtualisation du tableau (`TeamTasksTable`, branche `audit-rouges`).

#### M2 · Le projet n'est pas un véritable objet (Critique pour le multi-projets) · ✅

`owner_id`, description, `start_date`, `target_date`, statut, santé déclarée avec note (mig. 153 ;
santé et notification `project_at_risk` ⏳ mig. 190), `team_project_members` (⏳ mig. 190) et
équipes associées (⏳ mig. 164). Page projet `/entreprise/projects/:id` : vue d'ensemble, tâches,
frise, membres et rôles, jalons, dépendances, activité.

#### M3 · Deux structures de personnes qui donnent des pouvoirs différents (Haute) · ✅

Les statistiques se filtrent par périmètre : hiérarchie (managers, admins), équipe (responsables
d'équipe, même sans subordonné), projet. « Pourquoi je vois ceci ? » explique la règle. Repris le
2026-09-26 du travail interrompu de la branche gouvernance (`stats-scope.helpers.ts`).

#### M4 · La gouvernance ne tient pas quand l'organisation grandit (Critique) · ✅

1. ✅ Suppression douce et corbeille de 30 jours, restaurable (mig. 152) ; suppression définitive
   réservée à l'admin (⏳ mig. 193).
2. ✅ `task.deleteAny` n'est plus un droit par défaut du membre.
3. ✅ ⏳ mig. 190 : droits par projet (co-pilote, contributeur, lecteur).
4. ✅ « Annuler » restaure la tâche d'origine depuis la corbeille, avec ses commentaires,
   sous-tâches et dépendances, au lieu d'en recréer une.

#### M5 · Supprimer une équipe rend ses projets et ses OKR visibles par toute l'entreprise (Critique) · ✅

Trigger `BEFORE DELETE` et modale d'impact qui fait réaffecter ou archiver (mig. 151, appliquée).
Confirmation qui nomme la nouvelle audience quand on change l'équipe d'un projet.

#### M6 · Les onglets Tâches et Projets présentent les mêmes tâches avec deux logiques (Haute) · 🟠

- ✅ Une barre de filtres unique (`OrgTaskFilterBar`), filtres dans l'URL, vues enregistrées
  (⏳ mig. 192), actions groupées dans toutes les vues.
- ✅ Projets devient un portefeuille qui mène à la page projet.
- 🟠 La barre filtre par projet, équipe, assigné, statut et texte ; ✅ priorité, plage
  d'échéance, catégorie et étiquette dans l'onglet Tâches (`TaskAttributeFilters`, branche
  `audit-rouges`). Tâches et Projets restent deux onglets, pas un seul espace Travail.

#### M7 · Aucune recherche ni navigation par objet (Haute) · ✅

Ctrl+K sur `search_org` (projets, jalons, tâches, OKR, KR, membres, équipes, ⏳ mig. 191).
`?task=`, `?project=`, `?okr=`, `?member=`, `?team=` ouvrent leur fiche depuis n'importe quelle
section. Épinglés et Récents dans le panneau de droite.

#### M8 · Des capacités déjà construites mais invisibles (Moyenne à haute) · ✅

- ✅ Étiquettes : champ de la fiche de tâche, et filtre par étiquette dans l'onglet Tâches
  (branche `audit-rouges`, lecture de `team_task_labels` par `label_id`, sans migration).
- ✅ Historique par tâche : onglet Historique.
- ✅ Statut de flux en tête de la fiche de tâche.

#### M9 · Les OKR sont coupés de l'exécution (Haute) · ✅

KR reliés à des projets et progression calculée par leurs tâches terminées, cycles
d'organisation (filtre et gestion), points d'étape datés (valeur, confiance, commentaire),
états « à risque » et « en retard », objectif parent (mig. 160).

#### M10 · Le cycle de vie des membres s'arrête à « retirer » (Haute) · ✅

Assistant de départ (tâches, subordonnés, rôles de responsable, projets portés, KR), suspension,
invités à accès borné (mig. 161). Transmettre sans partir et libération des assignations
fantômes ⏳ mig. 164 (+ 194).

#### M11 · Pas d'invitation par e-mail (Haute pour l'adoption) · ✅

Liste collée, placement dans la pyramide, équipes, accès borné, relances ; Edge Function
`send-org-invite` déployée le 2026-09-25.

#### M12 · La visibilité ne s'affiche nulle part (Haute) · 🟠

- ✅ À la création d'un projet : audience explicite et chiffrée, plus de valeur implicite.
- ✅ Changement d'équipe : la nouvelle audience est nommée.
- 🔴 Pas de pastille « Visible : équipe Produit + hiérarchie · 14 personnes » cliquable sur un
  projet ou un OKR existant.

#### M13 · Des réglages mal rangés (Moyenne) · 🟠

Section Paramètres : ✅ profil édité sur place, ✅ catégories, ✅ rôles et permissions, ✅ mes
droits, ✅ notifications, ✅ forfait (lien vers Facturation), ✅ invitations, ✅ journal d'audit
(⏳ mig. 190 pour ses nouvelles familles), ✅ zone de danger. 🔴 Pas de rubrique Sécurité.

#### M14 · Des notifications trop pauvres (Moyenne) · ✅

Nouveaux types (changement de statut, levée d'un blocage, projet à risque, échéance de KR,
créneau posé, projet archivé et changement de position ⏳ mig. 164), préférences par type et par
canal (application, e-mail, résumé quotidien), suivre une tâche ou un projet, cloche filtrable.

**Dépendances entre problèmes** : M1 et M2 sont à la racine.

---

## ÉTAPE 2 · Page par page

### Navigation générale

| Problème | Gravité | Solution proposée | État 2026-09-26 |
|---|---|---|---|
| Aucune recherche globale | Haute | Palette Ctrl+K (M7) | ✅ ⏳ mig. 191 |
| Sections qui apparaissent sans prévenir | Moyenne | Toast une seule fois | ✅ |
| Pas de favoris ni de récents | Moyenne | Groupe « Épinglés » | ✅ |
| Réglages éparpillés | Moyenne | Section Paramètres (M13) | ✅ (rubrique Sécurité absente, cf. M13) |
| Bandeau de lancement mort | Faible | Supprimer | ✅ |

### Aperçu (`/entreprise`)

| Problème | Gravité | Solution proposée | État 2026-09-26 |
|---|---|---|---|
| Lit toute l'organisation pour afficher mes tâches | Critique | RPC `get_my_team_tasks` | ✅ |
| Agenda masqué quand je n'ai pas de tâche | Moyenne | Sortir la carte de la branche | ✅ |
| Fil d'activité reconstruit | Moyenne | Lire `team_task_activity` | ✅ ⏳ mig. 181 |
| `isManager={isAdmin}` | Faible | Même `isManager` partout | ✅ |
| Pas de « En attente de moi » | Haute | Bloc revue, mentions, dépendances | ✅ |

Fonctionnalités manquantes : ✅ Aujourd'hui / cette semaine, ✅ « Je bloque quelqu'un »,
✅ Mes projets, ✅ Mes KR.

### Tâches (`/entreprise/tasks`)

| Problème | Gravité | Solution proposée | État 2026-09-26 |
|---|---|---|---|
| Puces de projets sans limite | Haute | Sélecteur avec recherche, 5 épinglés | 🟠 12 puces puis « +N » ; pas de sélecteur avec recherche |
| Pas de filtre par assigné ni « moi » | Haute | Barre de filtres unifiée | ✅ |
| Création rapide d'un projet visible par tous | Haute | Ouvrir le vrai formulaire | ✅ |
| Actions montrées sans en avoir le droit | Moyenne | Griser avec explication | ✅ |
| Pas de colonne Assignés, et je n'y figure pas | Moyenne | Colonne avec « Vous » | ✅ Colonne Assignés, « Vous » en toutes lettres (branche `audit-rouges`) |
| Pas d'actions groupées | Haute | Barre groupée | ✅ Statut, assignés, échéance, priorité, projet, suppression |
| Filtres non enregistrés | Moyenne | URL et vues enregistrées | ✅ ⏳ mig. 192 pour les vues |

Fonctionnalités manquantes : ✅ filtres assigné, « moi », équipe. Branche `audit-rouges` :
✅ priorité, plage d'échéance, catégorie, étiquette ; ✅ colonnes configurables (préférence
locale) ; ✅ regroupement (projet, statut, assigné, priorité) ; ✅ export CSV des tâches
affichées ; ✅ édition en ligne de l'échéance et de la priorité.

### Projets (`/entreprise/projects`)

| Problème | Gravité | Solution proposée | État 2026-09-26 |
|---|---|---|---|
| Aucun objet projet riche ni page projet | Critique | M2 | ✅ |
| Changement d'équipe silencieux | Haute | Confirmation qui nomme l'audience | ✅ |
| Archivage sans filet | Moyenne | Toast d'annulation | ✅ |
| Couleur écrasée par la catégorie | Faible | Garder la couleur du projet | ✅ |
| Actions groupées limitées | Haute | Étendre à toutes les vues | ✅ Tâches dans toutes les vues ; projets en lot dans le portefeuille |
| « + » kanban vers le premier projet | Moyenne | Demander le projet | ✅ |
| Création non transactionnelle | Moyenne | RPC `create_project_with_tasks` | ✅ `create_team_project_with_tasks` |
| Frise sans date de début | Haute | `start_date` | ✅ |

Fonctionnalités : ✅ trier et chercher, ✅ dupliquer et modèles, ✅ jalons, ✅ frise sur dates
de début et de fin, ✅ dépendances entre projets.

### OKR (`/entreprise/okr`)

| Problème | Gravité | Solution proposée | État 2026-09-26 |
|---|---|---|---|
| OKR coupés de l'exécution | Haute | M9 | ✅ |
| Pas d'alignement entre OKR | Haute | `parent_okr_id` et vue en arbre | 🟠 Objectif parent et nombre d'objectifs contributeurs sur la carte ; pas de vue en arbre |
| Catégories gérées ici | Moyenne | Paramètres → Catégories | ✅ |
| `window.confirm` | Faible | ConfirmDialog partagé | ✅ Suppression en corbeille (⏳ mig. 193) |
| Pas de cycles | Moyenne | `okr_cycles` | ✅ |

Fonctionnalités : ✅ cycles, ✅ points d'étape avec confiance, ✅ états « à risque », ✅ lien KR
vers projets, ✅ KR à plusieurs contributeurs (`KRContributorsField`, branche `audit-rouges`),
✅ alignement parent, ✅ historique des points d'étape. Filtres : ✅ catégorie et cycle ;
✅ équipe, porteur (responsable ou contributeur d'un KR) et état, dans l'URL (branche
`audit-rouges`). Trouvé en chemin et corrigé : modifier un objectif remettait à NULL le
responsable et à 30 min la durée de chacun de ses KR (la fiche ne renvoyait pas ces champs).

### Statistiques (`/entreprise/stats`)

| Problème | Gravité | Solution proposée | État 2026-09-26 |
|---|---|---|---|
| Calcul sur des données tronquées | Critique | Agrégats serveur | 🟠 Ensemble de travail borné ; agrégats serveur seulement pour projets et charge |
| Pas de filtre par équipe ni par projet | Haute | Filtres portée · équipe · projet | ✅ |
| Accès réservé à la hiérarchie | Haute | M3 | ✅ |
| Pas de charge au regard d'une capacité | Moyenne | Capacité hebdomadaire | 🔴 |

### Pyramide (`/entreprise/pyramid`)

| Problème | Gravité | Solution proposée | État 2026-09-26 |
|---|---|---|---|
| Un seul manager | Moyenne | Lien secondaire en pointillé | 🔴 |
| Pas de replier par branche ni de mini-carte | Haute (grandes org.) | Branches repliées, « centrer sur… » | 🟠 Branches repliables et repliées à grande échelle, recherche qui amène la carte à l'écran ; pas de mini-carte |
| Glisser-déposer seul pour les grands déplacements | Moyenne | « Déplacer la sélection sous… » | ✅ Depuis l'annuaire : sélection multiple puis « Changer de manager » |

### Membres (`/entreprise/members`)

| Problème | Gravité | Solution proposée | État 2026-09-26 |
|---|---|---|---|
| Quatre sujets sur une page | Haute | Personnes · Équipes · Paramètres | ✅ |
| Suppression d'une équipe qui ouvre ses projets | Critique | Modale d'impact et trigger | ✅ |
| Pas de page d'équipe | Haute | `/entreprise/teams/:id` | ✅ |
| Sélecteurs sans recherche | Haute | Combobox avec recherche | ✅ |
| Couleur d'équipe ignorée, chaîne en dur | Faible | `team.color`, `tp()` | ✅ |
| Pas de transfert au départ | Haute | Assistant de départ | ✅ |

Fonctionnalités : ✅ filtres de l'annuaire, ✅ actions groupées (équipe, manager, suspension),
✅ export CSV, ✅ dernière activité (mig. 170), ✅ page d'équipe, ✅ invitation par e-mail.

### Facturation (`/entreprise/billing`) · ✅

Sièges consommés, historique des factures, contact de facturation distinct (mig. 180), lien
depuis Paramètres.

### Onboarding · ✅

Assistant de démarrage après la création : organisation, invitations par e-mail, première
équipe, premier projet depuis un modèle.

---

## ÉTAPE 3 · Popups, modales, feuilles et menus

| Élément | Problèmes relevés | État 2026-09-26 |
|---|---|---|
| TeamTaskModal | Statut absent ; tâche enregistrée en silence au premier commentaire ; sous-tâches et dépendances en édition seulement ; ni étiquettes ni historique ; création de projet intégrée sans équipe ; assignés sans recherche | ✅ Statut en tête, « Créer et commenter » explicite, onglets Détails · Sous-tâches · Dépendances · Historique dès la création, étiquettes, recherche des assignés. La création de projet ouvre le formulaire complet au lieu d'un champ « nom seul » |
| NewTeamProjectModal | Ni responsable, ni dates, ni description, ni modèle ; visibilité implicite | ✅ |
| CreateTeamModal | Ni responsable ni description ; sélecteur non paginé | 🟠 Responsable et recherche ✅ ; description absente à la création |
| AssignMembersDialog | Pas de recherche ni de groupes | ✅ |
| AssignEventDialog | La personne n'est ni prévenue ni libre de refuser | ✅ |
| AssignTaskSheet | Premier projet par défaut | ✅ |
| TeamOKRModal | Crée une équipe ; ni cycle, ni parent, ni projets | ✅ |
| MemberSheet | Pas d'onglet Équipes et projets ni Historique | ✅ |
| MemberPermissionsSheet | N'affiche pas l'effet ; droits pour toute l'organisation | ✅ Aperçu de l'effet et portée dite ; droits par projet sur la page projet (⏳ mig. 190) |
| Placement (3 feuilles) | Trois feuilles pour un geste | ✅ `PyramidPlacementSheet` |
| WeeklyReviewSheet | Limitée au sous-arbre, non enregistrée | ✅ Par équipe ou projet, enregistrée, historique |
| OrgProfileSheet | À déplacer dans Paramètres | ✅ Profil édité dans Paramètres |
| TransferOwnershipDialog | Ne dit rien de la facturation | ✅ |
| DeleteOrganizationDialog | Exemplaire | ✅ (inchangé) |
| ConfirmLeaveOrgDialog · retrait d'un membre | N'annoncent pas l'impact | ✅ Impact chiffré ; retrait toujours par l'assistant de départ |
| Suppression d'équipe, d'OKR | `window.confirm` natif | ✅ Modale d'impact (équipe), corbeille (OKR) ; garde `org-confirm.guard` |
| OrgNotificationsBell | Ni filtre, ni préférences, ni « suivre » | ✅ |
| OrgTabBadge | Seuls Projets et Membres ont un compteur | ✅ Tâches, OKR, Pyramide comptent aussi leurs notifications |
| BulkActionsBar | Trois actions, vue liste seulement | ✅ |
| Menus « … » | Actions sans droit affichées | ✅ Grisées avec leur raison |

Incohérence transversale (trois styles de confirmation, deux styles d'annulation) : ✅ trois
niveaux (réversible : toast « Annuler » ; lourd : `OrgConfirmDialog` avec impact ; destructeur :
saisie du nom), « Annuler » aussi sur les équipes et les projets.

---

## ÉTAPE 4 · Cas limites

| Cas | Constat | État 2026-09-26 |
|---|---|---|
| Une personne dans plusieurs équipes | ✅ | ✅ |
| Une personne sur plusieurs projets | « Mes projets » jamais affiché | ✅ Mes projets (Aperçu, bascule dans Projets) |
| Changement d'équipe | Perte de visibilité sans prévenir | ✅ Les projets perdus sont nommés avant (⏳ mig. 164 pour les équipes associées) |
| Projet mené par plusieurs équipes | Une seule `team_id` | ✅ ⏳ mig. 164 |
| Projet archivé | Assignés non prévenus | ✅ ⏳ mig. 164 |
| Projet supprimé | Rien ne purge proprement | ✅ ⏳ mig. 164 (purge d'un projet archivé, nom à saisir) |
| Équipe supprimée | Projets et OKR ouverts à tous | ✅ |
| Utilisateur supprimé | Assignations fantômes | ✅ ⏳ mig. 164 (`release_member_work`) |
| Utilisateur désactivé | L'état n'existe pas | ✅ Suspension |
| Permissions contradictoires | Règle invisible | ✅ « Mes droits » dit le droit effectif et sa source |
| Changement de rôle | Silencieux | ✅ Confirmé ; la personne est prévenue ⏳ mig. 164 |
| Projet avec 200 membres | Sélecteurs sans recherche | ✅ |
| Entreprise avec 500 projets | Plafond de 200 | ✅ |
| Données manquantes | ✅ | ✅ |
| Utilisateur sans permission | Affiché puis refusé | ✅ |
| Accès temporaire | Ni invité ni expiration | ✅ |
| Transfert de responsabilité | Propriété seulement | ✅ Assistant en mode transfert ⏳ mig. 164 + 194 |
| Changement de configuration en masse | Aucune action groupée | ✅ Membres, projets, équipes |
| Actions irréversibles | Suppression définitive par tout membre | ✅ Corbeille |
| Réglage global contre réglage local | Sans objet | Sans objet ; seuls les rôles par projet (⏳ mig. 190) introduisent un réglage local |

---

## ÉTAPE 5 · Cohérence globale

| Axe | Règle cible | État 2026-09-26 |
|---|---|---|
| Terminologie | Glossaire et info-bulle au premier affichage de chaque rôle | ✅ |
| Création | Un seul formulaire par objet, ouvrable de partout | ✅ |
| Filtres | Barre unique, filtres dans l'URL | ✅ |
| Actions groupées | Partout où il y a une liste de tâches | ✅ |
| Confirmations | Trois niveaux | ✅ |
| Droits | Toujours `can[...]`, griser avec une explication | ✅ |
| Liens profonds | Toute URL d'objet ouvre sa fiche de partout | ✅ |
| Couleurs | La couleur de l'objet est celle choisie | ✅ |
| Journal d'activité | Une seule source, le journal | ✅ ⏳ mig. 181 |
| i18n | Tout passe par `tp` | ✅ |

---

## ÉTAPE 6 · Fonctionnalités manquantes justifiées

| Fonctionnalité | Priorité | État 2026-09-26 |
|---|---|---|
| Page projet riche (responsable, dates, santé, membres) | Essentielle | ✅ ⏳ mig. 190 pour santé et membres |
| Lectures côté serveur et pagination | Essentielle | 🟠 cf. M1 |
| Recherche globale (Ctrl+K) | Essentielle | ✅ ⏳ mig. 191 |
| Corbeille et suppression douce | Essentielle | ✅ Tâches (mig. 152) et objectifs (⏳ mig. 193) |
| Assistant de départ, suspension | Essentielle | ✅ |
| Invitation par e-mail | Essentielle | ✅ |
| Droits par projet (responsable, contributeur, lecteur) | Essentielle à terme | ✅ ⏳ mig. 190 |
| Vues enregistrées | Importante | ✅ ⏳ mig. 192 |
| Lien OKR vers projets, cycles, points d'étape | Importante | ✅ |
| Modèles de projet | Importante | ✅ |
| Dépendances entre projets et jalons | Importante | ✅ |
| Journal d'audit de l'organisation | Importante | ✅ (familles étendues ⏳ mig. 190) |
| Préférences de notification, suivre un objet, résumé par e-mail | Importante | ✅ |
| Capacité et charge planifiée | Optionnelle | 🟠 Charge comptée en base (⏳ mig. 191) ; aucune capacité par membre |
| Champs personnalisés et statuts de flux par projet | Optionnelle | 🔴 |
| Automatisations simples | Optionnelle | 🔴 (seul le rappel de retard de la mig. 096 existe) |
| Intégrations (Slack, calendrier, export CSV complet) | Optionnelle | 🔴 Pas de webhook ; exports CSV partiels (annuaire, statistiques, journal d'audit) |
| SSO/SAML, SCIM, domaine vérifié | Optionnelle | 🔴 |

---

## SYNTHÈSE

### 1. Problèmes critiques

1. 🟠 Chargement complet des données dans le navigateur, avec des plafonds (M1).
2. ✅ Supprimer une équipe rendait ses projets et ses OKR visibles par toute l'entreprise (M5).
3. ✅ Tout membre pouvait supprimer définitivement n'importe quelle tâche (M4).
4. ✅ Le projet n'était pas un véritable objet (M2).

### 2. Problèmes importants

- 🟠 Onglets Tâches et Projets qui se concurrencent (M6 ; filtres complets dans Tâches) · ✅ recherche globale et page par objet (M7).
- ✅ Pyramide et équipes, statistiques des responsables d'équipe (M3).
- ✅ OKR liés à l'exécution (M9) · ✅ processus de départ (M10) · ✅ invitation par e-mail (M11).
- 🟠 Visibilité (M12) · ✅ création rapide d'un projet visible par tous.
- ✅ Modale de tâche (statut, création explicite, étiquettes, historique).
- ✅ Sélecteurs avec recherche · ✅ page Membres découpée · 🟠 réglages (Sécurité absente).

### 3. Opportunités

- ✅ Simplicité : un seul formulaire par objet, une barre de filtres unique, trois niveaux de confirmation.
- ✅ Puissance : vues enregistrées, actions groupées partout, modèles de projet, lien OKR vers projets.
- ✅ Productivité : Ctrl+K, « En attente de moi », suivre un objet, résumé quotidien.
- 🟠 Passage à l'échelle : RPC paginées et agrégées (partiel), ✅ virtualisation (branche `audit-rouges`), ✅ branches repliables.
- 🟠 Compréhension : 🔴 pastille de visibilité, ✅ glossaire des rôles, ✅ toast quand on devient manager.
- ✅ Collaboration : page d'équipe, planification dans l'agenda avec accord, revue hebdomadaire par équipe.
- ✅ Déjà construit, à exposer : ✅ historique par tâche, ✅ journal de l'organisation, ✅ étiquettes (filtre, branche `audit-rouges`).

### 4. Vision cible

Navigation idéale :

- ✅ Moi : Aperçu, Mes tâches, Mes projets.
- 🟠 Travail : ✅ portefeuille, 🟠 espace Travail (tableau, kanban, frise dans Projets ; Tâches reste à part), ✅ Objectifs.
- ✅ Organisation : Personnes, Équipes, Pyramide, Statistiques.
- 🟠 Paramètres : ✅ Profil, Catégories, Permissions, Facturation (lien), Journal d'audit, Zone de danger ; 🔴 Sécurité.
- ✅ Plus : Ctrl+K partout, Épinglés et Récents.

Workflows clés : ✅ Démarrer · ✅ Planifier · ✅ Exécuter · ✅ Piloter · ✅ Faire évoluer.

Ordre de traitement conseillé : ✅ M5 · ✅ M4 · 🟠 M1 · ✅ M2 · 🟠 M6 et ✅ M7 · le reste.

---

## Annexe · Fusion du 2026-09-26

| Source | Contenu | Commit de fusion sur `main` |
|---|---|---|
| `feat/entreprise-popups` | Étape 3 (popups) | `Merge feat/entreprise-popups` |
| `claude/recommandations-mode-entreprise-swgi0u` | Étapes 3 et 4, mig. 164 | `Merge …-swgi0u` |
| `claude/recommandations-mode-entreprise-do9du9` | Étape 6, mig. 190 à 193 ; + mig. 194 écrite à la fusion | `Merge …-do9du9` |
| `coherence/journal-181` | Étape 5, axe journal, mig. 181 | `Merge coherence/journal-181` |
| `wip/entreprise-gov-ui` (travail non commité de `.worktrees/entreprise-gov`) | M3 statistiques par périmètre, M13 catégories et permissions dans Paramètres | `feat(entreprise): reprise du travail interrompu…` |
| `feat/entreprise-audit` | Première ébauche (mig. 151 à 155 numérotées autrement) | Non fusionnée : entièrement remplacée par les branches gouvernance, portefeuille et membres, déjà sur `main` |
| `feat/entreprise-assistant-demarrage` | Assistant de démarrage | Déjà sur `main` sous d'autres SHA (`926d403c`, `24356b15`) |

Budget de bundle mesuré avec `VITE_SENTRY_DSN` posée, contre `main` (`988e1e89`) : `TeamTaskModal`
ramené sous son plafond (14,4 ko pour 14,5). Restent au-dessus de leur plafond, **et l'étaient déjà
sur `main`** : entrée (71,4 → 71,9 ko pour 71,0), catalogue `org` (34,6 → 37,3 ko pour 30,0),
`legal` (18,5 ko, inchangé), `OrganizationPage` (18,0 → 18,2 ko pour 18,0).
