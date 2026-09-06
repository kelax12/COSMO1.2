# Pattern mobile "pas de card" (ListRow + FilterChips) — plan d'implémentation

> **Pour un exécutant agentique :** SOUS-SKILL REQUIS : utiliser
> superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans
> pour exécuter ce plan tâche par tâche. Les étapes utilisent la syntaxe case à cocher
> (`- [ ]`) pour le suivi.

**But :** Deux nouvelles primitives mobile (`ListRow`, `FilterChips`), un pilote complet sur la
vue "Liste" de la page Habitudes, et la correction d'un bug d'accès : la page Habitudes est
aujourd'hui injoignable sur mobile pour tout membre d'une organisation.

**Architecture :** `ListRow`/`FilterChips` dans `src/components/mobile/`, composées par un
nouveau `src/pages/habits/HabitsMobileList.tsx` monté à la place de `HabitCard` sous `md:hidden`
dans `HabitsPage.tsx` (desktop inchangé). Le calendrier de jours de `HabitCard` est extrait dans
`src/components/HabitDayButton.tsx` pour être réutilisé par un nouveau `HabitDetailSheet.tsx`
(feuille de détail, ouverte au tap sur une rangée). Le bug d'accès se corrige dans
`MobileMoreSheet.tsx` (le lien `/habits` n'existe nulle part dans la feuille "Plus").

**Tech Stack :** React 18 + TypeScript, Tailwind (tokens `src/index.css`), Vitest +
Testing Library, i18n maison (`useT`).

**Spec source :** `docs/superpowers/specs/2026-09-06-mobile-list-pattern-design.md`.

**Écart assumé par rapport à la spec** : la spec envisageait un filtre `FilterChips` par
*catégorie* d'habitude. `Habit` (`src/modules/habits/types.ts`) n'a **aucun champ catégorie** —
seulement `frequency: 'daily' | 'weekly' | 'monthly'`. Le filtre du pilote porte donc sur la
fréquence (Toutes / Quotidiennes / Hebdomadaires / Mensuelles), qui est le seul axe de
classification réel disponible sur une habitude. Le principe de la primitive ne change pas.

---

## Task 1 : primitive `FilterChips`

**Files:**
- Create: `src/components/mobile/FilterChips.tsx`
- Modify: `src/components/mobile/index.ts`
- Test: `src/components/mobile/mobile-primitives.test.tsx`

- [ ] **Step 1: Write the failing tests**

Ajouter en fin de `src/components/mobile/mobile-primitives.test.tsx` (après le bloc
`describe('BottomSheet', ...)`, avant la dernière accolade du fichier — il n'y en a pas, le
fichier se termine par le `describe('BottomSheet', ...)`, donc ajouter à la suite) :

```tsx
import FilterChips from './FilterChips';
import ListRow from './ListRow';
```

(ajouter ces deux imports en haut du fichier, à côté des imports existants de `BottomSheet` etc.)

```tsx
describe('FilterChips', () => {
  const OPTIONS = [
    { value: 'all' as const, label: 'Toutes' },
    { value: 'daily' as const, label: 'Quotidiennes' },
    { value: 'weekly' as const, label: 'Hebdomadaires' },
  ];

  it('marque une seule pilule comme sélectionnée', () => {
    render(
      <FilterChips options={OPTIONS} value="all" onChange={vi.fn()} ariaLabel="Filtrer" />,
    );
    expect(screen.getByRole('radio', { name: 'Toutes' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Quotidiennes' }).getAttribute('aria-checked')).toBe('false');
  });

  it('notifie le changement au clic sur une pilule inactive', () => {
    const onChange = vi.fn();
    render(
      <FilterChips options={OPTIONS} value="all" onChange={onChange} ariaLabel="Filtrer" />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Hebdomadaires' }));
    expect(onChange).toHaveBeenCalledWith('weekly');
  });

  it("ne renotifie pas quand on reclique la pilule déjà active", () => {
    const onChange = vi.fn();
    render(
      <FilterChips options={OPTIONS} value="all" onChange={onChange} ariaLabel="Filtrer" />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Toutes' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('respecte la cible tactile sur chaque pilule', () => {
    render(
      <FilterChips options={OPTIONS} value="all" onChange={vi.fn()} ariaLabel="Filtrer" />,
    );
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.className).toContain('min-h-touch');
    }
  });

  it('chaque pilule porte sa propre bordure (pas de rail commun)', () => {
    render(
      <FilterChips options={OPTIONS} value="all" onChange={vi.fn()} ariaLabel="Filtrer" />,
    );
    // Actif : bordure assortie au fond. Inactif : bordure "chip".
    expect(screen.getByRole('radio', { name: 'Toutes' }).className).toContain('border-[rgb(var(--color-accent-solid))]');
    expect(screen.getByRole('radio', { name: 'Quotidiennes' }).className).toContain('border-[rgb(var(--color-chip-border))]');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/mobile/mobile-primitives.test.tsx`
Expected: FAIL — `Cannot find module './FilterChips'` (et `./ListRow`, ajouté en Task 2 juste
après ; les deux imports sont ajoutés ensemble donc les deux échouent tant qu'aucun fichier
n'existe — normal à ce stade).

- [ ] **Step 3: Create the primitive**

Créer `src/components/mobile/FilterChips.tsx` :

```tsx
import { cn } from '@/lib/utils';
import { haptic } from './mobile-motion';

export interface FilterChipsOption<T extends string> {
  value: T;
  label: string;
}

interface FilterChipsProps<T extends string> {
  options: FilterChipsOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Libellé du groupe, requis pour les lecteurs d'écran. */
  ariaLabel: string;
  className?: string;
}

/**
 * Rangée de filtres en pilules indépendantes, défilement horizontal.
 *
 * Diffère de `Segmented` : pas de rail commun ni de pastille glissante, chaque
 * pilule porte sa propre bordure — le motif du filtre Spotify (Tout / Musique
 * / Podcasts), pas un contrôle segmenté borné à 2-4 options dans un cadre.
 * Sélection unique (comme Spotify) : pas de multi-filtre dans cette itération.
 */
function FilterChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: FilterChipsProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'flex items-center gap-2 overflow-x-auto hide-scrollbar -mx-gutter px-gutter',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              if (active) return;
              haptic(10);
              onChange(option.value);
            }}
            className={cn(
              'shrink-0 min-h-touch px-4 rounded-full border text-label font-medium whitespace-nowrap transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/50',
              active
                ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                : 'bg-transparent border-[rgb(var(--color-chip-border))] text-[rgb(var(--color-text-secondary))]',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default FilterChips;
```

- [ ] **Step 4: Export from the barrel**

Dans `src/components/mobile/index.ts`, ajouter après la ligne `export { default as BottomSheet }` :

```typescript
export { default as FilterChips } from './FilterChips';
export type { FilterChipsOption } from './FilterChips';
```

(Le reste du fichier — y compris la note sur la suppression de `ListRow`/`MobileScreen` — est
traité dans la Task 2, qui rétablit `ListRow`.)

- [ ] **Step 5: Run tests to verify FilterChips passes (ListRow still fails)**

Run: `npx vitest run src/components/mobile/mobile-primitives.test.tsx`
Expected: les 5 tests `FilterChips` passent ; le fichier échoue toujours au chargement à cause de
`import ListRow from './ListRow'` (module absent) — normal, corrigé Task 2.

- [ ] **Step 6: Commit**

```bash
git add src/components/mobile/FilterChips.tsx src/components/mobile/index.ts src/components/mobile/mobile-primitives.test.tsx
git commit -m "feat(mobile): ajoute la primitive FilterChips (filtre en pilules type Spotify)"
```

---

## Task 2 : primitive `ListRow`

**Files:**
- Create: `src/components/mobile/ListRow.tsx`
- Modify: `src/components/mobile/index.ts`
- Test: `src/components/mobile/mobile-primitives.test.tsx` (déjà modifié Task 1, tests ajoutés ici)

`ListRow` a existé dans ce fichier jusqu'au 2026-09-05 (commit `5dd2c78`, finding C-10) : supprimée
parce qu'aucun écran ne la montait après six semaines. Cette fois elle est réécrite **contre un
écran réel** (Task 5, page Habitudes) dans le même plan — pas de nouvelle primitive orpheline.
L'API diffère volontairement de l'ancienne version (qui utilisait `role="button"` sur un `div` et
`meta`/`railColor`) : `border-b` entre rangées (motif liste/réglages) plutôt que "séparation par
l'espace seul", et un vrai `<button>` sémantique quand la rangée est cliquable plutôt qu'un
`div` + `tabIndex` + gestion clavier manuelle.

- [ ] **Step 1: Write the failing tests**

Ajouter à la suite du `describe('FilterChips', ...)` dans
`src/components/mobile/mobile-primitives.test.tsx` :

```tsx
describe('ListRow', () => {
  it('rend un <div> non interactif sans onClick', () => {
    render(<ListRow title="Lecture" subtitle="30 min" />);
    expect(screen.getByText('Lecture')).toBeTruthy();
    expect(screen.getByText('30 min')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('rend un <button> cliquable avec onClick', () => {
    const onClick = vi.fn();
    render(<ListRow title="Lecture" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Lecture/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("le trailing peut stopper la propagation pour ne pas déclencher l'onClick de la rangée", () => {
    const onRowClick = vi.fn();
    const onTrailingClick = vi.fn((e: React.MouseEvent) => e.stopPropagation());
    render(
      <ListRow
        title="Lecture"
        onClick={onRowClick}
        trailing={<button onClick={onTrailingClick}>Coche</button>}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Coche' }));
    expect(onTrailingClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('respecte la cible tactile', () => {
    render(<ListRow title="Lecture" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Lecture/ }).className).toContain('min-h-touch');
  });

  it("utilise ariaLabel comme nom accessible quand fourni (le texte visible seul n'annonce pas toujours l'action)", () => {
    render(<ListRow title="Lecture" onClick={vi.fn()} ariaLabel="Voir le détail de « Lecture »" />);
    expect(screen.getByRole('button', { name: 'Voir le détail de « Lecture »' })).toBeTruthy();
  });
});
```

Ajouter `import type React from 'react';` en haut du fichier si absent (nécessaire pour le type
`React.MouseEvent` du test ci-dessus) — vérifier d'abord si `React` est déjà importé ailleurs dans
ce fichier de test ; sinon ajouter cette ligne avec les autres imports.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/mobile/mobile-primitives.test.tsx`
Expected: FAIL — `Cannot find module './ListRow'`.

- [ ] **Step 3: Create the primitive**

Créer `src/components/mobile/ListRow.tsx` :

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface ListRowProps {
  /** Pastille couleur, icône ou vignette ~40×40. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** Ligne de contexte sous le titre — courte, tronquée. */
  subtitle?: React.ReactNode;
  /**
   * Action/chevron/switch à droite. Doit faire ≥44×44 si interactif. Si la
   * rangée a elle-même un `onClick`, le `trailing` doit appeler
   * `event.stopPropagation()` dans son propre gestionnaire pour ne pas
   * déclencher les deux actions au même tap.
   */
  trailing?: React.ReactNode;
  onClick?: () => void;
  /**
   * Nom accessible de la rangée quand `onClick` est fourni. À fournir dès que
   * le texte visible seul n'annonce pas l'action (ex. « Voir le détail de … »
   * plutôt que le simple nom) — sinon un lecteur d'écran n'a que le contenu.
   */
  ariaLabel?: string;
  className?: string;
}

/**
 * Rangée de liste mobile — remplace les cards pour un élément (tâche,
 * habitude, événement...). Pas de fond ni de bordure au repos : la séparation
 * entre deux rangées est un trait fin, posé par le PARENT qui itère
 * (`border-b last:border-b-0`) — cette primitive ignore sa position dans une
 * liste. Cf. docs/MOBILE.md « Pattern liste (pas de card) ».
 */
const ListRow: React.FC<ListRowProps> = ({ leading, title, subtitle, trailing, onClick, className }) => {
  const content = (
    <>
      {leading && <div className="shrink-0 flex items-center">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-body font-medium text-[rgb(var(--color-text-primary))] truncate">
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 text-caption text-[rgb(var(--color-text-muted))] truncate">
            {subtitle}
          </div>
        )}
      </div>
      {trailing && <div className="shrink-0 flex items-center gap-1">{trailing}</div>}
    </>
  );

  const rowClassName = cn('w-full flex items-center gap-3 min-h-touch py-3', className);

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={cn(rowClassName, 'text-left active:bg-[rgb(var(--color-hover))] transition-colors')}
      >
        {content}
      </button>
    );
  }

  return <div className={rowClassName}>{content}</div>;
};

export default ListRow;
```

- [ ] **Step 4: Export from the barrel and update the deletion note**

Dans `src/components/mobile/index.ts`, remplacer le bloc de commentaire (celui qui commence par
`// 🗑️ \`MobileScreen\` et \`ListRow\` ont été SUPPRIMÉS...` et se termine juste avant
`export { default as MobileHeader }`) par :

```typescript
// Design system mobile — primitives partagées.
//
// Règle : toute nouvelle page ou liste mobile compose ces briques plutôt que
// de redessiner un en-tête / une ligne / un contrôle. Cf. docs/MOBILE.md.
//
// ℹ️ `ListRow` a existé ici jusqu'au 2026-09-05 (C-10), supprimée après six
// semaines sans aucun écran consommateur. Réécrite le 2026-09-06 CONTRE un
// écran réel (page Habitudes, vue Liste mobile) — c'est ce qui manquait la
// première fois. `MobileScreen` reste supprimé : rien n'en a eu besoin depuis.
export { default as MobileHeader } from './MobileHeader';
export { default as SectionHeader } from './SectionHeader';
export { default as Segmented } from './Segmented';
export { default as TouchTarget } from './TouchTarget';
export { default as BottomSheet } from './BottomSheet';
export { default as ListRow } from './ListRow';
export { default as FilterChips } from './FilterChips';
export type { SegmentedOption } from './Segmented';
export type { FilterChipsOption } from './FilterChips';
export {
  SHEET_SPRING,
  ITEM_TRANSITION,
  CONTROL_TRANSITION,
  FADE_TRANSITION,
  haptic,
  prefersReducedMotion,
} from './mobile-motion';
```

- [ ] **Step 5: Run tests to verify everything passes**

Run: `npx vitest run src/components/mobile/mobile-primitives.test.tsx`
Expected: PASS — tous les tests (`SectionHeader`, `Segmented`, `TouchTarget`, `BottomSheet`,
`FilterChips`, `ListRow`).

- [ ] **Step 6: Commit**

```bash
git add src/components/mobile/ListRow.tsx src/components/mobile/index.ts src/components/mobile/mobile-primitives.test.tsx
git commit -m "feat(mobile): reintroduit ListRow, cablee sur un ecran reel (Habitudes)"
```

---

## Task 3 : extraire `HabitDayButton` de `HabitCard`

**Files:**
- Create: `src/components/HabitDayButton.tsx`
- Modify: `src/components/HabitCard.tsx`

Refactor pur : aucun changement visuel ni comportemental. Nécessaire pour que
`HabitDetailSheet` (Task 4) réutilise le même calendrier de jours sans dupliquer la logique.

- [ ] **Step 1: Create the extracted component**

Créer `src/components/HabitDayButton.tsx` :

```tsx
import React from 'react';
import { CheckCircle } from 'lucide-react';
import { formatDate } from '@/i18n/format';

export interface HabitDay {
  date: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
}

/** Génère les `count` derniers jours (aujourd'hui inclus, en dernière position). */
export function generateHabitDays(count: number): HabitDay[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (count - 1 - i));
    return {
      date: date.toLocaleDateString('en-CA'),
      dayName: formatDate(date, { weekday: 'short' }),
      dayNumber: date.getDate(),
      isToday: i === count - 1,
    };
  });
}

interface HabitDayButtonProps {
  day: HabitDay;
  isCompleted: boolean;
  onToggle: (date: string) => void;
  size?: 'normal' | 'small';
}

/**
 * Case d'un jour dans le calendrier compact (7j) ou détaillé (30j) d'une
 * habitude. Extrait de `HabitCard` le 2026-09-06 pour être réutilisé par
 * `HabitDetailSheet` (mobile) sans dupliquer la logique.
 */
export const HabitDayButton: React.FC<HabitDayButtonProps> = ({
  day,
  isCompleted,
  onToggle,
  size = 'normal',
}) => {
  const btnSize = size === 'normal' ? 'w-11 h-11 md:w-10 md:h-10' : 'w-11 h-11 md:w-9 md:h-9';
  const iconSize = size === 'normal' ? 18 : 14;

  return (
    <div className="flex flex-col items-center">
      <div className="text-caption md:text-xs text-slate-500 mb-1 font-medium">{day.dayName}</div>
      <button
        onClick={() => onToggle(day.date)}
        className={`${btnSize} rounded-lg border-2 transition-all flex items-center justify-center ${
          day.isToday
            ? 'border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800 shadow-sm'
            : 'border-[rgb(var(--color-border))]'
        } ${
          isCompleted
            ? 'border-[rgb(var(--color-accent-solid))] text-white'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-[rgb(var(--color-border-strong))]'
        }`}
        style={{ backgroundColor: isCompleted ? '#2563EB' : undefined }}
      >
        {isCompleted ? (
          <CheckCircle size={iconSize} className="md:w-5 md:h-5" />
        ) : (
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{day.dayNumber}</span>
        )}
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Update `HabitCard.tsx` to use the extracted component**

Dans `src/components/HabitCard.tsx` :

1. Ajouter l'import (à côté des autres imports de composants) :

```typescript
import { HabitDayButton, generateHabitDays } from './HabitDayButton';
```

2. Supprimer entièrement la fonction `generateDays` (lignes 48-60 du fichier actuel) et son appel
   inline `const compactDays = generateDays(7);` / `const detailedDays = generateDays(30);`
   (lignes 62-63), remplacés par :

```typescript
  const compactDays = generateHabitDays(7);
  const detailedDays = generateHabitDays(30);
```

3. Supprimer entièrement la définition du composant `DayButton` (lignes 71-106 du fichier
   actuel, du `const DayButton = ({...` jusqu'à l'accolade fermante correspondante).

4. Remplacer les deux appels `<DayButton key={day.date} day={day} size="normal" />` et
   `<DayButton key={day.date} day={day} size="small" />` par :

```tsx
              <HabitDayButton
                key={day.date}
                day={day}
                isCompleted={habit.completions[day.date]}
                onToggle={handleDayClick}
                size="normal"
              />
```

et

```tsx
              <HabitDayButton
                key={day.date}
                day={day}
                isCompleted={habit.completions[day.date]}
                onToggle={handleDayClick}
                size="small"
              />
```

respectivement dans le bloc `{compactDays.map((day) => (...))}` et
`{detailedDays.map((day) => (...))}`.

- [ ] **Step 3: Verify no visual/behavioral change**

Il n'existe pas de test unitaire dédié à `HabitCard`. Lancer la suite complète pour vérifier
qu'aucune régression n'est introduite ailleurs (un autre composant important
`generateDays`/`DayButton` depuis `HabitCard` ferait échouer le typecheck) :

Run: `npm run typecheck`
Expected: 0 erreur.

Run: `npx vitest run src/components/`
Expected: tous les tests existants passent (aucun ne référence `HabitCard`, donc aucun changement
attendu dans les résultats — c'est la garantie recherchée).

- [ ] **Step 4: Commit**

```bash
git add src/components/HabitDayButton.tsx src/components/HabitCard.tsx
git commit -m "refactor(habits): extrait HabitDayButton de HabitCard pour reutilisation mobile"
```

---

## Task 4 : `HabitDetailSheet` (feuille de détail mobile)

**Files:**
- Create: `src/components/HabitDetailSheet.tsx`
- Test: `src/components/HabitDetailSheet.test.tsx`

Remplace, sur mobile, le contenu que `showDetails` affichait dans `HabitCard` (calendrier 30
jours) — ouvert au tap sur une `ListRow` d'habitude plutôt qu'en accordéon dans une card.

- [ ] **Step 1: Write the failing test**

Créer `src/components/HabitDetailSheet.test.tsx` :

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ensureNamespaces } from '@/i18n/catalog';
import type { Habit } from '@/modules/habits';

vi.mock('@/modules/habits', async () => {
  const actual = await vi.importActual<typeof import('@/modules/habits')>('@/modules/habits');
  return {
    ...actual,
    useDeleteHabit: () => ({ mutate: vi.fn() }),
    useRestoreHabit: () => ({ mutate: vi.fn() }),
    useToggleHabitCompletion: () => ({ mutate: vi.fn() }),
  };
});
vi.mock('@/lib/hooks/use-habit-pauses', () => ({
  useHabitPauses: () => ({ isPaused: () => false, getPauseUntil: () => undefined }),
  default: () => ({ isPaused: () => false, getPauseUntil: () => undefined }),
}));

const { default: HabitDetailSheet } = await import('./HabitDetailSheet');

const HABIT: Habit = {
  id: 'h1',
  name: 'Lecture',
  frequency: 'daily',
  estimatedTime: 30,
  color: '#3B82F6',
  icon: 'book',
  completions: {},
};

describe('HabitDetailSheet', () => {
  beforeAll(async () => {
    await ensureNamespaces(['habits', 'common'], 'fr');
  });

  it("ne rend rien tant qu'elle n'est pas ouverte", () => {
    render(<HabitDetailSheet habit={HABIT} open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("affiche le nom de l'habitude une fois ouverte", () => {
    render(<HabitDetailSheet habit={HABIT} open onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Lecture')).toBeTruthy();
  });

  it('affiche 30 jours dans le calendrier détaillé', () => {
    render(<HabitDetailSheet habit={HABIT} open onClose={vi.fn()} />);
    // 30 boutons de jour (un par case du calendrier détaillé).
    const dayButtons = screen.getAllByRole('button').filter((b) => /^\d+$/.test(b.textContent ?? ''));
    expect(dayButtons.length).toBe(30);
  });

  it('ferme au clic sur le fond', () => {
    const onClose = vi.fn();
    render(<HabitDetailSheet habit={HABIT} open onClose={onClose} />);
    fireEvent.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/HabitDetailSheet.test.tsx`
Expected: FAIL — `Cannot find module './HabitDetailSheet'`.

- [ ] **Step 3: Implement `HabitDetailSheet`**

Créer `src/components/HabitDetailSheet.tsx` :

```tsx
import React, { useState } from 'react';
import { Clock, Flame, Edit2, Trash2, Pause } from 'lucide-react';
import { format } from 'date-fns';
import { BottomSheet } from '@/components/mobile';
import { formatDate, getDateLocale } from '@/i18n/format';
import { useHabitPauses } from '@/lib/hooks/use-habit-pauses';
import { Habit, useDeleteHabit, useRestoreHabit, useToggleHabitCompletion } from '@/modules/habits';
import { useT } from '@/i18n/useT';
import { habitStreak } from '@/modules/habits/streak';
import { showUndoToast } from '@/lib/undo-toast';
import { Button } from '@/components/ui/button';
import { HabitDayButton, generateHabitDays } from './HabitDayButton';
import HabitModal from './HabitModal';
import HabitActionsMenu from './HabitActionsMenu';

interface HabitDetailSheetProps {
  habit: Habit;
  open: boolean;
  onClose: () => void;
}

/**
 * Détail d'une habitude sur mobile — ouvert au tap sur sa `ListRow` dans
 * `HabitsMobileList`. Remplace l'accordéon `showDetails` de `HabitCard`
 * (desktop uniquement désormais) : sur mobile, le détail est une feuille, pas
 * une carte qui grandit sur place. Cf. docs/MOBILE.md « Pattern liste ».
 */
const HabitDetailSheet: React.FC<HabitDetailSheetProps> = ({ habit, open, onClose }) => {
  const { t } = useT('habits');
  const { t: tCommon } = useT('common');
  const deleteHabitMutation = useDeleteHabit();
  const restoreHabitMutation = useRestoreHabit();
  const toggleCompletionMutation = useToggleHabitCompletion();
  const { isPaused, getPauseUntil } = useHabitPauses();
  const [editOpen, setEditOpen] = useState(false);

  const streak = habitStreak(habit);
  const paused = isPaused(habit.id);
  const pausedUntil = getPauseUntil(habit.id);
  const habitColor = habit.color.startsWith('#') ? habit.color : '#3B82F6';
  const detailedDays = generateHabitDays(30);

  const handleDayClick = (date: string) => {
    toggleCompletionMutation.mutate({ id: habit.id, date });
  };

  const handleDelete = () => {
    const snapshot = habit;
    onClose();
    deleteHabitMutation.mutate(habit.id, {
      onSuccess: () => {
        showUndoToast(t('card.deleted'), () => {
          restoreHabitMutation.mutate(snapshot);
        });
      },
    });
  };

  return (
    <>
      <BottomSheet open={open} onClose={onClose} ariaLabel={habit.name}>
        <div className="px-4 pb-5 flex flex-col gap-4" data-scroll-area>
          <div className="flex items-start gap-3">
            <div className="w-4 h-4 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: habitColor }} />
            <div className="min-w-0 flex-1">
              <h2 className="text-headline font-semibold text-[rgb(var(--color-text-primary))] truncate">
                {habit.name}
              </h2>
              <div className="flex items-center gap-4 mt-1 text-label text-[rgb(var(--color-text-secondary))] flex-wrap">
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>{habit.estimatedTime} min</span>
                </div>
                <div className="flex items-center gap-1">
                  <Flame size={14} className="text-orange-500" />
                  <span>{streak} jours</span>
                </div>
                {paused && pausedUntil && (
                  <div
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-caption font-medium"
                    title={t('card.pausedUntil', { date: format(pausedUntil, 'd MMMM yyyy', { locale: getDateLocale() }) })}
                  >
                    <Pause size={10} />
                    <span>{t('card.paused')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 border-y border-[rgb(var(--color-border))] py-1">
            <Button variant="ghost" size="sm" className="flex-1 gap-1.5" onClick={() => setEditOpen(true)}>
              <Edit2 size={16} />
              <span className="text-caption font-medium">{t('modal.edit')}</span>
            </Button>
            <HabitActionsMenu habit={habit} />
            <Button variant="ghost" size="sm" className="flex-1 gap-1.5" onClick={handleDelete}>
              <Trash2 size={16} />
              <span className="text-caption font-medium">{tCommon('actions.delete')}</span>
            </Button>
          </div>

          <div>
            <h3 className="text-label font-semibold text-[rgb(var(--color-text-secondary))] mb-3">
              {t('card.detailedTracking')}
            </h3>
            <div className="grid grid-cols-6 gap-2">
              {detailedDays.map((day) => (
                <HabitDayButton
                  key={day.date}
                  day={day}
                  isCompleted={habit.completions[day.date]}
                  onToggle={handleDayClick}
                  size="small"
                />
              ))}
            </div>
          </div>
        </div>
      </BottomSheet>

      <HabitModal isOpen={editOpen} onClose={() => setEditOpen(false)} habit={habit} />
    </>
  );
};

export default HabitDetailSheet;
```

(Le libellé du bouton Supprimer utilise `tCommon('actions.delete')` — clé générique déjà utilisée
par les autres écrans, `habits.json` n'a pas de clé dédiée pour "Supprimer" seul.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/HabitDetailSheet.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/HabitDetailSheet.tsx src/components/HabitDetailSheet.test.tsx
git commit -m "feat(habits): ajoute HabitDetailSheet, detail mobile ouvert depuis une ListRow"
```

---

## Task 5 : i18n — clés manquantes avant de câbler la page

**Files:**
- Modify: `src/locales/fr/habits.json`
- Modify: `src/locales/en/habits.json`
- Modify: `src/locales/fr/common.json`
- Modify: `src/locales/en/common.json`

Ajouter les clés maintenant, avant `HabitsMobileList` (Task 6) qui les consomme — `npm run
i18n:check` est bloquant en CI sur toute clé manquante dans un des deux catalogues.

- [ ] **Step 1: `src/locales/fr/habits.json`**

Ajouter un bloc `mobileList` après le bloc `"period"` (juste avant l'accolade fermante finale) :

```json
  "period": {
    "week": "Semaine",
    "month": "Mois",
    "all": "Tout",
    "weekOf": "Semaine du {{date}}"
  },
  "mobileList": {
    "filterAriaLabel": "Filtrer par fréquence",
    "filterAll": "Toutes",
    "filterDaily": "Quotidiennes",
    "filterWeekly": "Hebdomadaires",
    "filterMonthly": "Mensuelles",
    "markDone": "Marquer « {{name}} » comme faite aujourd'hui",
    "markUndone": "Marquer « {{name}} » comme non faite aujourd'hui",
    "openDetail": "Voir le détail de « {{name}} »",
    "streak_one": "{{count}} jour",
    "streak_many": "{{count}} de jours",
    "streak_other": "{{count}} jours"
  }
```

(Retirer la virgule finale de `"period": {...}` d'origine si elle n'en avait pas — vérifier le
JSON reste valide : la dernière entrée du fichier avant cet ajout était `"period"`, donc il faut
une virgule après son accolade fermante et aucune après `"mobileList"`.)

- [ ] **Step 2: `src/locales/en/habits.json`**

Même bloc, traduit :

```json
  "period": {
    "week": "Week",
    "month": "Month",
    "all": "All",
    "weekOf": "Week of {{date}}"
  },
  "mobileList": {
    "filterAriaLabel": "Filter by frequency",
    "filterAll": "All",
    "filterDaily": "Daily",
    "filterWeekly": "Weekly",
    "filterMonthly": "Monthly",
    "markDone": "Mark “{{name}}” as done today",
    "markUndone": "Mark “{{name}}” as not done today",
    "openDetail": "View details for “{{name}}”",
    "streak_one": "{{count}} day",
    "streak_other": "{{count}} days"
  }
```

- [ ] **Step 3: `src/locales/fr/common.json`**

Dans le bloc `nav.descriptions` (ligne 50-57), ajouter `"habits"` :

```json
    "descriptions": {
      "okr": "Objectifs & résultats",
      "statistics": "Suivi de progression",
      "habits": "Vos routines quotidiennes",
      "premium": "Débloquer toutes les fonctions",
      "settings": "Compte & préférences",
      "enterprise": "Équipe & collaboration",
      "bugReport": "Nous aider à corriger Cosmo"
    },
```

- [ ] **Step 4: `src/locales/en/common.json`**

Même clé, traduite :

```json
      "okr": "Objectives & key results",
      "statistics": "Progress tracking",
      "habits": "Your daily routines",
      "premium": "Unlock every feature",
```

(insérer `"habits"` entre `"statistics"` et `"premium"`, même position que côté FR)

- [ ] **Step 5: Verify parity**

Run: `npm run i18n:check`
Expected: 0 erreur (les 4 fichiers ont été modifiés en paire fr/en, clé pour clé).

- [ ] **Step 6: Commit**

```bash
git add src/locales/fr/habits.json src/locales/en/habits.json src/locales/fr/common.json src/locales/en/common.json
git commit -m "i18n(habits): cles pour la liste mobile et l'entree Habitudes du menu Plus"
```

---

## Task 6 : `HabitsMobileList` — composition du pilote

**Files:**
- Create: `src/pages/habits/HabitsMobileList.tsx`
- Test: `src/pages/habits/HabitsMobileList.test.tsx`

- [ ] **Step 1: Write the failing test**

Créer `src/pages/habits/HabitsMobileList.test.tsx` :

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ensureNamespaces } from '@/i18n/catalog';
import type { Habit } from '@/modules/habits';

vi.mock('@/modules/habits', async () => {
  const actual = await vi.importActual<typeof import('@/modules/habits')>('@/modules/habits');
  return {
    ...actual,
    useDeleteHabit: () => ({ mutate: vi.fn() }),
    useRestoreHabit: () => ({ mutate: vi.fn() }),
    useToggleHabitCompletion: () => ({ mutate: vi.fn() }),
  };
});
vi.mock('@/lib/hooks/use-habit-pauses', () => ({
  useHabitPauses: () => ({ isPaused: () => false, getPauseUntil: () => undefined }),
  default: () => ({ isPaused: () => false, getPauseUntil: () => undefined }),
}));

const { default: HabitsMobileList } = await import('./HabitsMobileList');

const HABITS: Habit[] = [
  { id: 'h1', name: 'Lecture', frequency: 'daily', estimatedTime: 30, color: '#3B82F6', icon: 'book', completions: {} },
  { id: 'h2', name: 'Bilan hebdo', frequency: 'weekly', estimatedTime: 15, color: '#10B981', icon: 'chart', completions: {} },
];

describe('HabitsMobileList', () => {
  beforeAll(async () => {
    await ensureNamespaces(['habits', 'common'], 'fr');
  });

  it('affiche une ListRow par habitude', () => {
    render(<HabitsMobileList habits={HABITS} />);
    expect(screen.getByText('Lecture')).toBeTruthy();
    expect(screen.getByText('Bilan hebdo')).toBeTruthy();
  });

  it('filtre par fréquence via FilterChips', () => {
    render(<HabitsMobileList habits={HABITS} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Hebdomadaires' }));
    expect(screen.queryByText('Lecture')).toBeNull();
    expect(screen.getByText('Bilan hebdo')).toBeTruthy();
  });

  it("le clic sur la coche ne déclenche pas l'ouverture du détail", () => {
    render(<HabitsMobileList habits={HABITS} />);
    fireEvent.click(screen.getByRole('button', { name: /Marquer « Lecture » comme faite aujourd'hui/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('le clic sur le reste de la rangée ouvre le détail', () => {
    render(<HabitsMobileList habits={HABITS} />);
    fireEvent.click(screen.getByRole('button', { name: /Voir le détail de « Lecture »/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it("affiche un état vide sans classe 'card'", () => {
    render(<HabitsMobileList habits={[]} />);
    const empty = screen.getByTestId('habits-mobile-empty');
    expect(empty.className).not.toContain('card');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/habits/HabitsMobileList.test.tsx`
Expected: FAIL — `Cannot find module './HabitsMobileList'`.

- [ ] **Step 3: Implement `HabitsMobileList`**

Créer `src/pages/habits/HabitsMobileList.tsx` :

```tsx
import React, { useMemo, useState } from 'react';
import { Calendar, Flame, Check } from 'lucide-react';
import { FilterChips, ListRow } from '@/components/mobile';
import type { FilterChipsOption } from '@/components/mobile';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/useT';
import { habitStreak } from '@/modules/habits/streak';
import { useToggleHabitCompletion, type Habit, type HabitFrequency } from '@/modules/habits';
import HabitDetailSheet from '@/components/HabitDetailSheet';

interface HabitsMobileListProps {
  habits: Habit[];
  onCreate?: () => void;
}

type FrequencyFilter = HabitFrequency | 'all';

const todayKey = () => new Date().toLocaleDateString('en-CA');

/**
 * Vue "Liste" de la page Habitudes, mobile uniquement — pilote du pattern
 * "pas de card" (docs/MOBILE.md). Desktop continue de rendre `HabitCard`
 * (HabitsPage.tsx, `hidden md:block`).
 */
const HabitsMobileList: React.FC<HabitsMobileListProps> = ({ habits, onCreate }) => {
  const { t, tp } = useT('habits');
  const { t: tCommon } = useT('common');
  const toggleCompletionMutation = useToggleHabitCompletion();
  const [filter, setFilter] = useState<FrequencyFilter>('all');
  const [detailHabit, setDetailHabit] = useState<Habit | null>(null);

  const options: FilterChipsOption<FrequencyFilter>[] = [
    { value: 'all', label: t('mobileList.filterAll') },
    { value: 'daily', label: t('mobileList.filterDaily') },
    { value: 'weekly', label: t('mobileList.filterWeekly') },
    { value: 'monthly', label: t('mobileList.filterMonthly') },
  ];

  const filteredHabits = useMemo(
    () => (filter === 'all' ? habits : habits.filter((h) => h.frequency === filter)),
    [habits, filter],
  );

  const today = todayKey();

  if (habits.length === 0) {
    return (
      <div data-testid="habits-mobile-empty" className="p-8 text-center">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: 'rgb(var(--color-hover))' }}
        >
          <Calendar size={24} style={{ color: 'rgb(var(--color-text-muted))' }} />
        </div>
        <h3 className="text-lg font-semibold mb-2 text-[rgb(var(--color-text-primary))]">
          {t('page.emptyTitle')}
        </h3>
        <p className="mb-6 text-sm text-[rgb(var(--color-text-secondary))]">{t('page.emptyBody')}</p>
        {onCreate && (
          <Button
            variant="default"
            size="lg"
            onClick={onCreate}
            className="mx-auto flex items-center justify-center gap-2 px-10 py-3 text-base bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))]"
          >
            {t('page.emptyCta')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterChips options={options} value={filter} onChange={setFilter} ariaLabel={t('mobileList.filterAriaLabel')} />

      <div>
        {filteredHabits.map((habit) => {
          const completedToday = !!habit.completions[today];
          return (
            <ListRow
              key={habit.id}
              className="border-b border-[rgb(var(--color-border))] last:border-b-0"
              onClick={() => setDetailHabit(habit)}
              ariaLabel={t('mobileList.openDetail', { name: habit.name })}
              leading={<span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: habit.color.startsWith('#') ? habit.color : '#3B82F6' }} aria-hidden="true" />}
              title={habit.name}
              subtitle={
                <span className="flex items-center gap-1">
                  <Flame size={12} className="text-orange-500" aria-hidden="true" />
                  {tp('mobileList.streak', habitStreak(habit))}
                </span>
              }
              trailing={
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCompletionMutation.mutate({ id: habit.id, date: today });
                  }}
                  aria-label={
                    completedToday
                      ? t('mobileList.markUndone', { name: habit.name })
                      : t('mobileList.markDone', { name: habit.name })
                  }
                  aria-pressed={completedToday}
                  className="min-w-11 min-h-11 flex items-center justify-center shrink-0"
                >
                  <span
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      completedToday
                        ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))]'
                        : 'border-[rgb(var(--color-text-muted))]'
                    }`}
                  >
                    {completedToday && <Check size={14} strokeWidth={3} className="text-[rgb(var(--color-accent-solid-foreground))]" />}
                  </span>
                </button>
              }
            />
          );
        })}
      </div>

      {detailHabit && (
        <HabitDetailSheet habit={detailHabit} open={!!detailHabit} onClose={() => setDetailHabit(null)} />
      )}
    </div>
  );
};

export default HabitsMobileList;
```

`ListRow` porte déjà `ariaLabel` (Task 2) : le bouton rendu a pour nom accessible
`mobileList.openDetail`, pas le contenu texte de `title`/`subtitle` — c'est ce qui permet
d'annoncer « Voir le détail de Lecture » plutôt que « Lecture · 🔥 3 jours » à un lecteur d'écran,
tout en gardant ce texte affiché à l'écran.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/mobile/mobile-primitives.test.tsx src/pages/habits/HabitsMobileList.test.tsx`
Expected: PASS — tous les tests, y compris le nouveau cas `ariaLabel`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/habits/HabitsMobileList.tsx src/pages/habits/HabitsMobileList.test.tsx
git commit -m "feat(habits): HabitsMobileList, pilote du pattern liste mobile sans card"
```

---

## Task 7 : câbler `HabitsMobileList` dans `HabitsPage`

**Files:**
- Modify: `src/pages/HabitsPage.tsx`

- [ ] **Step 1: Split the `list` view mobile/desktop**

Dans `src/pages/HabitsPage.tsx`, ajouter l'import :

```typescript
import HabitsMobileList from './habits/HabitsMobileList';
```

Remplacer le bloc actuel :

```tsx
      {viewMode === 'list' && (
        <div className="space-y-4 md:space-y-6" data-tutorial-id="habits-list">
          {isLoading && habits.length === 0 && <HabitListSkeleton count={4} />}

          {habits.map(habit => (
            <HabitCard key={habit.id} habit={habit} />
          ))}

          {!isLoading && habits.length === 0 && (
            <div className="card p-8 md:p-12 text-center">
              <div
                className="w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgb(var(--color-hover))' }}
              >
                <Calendar size={24} className="md:w-8 md:h-8" style={{ color: 'rgb(var(--color-text-muted))' }} />
              </div>
              <h3
                className="text-lg md:text-xl font-semibold mb-2"
                style={{ color: 'rgb(var(--color-text-primary))' }}
              >
                {t('page.emptyTitle')}
              </h3>
              <p className="mb-6 text-sm md:text-base" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                {t('page.emptyBody')}
              </p>
              <Button
                variant="default"
                size="lg"
                onClick={() => setShowModal(true)}
                className="mx-auto flex items-center justify-center gap-2 px-10 py-3 text-base bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] "
              >
                {t('page.emptyCta')}
              </Button>
            </div>
          )}
        </div>
      )}
```

par :

```tsx
      {viewMode === 'list' && (
        <div data-tutorial-id="habits-list">
          {isLoading && habits.length === 0 && <HabitListSkeleton count={4} />}

          {/* Mobile : ListRow plates, sans card (docs/MOBILE.md). Desktop : HabitCard,
              inchangée. Les deux rendus ne sont PAS un compromis responsive — cf. la même
              bascule pour MobileHeader plus haut dans ce fichier. */}
          <div className="md:hidden">
            {!isLoading && <HabitsMobileList habits={habits} onCreate={() => setShowModal(true)} />}
          </div>

          <div className="hidden md:block space-y-6">
            {habits.map(habit => (
              <HabitCard key={habit.id} habit={habit} />
            ))}

            {!isLoading && habits.length === 0 && (
              <div className="card p-8 md:p-12 text-center">
                <div
                  className="w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'rgb(var(--color-hover))' }}
                >
                  <Calendar size={24} className="md:w-8 md:h-8" style={{ color: 'rgb(var(--color-text-muted))' }} />
                </div>
                <h3
                  className="text-lg md:text-xl font-semibold mb-2"
                  style={{ color: 'rgb(var(--color-text-primary))' }}
                >
                  {t('page.emptyTitle')}
                </h3>
                <p className="mb-6 text-sm md:text-base" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  {t('page.emptyBody')}
                </p>
                <Button
                  variant="default"
                  size="lg"
                  onClick={() => setShowModal(true)}
                  className="mx-auto flex items-center justify-center gap-2 px-10 py-3 text-base bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] "
                >
                  {t('page.emptyCta')}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
```

- [ ] **Step 2: Strip `card` from the two remaining empty states (table/global modes)**

Les deux blocs identiques restants (modes `table` et `global`) utilisent `<div className="card p-8 text-center">`. Remplacer les DEUX occurrences de :

```tsx
          <div className="card p-8 text-center">
```

par :

```tsx
          <div className="card card-plain-mobile p-8 text-center">
```

(`.card-plain-mobile`, définie dans `src/index.css`, neutralise le chrome de `.card` sous 768px
et le restaure au-delà — c'est la classe déjà utilisée par `TasksPage`, `OKRCard` et les widgets
Dashboard pour exactement ce cas, cf. `docs/MOBILE.md` § « Listes bord à bord ». Pas besoin de la
réinventer ici.)

- [ ] **Step 3: Run the page through typecheck and existing tests**

Run: `npm run typecheck`
Expected: 0 erreur.

Run: `npx vitest run src/pages/`
Expected: PASS (aucun test existant ne cible `HabitsPage` directement à ce jour — vérifier
qu'aucune régression n'apparaît ailleurs dans le dossier).

- [ ] **Step 4: Commit**

```bash
git add src/pages/HabitsPage.tsx
git commit -m "feat(habits): cable HabitsMobileList sur mobile, HabitCard reste desktop"
```

---

## Task 8 : corriger l'accès manquant à Habitudes sur mobile

**Files:**
- Modify: `src/components/layout/MobileMoreSheet.tsx`
- Modify: `src/components/layout/MobileTabBar.tsx` (commentaire uniquement)
- Test: `src/components/layout/MobileMoreSheet.test.tsx`

**Le bug :** `MobileTabBar.tsx` retire l'onglet "Habitudes" de la barre du bas dès qu'un compte
appartient à une organisation (remplacé par "Entreprise"), avec un commentaire affirmant qu'elle
« reste atteignable dans « Plus », qui la liste déjà ». C'est faux : `MobileMoreSheet.tsx` ne
liste que OKR / Statistiques / Premium / Paramètres (+ Entreprise). Pour tout membre d'une
organisation, la page Habitudes est aujourd'hui **injoignable sur mobile**, quel que soit le
chemin emprunté.

- [ ] **Step 1: Write the failing test**

Créer `src/components/layout/MobileMoreSheet.test.tsx` :

```tsx
// @vitest-environment jsdom
//
// Régression du bug d'accès : MobileTabBar retire « Habitudes » de la barre du
// bas pour un membre d'organisation (remplacée par « Entreprise »), avec un
// commentaire affirmant qu'elle « reste atteignable dans Plus ». Ce test
// vérifie l'affirmation, pas juste le code qui la fait — sans lui, la feuille
// peut à nouveau perdre ce lien sans qu'aucun test ne le remarque.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ensureNamespaces } from '@/i18n/catalog';

vi.mock('@/modules/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Test User', email: 't@test.fr' }, logout: vi.fn() }),
}));
vi.mock('@/modules/billing/billing.context', () => ({
  useBilling: () => ({ isPremium: () => false }),
}));
vi.mock('@/modules/organizations', () => ({
  useActiveOrganization: () => ({
    activeOrg: { id: 'org-1', name: 'Acme' },
    organizations: [{ id: 'org-1', name: 'Acme' }],
    setActiveOrgId: vi.fn(),
  }),
}));

const { default: MobileMoreSheet } = await import('./MobileMoreSheet');

describe('MobileMoreSheet — accès Habitudes pour un membre d’organisation', () => {
  beforeAll(async () => {
    await ensureNamespaces(['common', 'org'], 'fr');
  });

  it('liste un lien vers Habitudes même quand Entreprise est aussi présent', () => {
    render(
      <MemoryRouter>
        <MobileMoreSheet open onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /Habitudes/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Entreprise/ })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/MobileMoreSheet.test.tsx`
Expected: FAIL — aucun bouton nommé `/Habitudes/` (la feuille ne liste que OKR, Statistiques,
Paramètres, Entreprise).

- [ ] **Step 3: Add the missing link**

Dans `src/components/layout/MobileMoreSheet.tsx` :

1. Ajouter l'import de l'icône (à côté de `Target, BarChart2, ...`) :

```typescript
import { Target, BarChart2, Crown, Settings, LogOut, ChevronRight, Building2, Check, Plus, Bug, Repeat } from 'lucide-react';
```

2. Ajouter l'entrée dans le tableau `links` (avant `okr`, puisque c'est la position qu'elle
   occupait dans la barre du bas dont elle a été retirée) :

```typescript
const links: SheetLink[] = [
  { to: '/habits',     labelKey: 'nav.habits',     descriptionKey: 'nav.descriptions.habits',     icon: Repeat,    iconBg: 'bg-orange-500'  },
  { to: '/okr',        labelKey: 'nav.okr',        descriptionKey: 'nav.descriptions.okr',        icon: Target,    iconBg: 'bg-green-500'  },
  { to: '/statistics', labelKey: 'nav.statistics', descriptionKey: 'nav.descriptions.statistics', icon: BarChart2, iconBg: 'bg-violet-500' },
  { to: '/premium',    labelKey: 'nav.premium',    descriptionKey: 'nav.descriptions.premium',    icon: Crown,     iconBg: 'bg-amber-400'  },
  { to: '/settings',   labelKey: 'nav.settings',   descriptionKey: 'nav.descriptions.settings',   icon: Settings,  iconBg: 'bg-gray-500'   },
];
```

`visibleLinks` (juste en dessous) n'a pas besoin de changer : `links` sans filtre supplémentaire
inclut déjà `/habits` pour tout le monde, comme les autres entrées non-premium.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/MobileMoreSheet.test.tsx`
Expected: PASS.

Run: `npx vitest run src/components/layout/MobileTabBar.test.tsx`
Expected: PASS — ce test ne porte que sur la barre du bas, inchangée, il doit continuer de passer
sans modification.

- [ ] **Step 5: Fix the stale comment in `MobileTabBar.tsx`**

Le commentaire au-dessus de `ENTERPRISE_TAB` (autour de la ligne 42-56) affirme un fait qui vient
d'être rendu vrai par cette task, mais qui ne l'était pas avant — le corriger pour qu'il cesse de
décrire un état non vérifié. Remplacer :

```typescript
/**
 * Entreprise n'entre dans la barre que pour un membre d'une organisation, et
 * remplace alors « Habitudes » plutôt que de s'ajouter en 6e position.
 *
 * Pourquoi un REMPLACEMENT : à 375 px, la barre fait 5 éléments de 75 px. Un
 * 6e les ramène à 62,5 px, sous la cible tactile de 44 px une fois les marges
 * internes retirées, et « Habitudes » comme « Entreprise » se tronquent.
 * Mesuré, pas supposé.
 *
 * Pourquoi « Habitudes » : c'est un module OPTIONNEL (`RequireModule`), donc
 * déjà absent pour une partie des comptes, alors que l'espace entreprise est
 * la seule zone collaborative du produit — et il était jusqu'ici au 3e niveau
 * de navigation sur mobile (Plus → feuille → Entreprise). Habitudes reste
 * atteignable dans « Plus », qui la liste déjà.
 */
```

par :

```typescript
/**
 * Entreprise n'entre dans la barre que pour un membre d'une organisation, et
 * remplace alors « Habitudes » plutôt que de s'ajouter en 6e position.
 *
 * Pourquoi un REMPLACEMENT : à 375 px, la barre fait 5 éléments de 75 px. Un
 * 6e les ramène à 62,5 px, sous la cible tactile de 44 px une fois les marges
 * internes retirées, et « Habitudes » comme « Entreprise » se tronquent.
 * Mesuré, pas supposé.
 *
 * Pourquoi « Habitudes » : c'est l'espace entreprise, seule zone collaborative
 * du produit, qui a besoin d'un accès direct — Habitudes reste atteignable
 * dans « Plus » (`MobileMoreSheet`).
 *
 * ⚠️ Ce commentaire affirmait déjà cette dernière phrase avant le 2026-09-06,
 * alors que `MobileMoreSheet` ne listait PAS Habitudes : la page était
 * injoignable sur mobile pour tout membre d'une organisation. Corrigé le
 * 2026-09-06 (`MobileMoreSheet.test.tsx` vérifie l'affirmation, pas juste le
 * code qui la fait). La mention « module OPTIONNEL (`RequireModule`) » de
 * l'ancienne version était elle-même fausse depuis le 2026-08-23 : cette
 * fonctionnalité a été supprimée (cf. CLAUDE.md § Onboarding).
 */
```

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/MobileMoreSheet.tsx src/components/layout/MobileMoreSheet.test.tsx src/components/layout/MobileTabBar.tsx
git commit -m "fix(nav): Habitudes etait injoignable sur mobile pour un membre d'organisation"
```

---

## Task 9 : documentation

**Files:**
- Modify: `docs/MOBILE.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: `docs/MOBILE.md` — restaurer la ligne `ListRow`/`FilterChips` dans la table des primitives**

Remplacer le bloc (lignes ~453-471, table "Primitives" + note de suppression) :

```markdown
### Primitives — `src/components/mobile/`

| Primitive | Rôle |
|---|---|
| `MobileHeader` | Grand titre qui se compacte au scroll (motif « large title » iOS) + slot actions |
| `SectionHeader` | Titre de section discret + compte + action |
| `Segmented` | Contrôle segmenté (pastille active animée via `layoutId`) |
| `TouchTarget` | Bouton-icône dont la zone tactile fait réellement 44×44 px |
| `BottomSheet` | Feuille bas-d'écran mobile / dialogue centré desktop (`sm:`), drag-to-dismiss, extrait de la modale de choix Premium — réutilisée telle quelle par toute nouvelle feuille modale à 2 choix ou plus |

> 🗑️ **`MobileScreen` et `ListRow` ont été supprimés le 2026-09-05** (C-10) : six semaines
> d'existence, zéro écran les montant. Ils sont restés dans cette table tout ce temps, et une
> table qui liste une primitive que rien n'utilise décrit une architecture qui n'existe pas.
>
> ❌ **Ne pas les recréer d'après cette note.** Si le besoin revient, ils se réécrivent CONTRE un
> écran réel : c'est la seule façon de savoir ce qu'ils doivent porter, et c'est précisément ce
> qui manquait à `MobileHeader` — utilisé par une page, et cassé pendant un mois sans que
> personne le voie.
| `mobile-motion.ts` | Courbes partagées (`SHEET_SPRING`…) + `haptic()` + `prefersReducedMotion()` |

Composer ces briques plutôt que redessiner. Tests : `src/components/mobile/mobile-primitives.test.tsx`.
```

par :

```markdown
### Primitives — `src/components/mobile/`

| Primitive | Rôle |
|---|---|
| `MobileHeader` | Grand titre qui se compacte au scroll (motif « large title » iOS) + slot actions |
| `SectionHeader` | Titre de section discret + compte + action |
| `Segmented` | Contrôle segmenté à rail commun (pastille active animée via `layoutId`), 2-4 options |
| `FilterChips` | Filtres en pilules INDÉPENDANTES, défilement horizontal, sélection unique — motif Spotify (Tout / Musique / Podcasts), pas un contrôle segmenté borné |
| `ListRow` | Rangée de liste (leading/title/subtitle/trailing), remplace les cards — le parent qui itère pose `border-b last:border-b-0` entre les rangées |
| `TouchTarget` | Bouton-icône dont la zone tactile fait réellement 44×44 px |
| `BottomSheet` | Feuille bas-d'écran mobile / dialogue centré desktop (`sm:`), drag-to-dismiss, extrait de la modale de choix Premium — réutilisée telle quelle par toute nouvelle feuille modale à 2 choix ou plus |
| `mobile-motion.ts` | Courbes partagées (`SHEET_SPRING`…) + `haptic()` + `prefersReducedMotion()` |

> ℹ️ **`ListRow` a existé, a été supprimée le 2026-09-05** (C-10, six semaines sans consommateur),
> **puis réécrite le 2026-09-06** cette fois CONTRE un écran réel (page Habitudes, vue Liste
> mobile — voir section suivante). `MobileScreen` reste supprimée : rien n'en a eu besoin depuis.
> ❌ Ne pas ajouter `ListRow`/`FilterChips` à un nouvel écran sans les y avoir réellement
> branchées dans le même changement — c'est cette discipline, pas l'existence de la primitive,
> qui a manqué la première fois.

Composer ces briques plutôt que redessiner. Tests : `src/components/mobile/mobile-primitives.test.tsx`.
```

- [ ] **Step 2: `docs/MOBILE.md` — nouvelle section "Pattern liste (pas de card)"**

Insérer une nouvelle section juste après la section "Listes bord à bord — `.card-plain-mobile`"
(après la ligne qui commence par « **Piège `MobileCollapsible`** » et avant
« ### Exceptions documentées ») :

```markdown
### Pattern liste (pas de card) — référence Spotify (2026-09-06)

Au-delà de `.card-plain-mobile` (qui neutralise le chrome d'une SEULE card existante), toute
nouvelle liste mobile compose `ListRow` + `SectionHeader`, sans fond ni bordure individuelle par
élément — modèle explicite : l'écran Accueil de Spotify (rangées vignette + texte, filtres en
pilules `FilterChips`, hiérarchie portée par la typo plutôt que par des cadres).

- **Mobile uniquement** (`md:hidden` / rendu conditionnel). Le desktop garde ses cards actuelles ;
  ce n'est pas une refonte visuelle globale, page par page.
- Séparation entre rangées : `border-b border-[rgb(var(--color-border))] last:border-b-0`, posée
  par le composant qui ITÈRE (pas par `ListRow`, qui ignore sa position dans une liste).
- Zéro exception : même les blocs "résumé", stats en un coup d'œil, etc. perdent leur fond distinct
  le jour où ils migrent vers ce pattern.
- Pilote : `src/pages/habits/HabitsMobileList.tsx` (vue "Liste" de la page Habitudes). Le détail
  d'une habitude (calendrier 30 jours, actions) est une feuille (`HabitDetailSheet`), pas un
  accordéon dans une card — cohérent avec « pas de card ».
- Spec complète : `docs/superpowers/specs/2026-09-06-mobile-list-pattern-design.md`.
```

- [ ] **Step 3: `CLAUDE.md` — pointeur court**

Dans la section `## 🚫 Garde-fous — à ne jamais faire` de `CLAUDE.md`, sous-section
`### Animations` (juste avant `### 🪟 Une surface modale maison passe par...`), ajouter une
puce :

```markdown
- ❌ **Ne jamais empiler une nouvelle liste mobile dans une card.** Depuis le 2026-09-06, une
  liste mobile compose `ListRow`/`FilterChips` (`src/components/mobile/`), séparateurs fins,
  zéro fond par élément — référence Spotify, détail dans `docs/MOBILE.md` § « Pattern liste ».
  Le desktop n'est pas concerné.
```

- [ ] **Step 4: Commit**

```bash
git add docs/MOBILE.md CLAUDE.md
git commit -m "docs(mobile): documente le pattern liste sans card (ListRow/FilterChips)"
```

---

## Task 10 : vérification finale

**Files:** aucun (validation uniquement)

- [ ] **Step 1: Lint + typecheck**

Run: `npm run lint`
Expected: 0 erreur.

Run: `npm run typecheck`
Expected: 0 erreur.

- [ ] **Step 2: Suite de tests ciblée**

Run: `npx vitest run src/components/mobile/ src/components/HabitDayButton.test.tsx src/components/HabitDetailSheet.test.tsx src/pages/habits/ src/components/layout/MobileMoreSheet.test.tsx src/components/layout/MobileTabBar.test.tsx`

(`HabitDayButton.test.tsx` n'existe pas — Task 3 est un refactor pur sans test dédié, cette
commande est informative : Vitest ignore un chemin sans fichier correspondant sans faire échouer
la run globale.)

Expected: PASS sur tous les fichiers listés qui existent.

- [ ] **Step 3: Suite complète**

Run: `npm test`
Expected: tous les tests passent (le nombre total augmente d'environ 20 par rapport à la mesure
de référence de `CLAUDE.md`, 2051 tests au 2026-09-02).

- [ ] **Step 4: i18n**

Run: `npm run i18n:check`
Expected: 0 erreur.

Run: `npm run i18n:scan`
Expected: le cliquet reste à 0 (aucune chaîne d'interface en dur introduite — vérifier en
particulier `HabitsMobileList.tsx` et `HabitDetailSheet.tsx`, qui passent tout leur texte par
`useT`).

- [ ] **Step 5: Vérification navigateur (obligatoire — c'est une UI mobile)**

Démarrer le serveur de dev, ouvrir `/habits` en mode démo (localStorage, pas besoin de Supabase),
viewport 375×812 :

1. Se connecter en mode démo (`loginDemo()` via l'écran de connexion), naviguer vers `/habits`.
2. Vérifier la vue "Liste" (par défaut la page ouvre en vue "Tableau" — basculer sur "Liste") :
   rangées sans fond/bordure individuelle, séparateur fin entre chaque habitude.
3. Taper la pilule "Quotidiennes" dans `FilterChips` : la liste se réduit aux habitudes
   quotidiennes, la pilule active a un fond plein.
4. Taper le rond de coche à droite d'une rangée : l'état coché change SANS ouvrir de feuille.
5. Taper le reste de la rangée (nom/série) : `HabitDetailSheet` s'ouvre, calendrier 30 jours
   visible, boutons Éditer/Supprimer/Menu "..." fonctionnels.
6. Vérifier l'accès complet à `/habits` : ouvrir "Plus" (bouton bas droit de la barre) et confirmer
   la présence du lien "Habitudes" — c'est la vérification directe du bug corrigé en Task 8. Ce
   test manuel est nécessaire même si le mode démo n'a pas d'organisation active (la barre du bas
   affiche déjà "Habitudes" dans ce cas) : il valide au moins que l'entrée existe dans "Plus" et
   ne casse rien pour un compte sans organisation.
7. Repasser en desktop (redimensionner ≥768px) : vérifier que la vue "Liste" affiche de nouveau
   les `HabitCard` habituelles, inchangées.

- [ ] **Step 6: Rien à committer à cette étape**

Cette task est une vérification, pas une modification de code — aucun commit attendu ici. Si une
anomalie est trouvée à l'étape 5, revenir à la task concernée, corriger, recommiter.

---

## Auto-revue effectuée

- **Couverture de la spec** : les deux primitives (Task 1-2), le pilote Habitudes complet
  (Task 3-7), la doc (Task 9) sont couverts. L'écart filtre catégorie → fréquence est documenté
  en tête de plan (Habit n'a pas de champ catégorie).
- **Point ajouté hors spec, à la demande explicite d'Axel** : Task 8 (accès Habitudes manquant
  sur mobile) — bug réel trouvé pendant la préparation du plan, indépendant du pattern "pas de
  card" mais demandé dans le même message.
- **Cohérence des types** : `Habit`, `HabitFrequency`, `habitStreak()`, `generateHabitDays()`,
  `HabitDayButton` gardent la même forme dans toutes les tasks qui les consomment (vérifié contre
  `src/modules/habits/types.ts` et `src/modules/habits/streak.ts`).
- **Deux détails réglés pendant la rédaction, avant qu'ils n'atteignent une task exécutable** :
  le bouton Supprimer de `HabitDetailSheet` (Task 4) utilise directement `tCommon('actions.delete')`
  (pas de clé `habits.json` dédiée) ; `ListRow` (Task 2) porte `ariaLabel` dès sa première version
  pour que `HabitsMobileList` (Task 6) puisse annoncer « Voir le détail de {{name}} » à un lecteur
  d'écran sans détour ni retouche ultérieure.
