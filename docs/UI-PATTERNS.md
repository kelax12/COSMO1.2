# Patterns UI — COSMO

## Historique des notes et des audits : archivé

Les notes /100 de ce document ont cessé (ADR 0012, [`INDICATEURS.md`](./INDICATEURS.md)). Leur journal daté, les angles morts mesurés et les récits d'incident qui fondent les règles ci-dessous sont déplacés, sans coupe, dans [`archive/UI-PATTERNS-journal-des-notes-2026-07-23-au-2026-11-06.md`](./archive/UI-PATTERNS-journal-des-notes-2026-07-23-au-2026-11-06.md). Une règle de ce document qui cite une date ou un incident s'y retrouve.

## Dette UI/UX : audit du 2026-08-14, soldé et archivé

Les six items de l'audit sont corrigés (2026-08-24 et 2026-08-25). Les règles qui en sortent :

- **Titre de page : deux tailles**, pas quatre.
- **Titre de tâche : deux lignes**, pas une.
- **Tableau Habitudes** : pas de colonne partielle.
- **z-index** : l'échelle est celle de [§ Échelle z-index](#échelle-z-index-audit-2026-07), toute valeur hors échelle est un défaut.
- **Cibles tactiles : 44 px au minimum.**

Les diagnostics d'origine, les mesures avant et après, et la liste « vérifié sain, ne pas re-suspecter » sont dans [`archive/UI-PATTERNS-dette-audit-2026-08-14.md`](./archive/UI-PATTERNS-dette-audit-2026-08-14.md).

## Listes — modèle étendu (types, smart, virtuelle)

`src/modules/lists/types.ts` — `TaskList` étendu avec 4 champs optionnels (rétro-compatibles) :
- `type?: 'manual' | 'smart'` — défaut `'manual'`
- `smartRule?: SmartRulePreset` — `'overdue' | 'this-week' | 'high-priority'`
- `isDefault?: boolean` — épingle UNE liste comme sélectionnée à l'ouverture
- `position?: number` — ordre d'affichage (drag-to-reorder)

**Migration SQL** : `021_lists_smart_default_position.sql` ajoute les 4 colonnes + CHECK constraints + unique partial index "un seul isDefault par user" + index user_id+position.

### Smart rules engine

`src/modules/lists/smart-rules.ts` — `SMART_PRESETS: SmartPresetDef[]` avec 3 presets (overdue / this-week / high-priority). Chaque preset a un `matches(task, now)` pur. Helper `tasksInList(list, allTasks, now)` retourne les tâches d'une liste manuelle OU smart (transparent côté caller).

**Anciens presets retirés** : `'no-deadline'` et `'bookmarked'`.

### Liste virtuelle « Aujourd'hui »

Sentinel ID = `'virtual-today'` (constante `VIRTUAL_TODAY_ID`). **Jamais en base** — calculée à l'affichage via `tasksDueToday(allTasks)` (filtre `deadline === today AND !completed`).

- Visible par défaut, masquable via `localStorage.cosmo_lists_today_hidden = '1'`
- Si sélectionnée et qu'on la masque → `selectedListId` repasse à null
- Bouton « + » au hover ouvre le mode sélection multi-tâches ; à la validation, chaque tâche se voit poser `deadline = today 23:59:59` via `updateTaskMutation` (pas `addTaskToListMutation`)

### SmartListMenu (popover ✨)

`src/components/SmartListMenu.tsx` — déclenché par bouton ✨ violet à côté du « + Nouvelle liste ». Affiche : Aujourd'hui (toggle show/hide), Liste par défaut (si une liste est `isDefault`), Smart presets (3 lignes). Cliquer un preset **actif** (✓) le supprime (toggle visibilité, même comportement que la corbeille rouge). Cliquer un preset inactif le crée et le sélectionne.

**Rendu via `createPortal(content, document.body)` + `position: fixed`** — sinon le popover était clippé par `overflow-x-auto` de la barre de chips. Trigger position mesurée via `getBoundingClientRect()` dans `useLayoutEffect`. z-index 9999.

### Drag-to-reorder local state

`Reorder.Group values={lists}` avec `lists` venant de React Query causait un snap-back après drop. **Fix** : state local `orderedLists` mis à jour immédiatement par `setOrderedLists(newOrder)` dans `onReorder`. Synchronisé depuis `lists` **uniquement** quand la composition change (ids ou count). Désactivé sur mobile.

### Couleurs personnalisées (hex)

`resolveListColor(color)` : si format `#RRGGBB` → utilisé tel quel, sinon lookup palette nominée. UI : Shift+clic sur la pastille ouvre un `<input type="color">` caché.

## EventModal — `lockedFields` & section repliée

### Prop `lockedFields?: ('title' | 'startDate' | 'endDate')[]`

Verrouille certains champs pré-remplis en lecture seule. Style locked : `bg-slate-50 cursor-not-allowed opacity-80`, distinct du style "prefilled" (bleu clair).

**Cas d'usage** : `HabitActionsMenu` → « Planifier dans l'agenda » passe `lockedFields={['title', 'startDate']}`. `endDate` est auto-synchronisé depuis `startDate`.

### Section « Description » repliée par défaut

État `showDescription` initialisé via `useEffect([isOpen])` (pas `[notes]`). Visible par défaut uniquement si l'event a déjà des notes. Sinon, bouton bleu **« + Ajouter un commentaire »**.

### Section « Aperçu » retirée

Supprimée pour tous les modes (add/edit/convert) — elle dupliquait des infos déjà visibles.

## HabitActionsMenu — habit → tâche/event

`src/components/HabitActionsMenu.tsx` — bouton « ... » dans HabitCard (ordre : `Edit2` → `MoreHorizontal` → `Trash2`). Popover via `createPortal` + position fixed.

1. **Créer une tâche** :
   ```ts
   createTaskMutation.mutate({
     name: habit.name, priority: 3, category: categories[0]?.id,
     deadline: todayEod(), estimatedTime: habit.estimatedTime,
     bookmarked: false, completed: false,
   })
   ```
2. **Planifier dans l'agenda** : ouvre `EventModal` en mode `'add'` (pré-remplit date à aujourd'hui + start 12:00 + end basé sur estimatedTime). Avec `lockedFields={['title', 'startDate']}`.

## InboxMenu — point unique pour la validation collaborative

`src/components/InboxMenu.tsx` est le **seul** endroit pour valider : demandes d'amis reçues +
tâches assignées par d'autres. (Il a remplacé l'ancien `SocialRequests.tsx` de la colonne droite
du Dashboard, supprimé depuis.)

Pour les tâches : filtre `t.isCollaborative && t.sharedBy && t.sharedBy !== user?.name`. Accepter = `{ sharedBy: undefined, isCollaborative: true }`. Refuser = `{ sharedBy: undefined, isCollaborative: false, collaborators: [] }`.

**Ne pas recréer un 2ème composant** qui validerait les mêmes tâches — `SharedTasksHistory.tsx` (supprimé) faisait ça et créait de la duplication.

## Liens d'invitation (mig. 046)

`ShareLinkField` (dans la vue Collaborateurs de `TaskModal`) affiche un lien copiable `/invite/<token>` (table `share_links`, token = uuid, 7 jours, révocable par DELETE). `InvitePage` (route publique) pose le token dans `localStorage.cosmo_pending_share_invite` puis redirige ; `ShareInviteClaimer` (monté au niveau App) claim via la RPC SECURITY DEFINER `claim_share_link` dès que l'utilisateur est authentifié. Feature Supabase-only — masquée en démo. **En création** (pas encore de `taskId` → FK `share_links.task_id`), `ShareLinkField` reçoit un callback `onGenerate` (= `useTaskModal.onGenerateShareLink`) et affiche un bouton **« Générer le lien »** : au clic, la tâche est persistée à la volée (`createTaskWithShares` dans `task-modal/save-task.ts`, avec les collaborateurs déjà sélectionnés), le hook stocke `createdTask` → la popup bascule en mode édition (`effectiveTask`/`effectiveIsCreating`) et le vrai lien s'affiche. Pas de tâche fantôme : rien n'est persisté tant que le lien n'est pas demandé. Sans `onGenerate`, fallback = placeholder désactivé.

Collaborateur **en attente** : `CollaboratorItem` marque l'état via `isPending` (demande d'ami envoyée, avatar orange + « ⏳ Demande d'ami envoyée ») ou `sentBadge` (partage émis non accepté, pastille « Envoyé » + « En attente d'acceptation »). Côté listes (`TaskTable` desktop + `TaskCard` mobile), un **sablier** ambre (`Hourglass`) s'affiche à côté des avatars de collaborateurs quand `usePendingCollaboratorTaskIds` (partage émis avec `accepted !== true`) contient la tâche.

## Showcases LandingPage — mobile vs desktop

`src/components/showcase/` :
- 5 desktop : `TaskTableShowcase`, `AgendaShowcase`, `OKRCardShowcase`, `HabitHeatmapShowcase`, `StatsShowcase`
- 5 mobile : exportés depuis `MobileShowcases.tsx`

Choisi via `useIsMobile()` dans `LandingPage`. Les showcases mobile reproduisent fidèlement les composants réels. Le folder `src/components/showcase/` est ignoré par ESLint.

## EmptyState — composant réutilisable

`src/components/EmptyState.tsx` — icône + titre positif + description + CTA. Branché sur TodayTasks et TodayHabits. À utiliser pour toute liste vide nouvelle.

Props : `icon: LucideIcon, title, description?, actionLabel?, onAction?, accentColor?, compact?`.

## Onboarding & Tutoriels

### Les deux accueils (refaits le 2026-10-03)

Les premières minutes doivent tout faire comprendre, et marquer. Chaque parcours continue la DA de
la landing d'où vient la personne, quel que soit le thème de l'application.

**Perso : le planétaire** (`src/components/onboarding/FirstRunSetup.tsx`, `perso/`). COSMO se
présente comme un système dont la personne est le centre (la planète du logo) et dont chaque
module est une orbite : Tâches, Agenda, Habitudes, Objectifs, du bleu au fuchsia comme les accents
de la landing perso. Écran partagé : à gauche la question, à droite la scène (planétaire + aperçu
de ce que l'étape va créer, sous la forme exacte d'une carte de l'app). Sur téléphone, le
planétaire réduit passe au-dessus et l'aperçu disparaît. Six écrans : présentation, tâches (cinq
au plus, idées cliquables, touche N), agenda (montre la PREMIÈRE tâche écrite posée dans un
créneau, ne crée rien), habitude (idées), objectif + résultat clé facultatif, bilan.

**Entreprise : la vidéo d'accueil** (refait le 2026-10-14, à la demande d'Axel, sur le modèle de
RemNote). `/entreprise/onboarding` ne propose plus que le choix créer | rejoindre (`OrgChoice`).
L'assistant de mise en place en constellation (équipe, invitations, projet, cap), qui demandait
des informations avant d'avoir montré le produit, est supprimé avec `MemberWelcome`. À la place,
`OrgWelcomeVideo` ouvre un lecteur au premier passage dans `/entreprise`, créateur comme membre :
vidéo V2 du 2026-10-19, 2 min 24 (`public/videos/onboarding-entreprise-v2.mp4`, source
`cockpit-marketing/videos/onboarding-entreprise`), sous-titres FR actifs d'office hors locale fr,
démarrage avec le son et repli muet + bouton « Activer le son » si le navigateur refuse, aucun
démarrage automatique sous mouvement réduit. Le guide (`?guide=1`, `OrgGuideFab`) est inchangé.
Historique de la constellation : `git log -- src/components/onboarding/enterprise/Constellation.tsx`.

**Règles communes**, et pourquoi :

- Chaque étape crée au moment où elle est validée. Mesuré le 2026-08-28 : 50 % des inscrits ne
  revenaient jamais après leur session d'inscription, c'est précisément la population qui ferme
  l'onglet entre deux questions.
- La garde d'ouverture est un verrou (`latched`). `useCreateTask` écrit la tâche créée dans le
  cache : relue à chaque rendu, la garde se refermait entre la première et la deuxième question,
  et l'écran ne revenait plus (le compte n'était plus vide). Seul le parcours
  `e2e/stubbed/first-run.spec.ts` l'a vu, le 2026-09-08 : un écran qui se referme sur son propre
  effet ne se voit qu'en le parcourant.
- 🔴 **Bug trouvé en rejouant l'accueil hors démo (2026-10-03)** : le résultat clé de l'objectif
  partait avec un id `kr-<horodatage>`. `syncKRsToTable` l'upserte, puis refuse tout id qui n'est
  pas un UUID avant de l'interpoler dans un filtre PostgREST (M-1) : la personne lisait
  « Impossible de créer l'OKR » à sa première minute. Le parcours e2e comptait les écritures sur
  `okrs` et ne pouvait pas le voir ; son témoin est désormais le `DELETE` sur `key_results`, qui
  n'existe que si la garde a laissé passer l'id (vérifié rouge en remettant l'ancien id).
- Le perso ne s'ouvre jamais sur `/entreprise` : il s'empilait sur l'accueil entreprise à la
  sortie de celui-ci.
- L'accueil vidéo (ex-`MemberWelcome`) ne s'ouvre qu'à une ARRIVÉE sur l'Aperçu nu (`/entreprise` sans section ni
  paramètre), décision prise une fois (`arrivedOnOverview`). Relue à chaque rendu, la garde
  laissait l'accueil s'ouvrir après coup, une fois `?tab=settings` réécrit en section, le retour
  Stripe `?tab=billing` traité ou `?task=` retiré par une fiche introuvable : il couvrait l'écran
  visé et a mis 8 cas du job e2e au rouge le 2026-10-04 (`delete-org`, `refund`, et le sien).
- Tailles de texte : l'échelle du projet uniquement (garde `design-system.guard.test.ts`, stock de
  `text-[Npx]` plafonné).

**Corrigé le 2026-10-05**, après une revue honnête de ses points faibles : retour arrière (une
étape faite s'affiche enregistrée, rien n'est recréé) ; un VRAI créneau d'agenda, facultatif,
relié à la première tâche ; l'aperçu sous le formulaire sur téléphone ; la durée de l'habitude
choisie ; une cible chiffrée facultative au résultat clé ; un bilan avec une carte de
statistiques et des sorties concrètes (tâches, agenda, habitudes) ; le thème de l'app suivi (plus
d'éclair blanc en thème Noir) ; un bouton « Animer » sous mouvement réduit (WCAG 2.3.3 interdit le
mouvement non demandé, pas le mouvement) ; un rappel de l'entreprise remise à plus tard. Côté
entreprise : équipe AVANT invitations, pour que l'invitation emporte l'équipe et le manager ;
constellation redessinée depuis les vraies données après un rechargement ; tâches du modèle de
projet visibles ; résultat clé manquant expliqué ; attente nommée et datée ; toasts sombres ;
reprise de l'assistant à la première étape non faite depuis l'Aperçu.
✅ **Mesure** : la mig. `213` (`get_admin_onboarding_funnel`, carte « Accueils » de la console
admin) est en production (ledger `20261008203135`). Si la fonction manque, la carte le dit au lieu
d'afficher des zéros.

Le sélecteur de modules a été supprimé le 2026-08-23 (`acf29b7`) : Agenda, Habitudes, OKR et
Statistiques sont visibles par tout le monde. `cosmo_onboarding_examples_created` (ancien accueil à
trois tâches d'exemple, écrites en dur en français) reste LU, jamais écrit.

Debug : `localStorage.removeItem('cosmo_first_run_done')` sur un compte SANS tâche, puis recharger ;
`cosmo_org_welcome_seen_<org>_<user>` pour l'accueil membre. Hors démo, les écrans se jouent avec
le harnais `e2e/supabase-stub.ts` (`first-run.spec.ts`, `org-onboarding.spec.ts`).

### OnboardingOverlay — supprimé (2026-07, commit c170e37)

Le tutoriel 3 étapes affiché après `loginDemo()` a été **retiré volontairement** et le composant supprimé du repo (purge 2026-07-15). En démo, ce sont les `PageTutorial` par page qui guident (l'accueil perso ne s'ouvre jamais en démo). Exception voulue par Axel le 2026-10-19 : la vidéo d'accueil entreprise s'ouvre au premier passage sur `/entreprise` en démo (fermable en un geste, drapeau posé par la fixture e2e). Ne pas recréer d'autre overlay bloquant à l'entrée en démo.

### PageTutorial — tutoriel par page

`src/components/tutorial/PageTutorial.tsx` — spotlight, flèche, démos d'actions automatiques.

Architecture :
- `tutorial/types.ts` — `TutorialStep` : title, description, target (selector CSS), cardPlacement, action ('click' | 'pulse' | 'drag-ghost' | 'drag-and-resize' | 'type' | 'custom'), dimLevel, ghostLabel, visibility
- `tutorial/useTutorial.ts` — gère le flag `cosmo_tutorial_seen_<key>`
- `tutorial/PageTutorial.tsx` — orchestrateur

**Configs séparées par viewport** : chaque page a `<page>.desktop.ts` ET `<page>.mobile.ts`. Choisi via `useIsMobile()` :

```tsx
const isMobile = useIsMobile();
const tutorial = useTutorial(isMobile ? 'tasks_mobile' : 'tasks_desktop');
const steps = isMobile ? tasksTutorialStepsMobile : tasksTutorialStepsDesktop;
```

Flags : `cosmo_tutorial_seen_tasks_(desktop|mobile)`, idem `agenda`, `habits`, `okr`.

**Visuel spotlight** : voile sombre via `boxShadow: 0 0 0 9999px <color>` sur le hole. PAS de fullscreen overlay avec `backdropFilter: blur`. `dimLevel: 'light'` (0.35) sur les steps Agenda/Calendar.

**Action `drag-and-resize`** (Agenda) : ghost coloré animé (4 phases) + indicateur de poignée resize. Pas de manipulation DOM réelle.

**Markers `data-tutorial-id`** :
- TasksPage : `tasks-filter`, `tasks-calendar-toggle`, `tasks-create-button`, `tasks-fab`, `tasks-list`, `tasks-lists`
- AgendaPage : `agenda-view-switcher`, `agenda-task-sidebar-toggle`, `agenda-calendar-grid`
- HabitsPage : `habits-view-switcher`, `habits-create-button`, `habits-fab`, `habits-list`
- OKRPage : `okr-category-filter`, `okr-create-button`, `okr-first-card`

> **Ne pas renommer** un `data-tutorial-id` sans grep les tutorials d'abord.

### Guide entreprise (2026-10-12)

**Rôle** : sur `/entreprise`, un bouton flottant (boussole, en bas à droite) ouvre un tiroir de
**28 actions** classées par catégorie, avec recherche. Chaque action joue une démo : un curseur
animé se déplace vers les vraies cibles de l'écran, ouvre le formulaire **vide** et commente
chaque étape dans une bulle. La démo **n'écrit jamais** : rien n'est saisi ni validé. Pause,
Passer et Échap (quitter) dans la barre de contrôle. Une action hors des droits du lecteur
s'affiche verrouillée et explique pourquoi. **Desktop uniquement** (le bouton n'est pas rendu
sur mobile).

**Fichiers** (`src/components/org-guide/`) : `OrgGuideFab` (seul morceau chargé d'emblée, monté
par `OrganizationPage`) ; `OrgGuideHost` (lazy : tiroir, scénarios, démo) ; `OrgGuideDrawer` ;
`GuideCursor`, `GuideBubble`, `GuideControlBar` ; `guide-runner.ts` (moteur), `guide-access.ts`
(droits), `guide-search.ts`, `guide-click.ts` ; `scenarios/` (une liste par catégorie). Textes :
namespace `orgGuide`. Entrée aussi depuis la fin de la constellation entreprise : « Découvrir le
guide » mène à `/entreprise?guide=1`, la page ouvre le tiroir une fois et retire le paramètre.

**Ancrages** : un scénario vise ses cibles par `data-guide-id`, jamais par un texte ou une
classe. La garde `src/components/org-guide/guide-scenarios.guard.test.ts` vérifie que chaque
`data-guide-id` cité par un scénario existe dans le code. ❌ Ne pas renommer ni déplacer un
`data-guide-id` sans la relancer.

**z-index** : 10010 (capteur de clics), 10020 (curseur, bulle), 10030 (barre de contrôle), voir la
table plus bas. **Drapeau** : `cosmo_org_guide_seen` (pastille « nouveau » du bouton, posée au
premier clic). **e2e** : `e2e/org-guide.spec.ts` (démo, aucune clé `cosmo_*` de données modifiée).

### Ré-afficher un tutoriel
```js
['tasks','agenda','habits','okr'].forEach(p => {
  localStorage.removeItem(`cosmo_tutorial_seen_${p}_desktop`);
  localStorage.removeItem(`cosmo_tutorial_seen_${p}_mobile`);
});
```

## Thèmes — 3 valeurs, source unique

`light` · `dark` · `black`. **Source de vérité : `src/lib/theme.ts`** (`Theme`, `resolveInitialTheme`, `applyTheme`, `isTheme`) — consommée par `src/main.tsx` (avant premier paint) et `src/hooks/useDarkMode.ts`. Ne pas redupliquer la résolution ailleurs.

Sur mobile, un visiteur sans `localStorage.theme` démarre en `black` ; un choix explicite prime toujours. Les valeurs historiques `midnight` et `monochrome` sont migrées vers `black` au chargement.

### `black` — palette GitHub (graphite + accent bleu, 2026-07-22)

Le thème `black` fusionne les anciens `midnight` (OLED + accent) et `black` (monochrome, sans couleur) en un seul thème reprenant la palette GitHub dark : fond `#24292e`, surfaces `#2b3137`, accent `#58a6ff` (texte/bordures) / `#1f6feb` (fonds pleins). Tokens dans `src/index.css → .black`, RGB (`--color-*`) et HSL (shadcn) toujours en valeurs synchronisées — ne jamais faire diverger les deux familles.

Le variant Tailwind `monochrome:` et la classe `.monochrome` **ont été entièrement supprimés** (plugin `addVariant` retiré de `tailwind.config.js`, ~250 classes `monochrome:*` reciblées ou supprimées dans les composants). Ne pas les réintroduire — le thème `black` porte désormais de la couleur (accent bleu) comme les deux autres.

### Bordures — tokens sémantiques (2026-07-22)

`--color-border` (défaut) · `--color-border-muted` (discret) · `--color-border-strong` (survol), déclarés dans les 3 thèmes. Le focus change la **couleur** de bordure vers `--color-accent` via un `box-shadow` inset 1px — jamais l'épaisseur (`border-2`), pour ne pas décaler le contenu voisin. Ne pas réintroduire `border-slate-*` / `hover:border-blue-*` codés en dur ni `focus:border-2` sur les champs de formulaire — utiliser les tokens.

## Échelle z-index (audit 2026-07)

Paliers en usage — **choisir dans cette table**, ne pas inventer de nouvelle valeur :

| Palier | Usage | Exemples |
|---|---|---|
| `z-10` – `z-30` | Éléments locaux (sticky headers, badges, overlays de carte) | headers de modals, chips |
| `z-40` | UI flottante de page : FAB quick-add, indicateur sync | `Layout.tsx` |
| `z-50` | Modals/sheets standards + MobileTabBar | TaskModal, EventModal, HabitModal |
| `z-[60]` `z-[70]` `z-[80]` `z-[90]` | Couches SUCCESSIVES au-dessus d'un modal ouvert. Quatre crans, pas un intervalle : `ColorSettingsModal` empile 80 puis 90 | QuickAddBar `z-[70]`, ColorSettingsModal 80/90 |
| `z-[100]` `z-[110]` | Popovers Radix au-dessus d'un modal (110 = imbriqué dans 100) | `date-picker.tsx` (`CategoryManager` supprimée le 2026-09-14) |
| `z-[150]` | Modal plein écran au-dessus du chrome applicatif | `WeeklyCheckinModal` |
| `z-[190]` `z-[200]` | Surfaces système : bannières, CommandPalette, PremiumGateModal | `DemoBridgePrompt` 190, `CookieBanner` 200 |
| `z-[250]` `z-[300]` | Interstitiels AU-DESSUS des surfaces système | `ShareInviteClaimer`, `AdModal` |
| `z-[500]` | Tutoriel de page — au-dessus de tout le chrome | `PageTutorial` |
| `z-[10010]` `z-[10020]` `z-[10030]` | Guide entreprise pendant une démo : capteur de clics (10010), curseur et bulle (10020), barre de contrôle et écran « accès refusé » (10030), au-dessus des modales maison (9999) et de leurs popovers (jusqu'à 10001) | `OrgGuideHost`, `GuideCursor`, `GuideBubble`, `GuideControlBar` |
| `z-[9999]` `z-[10000]` `z-[10001]` | `createPortal` + `position: fixed`. Trois étages réels : la feuille (9999), un popover DANS la feuille (10000), et un popover dans une popup elle-même montée à 10000 (10001) | SmartListMenu, `AssigneesPicker`, calendrier des popups de dépendances |

> 🔒 **Liste fermée, vérifiée par `src/design-system.guard.test.ts`.** Toute valeur `z-[…]` hors
> de ces crans échoue en CI. Ajouter un cran est permis — il faut le poser ici ET dans le test, en
> justifiant l'ordre voulu. La version précédente de cette table listait 7 paliers pendant que le
> code en utilisait 16 : une échelle qu'aucun script ne vérifie ne tient pas.

## Shadcn UI — exceptions documentées

Les composants dans `src/components/ui/` sont normalement **non modifiés** (gérés par la CLI shadcn). Si une modif est nécessaire, **la documenter ici** :

| Fichier | Modification | Raison | Commit |
|---|---|---|---|
| `dialog.tsx` | `DialogOverlay` : `bg-black/50` → `bg-black/30 backdrop-blur-md` | Cohérence iOS sheet style | `5e2336a` |
| `dialog.tsx` | `DialogOverlay` : `function` → `React.forwardRef` + `displayName` | Radix passait un ref → warning React. Test : `src/components/ui/dialog.test.tsx` | `2026-06-19` |
| `dialog.tsx` | `DialogContent` : prop `variant` (`'default'` \| `'bottom-sheet'`) — slide-from-bottom avec easing iOS | Animation bottom-sheet mobile TaskModal | `pending` |
| `chart.tsx` | `ChartStyle` : whitelist regex sur `color` + sanitization `id`/`key` avant `dangerouslySetInnerHTML` | M-11 — durcir CSS injection | `pending` |
| `chart.tsx` | `ChartTooltipContent` / `ChartLegendContent` : types découplés de Recharts | Recharts v3 a remanié les types Tooltip/Legend → 8 erreurs `tsc`. Runtime inchangé | `pending` |

Toute nouvelle modif doit s'ajouter dans cette table.

## Mode entreprise : popups, confirmations, cas limites

> Descendu de `src/modules/organizations/CLAUDE.md` le 2026-09-26 (plafond de 14 000 o dépassé
> après la fusion des branches de l'audit du 2026-09-24). Le CLAUDE.md garde les interdits.

### Archivage d'un projet

- ⚠️ **L'archivage d'un projet est un UPDATE**, pas un DELETE, et l'application ne supprime
  jamais un projet : c'est le trigger `enforce_team_project_archive_scope` qui rattache
  l'archivage à `project.delete`. Une policy, qui juge la ligne entière, ne sait pas le faire.


---

### 📁 Projet riche, portefeuille, page projet (mig. 153, M2, 2026-09-24)

Un projet porte `description`, `owner_id` (responsable), `status`, `start_date`, `due_date`,
`is_template` + `template_payload`. Une tâche porte `start_date` (≤ `deadline`, CHECK). Les jalons
sont **retirés du front** depuis le 2026-09-30 (la table `team_project_milestones` reste en base
jusqu'à la mig. `206`, non appliquée). Dépendances entre projets (`team_project_dependencies`, même
vocabulaire que les tâches : `project_id` est BLOQUÉ par `depends_on_id`). Page projet :
`/entreprise/projects?project=<id>`, le paramètre RESTE dans l'URL (palette et panneau l'émettent).


### 🧭 Étape 6 (mig. 190-193, 2026-09-25) : rôles de projet, recherche, vues

> Descendu de `src/modules/organizations/CLAUDE.md` le 2026-10-31 (plafond de 14 000 o dépassé).

En prod **sans ligne au ledger** (relu au catalogue le 2026-09-30, cf. `supabase/migration/CLAUDE.md`).

- 🔴 `team_project_members` : `lead`/`contributor`/`viewer`. Le lecteur est refusé par TRIGGER
  (une policy PERMISSIVE ne retire rien) ; un admin n'est jamais restreint ; tout helper exige un
  membre ACTIF. Preuve : `supabase/proofs/190-193.proof.sql` (55 cas).
- ❌ Ne pas recalculer un avancement ou une charge sur `useTeamTasks` : `useTeamProjectTaskStats`
  / `useTeamMemberWorkload` comptent en base, sur TOUTES les tâches.
- La palette lit `search_org` par `search.hooks.ts` : ❌ jamais `governance.hooks` depuis l'entrée.
- Une vue enregistrée ne DONNE rien : ses filtres se relisent sous la RLS, et se valident (URL).

### 🪟 Popups entreprise (audit du 2026-09-25)

- ❌ **Un seul sélecteur de plusieurs personnes : `MemberPickList`** (recherche au-delà de
  `MEMBER_SEARCH_THRESHOLD`, groupes d'équipe, affichage par tranches de 50). Fiche de tâche,
  « Attribuer à quelqu'un » et création d'équipe l'utilisent ; ne pas en réécrire un quatrième.
  Une personne cochée puis masquée reste choisie, et le compte des cochés masqués est affiché.
- ❌ **Ne jamais recréer une tâche EN SILENCE.** Le premier commentaire d'une fiche en création
  passe par « Créer et commenter » ; après, « Annuler » devient « Fermer ».
- ❌ **Ne jamais remettre une création d'équipe ou de projet DANS une autre fiche** (tâche, OKR).
  Ces chemins créaient une équipe vide ou un projet visible par toute l'entreprise.
- ✅ Sous-tâches, dépendances (« bloquée par ») et étiquettes se saisissent DÈS la création :
  brouillon appliqué par `useApplyTeamTaskDraft` une fois l'id connu.
- ✅ Étiquettes (mig. 093) et historique par tâche (mig. 094) rebranchés : `task-extras.hooks.ts`.
  La jonction se lit PAR TÂCHE (`eq('task_id')`, tête de PK), jamais pour toute l'organisation.
- ✅ Audience d'un projet et portée d'un droit : `audience.helpers.ts` (`projectAudience`,
  `memberReach`), miroir d'affichage de `can_access_team_project`. La RLS reste la frontière.
- ⚠️ Les droits de `org_member_permissions` valent pour **toute l'organisation** ; la fiche le dit.
  Des droits par projet demanderaient une migration et une réécriture des policies : non faits.
- `PyramidPlacementSheet` remplace `MemberPlacementSheet` et `AddUnderSheet` (deux sens :
  « son responsable », « sous cette personne » avec invitation).
### 🧱 Cas limites et cohérence (audit 2026-09-24, étapes 3-4, mig. 164)

- **Confirmer ou annuler, jamais les deux styles au hasard** : un geste réversible part tout de
  suite avec `showUndoToast` ; un geste irréversible passe par `OrgConfirmDialog` (impact listé,
  saisie du nom). ❌ `window.confirm` : refusé par `org-confirm.guard.test.ts`.
- 🔴 **Un retrait passe TOUJOURS par l'assistant de départ** (`useMemberLifecycle`) : il annonce
  l'impact et fait choisir qui reprend. Côté base, `release_member_work` libère tâches OUVERTES,
  projets portés et abonnements au retrait et au départ volontaire (plus d'assigné fantôme).
- Mode `transfer` de `offboard_org_member` : ne touche QUE les champs nommés ; la personne reste.
  ❌ Ne jamais le proposer en `suspend`/`remove` sur soi-même (`modes={['transfer']}`).
- **Équipes associées** (`team_project_teams`) : elles ÉLARGISSENT la lecture (CASCADE sûr,
  contrairement à `team_id`, M5). Ajout/retrait = `project.edit`, jamais le responsable seul.
- **Purge** : `purge_archived_team_project` (INVOKER), projet archivé seulement.
- Droits d'une tâche (menus, glisser) : `team-task-rights.ts`, jamais recalculés à la main.
- 🔴 **Namespace `orgAdmin`** : départs, invitations, lots, droits, pyramide, revue, corbeille.
  Chaque section/dialogue qui s'en sert le DÉCLARE dans `OrganizationPage` (`lazyWithRetry(…,
  [..., 'orgAdmin'])`). ❌ Ne pas remettre ces groupes dans `org` : plafond de 30 ko.
- ✅ **Mig. `164`** (équipes associées, purge, mode `transfer`) est en production, sans ligne au
  ledger (relu au catalogue le 2026-09-30). ❌ Ne jamais la réappliquer : `supabase/migration/CLAUDE.md`.

## Ne jamais faire — UI

### 🎨 Convention code
- ❌ Modifier les fichiers `src/components/ui/` **sans documenter l'exception**
- ❌ Ajouter des `as any` pour contourner les erreurs TypeScript
- ❌ Appeler `toast.error()` depuis un repository ou `normalizeApiError`
- ❌ Forcer `theme="dark"` sur le `Toaster` (utiliser `theme="system"`)
- ❌ Réintroduire la section « Aperçu » dans EventModal
- ❌ Forcer `showDescription = true` au mount par défaut
- ❌ Ajouter un champ à `lockedFields` sans gérer le visuel `disabled`/`readOnly` + style locked
- ❌ **Déstructurer `const { data = [] } = useX()` sans lire `isLoading`** quand la valeur alimente un chiffre, un compteur ou un état vide visible (2026-08-27, finding 7). Le tableau vide par défaut se rend comme une **affirmation** : « 0 tâche », « aucun projet ». Rendre un squelette (`src/components/skeletons`, `OrgLoadingSkeletons`), en gris neutre `--color-hover` et **jamais** `bg-accent`, qui vaut un bleu vif dans 3 thèmes sur 4
- ❌ **Confirmer un changement de contexte irréversible par un toast** (2026-08-27, finding 9) : il est *dismissible*, donc contournable. Un départ hors de la page, une perte de saisie, une navigation qui remplace l'écran se confirment dans un dialogue **bloquant** (`AlertDialog`)
- ❌ **Monter une entrée de navigation sur `{data && …}`** (2026-08-27, finding 8) : la barre se peint sans elle, puis la fait apparaître, et tout ce qui suit saute d'une ligne. Réserver la place à partir d'un indice persisté, et ne jamais confondre cet indice avec une autorisation (cf. `faille.md` (hors dépôt))

### 📋 Listes & SmartListMenu
- ❌ Popover positionné en `absolute` dans une barre `overflow-x-auto` — utiliser `createPortal` + `position: fixed`
- ❌ Stocker la liste virtuelle « Aujourd'hui » dans la table `lists` — filtre dynamique `tasksDueToday()`, sentinel `VIRTUAL_TODAY_ID`
- ❌ `Reorder.Group` avec React Query : `values={lists}` directement — maintenir un state local `orderedLists`
- ❌ Recréer un 2ème composant qui valide les tâches assignées — **InboxMenu est le point unique**

### 🧭 Tutoriels & onboarding
- ❌ Recréer un overlay d'onboarding bloquant à l'entrée en mode démo (supprimé par c170e37)
- ❌ `useEffect([], ...)` pour détecter `cosmo_onboarding_pending` — dépendre de `[isDemo, location.pathname]`
- ❌ Fusionner les configs tutoriel desktop/mobile en un seul fichier
- ❌ Manipuler le DOM réel (FullCalendar drag) depuis une action de tutoriel — animation pure
- ❌ Ajouter du `backdropFilter: blur` au voile du PageTutorial
