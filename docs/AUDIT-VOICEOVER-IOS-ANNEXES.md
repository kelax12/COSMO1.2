# Audit VoiceOver iOS : annexes

**Quand lire** : en jouant [`AUDIT-VOICEOVER-IOS.md`](./AUDIT-VOICEOVER-IOS.md) (le nom « M1 » attendu par surface), ou en câblant ou retirant une surface modale. **Fait foi** : le code ; recompter par `grep -rn "= useModalA11y" src --include=*.tsx` (hors `use-modal-a11y.guard.test.tsx`).

## Annexe A · les surfaces câblées et le nom que chacune doit dire

Référence des noms attendus, pour que « M1 » ait un contenu vérifiable (nom lu dans le code, résolu dans `src/locales/fr/`). 🇫🇷 = nom en dur en français, faux en interface anglaise. « à relire dans le code » = nom à relever dans le fichier avant la séance ; surface jamais auditée.

| Surface | Où l'ouvrir | Nom attendu (M1) | § |
|---|---|---|---|
| `AssignRoleDialog` | `/entreprise` › annuaire › attribuer un rôle personnalisé | à relire dans le code (affiche « aucun rôle » pendant le chargement, `loading-empty-state.guard`) | 9 |
| `RoleEditorSheet` | `/entreprise` › Paramètres › rôles (`OrgRolesSettings`) | à relire dans le code | 9 |
| `InviteModeDialog` | Personnes › inviter | à relire dans le code | 9 |
| `InviteByEmailDialog` | Personnes ou Paramètres › inviter par e-mail | à relire dans le code | 9 |
| `MemberBulkPicker` | annuaire › sélection multiple | à relire dans le code | 9 |
| `OrgSectionSwitcher` | `/entreprise`, changement de section sur téléphone | à relire dans le code | 9 |
| `OrgGlossarySheet` | un terme de rôle souligné (`RoleTerm`) | à relire dans le code | 9 |
| `ProjectEditDialog` | projets › nouveau projet, ou page projet › modifier | à relire dans le code | 9 |
| `PyramidPlacementSheet` | pyramide › placer une personne (sans point d'entrée depuis la mig. 229) | à relire dans le code | 9 |
| `OrgWelcomeVideo` | premier passage dans `/entreprise` : lecteur de la vidéo d'accueil | à relire dans le code | 9 |
| `MobileTaskSearch` | `/tasks` sur téléphone, recherche | à relire dans le code | 4 |
| `MoveCategoryDialog` | `ColorSettingsModal` › déplacer une catégorie | à relire dans le code | · |
| `DeleteTeamCategoryConfirm` | onglet OKR d'équipe › supprimer une catégorie | à relire dans le code | · |
| `MobileMoreSheet` | barre d'onglets, « Plus » | Plus d'options | 3.3 |
| `FirstRunSetup` | premier lancement, compte vide | Bienvenue dans COSMO | 2.4 |
| `TaskActionsSheet` | carte de tâche : appui long, glissement à gauche, ou `contextmenu` (aucun bouton « ⋯ » sur téléphone) | Actions pour \<nom\> | 4.5, 4.6 |
| `MobileAddToList` | feuille d'actions › Ajouter à une liste | Listes 🇫🇷 | 4.7 |
| `ListActionsSheet` | appui long sur une chip de liste | Actions pour la liste \<nom\> 🇫🇷 | 4.8 |
| `CreateListSheet` | barre de chips, nouvelle liste | Nouvelle liste | 4.9 |
| `ShareListSheet` | liste MANUELLE, partager | Partager la liste \<nom\> | 4.10 |
| `ConfirmDeleteSheet` | supprimer une tâche | le titre passé en prop | 4.11 |
| `DeleteTaskConfirm` | fiche de tâche, supprimer | Supprimer la tâche · Quitter la tâche partagée | 4.13 |
| `MobileActionSheet` | fiche de tâche mobile, actions | le titre passé en prop | 4.13 |
| `BulkAddToListModal` | sélection multiple › ajouter à une liste | Ajouter à une liste · ⚠️ à étages | 4.16 |
| `EventModal` | `/agenda`, événement | son titre d'en-tête | 6.4 |
| `ConfirmDiscardDialog` | « Z » sur un `EventModal` modifié | Abandonner les modifications ? | 6.5 |
| `ColorSettingsModal` | `EventModal` / `HabitModal` › catégories | Modifier les catégories | 6.6 · 7.6 |
| `RecurrenceDaysModal` | `EventModal` › récurrence personnalisée | Répéter les jours | 6.7 |
| `QuickEventCard` | appui long sur un créneau | Création rapide d'un événement | 6.9 |
| `RecurringEventsManager` | `/agenda`, événements récurrents | Événements récurrents | 6.10 |
| `AgendaEventToTaskConfirm` | conversion événement → tâche | Que faire de cet événement ? | 6.11 |
| `AgendaSlotReviewModal` | fin d'un créneau · ⚠️ « Z » = report | Créneau terminé | 6.12 |
| `HabitModal` | `/habits`, créer ou modifier | Créer l'habitude · Modifier l'habitude | 7.5 |
| `DeleteCategoryDialog` | supprimer une catégorie perso | Supprimer « \<nom\> » ? | 8.3 |
| `DeleteObjectiveConfirm` | `/okr`, supprimer un objectif | Supprimer l'objectif | 8.4 |
| `CompletedOKRsModal` | `/okr`, OKR terminés | OKR terminés | 8.5 |
| `WeeklyCheckinModal` | `/okr` ou `/dashboard`, check-in | Check-in hebdo 🇫🇷 | 8.6 |
| `OKRDeadlineReviewModal` | OKR échu · ⚠️ « Z » selon la phase | le titre de l'objectif | 8.7 |
| `MemberSheet` | `/entreprise` › annuaire | Fiche de \<nom\> | 9.6 |
| `MemberPermissionsSheet` | annuaire › « … » › permissions | Modifier les permissions de \<nom\> | 9.7 |
| `OffboardMemberDialog` | annuaire ou pyramide › retirer un membre | à relire dans le code | 9.8 |
| `AddUnderSheet` | pyramide › ajouter sous | Ajouter sous \<nom\> | 9.9 |
| `MemberPlacementSheet` | pyramide › placer | Placer \<nom\> 🇫🇷 | 9.10 |
| `CreateTeamModal` | pyramide ou projets › nouvelle équipe | Nouvelle équipe | 9.11 |
| `NewTeamProjectModal` | projets › nouveau projet | Nouveau projet d'équipe | 9.12 |
| `TeamTaskModal` | tâche d'équipe · ⚠️ exception M4 | Nouvelle tâche d'équipe · Modifier la tâche \<nom\> | 9.13 |
| `AssignTaskSheet` | annuaire ou projets › assigner | Attribuer une tâche à \<nom\> | 9.14 |
| `AssignEventDialog` | onglet tâches › planifier | Assigner l'événement, puis le nom de la tâche | 9.15 |
| `DeleteCategoryConfirm` | OKR d'équipe › supprimer une catégorie | Supprimer « \<nom\> » ? | 9.16 |
| `WeeklyReviewSheet` | vue d'ensemble › revue | Revue de la semaine | 9.17 |
| `OrgProfileSheet` | `/entreprise` › profil | Profil de l'entreprise | 9.18 |
| `InviteOrJoinModal` | `Layout`, créer ou rejoindre | Créer ou rejoindre une entreprise | 9.19 |
| `DeleteOrganizationDialog` | `/entreprise` › supprimer | Supprimer \<nom\> ? | 9.20 |
| `LoginModal` | landing › se connecter | Connexion ou inscription | 10.5 |
| `BugReportModal` | `Layout` · ⚠️ exception M4 | Signaler un bug | 10.6 |
| `TodayTasks`, `CollaborativeTasks` (dialogues de suppression) | `/dashboard`, supprimer une tâche | Supprimer la tâche | 4.11 |
| `RemoveFriendConfirm` | boîte de réception › retirer un ami | Confirmer la suppression de l'ami | à jouer si tu passes par la boîte de réception |
| `ShareInviteClaimer` | ouvrir un lien `/invite/:token` | Tâche partagée avec vous | à jouer si tu as un lien sous la main |

- ⚠️ Un composant mort mais CÂBLÉ compte comme une surface à auditer et coûte du temps à qui le prend pour vivant : supprimer le code mort (`CategoryManager` l'a été ; ce qui survit vit dans `src/lib/category-colors.ts`).

## Annexe B · ce qu'un iPhone ne peut pas atteindre, et pourquoi

| Surface | Pourquoi elle est hors d'atteinte |
|---|---|
| `CommandPalette` | ouverte au clavier, aucun déclencheur tactile |
| `ShortcutsHelp` | ouverte par la touche `?` ou par un événement de la palette. 🇫🇷 son nom, « Raccourcis clavier », est en dur |
| `QuickAddBar` | ouverte par la touche `N` |
| `DesktopAddToList` | `AddToListModal` aiguille sur `useIsMobile()` : au-dessus du point de rupture seulement |
| `BottomSheet` | `WeeklyRecapSheet`, son seul consommateur produit, est derrière `WEEKLY_RECAP_ENABLED = false` |
| `PremiumGateModal` | `PREMIUM_ENFORCED = false` : `isPremium()` répond `true` pour tous, le mur ne s'ouvre jamais |

⚠️ Les trois premières se rouvrent avec un clavier Bluetooth : le dire dans le compte-rendu (« joué avec clavier externe » n'est pas « joué au doigt »).
