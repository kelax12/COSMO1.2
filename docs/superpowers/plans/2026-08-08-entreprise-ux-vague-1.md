# Mode entreprise — Vague 1 : « l'écran arrête de mentir »

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** rendre actionnable et traduisible ce que le mode entreprise affiche déjà — 6 items (2, 1, 3, 4, 7, 20) sans aucune migration SQL ni changement de modèle.

**Architecture :** toute décision nouvelle (filtre de statut, agrégat de durée, compteur de badge, parsing de deep-link) est écrite comme fonction pure dans un `*.helpers.ts` couvert par Vitest ; les composants existants ne reçoivent que du câblage. Les préférences d'affichage rejoignent le `ProjectsUiPrefs` déjà persisté par org dans localStorage — pas de nouveau store.

**Tech Stack :** React 18 + TS strict, TanStack Query 5, Tailwind (tokens `rgb(var(--color-*))`), lucide-react, date-fns via `@/i18n/format`, i18n maison (`src/locales/{fr,en}/org.json`), Vitest.

---

## Structure de fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/locales/fr/org.json` | catalogue source de vérité | Modifier |
| `src/locales/en/org.json` | catalogue anglais | Modifier |
| `src/components/organization/team-projects.helpers.ts` | couleurs, tri, stats, prefs UI | Modifier (filtre statut, densité, durées) |
| `src/components/organization/team-projects.helpers.test.ts` | tests des helpers ci-dessus | **Créer** |
| `src/components/organization/deep-link.helpers.ts` | parsing/normalisation des params d'URL d'entité | **Créer** |
| `src/components/organization/deep-link.helpers.test.ts` | tests du parsing | **Créer** |
| `src/lib/hooks/use-org-notifications.ts` | compteurs de badge | Modifier (ventilation par onglet) |
| `src/lib/hooks/org-badges.helpers.ts` | calcul pur des compteurs | **Créer** |
| `src/lib/hooks/org-badges.helpers.test.ts` | tests des compteurs | **Créer** |
| `src/pages/OrganizationPage.tsx` | onglets, en-tête, deep-link | Modifier |
| `src/components/organization/TeamProjectsTab.tsx` | barre d'actions, pastilles, densité | Modifier |
| `src/components/organization/TeamProjectCard.tsx` | lignes de tâche (densité, durée) | Modifier |
| `src/components/organization/MyWorkTab.tsx` | synthèse, deep-link tâche | Modifier |

**Note de découpe :** `team-projects.helpers.ts` fait 130 lignes et gagne ~60 lignes. Il reste sous le seuil du refactor god-component (600 LOC) et garde une responsabilité claire (« logique de l'onglet Projets »). On ne le scinde pas.

---

## Task 1 : Catalogue i18n — inventaire réel

**Files:**
- Modify: `src/locales/fr/org.json`
- Modify: `src/locales/en/org.json`

- [ ] **Step 1 : Lister les chaînes en dur, ne pas les deviner**

Run: `npm run i18n:scan`

Attendu : un rapport listant les littéraux JSX non traduits. Noter ceux dont le
chemin commence par `src/components/organization/` ou vaut `src/pages/OrganizationPage.tsx`.

Chaînes déjà repérées à la lecture (le scan doit au minimum les contenir) :

| Fichier | Chaîne |
|---|---|
| `OrganizationPage.tsx` | `Annuaire ({members.length})` |
| `OrganizationPage.tsx` | `Supprimer l'entreprise` |
| `OrganizationPage.tsx` | `Quitter l'entreprise` |
| `MyWorkTab.tsx` | `Prochaines échéances de l'entreprise` |
| `TeamProjectsTab.tsx` | `Toutes les tâches` / `Mes tâches` |
| `TeamProjectsTab.tsx` | `Tâches de…` |
| `TeamProjectsTab.tsx` | `Nouveau projet` |
| `TeamProjectsTab.tsx` | `Vue liste` |
| `TeamProjectsTab.tsx` | `{n} projet(s)` / `{n} ouverte(s)` / `{n} en retard` |

- [ ] **Step 2 : Ajouter les clés au catalogue FR**

Dans `src/locales/fr/org.json`, section `"projects"`, ajouter :

```json
"allTasks": "Toutes les tâches",
"myTasks": "Mes tâches",
"tasksOf": "Tâches de…",
"newProject": "Nouveau projet",
"listView": "Vue liste",
"projectCount_one": "{{count}} projet",
"projectCount_other": "{{count}} projets",
"openCount_one": "{{count}} ouverte",
"openCount_other": "{{count}} ouvertes",
"overdueCount_one": "{{count}} en retard",
"overdueCount_other": "{{count}} en retard",
```

Section `"page"`, ajouter :

```json
"directoryTitle": "Annuaire ({{count}})",
"deleteOrg": "Supprimer l'entreprise",
"leaveOrg": "Quitter l'entreprise",
```

Section `"myWork"`, ajouter :

```json
"orgDeadlines": "Prochaines échéances de l'entreprise",
```

- [ ] **Step 3 : Répliquer dans le catalogue EN**

Dans `src/locales/en/org.json`, mêmes chemins :

```json
"allTasks": "All tasks",
"myTasks": "My tasks",
"tasksOf": "Tasks of…",
"newProject": "New project",
"listView": "List view",
"projectCount_one": "{{count}} project",
"projectCount_other": "{{count}} projects",
"openCount_one": "{{count}} open",
"openCount_other": "{{count}} open",
"overdueCount_one": "{{count}} overdue",
"overdueCount_other": "{{count}} overdue",
```

```json
"directoryTitle": "Directory ({{count}})",
"deleteOrg": "Delete organization",
"leaveOrg": "Leave organization",
```

```json
"orgDeadlines": "Upcoming company deadlines",
```

- [ ] **Step 4 : Vérifier la complétude**

Run: `npm run i18n:check`
Attendu : `0 clé manquante` (aucune sortie d'erreur, code de sortie 0).

- [ ] **Step 5 : Commit**

```bash
git add src/locales/fr/org.json src/locales/en/org.json
git commit -m "i18n(entreprise): ajoute les cles manquantes des onglets Projets/Membres/Apercu"
```

---

## Task 2 : Câbler les composants sur le catalogue

**Files:**
- Modify: `src/pages/OrganizationPage.tsx:269`, `:307`, `:319`
- Modify: `src/components/organization/MyWorkTab.tsx:305`
- Modify: `src/components/organization/TeamProjectsTab.tsx:211-224`, `:241`, `:250`, `:271`, `:316`, `:343`

- [ ] **Step 1 : Remplacer dans `OrganizationPage.tsx`**

Ligne ~269 :

```tsx
<h2 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
  {t('page.directoryTitle', { count: members.length })}
</h2>
```

Ligne ~307 (bouton rouge) : `<Trash2 size={15} aria-hidden="true" /> {t('page.deleteOrg')}`

Ligne ~319 : `<LogOut size={15} aria-hidden="true" /> {t('page.leaveOrg')}`

- [ ] **Step 2 : Remplacer dans `MyWorkTab.tsx`**

Ligne ~305 :

```tsx
<h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
  {t('myWork.orgDeadlines')}
</h3>
```

- [ ] **Step 3 : Remplacer dans `TeamProjectsTab.tsx`**

Les trois pastilles (lignes ~211-224) — noter le passage de la pluralisation
manuelle `{n > 1 ? 's' : ''}` à `tp`, qui est faux en anglais :

```tsx
<FolderKanban size={12} aria-hidden="true" /> {tp('projects.projectCount', activeProjects.length)}
```
```tsx
<CircleDashed size={12} aria-hidden="true" /> {tp('projects.openCount', openCount)}
```
```tsx
<AlarmClock size={12} aria-hidden="true" /> {tp('projects.overdueCount', overdueCount)}
```

Boutons du segment (lignes ~241, ~250) : `{t('projects.allTasks')}` et `{t('projects.myTasks')}`.
Déclencheur du dropdown (ligne ~271) : `<UserRound size={14} aria-hidden="true" /> {t('projects.tasksOf')}`.
Bouton vue liste (ligne ~316) : `aria-label={t('projects.listView')}` et `title={t('projects.listView')}`.
Bouton nouveau projet (ligne ~343) : `<Plus size={15} aria-hidden="true" /> {t('projects.newProject')}`.

- [ ] **Step 4 : Vérifier**

Run: `npm run typecheck`
Attendu : 0 erreur. Une clé mal orthographiée est une **erreur de compilation**
(`t` est typée par le catalogue FR) — c'est le filet de sécurité de cette tâche.

Run: `npm run lint`
Attendu : 0 erreur.

- [ ] **Step 5 : Commit**

```bash
git add src/pages/OrganizationPage.tsx src/components/organization/MyWorkTab.tsx src/components/organization/TeamProjectsTab.tsx
git commit -m "i18n(entreprise): remplace les chaines FR en dur par le catalogue"
```

---

## Task 3 : Helpers de filtre de statut + densité + durées

**Files:**
- Modify: `src/components/organization/team-projects.helpers.ts`
- Create: `src/components/organization/team-projects.helpers.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/components/organization/team-projects.helpers.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import {
  filterByStatus, sumEstimatedTime, formatDuration, type TaskStatusFilter,
} from './team-projects.helpers';
import type { TeamTask } from '@/modules/team-projects';

const base: TeamTask = {
  id: 't1', orgId: 'o1', projectId: 'p1', name: 'Tache', priority: 3,
  assigneeIds: [], createdBy: 'u1', completed: false,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};

const task = (over: Partial<TeamTask>): TeamTask => ({ ...base, ...over });

// Date fixe pour les retards : hier / demain relatifs au jour du test.
const iso = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

describe('filterByStatus', () => {
  const tasks = [
    task({ id: 'open', deadline: iso(3) }),
    task({ id: 'late', deadline: iso(-3) }),
    task({ id: 'done', completed: true, completedAt: new Date().toISOString() }),
  ];

  it('retourne tout pour "all"', () => {
    expect(filterByStatus(tasks, 'all')).toHaveLength(3);
  });

  it('ne garde que les tâches ouvertes pour "open"', () => {
    expect(filterByStatus(tasks, 'open').map((t) => t.id)).toEqual(['open', 'late']);
  });

  it('ne garde que les tâches en retard pour "overdue"', () => {
    expect(filterByStatus(tasks, 'overdue').map((t) => t.id)).toEqual(['late']);
  });

  it('ne garde que les tâches terminées cette semaine pour "doneThisWeek"', () => {
    expect(filterByStatus(tasks, 'doneThisWeek').map((t) => t.id)).toEqual(['done']);
  });

  it('exclut une tâche terminée il y a plus d\'une semaine', () => {
    const old = task({ id: 'old', completed: true, completedAt: '2020-01-01T00:00:00Z' });
    expect(filterByStatus([old], 'doneThisWeek')).toHaveLength(0);
  });
});

describe('sumEstimatedTime', () => {
  it('somme les minutes estimées', () => {
    expect(sumEstimatedTime([task({ estimatedTime: 30 }), task({ estimatedTime: 45 })])).toBe(75);
  });

  it('ignore les tâches sans estimation', () => {
    expect(sumEstimatedTime([task({ estimatedTime: 30 }), task({})])).toBe(30);
  });

  it('retourne 0 sur une liste vide', () => {
    expect(sumEstimatedTime([])).toBe(0);
  });
});

describe('formatDuration', () => {
  it('formate les minutes seules', () => {
    expect(formatDuration(45)).toBe('45 min');
  });

  it('formate les heures rondes', () => {
    expect(formatDuration(120)).toBe('2 h');
  });

  it('formate heures et minutes', () => {
    expect(formatDuration(135)).toBe('2 h 15');
  });

  it('retourne une chaîne vide pour 0', () => {
    expect(formatDuration(0)).toBe('');
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/components/organization/team-projects.helpers.test.ts`
Attendu : ÉCHEC — `filterByStatus is not exported` / `does not provide an export named`.

- [ ] **Step 3 : Implémenter dans `team-projects.helpers.ts`**

Après `completedThisWeek` (ligne ~78), ajouter :

```ts
// ─── Filtre de statut (pastilles cliquables, item #4) ────────────────

/** Filtre actif des pastilles de synthèse. `all` = aucun filtre. */
export type TaskStatusFilter = 'all' | 'open' | 'overdue' | 'doneThisWeek';

/**
 * Restreint une liste de tâches au filtre de statut choisi.
 *
 * `doneThisWeek` utilise la MÊME fenêtre de 7 jours que `completedThisWeek` :
 * si les deux divergeaient, la pastille afficherait un compte que le filtre
 * ne saurait pas reproduire.
 */
export const filterByStatus = (tasks: TeamTask[], filter: TaskStatusFilter): TeamTask[] => {
  if (filter === 'all') return tasks;
  if (filter === 'open') return tasks.filter((t) => !t.completed);
  if (filter === 'overdue') return tasks.filter(isTaskOverdue);
  const cutoff = Date.now() - WEEK_MS;
  return tasks.filter(
    (t) => t.completed && t.completedAt && new Date(t.completedAt).getTime() >= cutoff,
  );
};

// ─── Durées estimées (item #20) ──────────────────────────────────────

/** Somme des `estimatedTime` (minutes) ; les tâches sans estimation valent 0. */
export const sumEstimatedTime = (tasks: TeamTask[]): number =>
  tasks.reduce((sum, t) => sum + (t.estimatedTime ?? 0), 0);

/**
 * Minutes → libellé court (`45 min`, `2 h`, `2 h 15`).
 * Renvoie '' pour 0 : l'appelant n'affiche alors rien du tout plutôt qu'un
 * « 0 min » qui ferait croire à une estimation saisie et nulle.
 */
export const formatDuration = (minutes: number): string => {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
};
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/components/organization/team-projects.helpers.test.ts`
Attendu : PASS, 12 tests.

- [ ] **Step 5 : Commit**

```bash
git add src/components/organization/team-projects.helpers.ts src/components/organization/team-projects.helpers.test.ts
git commit -m "feat(entreprise): helpers filtre de statut et duree estimee"
```

---

## Task 4 : Pastilles cliquables (item #4) + densité (item #7)

**Files:**
- Modify: `src/components/organization/team-projects.helpers.ts` (prefs)
- Modify: `src/components/organization/TeamProjectsTab.tsx`
- Modify: `src/components/organization/TeamProjectCard.tsx`
- Modify: `src/locales/fr/org.json`, `src/locales/en/org.json`

- [ ] **Step 1 : Étendre `ProjectsUiPrefs`**

Dans `team-projects.helpers.ts`, ajouter deux champs à l'interface (ligne ~82) :

```ts
export interface ProjectsUiPrefs {
  view: 'list' | 'kanban';
  assigneeFilter: string | null;
  teamFilter: string;
  collapsed: Record<string, boolean>;
  showArchived: boolean;
  /** Pastille de synthèse active (item #4). */
  statusFilter: TaskStatusFilter;
  /** Densité des listes de tâches (item #7). */
  density: 'comfortable' | 'compact';
}
```

Et les valeurs par défaut (ligne ~92) :

```ts
const DEFAULT_PREFS: ProjectsUiPrefs = {
  view: 'list',
  assigneeFilter: null,
  teamFilter: '',
  collapsed: {},
  showArchived: false,
  statusFilter: 'all',
  density: 'comfortable',
};
```

> `readPrefs` fait déjà `{ ...DEFAULT_PREFS, ...parsed }` : un utilisateur avec
> des prefs enregistrées avant cette version reçoit les deux nouveaux champs
> sans migration ni purge.

- [ ] **Step 2 : Clés i18n des nouveaux contrôles**

`src/locales/fr/org.json`, section `"projects"` :

```json
"filterOpen": "Voir uniquement les tâches ouvertes",
"filterOverdue": "Voir uniquement les tâches en retard",
"filterDone": "Voir les tâches terminées cette semaine",
"filterClear": "Retirer le filtre",
"densityToggle": "Densité d'affichage",
"densityComfortable": "Confortable",
"densityCompact": "Compact",
"estimatedTotal": "{{duration}} estimées",
```

`src/locales/en/org.json`, mêmes chemins :

```json
"filterOpen": "Show open tasks only",
"filterOverdue": "Show overdue tasks only",
"filterDone": "Show tasks completed this week",
"filterClear": "Clear filter",
"densityToggle": "Display density",
"densityComfortable": "Comfortable",
"densityCompact": "Compact",
"estimatedTotal": "{{duration}} estimated",
```

- [ ] **Step 3 : Rendre les pastilles cliquables dans `TeamProjectsTab.tsx`**

Extraire le motif répété en composant local, juste avant `const TeamProjectsTab` :

```tsx
/** Pastille de synthèse cliquable : bascule le filtre de statut (item #4). */
const StatPill = ({ active, onClick, label, tone, children }: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: 'neutral' | 'danger' | 'success';
  children: React.ReactNode;
}) => {
  const toneClass =
    tone === 'danger'
      ? 'bg-red-500/10 text-red-500 font-semibold'
      : tone === 'success'
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
        : 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))] font-medium';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60 ${toneClass} ${
        active ? 'ring-2 ring-[rgb(var(--color-accent))]' : 'hover:brightness-110'
      }`}
    >
      {children}
    </button>
  );
};
```

Puis, dans le corps du composant, à côté des autres prefs (ligne ~92) :

```tsx
const { teamFilter, assigneeFilter, view, collapsed, showArchived, statusFilter, density } = prefs;
```

Bascule (un second clic sur la pastille active retire le filtre) :

```tsx
const toggleStatus = (next: TaskStatusFilter) =>
  updatePrefs({ statusFilter: statusFilter === next ? 'all' : next });
```

Remplacer le bloc « Pouls » (lignes ~208-227) :

```tsx
{activeProjects.length > 0 && (
  <div className="flex items-center gap-2 flex-wrap text-xs">
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))] font-medium">
      <FolderKanban size={12} aria-hidden="true" /> {tp('projects.projectCount', activeProjects.length)}
    </span>
    <StatPill
      active={statusFilter === 'open'}
      onClick={() => toggleStatus('open')}
      label={statusFilter === 'open' ? t('projects.filterClear') : t('projects.filterOpen')}
      tone="neutral"
    >
      <CircleDashed size={12} aria-hidden="true" /> {tp('projects.openCount', openCount)}
    </StatPill>
    {overdueCount > 0 && (
      <StatPill
        active={statusFilter === 'overdue'}
        onClick={() => toggleStatus('overdue')}
        label={statusFilter === 'overdue' ? t('projects.filterClear') : t('projects.filterOverdue')}
        tone="danger"
      >
        <AlarmClock size={12} aria-hidden="true" /> {tp('projects.overdueCount', overdueCount)}
      </StatPill>
    )}
    {doneThisWeek > 0 && (
      <StatPill
        active={statusFilter === 'doneThisWeek'}
        onClick={() => toggleStatus('doneThisWeek')}
        label={statusFilter === 'doneThisWeek' ? t('projects.filterClear') : t('projects.filterDone')}
        tone="success"
      >
        <CheckCircle2 size={12} aria-hidden="true" /> {tp('projects.doneThisWeek', doneThisWeek)}
      </StatPill>
    )}
    {totalEstimated > 0 && (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))] font-medium">
        <Clock size={12} aria-hidden="true" /> {t('projects.estimatedTotal', { duration: formatDuration(totalEstimated) })}
      </span>
    )}
  </div>
)}
```

- [ ] **Step 4 : Appliquer le filtre et calculer le total estimé**

Toujours dans `TeamProjectsTab.tsx`, remplacer le `visibleTasks` existant (ligne ~113) :

```tsx
// Vue filtrée : assigné (dropdown) PUIS statut (pastilles). Les compteurs des
// pastilles restent calculés sur `statsTasks` non filtré — sinon cliquer
// « en retard » ferait tomber son propre compteur à sa propre valeur filtrée.
const visibleTasks = useMemo(() => {
  const byAssignee = assigneeFilter
    ? allTasks.filter((t) => t.assigneeIds.includes(assigneeFilter))
    : allTasks;
  return filterByStatus(byAssignee, statusFilter);
}, [allTasks, assigneeFilter, statusFilter]);

/** Reste à faire estimé sur le périmètre visible (item #20). */
const totalEstimated = useMemo(
  () => sumEstimatedTime(statsTasks.filter((t) => !t.completed)),
  [statsTasks],
);
```

Ajouter les imports :

```tsx
import { Clock } from 'lucide-react';
import {
  useProjectsUiPrefs, isTaskOverdue, completedThisWeek,
  filterByStatus, sumEstimatedTime, formatDuration, type TaskStatusFilter,
} from './team-projects.helpers';
```

- [ ] **Step 5 : Ajouter le sélecteur de densité**

Dans la barre d'actions, à côté du segment Liste/Kanban (ligne ~310) :

```tsx
<button
  type="button"
  onClick={() => updatePrefs({ density: density === 'compact' ? 'comfortable' : 'compact' })}
  aria-pressed={density === 'compact'}
  title={density === 'compact' ? t('projects.densityComfortable') : t('projects.densityCompact')}
  aria-label={t('projects.densityToggle')}
  className={`w-9 h-9 rounded-lg border border-[rgb(var(--color-border))] flex items-center justify-center transition-colors ${
    density === 'compact'
      ? 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]'
      : 'text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]'
  }`}
>
  <Rows3 size={15} aria-hidden="true" />
</button>
```

Import : ajouter `Rows3` à l'import `lucide-react`.

- [ ] **Step 6 : Propager la densité à la carte projet**

Passer la prop dans `renderProjectCard` (ligne ~184) : `density={density}`.

Dans `TeamProjectCard.tsx`, ajouter à l'interface de props :

```tsx
  /** Densité des lignes de tâche (item #7). */
  density: 'comfortable' | 'compact';
```

et appliquer sur le conteneur des lignes de tâche :

```tsx
const rowClass = density === 'compact' ? 'py-1 text-xs' : 'py-1.5 text-sm';
```

en remplaçant les classes `py-1.5` / `text-sm` codées en dur sur la ligne de tâche
par `rowClass`.

- [ ] **Step 7 : Vérifier**

Run: `npm run typecheck && npm run lint && npm test`
Attendu : 0 erreur, 0 erreur, suite verte.

- [ ] **Step 8 : Vérification visuelle**

Ouvrir la preview, aller sur `/entreprise?tab=projects`, et vérifier :
1. clic sur « N en retard » → la liste se restreint, la pastille prend l'anneau d'accent ;
2. second clic → filtre retiré ;
3. bouton densité → les lignes se resserrent, et l'état survit à un rechargement ;
4. en 375 px, la rangée de pastilles passe à la ligne sans déborder ;
5. thème sombre : aucune couleur en dur, tout suit les tokens.

- [ ] **Step 9 : Commit**

```bash
git add src/components/organization/ src/locales/
git commit -m "feat(entreprise): pastilles de statut cliquables, densite reglable, total estime"
```

---

## Task 5 : Deep-link jusqu'à l'entité (item #1)

**Files:**
- Create: `src/components/organization/deep-link.helpers.ts`
- Create: `src/components/organization/deep-link.helpers.test.ts`
- Modify: `src/pages/OrganizationPage.tsx`
- Modify: `src/components/organization/TeamProjectsTab.tsx`
- Modify: `src/components/organization/MyWorkTab.tsx`
- Modify: `src/components/CommandPalette.tsx:152,163`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/components/organization/deep-link.helpers.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { readEntityParam, buildOrgLink } from './deep-link.helpers';

describe('readEntityParam', () => {
  it('lit un id de tâche', () => {
    expect(readEntityParam(new URLSearchParams('?task=abc'), 'task')).toBe('abc');
  });

  it('retourne null quand le paramètre est absent', () => {
    expect(readEntityParam(new URLSearchParams('?tab=okr'), 'task')).toBeNull();
  });

  it('retourne null sur une valeur vide', () => {
    expect(readEntityParam(new URLSearchParams('?task='), 'task')).toBeNull();
  });

  it('rejette une valeur trop longue (garde anti-URL forgée)', () => {
    const long = 'x'.repeat(100);
    expect(readEntityParam(new URLSearchParams(`?task=${long}`), 'task')).toBeNull();
  });

  it('rejette une valeur avec des caractères hors id', () => {
    expect(readEntityParam(new URLSearchParams('?task=<script>'), 'task')).toBeNull();
  });
});

describe('buildOrgLink', () => {
  it('construit un lien d\'onglet seul', () => {
    expect(buildOrgLink('projects')).toBe('/entreprise?tab=projects');
  });

  it('construit un lien vers une entité', () => {
    expect(buildOrgLink('projects', { task: 'abc' })).toBe('/entreprise?tab=projects&task=abc');
  });

  it('omet l\'onglet par défaut', () => {
    expect(buildOrgLink('overview')).toBe('/entreprise');
  });

  it('garde l\'entité même sur l\'onglet par défaut', () => {
    expect(buildOrgLink('overview', { task: 'abc' })).toBe('/entreprise?task=abc');
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/components/organization/deep-link.helpers.test.ts`
Attendu : ÉCHEC — module introuvable.

- [ ] **Step 3 : Implémenter**

Créer `src/components/organization/deep-link.helpers.ts` :

```ts
// ═══════════════════════════════════════════════════════════════════
// Deep-links de l'espace entreprise (item #1)
//
// `?tab=` ouvrait déjà le bon onglet ; `?task=` / `?project=` / `?member=`
// ouvrent en plus la bonne entité. C'est ce qui rend une tâche collable dans
// une conversation — sans ça, « regarde cette tâche » se termine toujours par
// « cherche-la dans l'onglet Projets ».
// ═══════════════════════════════════════════════════════════════════

/** Entités adressables par l'URL de /entreprise. */
export type EntityParam = 'task' | 'project' | 'member';

/**
 * Un id vient toujours d'un UUID Supabase. On borne longueur et alphabet :
 * la valeur finit dans un `find()` puis dans du JSX, et une URL est une entrée
 * non fiable comme une autre.
 */
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Lit un id d'entité dans l'URL, ou null si absent / malformé. */
export const readEntityParam = (
  params: URLSearchParams,
  key: EntityParam,
): string | null => {
  const raw = params.get(key);
  if (!raw || !ID_RE.test(raw)) return null;
  return raw;
};

/** Construit un lien /entreprise (onglet + entité optionnelle). */
export const buildOrgLink = (
  tab: string,
  entity?: Partial<Record<EntityParam, string>>,
): string => {
  const params = new URLSearchParams();
  if (tab && tab !== 'overview') params.set('tab', tab);
  for (const [key, value] of Object.entries(entity ?? {})) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/entreprise?${qs}` : '/entreprise';
};
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/components/organization/deep-link.helpers.test.ts`
Attendu : PASS, 9 tests.

- [ ] **Step 5 : Consommer le param dans `TeamProjectsTab.tsx`**

Après les hooks de données, ajouter :

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const deepTaskId = readEntityParam(searchParams, 'task');

// Ouvre la tâche ciblée par l'URL une fois les données arrivées, puis retire
// le paramètre : sans ce nettoyage, refermer le modal le rouvrirait au rendu
// suivant (l'URL redeviendrait la source de vérité).
useEffect(() => {
  if (!deepTaskId) return;
  const target = allTasks.find((t) => t.id === deepTaskId);
  if (!target) return;
  setTaskModal({ mode: 'edit', task: target });
  const next = new URLSearchParams(searchParams);
  next.delete('task');
  setSearchParams(next, { replace: true });
}, [deepTaskId, allTasks, searchParams, setSearchParams]);
```

Imports : `import { useEffect } from 'react';`, `import { useSearchParams } from 'react-router';`,
`import { readEntityParam } from './deep-link.helpers';`.

- [ ] **Step 6 : Faire pointer la CommandPalette sur l'entité**

Dans `src/components/CommandPalette.tsx`, ligne ~152 :

```tsx
onSelect={() => go(buildOrgLink('projects', { task: teamTask.id }))}
```

et ligne ~163 :

```tsx
onSelect={() => go(buildOrgLink('projects', { project: p.id }))}
```

Import : `import { buildOrgLink } from '@/components/organization/deep-link.helpers';`

- [ ] **Step 7 : Vérifier**

Run: `npm run typecheck && npm run lint && npm test`
Attendu : 0 erreur, 0 erreur, suite verte.

Vérification manuelle : ouvrir `/entreprise?tab=projects&task=<id réel>` →
le modal de la tâche s'ouvre, et l'URL redevient `/entreprise?tab=projects`.

- [ ] **Step 8 : Commit**

```bash
git add src/components/organization/deep-link.helpers.ts src/components/organization/deep-link.helpers.test.ts src/components/organization/TeamProjectsTab.tsx src/components/CommandPalette.tsx
git commit -m "feat(entreprise): deep-links vers une tache ou un projet"
```

---

## Task 6 : Badges par onglet (item #3)

**Files:**
- Create: `src/lib/hooks/org-badges.helpers.ts`
- Create: `src/lib/hooks/org-badges.helpers.test.ts`
- Modify: `src/lib/hooks/use-org-notifications.ts`
- Modify: `src/pages/OrganizationPage.tsx`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/lib/hooks/org-badges.helpers.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { computeOrgBadges } from './org-badges.helpers';
import type { TeamTask } from '@/modules/team-projects';

const base: TeamTask = {
  id: 't1', orgId: 'o1', projectId: 'p1', name: 'T', priority: 3,
  assigneeIds: [], createdBy: 'other', completed: false,
  createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
};
const task = (over: Partial<TeamTask>): TeamTask => ({ ...base, ...over });
const LAST_SEEN = Date.parse('2026-01-01T00:00:00Z');

describe('computeOrgBadges', () => {
  it('compte les tâches qui me sont assignées depuis la dernière visite', () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0,
      tasks: [task({ assigneeIds: ['me'] })],
    });
    expect(badges.projects).toBe(1);
    expect(badges.total).toBe(1);
  });

  it('ignore une tâche que je me suis assignée moi-même', () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0,
      tasks: [task({ assigneeIds: ['me'], createdBy: 'me' })],
    });
    expect(badges.projects).toBe(0);
  });

  it('ignore une tâche déjà terminée', () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0,
      tasks: [task({ assigneeIds: ['me'], completed: true })],
    });
    expect(badges.projects).toBe(0);
  });

  it('ignore une tâche antérieure à la dernière visite', () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: Date.parse('2026-02-01T00:00:00Z'), pendingRequests: 0,
      tasks: [task({ assigneeIds: ['me'] })],
    });
    expect(badges.projects).toBe(0);
  });

  it('range les demandes d\'adhésion sur l\'onglet Membres', () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 3, tasks: [],
    });
    expect(badges.members).toBe(3);
    expect(badges.projects).toBe(0);
    expect(badges.total).toBe(3);
  });

  it('additionne les deux sources dans le total', () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 2,
      tasks: [task({ assigneeIds: ['me'] })],
    });
    expect(badges.total).toBe(3);
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/lib/hooks/org-badges.helpers.test.ts`
Attendu : ÉCHEC — module introuvable.

- [ ] **Step 3 : Implémenter**

Créer `src/lib/hooks/org-badges.helpers.ts` :

```ts
// ═══════════════════════════════════════════════════════════════════
// Compteurs de badge de l'espace entreprise (item #3)
//
// Le calcul vivait inline dans `use-org-notifications.ts` et ne produisait
// qu'un total pour la nav. Il est extrait ici pour être ventilé par onglet
// ET testé : c'est la seule partie qui décide quelque chose.
// ═══════════════════════════════════════════════════════════════════

import type { TeamTask } from '@/modules/team-projects';

export interface OrgBadgeInput {
  userId: string;
  /** Timestamp (ms) de la dernière visite de /entreprise. */
  lastSeen: number;
  /** Demandes d'adhésion en attente (0 si non-admin). */
  pendingRequests: number;
  tasks: TeamTask[];
}

export interface OrgBadges {
  /** Tâches nouvellement assignées → onglet Projets. */
  projects: number;
  /** Demandes d'adhésion en attente → onglet Membres. */
  members: number;
  /** Somme — c'est ce qu'affiche la pastille de navigation. */
  total: number;
}

export const computeOrgBadges = ({
  userId, lastSeen, pendingRequests, tasks,
}: OrgBadgeInput): OrgBadges => {
  const projects = tasks.filter((t) => {
    if (t.completed || !t.assigneeIds.includes(userId)) return false;
    // S'auto-assigner ne notifie pas : on sait déjà ce qu'on vient d'écrire.
    if (t.createdBy === userId) return false;
    const created = Date.parse(t.createdAt);
    return Number.isFinite(created) && created > lastSeen;
  }).length;

  return { projects, members: pendingRequests, total: projects + pendingRequests };
};
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/lib/hooks/org-badges.helpers.test.ts`
Attendu : PASS, 6 tests.

- [ ] **Step 5 : Recâbler `use-org-notifications.ts` sur le helper**

Remplacer le corps de `useOrgNotificationCount` et exposer la ventilation :

```ts
import { computeOrgBadges, type OrgBadges } from './org-badges.helpers';

const EMPTY_BADGES: OrgBadges = { projects: 0, members: 0, total: 0 };

/** Compteurs ventilés par onglet — source unique du badge nav ET des onglets. */
export function useOrgBadges(): OrgBadges {
  const { user } = useAuth();
  const { activeOrg } = useActiveOrganization();
  const isAdmin = activeOrg?.myRole === 'admin';
  const { data: requests = [] } = useOrgJoinRequests(isAdmin ? activeOrg?.id : undefined);
  const { data: tasks = [] } = useTeamTasks(activeOrg?.id);

  return useMemo(() => {
    if (!activeOrg || !user?.id) return EMPTY_BADGES;
    return computeOrgBadges({
      userId: user.id,
      lastSeen: readOrgLastSeen(activeOrg.id),
      pendingRequests: requests.filter((r) => r.status === 'pending').length,
      tasks,
    });
  }, [activeOrg, user?.id, requests, tasks]);
}

/** Total pour la pastille de navigation (compat : signature inchangée). */
export function useOrgNotificationCount(): number {
  return useOrgBadges().total;
}
```

- [ ] **Step 6 : Afficher le badge sur les onglets**

Dans `OrganizationPage.tsx`, importer `useOrgBadges` et l'appeler à côté des
autres hooks :

```tsx
const badges = useOrgBadges();
```

Dans le `.map` des onglets, après `{t(labelKey)}` :

```tsx
{(id === 'projects' ? badges.projects : id === 'members' ? badges.members : 0) > 0 && (
  <span
    className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[rgb(var(--color-accent))] text-white text-[10px] font-bold inline-flex items-center justify-center"
    aria-label={tp('page.badgeCount', id === 'projects' ? badges.projects : badges.members)}
  >
    {id === 'projects' ? badges.projects : badges.members}
  </span>
)}
```

⚠️ `markOrgSeen` est appelé au mount de la page ([OrganizationPage.tsx:79](../../src/pages/OrganizationPage.tsx#L79)),
donc `lastSeen` est remis à `now` dès l'arrivée. Le badge d'onglet serait donc
toujours à 0. **Déplacer l'appel** : ne marquer vu que lorsqu'on quitte la page,
via le cleanup de l'effet :

```tsx
useEffect(() => {
  if (!myOrg?.id) return;
  return () => markOrgSeen(myOrg.id);
}, [myOrg?.id]);
```

- [ ] **Step 7 : Clé i18n du badge**

`src/locales/fr/org.json`, section `"page"` :

```json
"badgeCount_one": "{{count}} nouveauté",
"badgeCount_other": "{{count}} nouveautés",
```

`src/locales/en/org.json` :

```json
"badgeCount_one": "{{count}} new item",
"badgeCount_other": "{{count}} new items",
```

- [ ] **Step 8 : Vérifier**

Run: `npm run typecheck && npm run lint && npm test && npm run i18n:check`
Attendu : tout vert.

- [ ] **Step 9 : Commit**

```bash
git add src/lib/hooks/ src/pages/OrganizationPage.tsx src/locales/
git commit -m "feat(entreprise): badges de compteur ventiles par onglet"
```

---

## Task 7 : Durée estimée sur la carte projet et la synthèse (item #20)

**Files:**
- Modify: `src/components/organization/TeamProjectCard.tsx`
- Modify: `src/components/organization/MyWorkTab.tsx`

- [ ] **Step 1 : Afficher le reste estimé sur la carte projet**

Dans `TeamProjectCard.tsx`, à côté du compteur de tâches de l'en-tête :

```tsx
{restEstimated > 0 && (
  <span className="inline-flex items-center gap-1 text-[10px] text-[rgb(var(--color-text-muted))]">
    <Clock size={10} aria-hidden="true" /> {formatDuration(restEstimated)}
  </span>
)}
```

avec, dans le corps du composant :

```tsx
const restEstimated = useMemo(
  () => sumEstimatedTime(tasks.filter((t) => !t.completed)),
  [tasks],
);
```

Imports : `Clock` depuis `lucide-react`, `{ formatDuration, sumEstimatedTime }`
depuis `./team-projects.helpers`, `useMemo` depuis `react`.

- [ ] **Step 2 : Afficher la durée sur la ligne de tâche du modal ouvert**

Dans `TeamTaskModal.tsx`, le champ existe déjà et est saisi — aucun changement.

- [ ] **Step 3 : Afficher mon reste à faire dans `MyWorkTab.tsx`**

Sous la carte de synthèse, ajouter au bloc « Mes tâches » :

```tsx
{myEstimated > 0 && (
  <span className="text-xs font-normal text-[rgb(var(--color-text-muted))] ml-2">
    · {formatDuration(myEstimated)}
  </span>
)}
```

avec :

```tsx
const myEstimated = useMemo(() => sumEstimatedTime(open), [open]);
```

Import : `{ sumEstimatedTime, formatDuration }` depuis `./team-projects.helpers`.

- [ ] **Step 4 : Vérifier**

Run: `npm run typecheck && npm run lint && npm test`
Attendu : tout vert.

Vérification manuelle : créer une tâche avec `Temps estimé = 90`, confirmer que
la carte projet affiche `1 h 30` et que le total de l'onglet le compte.

- [ ] **Step 5 : Commit**

```bash
git add src/components/organization/
git commit -m "feat(entreprise): expose le temps estime sur les cartes et la synthese"
```

---

## Clôture de vague

- [ ] **Vérification complète**

```bash
npm run lint && npm run typecheck && npm test && npm run i18n:check
```

- [ ] **Vérification visuelle** — `/entreprise`, onglets Aperçu / Projets / Membres,
      en 375 px et 1280 px, thèmes clair et sombre.

- [ ] **Push**

```bash
git push
```

---

## Auto-revue (menée à l'écriture du plan)

**Couverture du périmètre.** Items 2 (Tasks 1-2), 1 (Task 5), 3 (Task 6),
4 (Tasks 3-4), 7 (Task 4), 20 (Tasks 3, 4, 7). Les 6 items sont couverts.

**Cohérence des types.** `TaskStatusFilter` est défini Task 3 et consommé
Tasks 3-4 sous ce nom exact. `OrgBadges` défini Task 6 step 3, consommé step 5.
`formatDuration` / `sumEstimatedTime` définis Task 3, consommés Tasks 4 et 7.
`buildOrgLink` / `readEntityParam` définis Task 5 step 3, consommés steps 5-6.

**Piège identifié pendant l'écriture** — Task 6 step 6 : `markOrgSeen` au mount
annule le badge d'onglet avant son premier rendu. Le plan corrige en déplaçant
l'appel dans le cleanup. Sans cette note, la fonctionnalité serait livrée
silencieusement morte.

**Piège identifié** — Task 4 step 4 : filtrer `statsTasks` casserait les
compteurs des pastilles (chaque pastille afficherait sa propre valeur filtrée).
Le filtre ne s'applique qu'à `visibleTasks`.
