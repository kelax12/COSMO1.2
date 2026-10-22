# Guide entreprise : assistant d'actions et tutoriels pilotés par curseur

Date : 2026-10-12 · Statut : spec validée par Axel (questions et maquettes du 2026-10-12), plan d'implémentation à écrire.

## 1. Intention

Un guide toujours disponible en mode entreprise. On l'ouvre par un bouton flottant. Il présente un
catalogue d'actions (« Créer un projet », « Modifier un rôle »…) rangées par catégorie. Un clic sur
une action lance une démo : un curseur dédié navigue jusqu'au bon écran, ouvre le formulaire, puis
présente 2 ou 3 champs clés dans une bulle avant de rendre la main.

Il **complète** l'onboarding constellation (2026-10-03), qui reste l'accueil et renvoie vers ce guide
en fin de parcours. Il ne remplace pas les `PageTutorial` des pages perso.

## 2. Décisions arrêtées

| Sujet | Décision |
|---|---|
| Ouverture | Bouton flottant seul, en bas à droite, visible sur toutes les sections entreprise |
| Panneau | Tiroir latéral droit, recherche simple en tête, 4 catégories repliables |
| Démo | **Automatique** : le curseur clique et navigue tout seul |
| Données | **Aucune écriture, aucun pré-remplissage** : la démo s'arrête formulaire ouvert et vide |
| Fin | Bulle sur 2 à 3 champs clés, puis l'utilisateur reprend la main, formulaire ouvert |
| Pendant la démo | Barre Pause / Passer / Quitter ; le reste de l'écran ne réagit pas aux clics |
| Droit manquant | Action grisée avec badge, carte explicative + « Voir les admins » au clic |
| Progression | Aucune (pas de cases cochées, pas de pourcentage) |
| Recherche | Filtre local sur libellés + synonymes, pas d'IA |
| Périmètre v1 | Desktop, mode démo inclus, fr + en. **Pas de mobile** : bouton flottant masqué sous 768 px |
| Contenu | Les 30 actions de la section 6, toutes retenues |

## 3. Architecture

Réutiliser le moteur de tutoriel existant plutôt qu'en créer un second.

- `src/components/tutorial/` porte déjà le spotlight, les cartes, les actions `click` / `custom`, le
  z-index `500` et les clés i18n `tutorials`. Le guide y ajoute **un mode « scénario »** : le curseur
  animé, les étapes de navigation entre sections et la barre de contrôle.
- Nouveau dossier `src/components/org-guide/` :
  - `OrgGuideFab.tsx` : bouton flottant (lazy, monté dans `OrganizationPage` seulement).
  - `OrgGuideDrawer.tsx` : tiroir, recherche, catégories, état des droits.
  - `GuideCursor.tsx` : curseur SVG violet à contour blanc, déplacement Framer Motion (pas GSAP, hors landing).
  - `GuideControlBar.tsx` : Pause / Passer / Quitter, étape `n/N`.
  - `guide-runner.ts` : exécute un scénario, logique pure testable (attente de cible, délais, annulation).
  - `scenarios/*.ts` : un fichier par catégorie, données seulement.
- Ancrages : attribut **`data-guide-id`** posé sur chaque cible. Jamais de sélecteur de classe
  Tailwind, jamais de texte. Ne pas réutiliser `data-tutorial-id` (propre aux `PageTutorial`).
- Navigation entre sections : par le deep-link existant (`deep-link.helpers.ts`, `org-sections.ts`),
  pas par un faux clic dans la sidebar quand la section n'est pas visible. Le curseur **montre** le
  lien de la sidebar puis la navigation se fait par le routeur, pour rester robuste.

### Format d'un scénario

```ts
interface GuideAction {
  id: string;                         // 'project.create'
  category: 'work' | 'people' | 'roles' | 'steer';
  labelKey: KeyOf<'orgGuide'>;
  synonymsKey: KeyOf<'orgGuide'>;     // liste séparée par virgules, traduite
  requires?: OrgPermissionKey | 'admin' | 'manager';
  steps: GuideStep[];
}

type GuideStep =
  | { kind: 'goto'; section: OrgSection; via: string /* data-guide-id du lien */ }
  | { kind: 'click'; target: string; bubbleKey?: KeyOf<'orgGuide'> }
  | { kind: 'field'; target: string; bubbleKey: KeyOf<'orgGuide'> }   // survol + bulle, pas de saisie
  | { kind: 'pick-first'; target: string; bubbleKey?: KeyOf<'orgGuide'> } // ouvre le 1er élément d'une liste
  | { kind: 'handoff'; bubbleKey: KeyOf<'orgGuide'> };                // « À toi de jouer »
```

### Règles du runner

1. Chaque cible est attendue au plus **3 s** (`MutationObserver`). Introuvable : la démo s'arrête
   proprement avec « Cet écran a changé, ouvre-le à la main » et un lien direct. Jamais de blocage.
2. `click` déclenche un vrai `click()` sur un élément qui **ouvre** quelque chose (onglet, modale,
   fiche). Un scénario ne cible **jamais** un bouton de soumission, de suppression ou de confirmation.
   Une garde de test le vérifie (section 8).
3. Pendant la démo, un calque transparent capte les clics hors barre de contrôle. `Échap` = Quitter.
4. Quitter ou terminer laisse l'écran tel quel (formulaire ouvert) : l'utilisateur continue lui-même.
5. `pick-first` sur une liste vide : bulle « Il te faut d'abord un projet », proposition de lancer
   l'action prérequise. Prérequis déclarés dans la section 6.
6. `prefers-reduced-motion` : le curseur saute d'une cible à l'autre sans trajectoire, durées réduites.

## 4. Droits

L'état de chaque action vient de `effectivePermissions` (`src/modules/organizations/permissions.ts`),
jamais d'un calcul local. `requires` pointe une des clés de `ORG_PERMISSION_KEYS`, ou `admin` /
`manager` quand l'écran n'a pas de clé dédiée.

- Autorisé : action normale.
- Refusé : grisée, badge « Admin » ou « Gestion », clic = carte « Il te faut le droit X » + bouton
  « Voir les admins » (ouvre l'annuaire Personnes filtré sur les admins).
- Mode démo : l'utilisateur démo est admin, tout est autorisé.

## 5. Accessibilité, i18n, performance

- Tiroir : `role="dialog"`, focus piégé, retour du focus sur le bouton flottant (patterns de
  `src/components/CLAUDE.md`). Bulles annoncées par une région `aria-live="polite"`.
- Toutes les chaînes dans un nouveau catalogue `orgGuide` (`src/locales/{fr,en}/`), aucune en dur.
- Tout le guide est **lazy** : seul `OrgGuideFab` est dans le lot entreprise. Vérifier `check:bundle`.

## 6. Les 30 actions

Légende droit : `—` aucun. Les noms d'ancrage sont à poser lors de l'implémentation ; les composants
cités sont ceux d'aujourd'hui dans `src/components/organization/`.

### 6.1 Projets et tâches (`work`)

| Action | Droit | Parcours du curseur | Bulles sur les champs |
|---|---|---|---|
| Créer un projet | `project.create` | Projets → bouton « Nouveau projet » → `NewTeamProjectModal` | Nom · Équipe propriétaire · Échéance |
| Créer un projet depuis un modèle | `project.create` | Projets → Nouveau projet → onglet Modèles (`ProjectTemplatesSection`) | Choix du modèle · Ce qui est copié |
| Créer une tâche d'équipe | `task.create` | Tâches → « Nouvelle tâche » → `TeamTaskModal` | Titre · Projet · Assignés |
| Assigner une tâche | — (`canEditTeamTask`) | Tâches → 1re tâche → `DeepTaskModal` → champ Assignés | Assignés · Qui reçoit la notification |
| Ajouter une sous-tâche ou une dépendance | — (`canEditTeamTask`) | Tâches → 1re tâche → sections sous-tâches puis dépendances | Ajouter une sous-tâche · Tâche bloquante |
| Gérer la visibilité d'un projet | `project.edit` | Projets → 1er projet → audience (`ProjectAudienceActions`) | Qui voit le projet · Projet confidentiel |
| Créer une liste de tâches | — | Tâches → barre des listes (`TeamTaskListsBar`) → « Nouvelle liste » | Nom · Épingler la liste |
| Restaurer depuis la corbeille | `task.deleteAny` | Tâches → menu → Corbeille (`TeamTrashDialog`) | Élément supprimé · Restaurer · Délai de purge |

Prérequis : « Assigner », « Sous-tâche », « Visibilité » demandent au moins une tâche ou un projet.

### 6.2 Équipes et membres (`people`)

| Action | Droit | Parcours du curseur | Bulles |
|---|---|---|---|
| Créer une équipe | `team.create` | Équipes → « Nouvelle équipe » → `CreateTeamModal` | Nom · Responsable · Membres |
| Inviter par email | `member.invite` | Personnes → Inviter → `InviteByEmailDialog` | Adresses · Rôle d'arrivée |
| Partager un lien ou un code | `member.invite` | Personnes → Inviter → `OrgInviteLinkCard` / `OrgJoinCodeCard` | Copier le lien · Expiration · Code |
| Accepter une demande d'adhésion | `member.invite` | Personnes → `OrgJoinRequestsList` | Demandeur · Accepter ou refuser |
| Ajouter des membres à une équipe | `manager` | Équipes → 1re équipe → `TeamMembersPanel` → Ajouter | Sélection multiple · Rôle dans l'équipe |
| Placer un membre dans l'organigramme | `admin` | Pyramide → `UnplacedMembersPanel` → `PyramidPlacementSheet` | Supérieur · Effet sur la visibilité |
| Retirer un membre | `admin` | Personnes → 1re fiche → `MemberLifecycleActions` → `OffboardMemberDialog` | Réattribution des tâches · Ce qui est conservé |

Garde spécifique : « Retirer un membre » s'arrête **dialogue ouvert**, bouton de confirmation jamais ciblé.

### 6.3 Rôles et permissions (`roles`)

| Action | Droit | Parcours du curseur | Bulles |
|---|---|---|---|
| Créer un rôle personnalisé | `role.manage` | Paramètres → Rôles (`OrgRolesSettings`) → Nouveau → `RoleEditorSheet` | Nom · Matrice des droits · Couleur |
| Modifier un rôle | `role.manage` | Paramètres → Rôles → 1er rôle → `RoleEditorSheet` | Droits cochés · Membres concernés |
| Attribuer un rôle | `role.manage` | Personnes → 1re fiche → `AssignRoleDialog` | Rôle · Cumul avec le rôle de base |
| Donner un rôle à durée limitée | `role.manage` | Même parcours → champ échéance (`RoleTermCard`, mig. 219) | Date de fin · Retour automatique |
| Régler les permissions d'un membre | `admin` | Personnes → 1re fiche → `MemberPermissionsSheet` | Surcharge · « Suit le défaut » |
| Voir mes propres droits | — | Paramètres → `MyPermissionsCard` | Droits actifs · D'où vient chaque droit |
| Transférer la propriété | `admin` (propriétaire) | Paramètres → `TransferOwnershipDialog` | Nouveau propriétaire · Irréversible |

Point bloquant : **mig. 219 non appliquée en prod** (commit `a6562733`). « Durée limitée » est
masquée tant que la colonne d'échéance n'existe pas côté serveur ; l'action réapparaît d'elle-même.

### 6.4 OKR et pilotage (`steer`)

| Action | Droit | Parcours du curseur | Bulles |
|---|---|---|---|
| Créer un OKR d'entreprise | `okr.create` | OKR → Nouvel objectif → `TeamOKRModal` | Objectif · Résultats clés · Audience |
| Mettre à jour un résultat clé | — (contributeur) | OKR → 1er OKR → `KRExecutionDialog` | Nouvelle valeur · Commentaire de point |
| Lier un KR à un projet | `okr.create` | OKR → 1er OKR → `TeamOKRLinkFields` | Projet lié · Effet sur la progression |
| Lancer la revue hebdomadaire | `manager` | Vue d'ensemble → `WeeklyReviewSheet` | Ce qui a avancé · Blocages |
| Consulter un rapport d'activité | `report.org` ou `report.allTeams` | Rapports (`OrgReportsSection`) → 1er rapport | Période · Périmètre |
| Voir la charge de l'équipe | `manager` | Équipes → 1re équipe → `TeamWorkloadSection` | Charge par membre · Surcharge |
| Exporter les tâches | `admin` | Paramètres → `OrgTasksExportSection` | Format · Filtres appliqués |
| Modifier le profil de l'entreprise | `admin` | Paramètres → `OrgProfileForm` | Nom · Logo · Fuseau horaire |

## 7. Lien avec la constellation

Dernier écran de la constellation : un bouton « Découvrir le guide » qui ouvre le tiroir. Le bouton
flottant porte une pastille discrète tant que le tiroir n'a jamais été ouvert (flag
`cosmo_org_guide_seen`, lu avec `safeParse`, sans try/catch manquant).

## 8. Tests et gardes

- Vitest, `guide-runner.test.ts` : cible absente → arrêt propre ; Quitter annule les timers ; Pause
  gèle ; reduced-motion supprime la trajectoire.
- **Garde de scénarios** : chaque `target` d'un scénario doit exister comme `data-guide-id` dans
  `src/`, et aucun ne doit être posé sur un bouton `type="submit"` ni sur un bouton de confirmation
  ou de suppression. Un ancrage renommé casse la CI, pas la démo en prod.
- Garde i18n : toute `labelKey` / `bubbleKey` existe en fr et en en.
- Playwright (mode démo, desktop) : 1 action par catégorie jouée de bout en bout, puis vérification
  qu'**aucune requête d'écriture** n'est partie pendant la démo.

## 9. Hors périmètre v1

Mobile, recherche en langage naturel, suivi de progression, pré-remplissage, exécution réelle,
actions perso (hors entreprise), facturation (désactivée, cf. mémoire Stripe entreprise).

## 10. Questions ouvertes

1. Ordre d'affichage des catégories dans le tiroir : celui de la section 6 par défaut.
2. Le bouton flottant doit-il cohabiter avec le FAB de création rapide déjà présent en bas à droite ?
   Proposition : le guide se place **au-dessus** du FAB, 56 px plus haut. À vérifier à l'écran.
