# Patterns UI

Lire en touchant `src/components/{SmartListMenu,HabitActionsMenu,InboxMenu,EmptyState,EventModal*}`, `src/components/tutorial/**`, `src/components/org-guide/**`, `src/components/onboarding/**`, `src/components/ui/**`, `src/lib/theme.ts`, `src/index.css` (thèmes), un `z-[…]`, `src/modules/lists/**`. Ce qui fait foi : `src/design-system.guard.test.ts` et le code.
Notes /100 cessées (ADR 0012). Journal et diagnostics : [`archive/UI-PATTERNS-journal-des-notes-2026-07-23-au-2026-11-06.md`](./archive/UI-PATTERNS-journal-des-notes-2026-07-23-au-2026-11-06.md), [`archive/UI-PATTERNS-dette-audit-2026-08-14.md`](./archive/UI-PATTERNS-dette-audit-2026-08-14.md), [`archive/DOC-FRONT-recits-retires-2026-11-13.md`](./archive/DOC-FRONT-recits-retires-2026-11-13.md). Mobile : [`MOBILE.md`](./MOBILE.md) ; règles d'écriture de composants : [`src/components/CLAUDE.md`](../src/components/CLAUDE.md).

## Dette UI/UX ouverte

- ✅ Titre de page : deux tailles. Titre de tâche : deux lignes. Tableau Habitudes : pas de colonne partielle. z-index : l'échelle ci-dessous, toute valeur hors échelle est un défaut. Cibles tactiles : 44 px au minimum, sauf les décisions de [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) § Cibles tactiles.

## Listes : modèle étendu (types, smart, virtuelle)

`TaskList` (`src/modules/lists/types.ts`) : `type?: 'manual' | 'smart'` (défaut `'manual'`), `smartRule?: 'overdue' | 'this-week' | 'high-priority'`, `isDefault?: boolean` (UNE liste sélectionnée à l'ouverture), `position?: number`. Mig. `021` : colonnes, CHECK, index unique partiel « un seul `isDefault` par user », index `user_id + position`.

- ✅ `src/modules/lists/smart-rules.ts` : `SMART_PRESETS` (chacun un `matches(task, now)` pur) ; `tasksInList(list, allTasks, now)` sert listes manuelles et smart. ❌ Réintroduire les presets `'no-deadline'` et `'bookmarked'`.
- ✅ Liste virtuelle « Aujourd'hui » : sentinel `VIRTUAL_TODAY_ID = 'virtual-today'`, calculée par `tasksDueToday(allTasks)` (`deadline === today AND !completed`). ❌ La stocker dans la table `lists`. Masquable par `localStorage.cosmo_lists_today_hidden = '1'` ; masquée alors qu'elle est sélectionnée, `selectedListId` repasse à null ; le « + » au hover ouvre la sélection multiple et pose `deadline = today 23:59:59` par `updateTaskMutation` (pas `addTaskToListMutation`).
- ✅ `SmartListMenu` (popover ✨ à côté de « + Nouvelle liste ») : Aujourd'hui (toggle), Liste par défaut, presets ; un preset actif (✓) se supprime au clic, un inactif se crée et se sélectionne. ❌ Un popover en `absolute` dans une barre `overflow-x-auto` : `createPortal(content, document.body)` + `position: fixed`, position mesurée par `getBoundingClientRect()` dans `useLayoutEffect`, z-index 9999.
- ❌ `Reorder.Group values={lists}` directement depuis React Query (snap-back après drop) : état local `orderedLists` mis à jour par `setOrderedLists(newOrder)` dans `onReorder`, resynchronisé depuis `lists` seulement quand la composition (ids ou nombre) change. Désactivé sur mobile.
- ✅ `resolveListColor(color)` : `#RRGGBB` tel quel, sinon palette nominée ; Shift+clic sur la pastille ouvre un `<input type="color">` caché.

## EventModal, HabitActionsMenu, InboxMenu

- ✅ `lockedFields?: ('title' | 'startDate' | 'endDate')[]` verrouille des champs pré-remplis (style `bg-slate-50 cursor-not-allowed opacity-80`, distinct du « prefilled » bleu clair). `HabitActionsMenu` › « Planifier dans l'agenda » passe `['title', 'startDate']` ; `endDate` suit `startDate`. ❌ Un champ dans `lockedFields` sans `disabled`/`readOnly` + style locked.
- ✅ Section « Description » repliée par défaut : `showDescription` initialisé par `useEffect([isOpen])` (pas `[notes]`), visible d'emblée seulement si l'événement a des notes, sinon bouton « + Ajouter un commentaire ». ❌ La forcer à `true` au mount ; ❌ réintroduire la section « Aperçu ».
- ✅ `HabitActionsMenu` (« ... » de `HabitCard`, ordre `Edit2`, `MoreHorizontal`, `Trash2`, popover `createPortal` + fixed) : « Créer une tâche » (`createTaskMutation.mutate({ name: habit.name, priority: 3, category: categories[0]?.id, deadline: todayEod(), estimatedTime: habit.estimatedTime, bookmarked: false, completed: false })`) ; « Planifier dans l'agenda » (`EventModal` en mode `'add'`, date du jour, début 12:00, fin selon `estimatedTime`).
- ✅ `InboxMenu` est le SEUL endroit pour valider demandes d'amis reçues et tâches assignées par d'autres : filtre `t.isCollaborative && t.sharedBy && t.sharedBy !== user?.name` ; accepter = `{ sharedBy: undefined, isCollaborative: true }`, refuser = `{ sharedBy: undefined, isCollaborative: false, collaborators: [] }`. ❌ Un 2ᵉ composant qui valide les mêmes tâches.
- ✅ `EmptyState` (`src/components/EmptyState.tsx`) pour toute liste vide nouvelle : `icon: LucideIcon, title, description?, actionLabel?, onAction?, accentColor?, compact?`.

## Liens d'invitation (mig. 046)

`ShareLinkField` (vue Collaborateurs de `TaskModal`) : lien `/invite/<token>` (table `share_links`, token uuid, 7 jours, révocable par DELETE). `InvitePage` (publique) pose le token dans `localStorage.cosmo_pending_share_invite` puis redirige ; `ShareInviteClaimer` (niveau App) claim par la RPC `SECURITY DEFINER` `claim_share_link` dès l'authentification. Supabase seulement, masqué en démo.

- ✅ En création (pas de `taskId`, FK `share_links.task_id`), `ShareLinkField` reçoit `onGenerate` (`useTaskModal.onGenerateShareLink`) : bouton « Générer le lien », la tâche est persistée à la volée (`createTaskWithShares`, `task-modal/save-task.ts`, avec les collaborateurs déjà choisis), la popup passe en édition (`effectiveTask` / `effectiveIsCreating`). Rien n'est persisté tant que le lien n'est pas demandé. Sans `onGenerate` : placeholder désactivé.
- ✅ Collaborateur en attente : `CollaboratorItem` par `isPending` (demande d'ami envoyée, avatar orange) ou `sentBadge` (partage non accepté, « Envoyé »). Listes (`TaskTable` desktop, `TaskCard` mobile) : sablier ambre (`Hourglass`) quand `usePendingCollaboratorTaskIds` (partage émis avec `accepted !== true`) contient la tâche.

## Showcases de la landing

`src/components/showcase/` : 5 desktop (`TaskTableShowcase`, `AgendaShowcase`, `OKRCardShowcase`, `HabitHeatmapShowcase`, `StatsShowcase`), 5 mobile (`MobileShowcases.tsx`), choisis par `useIsMobile()` ; ils reproduisent les composants réels. Dossier ignoré par ESLint. Règles : [`src/pages/landing/CLAUDE.md`](../src/pages/landing/CLAUDE.md).

## Onboarding et tutoriels

### Les deux accueils

Règles d'écriture : [`src/components/CLAUDE.md`](../src/components/CLAUDE.md) § Onboarding. Chaque parcours continue la DA de la landing d'où vient la personne, quel que soit le thème.

- ✅ Perso : le planétaire (`src/components/onboarding/FirstRunSetup.tsx`, `perso/`) : COSMO comme système dont la personne est le centre, chaque module une orbite (bleu → fuchsia). Écran partagé : question à gauche, scène à droite (planétaire + aperçu, sous la forme exacte d'une carte de l'app) ; sur téléphone l'aperçu disparaît. Six écrans : présentation, tâches (cinq au plus, idées cliquables, touche N), agenda (montre la PREMIÈRE tâche posée dans un créneau, ne crée rien), habitude, objectif + résultat clé facultatif, bilan. Retour arrière sans recréation ; vrai créneau d'agenda facultatif relié à la première tâche ; durée d'habitude choisie ; cible chiffrée facultative ; bilan avec carte de statistiques et sorties concrètes ; thème de l'app suivi ; bouton « Animer » sous mouvement réduit (WCAG 2.3.3 interdit le mouvement non demandé, pas le mouvement).
- ✅ Entreprise : `/entreprise/onboarding` = `OrgChoice` (créer | rejoindre) ; `OrgWelcomeVideo` ouvre un lecteur au premier passage dans `/entreprise` (`public/videos/onboarding-entreprise-v2.mp4`, sous-titres FR d'office hors locale fr, démarrage avec le son, repli muet + « Activer le son » si le navigateur refuse, aucun démarrage automatique sous mouvement réduit). Guide (`?guide=1`, `OrgGuideFab`). ❌ Recréer l'assistant en constellation (équipe, invitations, projet, cap) ou `MemberWelcome`.
- ✅ Chaque étape crée à sa validation (une part importante des inscrits ne revenait jamais après leur session d'inscription).
- 🔴 La garde d'ouverture est un verrou (`latched`) : `useCreateTask` écrit la tâche dans le cache, relue à chaque rendu elle se refermait entre la 1ʳᵉ et la 2ᵉ question. Parcours : `e2e/stubbed/first-run.spec.ts`.
- 🔴 Un id de résultat clé est un UUID : un `kr-<horodatage>` est refusé par `syncKRsToTable` avant interpolation dans un filtre PostgREST (M-1) → « Impossible de créer l'OKR » à la première minute. Témoin : le `DELETE` sur `key_results`.
- ❌ L'accueil perso sur `/entreprise` (il s'empilait sur l'accueil entreprise). L'accueil vidéo ne s'ouvre qu'à une ARRIVÉE sur l'Aperçu nu (`arrivedOnOverview`, décidé une fois) : relue à chaque rendu, la garde s'ouvrait après `?tab=settings` réécrit, retour Stripe `?tab=billing` ou `?task=` retiré, et couvrait l'écran visé.
- ✅ Tailles de texte : l'échelle du projet (`design-system.guard.test.ts`).
- ✅ Mesure : mig. `213` (`get_admin_onboarding_funnel`, carte « Accueils » de la console admin) ; si la fonction manque, la carte le dit au lieu d'afficher des zéros.
- ✅ Le sélecteur de modules n'existe plus (Agenda, Habitudes, OKR, Statistiques visibles par tous) ; `cosmo_onboarding_examples_created` reste LU, jamais écrit.
- ✅ Debug : `localStorage.removeItem('cosmo_first_run_done')` sur un compte SANS tâche puis recharger ; `cosmo_org_welcome_seen_<org>_<user>` pour l'accueil membre. Hors démo : harnais `e2e/supabase-stub.ts` (`first-run.spec.ts`, `org-onboarding.spec.ts`).
- ❌ `OnboardingOverlay` et tout overlay bloquant à l'entrée en démo : en démo guident les `PageTutorial` (l'accueil perso ne s'ouvre jamais en démo). Exception voulue : la vidéo d'accueil entreprise s'ouvre au premier passage sur `/entreprise` en démo (fermable en un geste, drapeau posé par la fixture e2e).

### `PageTutorial` (`src/components/tutorial/PageTutorial.tsx`)

Spotlight, flèche, démos d'actions automatiques. `tutorial/types.ts` (`TutorialStep` : title, description, target (sélecteur CSS), cardPlacement, action `'click' | 'pulse' | 'drag-ghost' | 'drag-and-resize' | 'type' | 'custom'`, dimLevel, ghostLabel, visibility) ; `tutorial/useTutorial.ts` (flag `cosmo_tutorial_seen_<key>`) ; `PageTutorial.tsx` (orchestrateur).

- ✅ Une config par viewport : `<page>.desktop.ts` ET `<page>.mobile.ts`, choisies par `useIsMobile()` (`useTutorial(isMobile ? 'tasks_mobile' : 'tasks_desktop')`). Flags `cosmo_tutorial_seen_{tasks,agenda,habits,okr}_{desktop,mobile}`. ❌ Les fusionner.
- ✅ Voile par `boxShadow: 0 0 0 9999px <color>` sur le trou ; `dimLevel: 'light'` (0.35) sur Agenda/Calendar. ❌ `backdropFilter: blur` ou overlay plein écran.
- ✅ `drag-and-resize` (Agenda) : ghost coloré animé (4 phases) + indicateur de poignée, aucune manipulation du DOM réel. ❌ Manipuler le DOM réel (FullCalendar drag) depuis une action de tutoriel.
- ✅ `data-tutorial-id` : TasksPage `tasks-filter`, `tasks-calendar-toggle`, `tasks-create-button`, `tasks-fab`, `tasks-list`, `tasks-lists` ; AgendaPage `agenda-view-switcher`, `agenda-task-sidebar-toggle`, `agenda-calendar-grid` ; HabitsPage `habits-view-switcher`, `habits-create-button`, `habits-fab`, `habits-list` ; OKRPage `okr-category-filter`, `okr-create-button`, `okr-first-card`. ❌ Renommer sans grep des tutoriels.
- ❌ `useEffect([], …)` pour détecter `cosmo_onboarding_pending` : dépendre de `[isDemo, location.pathname]`.
- ✅ Ré-afficher : `['tasks','agenda','habits','okr'].forEach(p => ['desktop','mobile'].forEach(v => localStorage.removeItem(`cosmo_tutorial_seen_${p}_${v}`)))`.

### Guide entreprise (`src/components/org-guide/`)

Sur `/entreprise`, un bouton flottant (boussole) ouvre un tiroir d'actions classées par catégorie, avec recherche ; chaque action joue une démo (curseur animé vers les vraies cibles, formulaire VIDE, bulle commentée). Desktop seulement.

- 🔴 La démo n'écrit JAMAIS (rien n'est saisi ni validé). Pause, Passer, Échap dans la barre de contrôle. Une action hors des droits du lecteur s'affiche verrouillée avec sa raison.
- ✅ Fichiers : `OrgGuideFab` (seul morceau chargé d'emblée, monté par `OrganizationPage`), `OrgGuideHost` (lazy), `OrgGuideDrawer`, `GuideCursor`, `GuideBubble`, `GuideControlBar`, `guide-runner.ts` (moteur), `guide-access.ts` (droits), `guide-search.ts`, `guide-click.ts`, `scenarios/` (une liste par catégorie). Textes : namespace `orgGuide`. Entrée aussi par « Découvrir le guide » → `/entreprise?guide=1` (la page ouvre le tiroir une fois et retire le paramètre). Drapeau `cosmo_org_guide_seen` ; e2e `e2e/org-guide.spec.ts`.
- ✅ Un scénario vise ses cibles par `data-guide-id`, jamais par un texte ou une classe. ❌ Renommer ou déplacer un `data-guide-id` sans relancer `guide-scenarios.guard.test.ts`.

## Thèmes

- ✅ Trois valeurs : `light`, `dark`, `black`. Source unique : `src/lib/theme.ts` (`Theme`, `resolveInitialTheme`, `applyTheme`, `isTheme`), consommée par `src/main.tsx` et `src/hooks/useDarkMode.ts`. ❌ Redupliquer la résolution. Sur mobile, un visiteur sans `localStorage.theme` démarre en `black` ; `midnight` et `monochrome` sont migrés vers `black`.
- ✅ `black` = palette GitHub dark (graphite + accent bleu) : fond `#24292e`, surfaces `#2b3137`, accent `#58a6ff` (texte, bordures) / `#1f6feb` (fonds pleins). Tokens dans `src/index.css → .black`, RGB (`--color-*`) et HSL (shadcn) synchronisés : ❌ les faire diverger. ❌ Le variant Tailwind `monochrome:` et la classe `.monochrome` (supprimés).
- ✅ Bordures : `--color-border`, `--color-border-muted`, `--color-border-strong` (survol), dans les 3 thèmes. Le focus change la COULEUR vers `--color-accent` par `box-shadow` inset 1 px. ❌ `border-slate-*` / `hover:border-blue-*` en dur, `focus:border-2` (décale le contenu voisin).

## Échelle z-index

Choisir dans cette table, ne pas inventer de valeur.

| Palier | Usage | Exemples |
|---|---|---|
| `z-10` – `z-30` | éléments locaux (sticky headers, badges, overlays de carte) | headers de modals, chips |
| `z-40` | UI flottante de page : FAB quick-add, indicateur sync | `Layout.tsx` |
| `z-50` | modals et sheets standards + MobileTabBar | TaskModal, EventModal, HabitModal |
| `z-[60]` `z-[70]` `z-[80]` `z-[90]` | couches SUCCESSIVES au-dessus d'un modal ouvert (quatre crans, pas un intervalle : `ColorSettingsModal` empile 80 puis 90) | QuickAddBar 70, ColorSettingsModal 80/90 |
| `z-[100]` `z-[110]` | popovers Radix au-dessus d'un modal (110 = imbriqué dans 100) | `date-picker.tsx` |
| `z-[150]` | modal plein écran au-dessus du chrome applicatif | `WeeklyCheckinModal` |
| `z-[190]` `z-[200]` | surfaces système : bannières, CommandPalette, PremiumGateModal | `DemoBridgePrompt` 190, `CookieBanner` 200 |
| `z-[250]` `z-[300]` | interstitiels AU-DESSUS des surfaces système | `ShareInviteClaimer` |
| `z-[500]` | tutoriel de page, au-dessus de tout le chrome | `PageTutorial` |
| `z-[10010]` `z-[10020]` `z-[10030]` | guide entreprise en démo : capteur de clics, curseur et bulle, barre de contrôle et écran « accès refusé » (au-dessus des modales maison 9999 et de leurs popovers jusqu'à 10001) | `OrgGuideHost`, `GuideCursor`, `GuideBubble`, `GuideControlBar` |
| `z-[9999]` `z-[10000]` `z-[10001]` | `createPortal` + `position: fixed` : la feuille (9999), un popover DANS la feuille (10000), un popover dans une popup montée à 10000 (10001) | SmartListMenu, `AssigneesPicker`, calendrier des popups de dépendances |

- 🔒 Liste FERMÉE, vérifiée par `src/design-system.guard.test.ts` : toute valeur `z-[…]` hors de ces crans échoue en CI. Ajouter un cran : le poser ici ET dans le test, en justifiant l'ordre voulu.

## shadcn : exceptions documentées

Les composants de `src/components/ui/` ne se modifient pas (CLI shadcn) ; toute modification se documente ici.

| Fichier | Modification | Raison |
|---|---|---|
| `dialog.tsx` | `DialogOverlay` : `bg-black/50` → `bg-black/30 backdrop-blur-md` | cohérence iOS sheet |
| `dialog.tsx` | `DialogContent` : prop `variant` (`'default'` \| `'bottom-sheet'`), slide-from-bottom avec easing iOS | animation bottom-sheet mobile de TaskModal |
| `chart.tsx` | `ChartStyle` : whitelist regex sur `color` + sanitization `id`/`key` avant `dangerouslySetInnerHTML` | M-11, CSS injection |
| `chart.tsx` | `ChartTooltipContent` / `ChartLegendContent` : types découplés de Recharts | Recharts v3 a remanié les types, runtime inchangé |

- ⚠️ `DialogOverlay` n'a plus de `forwardRef` (React 19) : [`MIGRATION-REACT19.md`](./MIGRATION-REACT19.md).

## Mode entreprise : popups, confirmations, cas limites

Règles courtes : [`src/modules/organizations/CLAUDE.md`](../src/modules/organizations/CLAUDE.md).

### Archivage d'un projet

- ⚠️ L'archivage est un UPDATE, jamais un DELETE, et l'application ne supprime jamais un projet : le trigger `enforce_team_project_archive_scope` rattache l'archivage à `project.delete` (une policy, qui juge la ligne entière, ne sait pas le faire).

### Projet riche, portefeuille, page projet (mig. 153, M2)

- ✅ Un projet porte `description`, `owner_id` (responsable), `status`, `start_date`, `due_date`, `is_template` + `template_payload` ; une tâche porte `start_date` (≤ `deadline`, CHECK). Dépendances entre projets : `team_project_dependencies` (`project_id` est BLOQUÉ par `depends_on_id`, même vocabulaire que les tâches). Page projet : `/entreprise/projects?project=<id>`, le paramètre RESTE dans l'URL (palette et panneau l'émettent).
- ⚠️ Jalons retirés du front (la table `team_project_milestones` reste en base jusqu'à la mig. `206`, non appliquée).

### Étape 6 (mig. 190-193) : rôles de projet, recherche, vues

En prod sans ligne au ledger : `supabase/migration/CLAUDE.md`.

- 🔴 `team_project_members` : `lead` / `contributor` / `viewer`. Le lecteur est refusé par TRIGGER (une policy PERMISSIVE ne retire rien) ; un admin n'est jamais restreint ; tout helper exige un membre ACTIF. Preuve : `supabase/proofs/190-193.proof.sql`.
- ❌ Recalculer un avancement ou une charge sur `useTeamTasks` : `useTeamProjectTaskStats`, `useTeamMemberWorkload` comptent en base sur TOUTES les tâches.
- ❌ `governance.hooks` depuis l'entrée de la palette : elle lit `search_org` par `search.hooks.ts`.
- ✅ Une vue enregistrée ne DONNE rien : ses filtres se relisent sous la RLS et se valident (URL).

### Popups entreprise

- ❌ Un 4ᵉ sélecteur de plusieurs personnes : `MemberPickList` (recherche au-delà de `MEMBER_SEARCH_THRESHOLD`, groupes d'équipe, tranches de 50 ; une personne cochée puis masquée reste choisie, le compte des cochés masqués s'affiche). Utilisé par la fiche de tâche, « Attribuer à quelqu'un », la création d'équipe.
- ❌ Recréer une tâche EN SILENCE : le premier commentaire d'une fiche en création passe par « Créer et commenter » ; ensuite « Annuler » devient « Fermer ».
- ❌ Une création d'équipe ou de projet DANS une autre fiche (tâche, OKR) : équipe vide ou projet visible par toute l'entreprise.
- ✅ Sous-tâches, dépendances (« bloquée par ») et étiquettes se saisissent dès la création : brouillon appliqué par `useApplyTeamTaskDraft` une fois l'id connu. Étiquettes (mig. 093) et historique (mig. 094) : `task-extras.hooks.ts`, la jonction se lit PAR TÂCHE (`eq('task_id')`), jamais pour toute l'organisation.
- ✅ Audience d'un projet et portée d'un droit : `audience.helpers.ts` (`projectAudience`, `memberReach`), miroir d'affichage de `can_access_team_project` ; la RLS reste la frontière.
- ⚠️ Les droits de `org_member_permissions` valent pour TOUTE l'organisation (la fiche le dit) ; des droits par projet exigeraient une migration et une réécriture des policies.
- ✅ `PyramidPlacementSheet` remplace `MemberPlacementSheet` et `AddUnderSheet` (« son responsable », « sous cette personne » avec invitation).

### Cas limites et cohérence (mig. 164)

- ✅ Geste réversible : part tout de suite avec `showUndoToast` ; irréversible : `OrgConfirmDialog` (impact listé, saisie du nom). ❌ `window.confirm` (`org-confirm.guard.test.ts`).
- 🔴 Un retrait passe TOUJOURS par l'assistant de départ (`useMemberLifecycle`) : il annonce l'impact et fait choisir qui reprend. Côté base `release_member_work` libère tâches OUVERTES, projets portés et abonnements au retrait et au départ volontaire (plus d'assigné fantôme).
- ✅ Le mode `transfer` de `offboard_org_member` ne touche QUE les champs nommés ; la personne reste. ❌ Le proposer en `suspend` / `remove` sur soi-même (`modes={['transfer']}`).
- ✅ Équipes associées (`team_project_teams`) ÉLARGISSENT la lecture (CASCADE sûr, contrairement à `team_id`, M5) ; ajout et retrait = `project.edit`, jamais le responsable seul. Purge : `purge_archived_team_project` (INVOKER), projet archivé seulement.
- ✅ Droits d'une tâche (menus, glisser) : `team-task-rights.ts`, jamais recalculés à la main.
- 🔴 Namespace `orgAdmin` (départs, invitations, lots, droits, pyramide, revue, corbeille) : chaque section ou dialogue qui s'en sert le DÉCLARE dans `OrganizationPage` (`lazyWithRetry(…, [..., 'orgAdmin'])`). ❌ Remettre ces groupes dans `org` (plafond de bundle du catalogue).
- ❌ Réappliquer la mig. `164` (en prod sans ligne au ledger) : `supabase/migration/CLAUDE.md`.

## Ne jamais faire (UI)

- ❌ Modifier `src/components/ui/` sans documenter l'exception ci-dessus. ❌ `as any` pour contourner TypeScript.
- ❌ `toast.error()` depuis un repository ou `normalizeApiError`. ❌ Forcer `theme="dark"` sur le `Toaster` (`theme="system"`).
- ❌ `const { data = [] } = useX()` sans lire `isLoading` quand la valeur alimente un chiffre, un compteur ou un état vide : le tableau vide se rend comme une AFFIRMATION (« 0 tâche », « aucun projet »). Squelette (`src/components/skeletons`, `OrgLoadingSkeletons`) en gris neutre `--color-hover`, jamais `bg-accent` (bleu vif dans 3 thèmes sur 4).
- ❌ Confirmer un changement de contexte irréversible par un toast (dismissible, donc contournable) : dialogue bloquant (`AlertDialog`) pour un départ hors de la page, une perte de saisie, une navigation qui remplace l'écran.
- ❌ Monter une entrée de navigation sur `{data && …}` : la barre se peint sans elle puis tout saute d'une ligne. Réserver la place à partir d'un indice persisté, jamais confondu avec une autorisation.
