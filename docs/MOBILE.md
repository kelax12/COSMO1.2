# Mobile-first — patterns et conventions

> **Avant de toucher une page mobile** : consulter [`../a-faire.md`](../a-faire.md) — bugs/régressions mobile non résolus (notamment le panneau de couleur swipe TaskCard).

## Breakpoint et hook

- Tailwind breakpoint mobile = `< md` (768 px). Le `sm` (640 px) sépare "petit mobile" et "grand mobile / phablette".
- Hook React : `useIsMobile()` depuis `@/lib/hooks/use-mobile` — boolean réactif basé sur `window.innerWidth < 768`. À utiliser quand une logique JS doit diverger mobile/desktop (ex. vue par défaut d'un calendrier). Préférer Tailwind responsive classes (`md:hidden`, `md:flex`) quand c'est purement visuel.
- Détection viewport en JS pur : `window.matchMedia('(min-width: 768px)')`.

## Layout shell mobile

- **`MobileTabBar`** (bottom tab bar, hauteur ~64 px) — visible sur mobile uniquement : `Accueil / Tâches / Agenda / Habitudes / Plus`.
- **Padding-bottom obligatoire** sur les pages : `pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8` (avec FAB) ou `+24px` (sans FAB). **Toutes les pages protégées doivent l'avoir** — sinon le dernier élément est caché derrière la tab bar.
- **`min-h-[100dvh]`** (jamais `min-h-screen`/`100vh`) sur les wrappers de page — sinon Safari iOS rogne le contenu.
- **FAB** : `fixed right-4 bottom-[calc(64px+env(safe-area-inset-bottom)+12px)] z-30 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-500`. **Pages avec FAB** : Tasks, Habits, OKR. Sans FAB : Dashboard, Settings, Agenda, Statistics.

## Échelle typographique (H1 des pages)

| Famille | Mobile | Desktop | Pages |
|---|---|---|---|
| **Hero salutation** | `text-2xl` | `sm:text-4xl lg:text-5xl` | DashboardPage uniquement |
| **Standard** | `text-2xl` | `sm:text-3xl` / `md:text-3xl` | HabitsPage, OKRPage, StatisticsPage, PremiumPage (`sm:text-4xl`) |
| **Compact inline** | `text-lg` | `sm:text-3xl` | TasksPage |

> Ne pas inventer une 4ème famille sans raison UX claire.

## Modals — pattern bottom-sheet

Tous les modals tâche (TaskModal, AddTaskForm, AddToListModal, EventModal, ColorSettingsModal, confirms de suppression) suivent ce pattern :

```tsx
<motion.div
  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
  className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
  onClick={onClose}
>
  <motion.div
    initial={{ y: '100%', opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: '100%', opacity: 0 }}
    transition={{ type: 'spring', damping: 28, stiffness: 280 }}
    onClick={(e) => e.stopPropagation()}
    className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh]"
    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
  >
    <div className="sm:hidden flex justify-center pt-2 pb-1">
      <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
    </div>
    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">…</div>
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">…</div>
    <div className="px-4 pt-3 pb-3 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">…</div>
  </motion.div>
</motion.div>
```

Règles non négociables :
- ✅ ESC pour fermer + clic backdrop + verrouillage `body.overflow` quand ouvert
- ✅ Drag handle visuel sur mobile
- ✅ Sticky header + sticky footer ; le body scrolle seul
- ✅ Boutons footer empilés sur mobile (`flex-col-reverse`), inline sur desktop
- ✅ Touch targets ≥ 44×44 px (`min-w-11 min-h-11` ou icônes ≥ 22 px dans wrapper 11)
- ✅ `env(safe-area-inset-bottom)` partout
- ❌ Pas de modal centré avec marge sur mobile — toujours bottom-sheet

`TaskModal` et `AddTaskForm` sont **full-screen** sur mobile (override des classes shadcn Dialog avec `top-0 left-0 translate-x-0 translate-y-0 max-w-none w-full h-[100dvh] sm:rounded-2xl sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-2xl`). Utiliser `100dvh` plutôt que `100vh`.

> **Structure TaskModal** (refactor 2026-06-06) : le corps mobile full-screen est extrait dans `src/components/task-modal/` (`TaskModalMobileBody.tsx` + `primitives.tsx` pour `Cell`/`SectionCard`/… + `constants.ts` pour `PRIORITY_OPTIONS`/`priorityColor`). `TaskModalMobileBody` est **entièrement piloté par props** (`MobileBodyProps`) — il ne lit aucun état du parent par closure. Ne pas refusionner ces fichiers.

## TaskCard mobile (`src/components/TaskTable.tsx → TaskCard`)

Layout style "agenda" :
- Barre verticale colorée à gauche (`w-1` rounded, `self-stretch`) — rouge pour retard, jaune pour favori, sinon couleur de catégorie
- Checkbox de complétion **inline avec le titre**
- Titre tronqué + ligne meta `date · temps` en dessous
- Badge `P{priorité}` à droite
- **Pas de TaskCategoryIndicator** (carré coloré supprimé sur mobile)
- **Toutes les icônes d'action cachées par défaut** (Bookmark, UserPlus, Calendar, MoreHorizontal, Trash2). Révélation via :
  1. **Long press** (500 ms) — `navigator.vibrate(15)` si dispo
  2. **Swipe à gauche** > 80 px (Framer Motion `drag="x"`) → `setActionsVisible(true)`
- **Swipe à droite** > 80 px → bascule `completed` (haptique + handle dans `onDragEnd`)
- Le `<TaskCard>` est wrappé dans `md:hidden` ; la `<table>` desktop dans `hidden md:block`

## TaskFilter mobile (`src/components/TaskFilter.tsx`)

- Lien `+ d'options` (texte bleu, `md:hidden`) toggle `showQuickFilters` (Favoris/Terminées/Retard/Collaboration dans `<TaskTable>`).
- Sur desktop (`md:flex`), ces 4 boutons sont **toujours** visibles.
- Bouton "Filtres" caché sur mobile (`hidden sm:inline-flex`).
- Label de tri compacté : `<span className="hidden sm:inline">Trier par :</span><span className="sm:hidden">Tri :</span>`.

## DeadlineCalendar mobile (`src/components/DeadlineCalendar.tsx`)

- Mobile = vue **agenda** (liste verticale par jour) **uniquement**. Boutons Sem./Mois masqués (`hidden sm:flex`).
- Le toggle "Agenda" est masqué sur mobile (`hidden sm:inline-flex`).
- `useEffect` force `currentView = 'agenda'` quand `isMobile` devient true.
- Bouton "Aujourd'hui" pour retour rapide.

## Modules touchés par les conventions mobile

| Composant | Particularité mobile |
|---|---|
| `TasksPage.tsx` | H1 réduit (`text-lg sm:text-3xl`), Calendrier inline, padding-bottom safe-area |
| `TaskTable.tsx → TaskCard` | Voir section dédiée |
| `TaskFilter.tsx` | Voir section dédiée |
| `TaskModal.tsx` | Full-screen, single-column, Supprimer comme icône, pas de "Marquer complétée" |
| `AddTaskForm.tsx` | `h-[100dvh]` full-screen, sticky footer empilé |
| `DeadlineCalendar.tsx` | Vue agenda forcée |
| `AddToListModal.tsx`, `EventModal.tsx`, `ColorSettingsModal.tsx` | Bottom-sheet pattern |

## Drag-to-reorder — desktop only

Sur la barre de chips des listes (TasksPage), le drag-to-reorder Framer Motion est **désactivé sur mobile** :
```tsx
drag={isEditing || isMobile ? false : 'x'}
```
Raison : la barre a `overflow-x-auto`. Le drag horizontal capturerait le swipe de scroll → conflit. Même logique pour toute barre scrollable horizontale avec items draggables.

## iOS Safari — bug WebKit fetches parallèles (`src/main.tsx`)

iOS Safari WebKit a un bug documenté ([WebKit #171501](https://bugs.webkit.org/show_bug.cgi?id=171501), [supabase-js #684](https://github.com/supabase/supabase-js/issues/684)) : quand une page charge et lance **plusieurs fetches cross-origin en parallèle** avant que la connexion HTTP/2 soit stabilisée, le navigateur accepte le 1er stream mais **rejette silencieusement les suivants** avec `TypeError: Load failed` / DOMException.

**Symptômes** : page `/tasks` ou `/habits` plante après ~8 s sur iOS Safari uniquement, "Impossible de charger les tâches", **aucune requête Supabase visible** dans Network. Ne se reproduit **que** la première fois (connexion HTTP/2 ensuite en keep-alive).

**Fix obligatoire** dans `src/main.tsx`, **avant `createRoot()`** :

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
if (supabaseUrl) {
  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = supabaseUrl;
  preconnect.crossOrigin = 'anonymous';
  document.head.appendChild(preconnect);

  fetch(`${supabaseUrl}/auth/v1/health`, { method: 'GET', mode: 'cors', credentials: 'omit' }).catch(() => {});
  fetch(`${supabaseUrl}/rest/v1/`,        { method: 'GET', mode: 'cors', credentials: 'omit' }).catch(() => {});
}
```

⚠️ **Règles non négociables** :
- ✅ Garder **les deux** warmup fetches — un seul n'amorce qu'un seul pool de streams
- ✅ Garder le `.catch(() => {})` — la requête peut échouer (401, CORS), peu importe
- ✅ Tester sur un vrai iPhone (Eruda console + `?debug=1`)
- ❌ **Ne JAMAIS** retirer ces fetches — la régression est invisible en CI/dev/desktop
- ❌ Remplacer par `<link rel="preconnect">` seul — ne committe pas de stream HTTP
- ❌ Centraliser les premières requêtes dans un seul fetch — le bug reviendra dès qu'une autre fetch sera ajoutée

**Cache localStorage complémentaire** : `src/modules/auth/AuthContext.tsx` persiste `tasks` et `habits` (clés `cosmo:qcache:{userId}:{key}`, TTL 24 h, write-through via `queryCache.subscribe`). Cleaning : `clearLocalCache(userId)` sur logout et user-change.

**Skip retry sur timeout** : `src/App.tsx` retire le retry sur `timeout` / `aborted` / `Délai` — sinon worst-case 17 s avant erreur.

**Debug iOS sans Mac** : ajouter `?debug=1` → Eruda console flottante (CDN). Logs `[AUTH] @Xms` et `[FETCH→] /path`. Zéro overhead sans le query param.

## Tester le mobile

- DevTools responsive → **375 × 812**, **393 × 852**, **412 × 915**
- Touch targets : `document.querySelectorAll('button').forEach(b => { const r = b.getBoundingClientRect(); if (r.width < 44 || r.height < 44) console.warn(b); })`
- Mode démo : 100 tâches seedées sur 12 mois — stress-test du rendu

## Ne jamais faire (mobile)

- ❌ Modal centré sur mobile (toujours bottom-sheet)
- ❌ Touch target < 44 × 44 px (WCAG 2.5.5)
- ❌ Lire `window.innerWidth` en boucle dans le render — utiliser `useIsMobile()`
- ❌ `100vh` pour un modal full-screen (utiliser `100dvh`)
- ❌ Action (validation, suppression) accessible **que** par swipe — toujours un fallback visible
- ❌ Faire diverger mobile/desktop dans le même composant sans `md:hidden` / `md:flex` / `useIsMobile()`
- ❌ Modifier `<TaskCard>` (`md:hidden`) sans vérifier que la table desktop reste intacte (`hidden md:block`)
- ❌ Réintroduire `TaskCategoryIndicator` ou des icônes inline sur la TaskCard mobile
- ❌ Retirer le warmup `fetch()` iOS Safari, le cache `cosmo:qcache:*`, ou le skip-retry sur timeout
- ❌ Lancer > 5-6 requêtes Supabase en parallèle au mount sans tester sur vrai iPhone
- ❌ Activer un `Reorder.Group` / `drag` Framer Motion sur une barre `overflow-x-auto` mobile sans guard `drag={isMobile ? false : 'x'}`
