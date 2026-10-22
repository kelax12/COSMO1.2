# Guide entreprise : plan d'implémentation

> **Pour les agents :** sous-skill requis : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans. Les étapes utilisent des cases `- [ ]`.

**Objectif :** un bouton flottant en mode entreprise ouvre un tiroir de 30 actions ; un clic lance une démo où un curseur dédié navigue jusqu'au formulaire, l'ouvre vide et explique 2 ou 3 champs, sans jamais rien écrire.

**Architecture :** logique pure (types, droits, recherche, runner) testée en Vitest, scénarios en données, ancrages `data-guide-id` posés dans les écrans existants, quatre composants React lazy montés par `OrganizationPage`. Une garde Vitest relie scénarios, ancrages et traductions.

**Stack :** React 18, TypeScript strict, Framer Motion, catalogues i18n JSON maison, Vitest, Playwright.

**Spec :** [`docs/superpowers/specs/2026-10-12-guide-entreprise-design.md`](../specs/2026-10-12-guide-entreprise-design.md)

**Règles du dépôt à respecter tout du long :** alias `@/` ; pas de `as any` ; `toast` seulement via `@/lib/toast` ; pas de GSAP ; `safeParse` pour tout `localStorage` ; aucun em dash dans les textes livrés ; ne jamais passer `--maxWorkers` ; lire le code de sortie, pas la ligne de résumé.

**Écart assumé avec la spec :** l'attente de cible se fait par **sondage toutes les 100 ms** (3 s max) au lieu d'un `MutationObserver` : même comportement, testable avec des faux timers.

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `src/components/org-guide/guide-types.ts` | Types `GuideAction`, `GuideStep`, `GuideCategory`, `GuideRequirement` |
| `src/components/org-guide/guide-access.ts` (+ `.test.ts`) | Droit d'une action pour l'utilisateur courant |
| `src/components/org-guide/guide-search.ts` (+ `.test.ts`) | Filtre local libellé + synonymes, sans accents |
| `src/components/org-guide/guide-runner.ts` (+ `.test.ts`) | Exécution d'un scénario : attente, pause, annulation |
| `src/components/org-guide/scenarios/{work,people,roles,steer}.ts` | Les 30 actions, données seulement |
| `src/components/org-guide/scenarios/index.ts` | `GUIDE_ACTIONS`, `GUIDE_CATEGORIES` |
| `src/components/org-guide/guide-scenarios.guard.test.ts` | Ancrages existants, jamais sur submit/confirmation, clés i18n présentes |
| `src/components/org-guide/GuideCursor.tsx` | Curseur SVG animé |
| `src/components/org-guide/GuideBubble.tsx` | Bulle d'explication |
| `src/components/org-guide/GuideControlBar.tsx` | Pause / Passer / Quitter |
| `src/components/org-guide/OrgGuideDrawer.tsx` | Tiroir, recherche, catégories, carte « droit manquant » |
| `src/components/org-guide/OrgGuideHost.tsx` | Orchestration : tiroir, runner, calque de capture |
| `src/components/org-guide/OrgGuideFab.tsx` | Bouton flottant, seul élément eager |
| `src/locales/{fr,en}/orgGuide.json` | Toutes les chaînes |
| `src/i18n/catalog.ts` | Enregistrement du namespace |
| `src/App.tsx:106` | `orgGuide` ajouté aux namespaces d'`OrganizationPage` |
| `src/pages/OrganizationPage.tsx` | Montage du FAB et de l'hôte |
| ~25 composants de `src/components/organization/` | Pose des `data-guide-id` (tâche 7) |
| `e2e/org-guide.spec.ts` | Démo jouée en mode démo, zéro écriture |

---

### Tâche 1 : types et droits d'une action

**Fichiers :**
- Créer : `src/components/org-guide/guide-types.ts`
- Créer : `src/components/org-guide/guide-access.ts`
- Test : `src/components/org-guide/guide-access.test.ts`

- [ ] **Étape 1 : écrire les types**

```ts
// src/components/org-guide/guide-types.ts
import type { OrgSectionSegment } from '@/components/organization/deep-link.helpers';
import type { OrgPermissionKey } from '@/modules/organizations/permissions';

export type GuideCategory = 'work' | 'people' | 'roles' | 'steer';

/** Droit exigé : une clé de `ORG_PERMISSION_KEYS`, ou un statut sans clé dédiée. */
export type GuideRequirement = OrgPermissionKey | 'admin' | 'manager' | 'owner';

/**
 * Une étape ne SAISIT jamais rien et ne cible jamais un bouton qui écrit :
 * la garde `guide-scenarios.guard.test.ts` le vérifie sur le source.
 */
export type GuideStep =
  | { kind: 'goto'; section: OrgSectionSegment | 'overview'; via: string }
  | { kind: 'click'; target: string; bubbleKey?: string }
  | { kind: 'field'; target: string; bubbleKey: string }
  | { kind: 'pick-first'; target: string; emptyKey: string; bubbleKey?: string }
  | { kind: 'handoff'; bubbleKey: string };

export interface GuideAction {
  /** Identifiant stable, aussi suffixe des clés i18n `actions.<id>.*`. */
  id: string;
  category: GuideCategory;
  requires?: GuideRequirement;
  /** Masquée tant que la fonctionnalité serveur manque (mig. 219). */
  needsCustomRoles?: boolean;
  steps: GuideStep[];
}

export type GuideAccess = 'allowed' | 'denied' | 'hidden';

export interface GuideViewer {
  can: Record<OrgPermissionKey, boolean>;
  isAdmin: boolean;
  isManager: boolean;
  isOwner: boolean;
  customRolesAvailable: boolean;
}
```

- [ ] **Étape 2 : écrire le test qui échoue**

```ts
// src/components/org-guide/guide-access.test.ts
import { describe, expect, it } from 'vitest';
import { ORG_PERMISSION_KEYS, type OrgPermissionKey } from '@/modules/organizations/permissions';
import { guideAccess } from './guide-access';
import type { GuideAction, GuideViewer } from './guide-types';

const allCan = (value: boolean) =>
  Object.fromEntries(ORG_PERMISSION_KEYS.map((k) => [k, value])) as Record<OrgPermissionKey, boolean>;

const viewer = (over: Partial<GuideViewer> = {}): GuideViewer => ({
  can: allCan(false), isAdmin: false, isManager: false, isOwner: false, customRolesAvailable: true, ...over,
});
const action = (over: Partial<GuideAction> = {}): GuideAction => ({ id: 'x', category: 'work', steps: [], ...over });

describe('guideAccess', () => {
  it('autorise une action sans exigence', () => {
    expect(guideAccess(action(), viewer())).toBe('allowed');
  });
  it('suit la clé de permission', () => {
    const a = action({ requires: 'project.create' });
    expect(guideAccess(a, viewer())).toBe('denied');
    expect(guideAccess(a, viewer({ can: { ...allCan(false), 'project.create': true } }))).toBe('allowed');
  });
  it('admin, manager et propriétaire', () => {
    expect(guideAccess(action({ requires: 'admin' }), viewer({ isManager: true }))).toBe('denied');
    expect(guideAccess(action({ requires: 'manager' }), viewer({ isAdmin: true }))).toBe('allowed');
    expect(guideAccess(action({ requires: 'owner' }), viewer({ isAdmin: true }))).toBe('denied');
    expect(guideAccess(action({ requires: 'owner' }), viewer({ isOwner: true }))).toBe('allowed');
  });
  it('masque une action de rôle quand la mig. 219 manque, même pour un admin', () => {
    const a = action({ requires: 'role.manage', needsCustomRoles: true });
    expect(guideAccess(a, viewer({ isAdmin: true, can: allCan(true), customRolesAvailable: false }))).toBe('hidden');
  });
});
```

- [ ] **Étape 3 : lancer, constater l'échec**

Run : `npx vitest run src/components/org-guide/guide-access.test.ts`
Attendu : FAIL, `Cannot find module './guide-access'`.

- [ ] **Étape 4 : implémenter**

```ts
// src/components/org-guide/guide-access.ts
import type { GuideAccess, GuideAction, GuideViewer } from './guide-types';

/**
 * État d'une action pour l'utilisateur courant. Miroir d'affichage seulement :
 * la démo n'écrit rien, le serveur reste la barrière de toute action réelle.
 */
export const guideAccess = (action: GuideAction, viewer: GuideViewer): GuideAccess => {
  if (action.needsCustomRoles && !viewer.customRolesAvailable) return 'hidden';
  const req = action.requires;
  if (!req) return 'allowed';
  if (req === 'owner') return viewer.isOwner ? 'allowed' : 'denied';
  if (req === 'admin') return viewer.isAdmin ? 'allowed' : 'denied';
  if (req === 'manager') return viewer.isAdmin || viewer.isManager ? 'allowed' : 'denied';
  return viewer.can[req] ? 'allowed' : 'denied';
};
```

- [ ] **Étape 5 : relancer, constater le succès**

Run : `npx vitest run src/components/org-guide/guide-access.test.ts ; echo "exit=$?"`
Attendu : 4 tests PASS, `exit=0`.

- [ ] **Étape 6 : commit**

```bash
git add src/components/org-guide/guide-types.ts src/components/org-guide/guide-access.ts src/components/org-guide/guide-access.test.ts
git commit -m "feat(org-guide): types et droits d'une action du guide"
```

---

### Tâche 2 : recherche locale

**Fichiers :**
- Créer : `src/components/org-guide/guide-search.ts`
- Test : `src/components/org-guide/guide-search.test.ts`

- [ ] **Étape 1 : test qui échoue**

```ts
// src/components/org-guide/guide-search.test.ts
import { describe, expect, it } from 'vitest';
import { matchesGuideQuery, normalizeGuideText } from './guide-search';

describe('guide-search', () => {
  it('ignore casse et accents', () => {
    expect(normalizeGuideText('Créer une Équipe')).toBe('creer une equipe');
  });
  it('requête vide : tout correspond', () => {
    expect(matchesGuideQuery('', 'Créer un projet', '')).toBe(true);
  });
  it('cherche dans le libellé et les synonymes', () => {
    expect(matchesGuideQuery('equipe', 'Créer une équipe', '')).toBe(true);
    expect(matchesGuideQuery('ajouter collegue', 'Inviter par email', 'ajouter, collègue, recruter')).toBe(true);
    expect(matchesGuideQuery('facture', 'Créer un projet', 'chantier')).toBe(false);
  });
});
```

- [ ] **Étape 2 : lancer, constater l'échec**

Run : `npx vitest run src/components/org-guide/guide-search.test.ts`
Attendu : FAIL, module introuvable.

- [ ] **Étape 3 : implémenter**

```ts
// src/components/org-guide/guide-search.ts
export const normalizeGuideText = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Chaque mot de la requête doit apparaître dans le libellé ou les synonymes. */
export const matchesGuideQuery = (query: string, label: string, synonyms: string): boolean => {
  const words = normalizeGuideText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeGuideText(`${label} ${synonyms}`);
  return words.every((w) => haystack.includes(w));
};
```

- [ ] **Étape 4 : relancer**

Run : `npx vitest run src/components/org-guide/guide-search.test.ts ; echo "exit=$?"`
Attendu : 3 PASS, `exit=0`.

- [ ] **Étape 5 : commit**

```bash
git add src/components/org-guide/guide-search.ts src/components/org-guide/guide-search.test.ts
git commit -m "feat(org-guide): recherche locale sans accents"
```

---

### Tâche 3 : le runner

**Fichiers :**
- Créer : `src/components/org-guide/guide-runner.ts`
- Test : `src/components/org-guide/guide-runner.test.ts`

Le runner ne touche pas React. Il reçoit ses effets par `deps`, ce qui le rend testable avec des faux timers.

- [ ] **Étape 1 : test qui échoue**

```ts
// src/components/org-guide/guide-runner.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGuideRun, type GuideRunDeps } from './guide-runner';
import type { GuideStep } from './guide-types';

const el = () => document.createElement('button');

const makeDeps = (found: Record<string, HTMLElement | null>): GuideRunDeps & { log: string[] } => {
  const log: string[] = [];
  return {
    log,
    reducedMotion: false,
    find: (id) => found[id] ?? null,
    navigate: (section) => { log.push(`nav:${section}`); },
    moveCursor: async (target) => { log.push(`move:${target.dataset.g ?? '?'}`); },
    click: (target) => { log.push(`click:${target.dataset.g ?? '?'}`); },
    showBubble: (key) => { log.push(`bubble:${key ?? 'none'}`); },
    onStep: (i, n) => { log.push(`step:${i + 1}/${n}`); },
  };
};

const tag = (g: string) => { const b = el(); b.dataset.g = g; return b; };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('createGuideRun', () => {
  it('joue les étapes dans l\'ordre et finit en handoff', async () => {
    const steps: GuideStep[] = [
      { kind: 'goto', section: 'projects', via: 'nav-projects' },
      { kind: 'click', target: 'projects-new' },
      { kind: 'field', target: 'project-form-name', bubbleKey: 'b.name' },
      { kind: 'handoff', bubbleKey: 'b.done' },
    ];
    const deps = makeDeps({ 'nav-projects': tag('nav'), 'projects-new': tag('new'), 'project-form-name': tag('name') });
    const run = createGuideRun(steps, deps);
    const done = run.start();
    await vi.runAllTimersAsync();
    expect(await done).toEqual({ status: 'completed' });
    expect(deps.log).toEqual([
      'step:1/4', 'move:nav', 'nav:projects',
      'step:2/4', 'move:new', 'click:new',
      'step:3/4', 'move:name', 'bubble:b.name',
      'step:4/4', 'bubble:b.done',
    ]);
  });

  it('cible absente : s\'arrête après 3 s avec le motif missing', async () => {
    const deps = makeDeps({});
    const run = createGuideRun([{ kind: 'click', target: 'nope' }], deps);
    const done = run.start();
    await vi.advanceTimersByTimeAsync(3100);
    expect(await done).toEqual({ status: 'missing', target: 'nope' });
  });

  it('cible qui apparaît tard est attendue', async () => {
    const found: Record<string, HTMLElement | null> = {};
    const deps = makeDeps(found);
    const run = createGuideRun([{ kind: 'click', target: 'late' }], deps);
    const done = run.start();
    await vi.advanceTimersByTimeAsync(1000);
    found.late = tag('late');
    await vi.runAllTimersAsync();
    expect(await done).toEqual({ status: 'completed' });
    expect(deps.log).toContain('click:late');
  });

  it('pick-first sur liste vide : motif empty', async () => {
    const deps = makeDeps({ list: document.createElement('div') });
    const run = createGuideRun([{ kind: 'pick-first', target: 'list', emptyKey: 'e.noProject' }], deps);
    const done = run.start();
    await vi.runAllTimersAsync();
    expect(await done).toEqual({ status: 'empty', emptyKey: 'e.noProject' });
  });

  it('quitter interrompt sans autre effet', async () => {
    const deps = makeDeps({ a: tag('a'), b: tag('b') });
    const run = createGuideRun([{ kind: 'click', target: 'a' }, { kind: 'click', target: 'b' }], deps);
    const done = run.start();
    run.quit();
    await vi.runAllTimersAsync();
    expect(await done).toEqual({ status: 'quit' });
    expect(deps.log).not.toContain('click:b');
  });

  it('pause gèle, reprise continue', async () => {
    const deps = makeDeps({ a: tag('a'), b: tag('b') });
    const run = createGuideRun([{ kind: 'click', target: 'a' }, { kind: 'click', target: 'b' }], deps);
    const done = run.start();
    await vi.advanceTimersByTimeAsync(10);
    run.pause();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(deps.log).not.toContain('click:b');
    run.resume();
    await vi.runAllTimersAsync();
    expect(await done).toEqual({ status: 'completed' });
    expect(deps.log).toContain('click:b');
  });
});
```

- [ ] **Étape 2 : lancer, constater l'échec**

Run : `npx vitest run src/components/org-guide/guide-runner.test.ts`
Attendu : FAIL, module introuvable.

- [ ] **Étape 3 : implémenter**

```ts
// src/components/org-guide/guide-runner.ts
import type { GuideStep } from './guide-types';

export interface GuideRunDeps {
  reducedMotion: boolean;
  /** Élément portant `data-guide-id="<id>"`, ou null. */
  find: (id: string) => HTMLElement | null;
  navigate: (section: string) => void;
  moveCursor: (target: HTMLElement) => Promise<void>;
  /** Vrai clic : uniquement sur des éléments qui OUVRENT (garde de scénarios). */
  click: (target: HTMLElement) => void;
  showBubble: (key: string | null, target: HTMLElement | null) => void;
  onStep: (index: number, total: number) => void;
}

export type GuideRunResult =
  | { status: 'completed' }
  | { status: 'quit' }
  | { status: 'missing'; target: string }
  | { status: 'empty'; emptyKey: string };

const POLL_MS = 100;
const TARGET_TIMEOUT_MS = 3000;
const FIELD_DWELL_MS = 2600;
const STEP_GAP_MS = 500;

class Quit extends Error {}

export const createGuideRun = (steps: GuideStep[], deps: GuideRunDeps) => {
  let quitted = false;
  let paused = false;
  let skipDwell: (() => void) | null = null;
  const resumeWaiters: (() => void)[] = [];

  const gate = async () => {
    if (quitted) throw new Quit();
    while (paused) {
      await new Promise<void>((r) => resumeWaiters.push(r));
      if (quitted) throw new Quit();
    }
  };

  const sleep = async (ms: number, skippable = false) => {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, deps.reducedMotion ? Math.min(ms, 300) : ms);
      if (skippable) skipDwell = () => { clearTimeout(t); resolve(); };
    });
    skipDwell = null;
    await gate();
  };

  const waitFor = async (id: string): Promise<HTMLElement | null> => {
    for (let waited = 0; waited <= TARGET_TIMEOUT_MS; waited += POLL_MS) {
      await gate();
      const found = deps.find(id);
      if (found) return found;
      await sleep(POLL_MS);
    }
    return null;
  };

  const run = async (): Promise<GuideRunResult> => {
    try {
      for (let i = 0; i < steps.length; i++) {
        await gate();
        const step = steps[i];
        deps.onStep(i, steps.length);
        if (step.kind === 'handoff') { deps.showBubble(step.bubbleKey, null); continue; }
        const id = step.kind === 'goto' ? step.via : step.target;
        const target = await waitFor(id);
        if (!target) return { status: 'missing', target: id };
        await deps.moveCursor(target);
        await gate();
        if (step.kind === 'goto') deps.navigate(step.section);
        else if (step.kind === 'click') { deps.click(target); if (step.bubbleKey) deps.showBubble(step.bubbleKey, target); }
        else if (step.kind === 'field') { deps.showBubble(step.bubbleKey, target); await sleep(FIELD_DWELL_MS, true); }
        else if (step.kind === 'pick-first') {
          const first = target.querySelector<HTMLElement>('[data-guide-item]');
          if (!first) return { status: 'empty', emptyKey: step.emptyKey };
          await deps.moveCursor(first);
          deps.click(first);
          if (step.bubbleKey) deps.showBubble(step.bubbleKey, first);
        }
        if (i < steps.length - 1) await sleep(STEP_GAP_MS);
      }
      return { status: 'completed' };
    } catch (e) {
      if (e instanceof Quit) return { status: 'quit' };
      throw e;
    }
  };

  return {
    start: run,
    pause: () => { paused = true; },
    resume: () => { paused = false; resumeWaiters.splice(0).forEach((r) => r()); },
    /** Passe la bulle en cours (étape `field`). */
    skip: () => { skipDwell?.(); },
    quit: () => { quitted = true; skipDwell?.(); resumeWaiters.splice(0).forEach((r) => r()); },
  };
};
```

- [ ] **Étape 4 : relancer**

Run : `npx vitest run src/components/org-guide/guide-runner.test.ts ; echo "exit=$?"`
Attendu : 6 PASS, `exit=0`. Si « pause gèle » échoue parce que le premier clic n'a pas eu lieu à 10 ms, c'est le `moveCursor` asynchrone : avancer de 10 ms suffit avec les faux timers, ne pas allonger les délais du runner pour le test.

- [ ] **Étape 5 : commit**

```bash
git add src/components/org-guide/guide-runner.ts src/components/org-guide/guide-runner.test.ts
git commit -m "feat(org-guide): runner de scenario (attente, pause, quitter)"
```

---

### Tâche 4 : namespace i18n `orgGuide`

**Fichiers :**
- Créer : `src/locales/fr/orgGuide.json`, `src/locales/en/orgGuide.json`
- Modifier : `src/i18n/catalog.ts` (trois endroits : `typeof import` vers la ligne 70, `Shape` vers la ligne 240, `NAMESPACES` vers la ligne 332)
- Modifier : `src/App.tsx:106`

- [ ] **Étape 1 : écrire le catalogue `fr`** (structure complète ; les 30 actions suivent le même gabarit, contenus repris de la section 6 de la spec)

```json
{
  "fab": { "label": "Ouvrir le guide entreprise", "newBadge": "Nouveau" },
  "drawer": {
    "title": "Guide entreprise",
    "close": "Fermer le guide",
    "searchPlaceholder": "Inviter, rôle, projet…",
    "noResult": "Aucune action ne correspond. Essaie un autre mot.",
    "badgeAdmin": "Admin",
    "badgeManager": "Gestion",
    "badgeOwner": "Propriétaire"
  },
  "categories": {
    "work": "Projets et tâches",
    "people": "Équipes et membres",
    "roles": "Rôles et permissions",
    "steer": "OKR et pilotage"
  },
  "denied": {
    "title": "Droit manquant",
    "body": "Il te faut le droit « {right} ». Un admin de l'entreprise peut te l'accorder.",
    "seeAdmins": "Voir les admins",
    "rights": {
      "admin": "Administrateur", "manager": "Gestion d'équipe", "owner": "Propriétaire",
      "task.create": "Créer des tâches", "task.editAny": "Modifier toutes les tâches", "task.deleteAny": "Supprimer toutes les tâches",
      "project.create": "Créer des projets", "project.edit": "Modifier les projets", "project.delete": "Supprimer les projets",
      "okr.create": "Créer des OKR", "okr.delete": "Supprimer des OKR", "category.manage": "Gérer les catégories",
      "team.create": "Créer des équipes", "member.invite": "Inviter des membres",
      "report.org": "Rapports de l'entreprise", "report.allTeams": "Rapports de toutes les équipes", "role.manage": "Gérer les rôles"
    }
  },
  "control": {
    "progress": "{action} · étape {current}/{total}",
    "pause": "Mettre en pause", "resume": "Reprendre", "skip": "Passer", "quit": "Quitter la démo"
  },
  "end": {
    "handoff": "À toi de jouer : le formulaire est ouvert.",
    "missing": "Cet écran a changé depuis l'écriture du guide. Ouvre-le à la main.",
    "openDirect": "Ouvrir l'écran"
  },
  "empty": {
    "noTask": "Il te faut d'abord une tâche.",
    "noProject": "Il te faut d'abord un projet.",
    "noTeam": "Il te faut d'abord une équipe.",
    "noMember": "Il n'y a encore personne d'autre que toi.",
    "noRole": "Aucun rôle personnalisé pour l'instant.",
    "noOkr": "Il te faut d'abord un OKR.",
    "noReport": "Aucun rapport pour l'instant : le premier est généré à minuit.",
    "noRequest": "Aucune demande en attente.",
    "noUnplaced": "Tout le monde est déjà placé.",
    "startPrereq": "Montre-moi comment"
  },
  "actions": {
    "project.create": {
      "label": "Créer un projet",
      "synonyms": "nouveau projet, chantier, dossier",
      "b1": "Le nom du projet, visible par toute l'audience.",
      "b2": "L'équipe propriétaire décide de qui gère le projet.",
      "b3": "L'échéance alimente la timeline et les alertes."
    }
  }
}
```

Pour chacune des 30 actions de la spec, ajouter sous `actions.<id>` : `label`, `synonyms`, et une clé `b1`, `b2` (et `b3` si la spec liste trois champs) dont le texte explique le champ nommé dans la colonne « Bulles » de la spec en une phrase de 6 à 14 mots. Ids : voir tâche 5. Sans em dash.

- [ ] **Étape 2 : écrire le catalogue `en`** avec exactement les mêmes clés, traduites.

- [ ] **Étape 3 : enregistrer le namespace dans `src/i18n/catalog.ts`**

Ajouter, à côté de `orgConfig` :
```ts
  orgGuide: typeof import('@/locales/fr/orgGuide.json');
```
```ts
  orgGuide: Shape<'orgGuide'>;
```
et `'orgGuide'` dans `NAMESPACES` juste après `'orgConfig'`. Lire le fichier avant : si un import statique `fr` de chaque namespace lazy est exigé ailleurs, suivre le même motif que `orgConfig`.

- [ ] **Étape 4 : charger le namespace avec la page** (`src/App.tsx:106`)

```ts
const OrganizationPage = lazyWithRetry(() => import('@/pages/OrganizationPage'), ['csv', 'eventModal', 'okr', 'org', 'orgAdmin', 'orgGuide', 'overlays', 'portfolio', 'tasks']);
```

- [ ] **Étape 5 : vérifier**

Run : `npm run typecheck ; echo "exit=$?"` puis `npm run i18n:check ; echo "exit=$?"` puis `npx vitest run src/i18n ; echo "exit=$?"`
Attendu : trois `exit=0`. `lazy-namespaces.guard.test.ts` doit rester vert : `orgGuide` n'est pas un namespace du shell.

- [ ] **Étape 6 : commit**

```bash
git add src/locales/fr/orgGuide.json src/locales/en/orgGuide.json src/i18n/catalog.ts src/App.tsx
git commit -m "feat(org-guide): catalogue i18n orgGuide fr/en"
```

---

### Tâche 5 : les 30 scénarios

**Fichiers :**
- Créer : `src/components/org-guide/scenarios/work.ts`, `people.ts`, `roles.ts`, `steer.ts`, `index.ts`

Convention d'ancrage : `nav-<section>` pour les liens de navigation, `<zone>-<élément>` ailleurs. La pose réelle est la tâche 7 ; la garde de la tâche 6 les relie.

- [ ] **Étape 1 : `work.ts`**

```ts
// src/components/org-guide/scenarios/work.ts
import type { GuideAction } from '../guide-types';

const k = (id: string, b: string) => `actions.${id}.${b}`;

export const WORK_ACTIONS: GuideAction[] = [
  { id: 'project.create', category: 'work', requires: 'project.create', steps: [
    { kind: 'goto', section: 'projects', via: 'nav-projects' },
    { kind: 'click', target: 'projects-new' },
    { kind: 'field', target: 'project-form-name', bubbleKey: k('project.create', 'b1') },
    { kind: 'field', target: 'project-form-team', bubbleKey: k('project.create', 'b2') },
    { kind: 'field', target: 'project-form-due', bubbleKey: k('project.create', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'project.fromTemplate', category: 'work', requires: 'project.create', steps: [
    { kind: 'goto', section: 'projects', via: 'nav-projects' },
    { kind: 'click', target: 'projects-new' },
    { kind: 'click', target: 'project-form-templates-tab' },
    { kind: 'field', target: 'project-templates-list', bubbleKey: k('project.fromTemplate', 'b1') },
    { kind: 'field', target: 'project-templates-preview', bubbleKey: k('project.fromTemplate', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'task.create', category: 'work', requires: 'task.create', steps: [
    { kind: 'goto', section: 'tasks', via: 'nav-tasks' },
    { kind: 'click', target: 'tasks-new' },
    { kind: 'field', target: 'task-form-title', bubbleKey: k('task.create', 'b1') },
    { kind: 'field', target: 'task-form-project', bubbleKey: k('task.create', 'b2') },
    { kind: 'field', target: 'task-form-assignees', bubbleKey: k('task.create', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'task.assign', category: 'work', steps: [
    { kind: 'goto', section: 'tasks', via: 'nav-tasks' },
    { kind: 'pick-first', target: 'tasks-list', emptyKey: 'empty.noTask' },
    { kind: 'field', target: 'task-detail-assignees', bubbleKey: k('task.assign', 'b1') },
    { kind: 'field', target: 'task-detail-followers', bubbleKey: k('task.assign', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'task.subtaskDependency', category: 'work', steps: [
    { kind: 'goto', section: 'tasks', via: 'nav-tasks' },
    { kind: 'pick-first', target: 'tasks-list', emptyKey: 'empty.noTask' },
    { kind: 'field', target: 'task-detail-subtasks', bubbleKey: k('task.subtaskDependency', 'b1') },
    { kind: 'field', target: 'task-detail-dependencies', bubbleKey: k('task.subtaskDependency', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'project.audience', category: 'work', requires: 'project.edit', steps: [
    { kind: 'goto', section: 'projects', via: 'nav-projects' },
    { kind: 'pick-first', target: 'projects-list', emptyKey: 'empty.noProject' },
    { kind: 'click', target: 'project-detail-audience' },
    { kind: 'field', target: 'project-audience-who', bubbleKey: k('project.audience', 'b1') },
    { kind: 'field', target: 'project-audience-confidential', bubbleKey: k('project.audience', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'list.create', category: 'work', steps: [
    { kind: 'goto', section: 'tasks', via: 'nav-tasks' },
    { kind: 'click', target: 'task-lists-new' },
    { kind: 'field', target: 'task-list-form-name', bubbleKey: k('list.create', 'b1') },
    { kind: 'field', target: 'task-list-form-pin', bubbleKey: k('list.create', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'trash.restore', category: 'work', requires: 'task.deleteAny', steps: [
    { kind: 'goto', section: 'tasks', via: 'nav-tasks' },
    { kind: 'click', target: 'tasks-more-menu' },
    { kind: 'click', target: 'tasks-open-trash' },
    { kind: 'field', target: 'trash-list', bubbleKey: k('trash.restore', 'b1') },
    { kind: 'field', target: 'trash-restore-hint', bubbleKey: k('trash.restore', 'b2') },
    { kind: 'field', target: 'trash-retention', bubbleKey: k('trash.restore', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
];
```

- [ ] **Étape 2 : `people.ts`**

```ts
// src/components/org-guide/scenarios/people.ts
import type { GuideAction } from '../guide-types';

const k = (id: string, b: string) => `actions.${id}.${b}`;

export const PEOPLE_ACTIONS: GuideAction[] = [
  { id: 'team.create', category: 'people', requires: 'team.create', steps: [
    { kind: 'goto', section: 'teams', via: 'nav-teams' },
    { kind: 'click', target: 'teams-new' },
    { kind: 'field', target: 'team-form-name', bubbleKey: k('team.create', 'b1') },
    { kind: 'field', target: 'team-form-lead', bubbleKey: k('team.create', 'b2') },
    { kind: 'field', target: 'team-form-members', bubbleKey: k('team.create', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'member.inviteEmail', category: 'people', requires: 'member.invite', steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'click', target: 'members-invite' },
    { kind: 'click', target: 'invite-mode-email' },
    { kind: 'field', target: 'invite-email-addresses', bubbleKey: k('member.inviteEmail', 'b1') },
    { kind: 'field', target: 'invite-email-role', bubbleKey: k('member.inviteEmail', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'member.inviteLink', category: 'people', requires: 'member.invite', steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'click', target: 'members-invite' },
    { kind: 'click', target: 'invite-mode-link' },
    { kind: 'field', target: 'invite-link-copy', bubbleKey: k('member.inviteLink', 'b1') },
    { kind: 'field', target: 'invite-link-expiry', bubbleKey: k('member.inviteLink', 'b2') },
    { kind: 'field', target: 'invite-join-code', bubbleKey: k('member.inviteLink', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'member.joinRequest', category: 'people', requires: 'member.invite', steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'pick-first', target: 'members-join-requests', emptyKey: 'empty.noRequest', bubbleKey: k('member.joinRequest', 'b1') },
    { kind: 'field', target: 'join-request-actions', bubbleKey: k('member.joinRequest', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'team.addMembers', category: 'people', requires: 'manager', steps: [
    { kind: 'goto', section: 'teams', via: 'nav-teams' },
    { kind: 'pick-first', target: 'teams-list', emptyKey: 'empty.noTeam' },
    { kind: 'click', target: 'team-members-add' },
    { kind: 'field', target: 'team-add-picker', bubbleKey: k('team.addMembers', 'b1') },
    { kind: 'field', target: 'team-add-role', bubbleKey: k('team.addMembers', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'pyramid.place', category: 'people', requires: 'admin', steps: [
    { kind: 'goto', section: 'pyramid', via: 'nav-pyramid' },
    { kind: 'pick-first', target: 'pyramid-unplaced', emptyKey: 'empty.noUnplaced' },
    { kind: 'field', target: 'pyramid-place-manager', bubbleKey: k('pyramid.place', 'b1') },
    { kind: 'field', target: 'pyramid-place-effect', bubbleKey: k('pyramid.place', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'member.offboard', category: 'people', requires: 'admin', steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'pick-first', target: 'members-directory', emptyKey: 'empty.noMember' },
    { kind: 'click', target: 'member-lifecycle-offboard' },
    { kind: 'field', target: 'offboard-reassign', bubbleKey: k('member.offboard', 'b1') },
    { kind: 'field', target: 'offboard-kept', bubbleKey: k('member.offboard', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
];
```

- [ ] **Étape 3 : `roles.ts`**

```ts
// src/components/org-guide/scenarios/roles.ts
import type { GuideAction } from '../guide-types';

const k = (id: string, b: string) => `actions.${id}.${b}`;

export const ROLES_ACTIONS: GuideAction[] = [
  { id: 'role.create', category: 'roles', requires: 'role.manage', needsCustomRoles: true, steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'click', target: 'settings-roles-new' },
    { kind: 'field', target: 'role-editor-name', bubbleKey: k('role.create', 'b1') },
    { kind: 'field', target: 'role-editor-matrix', bubbleKey: k('role.create', 'b2') },
    { kind: 'field', target: 'role-editor-color', bubbleKey: k('role.create', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'role.edit', category: 'roles', requires: 'role.manage', needsCustomRoles: true, steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'pick-first', target: 'settings-roles-list', emptyKey: 'empty.noRole' },
    { kind: 'field', target: 'role-editor-matrix', bubbleKey: k('role.edit', 'b1') },
    { kind: 'field', target: 'role-editor-members', bubbleKey: k('role.edit', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'role.assign', category: 'roles', requires: 'role.manage', needsCustomRoles: true, steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'pick-first', target: 'members-directory', emptyKey: 'empty.noMember' },
    { kind: 'click', target: 'member-assign-role' },
    { kind: 'field', target: 'assign-role-select', bubbleKey: k('role.assign', 'b1') },
    { kind: 'field', target: 'assign-role-stack', bubbleKey: k('role.assign', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'role.assignTimed', category: 'roles', requires: 'role.manage', needsCustomRoles: true, steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'pick-first', target: 'members-directory', emptyKey: 'empty.noMember' },
    { kind: 'click', target: 'member-assign-role' },
    { kind: 'field', target: 'assign-role-until', bubbleKey: k('role.assignTimed', 'b1') },
    { kind: 'field', target: 'assign-role-until-hint', bubbleKey: k('role.assignTimed', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'member.permissions', category: 'roles', requires: 'admin', steps: [
    { kind: 'goto', section: 'members', via: 'nav-members' },
    { kind: 'pick-first', target: 'members-directory', emptyKey: 'empty.noMember' },
    { kind: 'click', target: 'member-open-permissions' },
    { kind: 'field', target: 'member-permissions-matrix', bubbleKey: k('member.permissions', 'b1') },
    { kind: 'field', target: 'member-permissions-default', bubbleKey: k('member.permissions', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'me.permissions', category: 'roles', steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'field', target: 'my-permissions-card', bubbleKey: k('me.permissions', 'b1') },
    { kind: 'field', target: 'my-permissions-source', bubbleKey: k('me.permissions', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'org.transferOwnership', category: 'roles', requires: 'owner', steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'click', target: 'settings-transfer-ownership' },
    { kind: 'field', target: 'transfer-new-owner', bubbleKey: k('org.transferOwnership', 'b1') },
    { kind: 'field', target: 'transfer-warning', bubbleKey: k('org.transferOwnership', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
];
```

- [ ] **Étape 4 : `steer.ts`**

```ts
// src/components/org-guide/scenarios/steer.ts
import type { GuideAction } from '../guide-types';

const k = (id: string, b: string) => `actions.${id}.${b}`;

export const STEER_ACTIONS: GuideAction[] = [
  { id: 'okr.create', category: 'steer', requires: 'okr.create', steps: [
    { kind: 'goto', section: 'okr', via: 'nav-okr' },
    { kind: 'click', target: 'okr-new' },
    { kind: 'field', target: 'okr-form-objective', bubbleKey: k('okr.create', 'b1') },
    { kind: 'field', target: 'okr-form-krs', bubbleKey: k('okr.create', 'b2') },
    { kind: 'field', target: 'okr-form-audience', bubbleKey: k('okr.create', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'kr.update', category: 'steer', steps: [
    { kind: 'goto', section: 'okr', via: 'nav-okr' },
    { kind: 'pick-first', target: 'okr-kr-list', emptyKey: 'empty.noOkr' },
    { kind: 'field', target: 'kr-exec-value', bubbleKey: k('kr.update', 'b1') },
    { kind: 'field', target: 'kr-exec-comment', bubbleKey: k('kr.update', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'kr.linkProject', category: 'steer', requires: 'okr.create', steps: [
    { kind: 'goto', section: 'okr', via: 'nav-okr' },
    { kind: 'pick-first', target: 'okr-list', emptyKey: 'empty.noOkr' },
    { kind: 'field', target: 'okr-link-project', bubbleKey: k('kr.linkProject', 'b1') },
    { kind: 'field', target: 'okr-link-effect', bubbleKey: k('kr.linkProject', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'review.weekly', category: 'steer', requires: 'manager', steps: [
    { kind: 'goto', section: 'overview', via: 'nav-overview' },
    { kind: 'click', target: 'overview-weekly-review' },
    { kind: 'field', target: 'weekly-review-progress', bubbleKey: k('review.weekly', 'b1') },
    { kind: 'field', target: 'weekly-review-blockers', bubbleKey: k('review.weekly', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'report.view', category: 'steer', requires: 'report.org', steps: [
    { kind: 'goto', section: 'reports', via: 'nav-reports' },
    { kind: 'pick-first', target: 'reports-list', emptyKey: 'empty.noReport' },
    { kind: 'field', target: 'report-period', bubbleKey: k('report.view', 'b1') },
    { kind: 'field', target: 'report-scope', bubbleKey: k('report.view', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'team.workload', category: 'steer', requires: 'manager', steps: [
    { kind: 'goto', section: 'teams', via: 'nav-teams' },
    { kind: 'pick-first', target: 'teams-list', emptyKey: 'empty.noTeam' },
    { kind: 'field', target: 'team-workload-members', bubbleKey: k('team.workload', 'b1') },
    { kind: 'field', target: 'team-workload-overload', bubbleKey: k('team.workload', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'tasks.export', category: 'steer', requires: 'admin', steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'field', target: 'export-format', bubbleKey: k('tasks.export', 'b1') },
    { kind: 'field', target: 'export-filters', bubbleKey: k('tasks.export', 'b2') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
  { id: 'org.profile', category: 'steer', requires: 'admin', steps: [
    { kind: 'goto', section: 'settings', via: 'nav-settings' },
    { kind: 'field', target: 'org-profile-name', bubbleKey: k('org.profile', 'b1') },
    { kind: 'field', target: 'org-profile-logo', bubbleKey: k('org.profile', 'b2') },
    { kind: 'field', target: 'org-profile-timezone', bubbleKey: k('org.profile', 'b3') },
    { kind: 'handoff', bubbleKey: 'end.handoff' },
  ] },
];
```

Note : `report.view` exige `report.org` ; un membre qui n'a que `report.allTeams` la verra grisée. Accepté pour la v1 (spec : « `report.org` ou `report.allTeams` ») ? **Non** : ajouter dans `guide-access.ts` un cas `if (action.id === 'report.view') return viewer.can['report.org'] || viewer.can['report.allTeams'] ? 'allowed' : 'denied';` serait un cas spécial caché. Préférer étendre `GuideRequirement` avec `{ anyOf: OrgPermissionKey[] }` si le test de la tâche 1 est repris ; sinon garder `report.org` et le noter en question ouverte. **Décision du plan : garder `report.org`**, le signaler à Axel au bilan.

- [ ] **Étape 5 : `index.ts`**

```ts
// src/components/org-guide/scenarios/index.ts
import type { GuideAction, GuideCategory } from '../guide-types';
import { PEOPLE_ACTIONS } from './people';
import { ROLES_ACTIONS } from './roles';
import { STEER_ACTIONS } from './steer';
import { WORK_ACTIONS } from './work';

export const GUIDE_CATEGORIES: GuideCategory[] = ['work', 'people', 'roles', 'steer'];

export const GUIDE_ACTIONS: GuideAction[] = [...WORK_ACTIONS, ...PEOPLE_ACTIONS, ...ROLES_ACTIONS, ...STEER_ACTIONS];
```

- [ ] **Étape 6 : vérifier et committer**

Run : `npm run typecheck ; echo "exit=$?"` → `exit=0`.

```bash
git add src/components/org-guide/scenarios
git commit -m "feat(org-guide): les 30 scenarios du guide"
```

---

### Tâche 6 : garde des scénarios

**Fichiers :**
- Créer : `src/components/org-guide/guide-scenarios.guard.test.ts`

- [ ] **Étape 1 : écrire la garde**

```ts
// src/components/org-guide/guide-scenarios.guard.test.ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fr from '@/locales/fr/orgGuide.json';
import en from '@/locales/en/orgGuide.json';
import { GUIDE_ACTIONS } from './scenarios';

const SRC = join(process.cwd(), 'src');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [p] : [];
  });

// Chaque balise ouvrante qui porte un data-guide-id, avec ses attributs.
const ANCHOR_RE = /<([A-Za-z.]+)\b([^>]*?)data-guide-id=["']([a-z0-9-]+)["']([^>]*)>/gs;
const anchors = new Map<string, string>();
for (const file of walk(SRC)) {
  for (const m of readFileSync(file, 'utf8').matchAll(ANCHOR_RE)) anchors.set(m[3], `${m[1]} ${m[2]} ${m[4]}`);
}

const targets = GUIDE_ACTIONS.flatMap((a) => a.steps.map((s) => (s.kind === 'goto' ? s.via : s.kind === 'handoff' ? null : s.target)))
  .filter((t): t is string => !!t);

const lookup = (cat: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), cat);

// Les ids d'action contiennent des points : `actions.project.create.b1` se résout en
// actions → "project.create" → b1, pas en actions → project → create.
const lookupKey = (cat: unknown, key: string): unknown => {
  const m = /^actions\.(.+)\.(label|synonyms|b\d)$/.exec(key);
  if (!m) return lookup(cat, key);
  const actions = (cat as { actions: Record<string, Record<string, unknown>> }).actions;
  return actions[m[1]]?.[m[2]];
};

describe('scénarios du guide entreprise', () => {
  it('30 actions, ids uniques', () => {
    expect(GUIDE_ACTIONS).toHaveLength(30);
    expect(new Set(GUIDE_ACTIONS.map((a) => a.id)).size).toBe(30);
  });

  it.each([...new Set(targets)])('l\'ancrage %s existe dans src/', (id) => {
    expect(anchors.has(id), `data-guide-id="${id}" introuvable`).toBe(true);
  });

  it('aucun ancrage sur un bouton qui écrit', () => {
    const writes = [...anchors].filter(([, attrs]) =>
      /type=["']submit["']/.test(attrs) || /data-guide-forbid/.test(attrs));
    expect(writes.map(([id]) => id)).toEqual([]);
  });

  it('les étapes `click` ne visent pas un id évoquant une écriture', () => {
    const risky = GUIDE_ACTIONS.flatMap((a) => a.steps)
      .filter((s) => s.kind === 'click' && /(save|submit|confirm|delete|remove|create-confirm)/.test(s.target));
    expect(risky).toEqual([]);
  });

  it.each(['fr', 'en'] as const)('toutes les clés existent en %s', (lang) => {
    const cat = lang === 'fr' ? fr : en;
    const keys = GUIDE_ACTIONS.flatMap((a) => [
      `actions.${a.id}.label`, `actions.${a.id}.synonyms`,
      ...a.steps.flatMap((s) => [
        'bubbleKey' in s ? s.bubbleKey : undefined,
        s.kind === 'pick-first' ? s.emptyKey : undefined,
      ]),
    ]).filter((key): key is string => !!key);
    const missing = keys.filter((key) => typeof lookupKey(cat, key) !== 'string');
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Étape 2 : lancer**

Run : `npx vitest run src/components/org-guide/guide-scenarios.guard.test.ts ; echo "exit=$?"`
Attendu : FAIL sur les ancrages (aucun n'est posé), PASS sur le nombre d'actions et les clés i18n. Si des clés manquent, compléter la tâche 4 maintenant. **Ne pas** committer la garde en rouge : passer à la tâche 7 et committer les deux ensemble.

---

### Tâche 7 : poser les ancrages `data-guide-id`

**Fichiers :** composants de `src/components/organization/` listés ci-dessous, plus `OrgSideNav.tsx`.

Règles :
- Un `data-guide-id` se pose sur l'élément **qui ouvre** (bouton d'ouverture, onglet, ligne de liste) ou sur le **conteneur d'un champ** (le `div` qui entoure label + input), jamais sur un bouton `type="submit"` ni sur un bouton de confirmation ou de suppression.
- Les listes ciblées par `pick-first` portent `data-guide-id` sur le conteneur, et **chaque ligne cliquable** porte `data-guide-item` (attribut sans valeur).
- Avant de poser un id, `grep -rn 'data-guide-id="<id>"' src` doit être vide (unicité).
- Si un composant passe ses props à un primitif shadcn (`<Button>`, `<DialogContent>`), l'attribut `data-*` traverse : vérifier en lisant le primitif.

| Ancrage | Composant (à ouvrir et lire) | Élément |
|---|---|---|
| `nav-overview`, `nav-tasks`, `nav-projects`, `nav-okr`, `nav-reports`, `nav-pyramid`, `nav-members`, `nav-teams`, `nav-settings` | `OrgSideNav.tsx` | lien de chaque section : `data-guide-id={\`nav-${item.id}\`}` |
| `projects-new`, `projects-list` (+ `data-guide-item` sur `TeamProjectCard`) | `ProjectsToolbar.tsx`, `ProjectPortfolioView.tsx`, `TeamProjectCard.tsx` | bouton Nouveau projet ; conteneur de liste ; carte |
| `project-form-name`, `project-form-team`, `project-form-due`, `project-form-templates-tab` | `NewTeamProjectModal.tsx` | conteneurs de champ ; onglet modèles |
| `project-templates-list`, `project-templates-preview` | `ProjectTemplatesSection.tsx` | liste ; aperçu |
| `project-detail-audience`, `project-audience-who`, `project-audience-confidential` | `ProjectDetailPage.tsx`, `ProjectAudienceActions.tsx` | bouton d'ouverture ; champs |
| `tasks-new`, `tasks-more-menu`, `tasks-open-trash`, `tasks-list` (+ `data-guide-item` sur `TeamTaskRow` / `TeamTasksTableRow`) | `TeamTasksToolbar.tsx`, `TeamTasksTab.tsx`, `TeamTaskRow.tsx`, `TeamTasksTableRow.tsx` | |
| `task-form-title`, `task-form-project`, `task-form-assignees` | `TeamTaskModal.tsx` / `TeamTaskFields.tsx` | conteneurs de champ |
| `task-detail-assignees`, `task-detail-followers`, `task-detail-subtasks`, `task-detail-dependencies` | `DeepTaskModal.tsx`, `FollowTaskToggle.tsx`, `TeamSubtasksSection.tsx`, `TeamTaskDependenciesSection.tsx` | |
| `task-lists-new`, `task-list-form-name`, `task-list-form-pin` | `TeamTaskListsBar.tsx` | |
| `trash-list`, `trash-restore-hint`, `trash-retention` | `TeamTrashDialog.tsx` | `trash-restore-hint` sur le texte d'aide, pas sur le bouton Restaurer |
| `teams-new`, `teams-list` (+ items), `team-form-name`, `team-form-lead`, `team-form-members` | `TeamsSection.tsx`, `CreateTeamModal.tsx` | |
| `team-members-add`, `team-add-picker`, `team-add-role` | `TeamMembersPanel.tsx`, `TeamBulkAddDialog.tsx` | |
| `team-workload-members`, `team-workload-overload` | `TeamWorkloadSection.tsx` | |
| `members-invite`, `invite-mode-email`, `invite-mode-link` | `OrgMembersSection.tsx` / `MemberDirectoryToolbar.tsx`, `InviteModeDialog.tsx` | |
| `invite-email-addresses`, `invite-email-role` | `InviteByEmailDialog.tsx` | |
| `invite-link-copy`, `invite-link-expiry`, `invite-join-code` | `OrgInviteLinkCard.tsx`, `OrgJoinCodeCard.tsx` | `invite-link-copy` sur le bouton Copier (il n'écrit rien) |
| `members-join-requests` (+ items), `join-request-actions` | `OrgJoinRequestsList.tsx` | `join-request-actions` sur le **conteneur** des boutons |
| `members-directory` (+ `data-guide-item` sur `MemberDirectoryRow`) | `MemberDirectory.tsx`, `MemberDirectoryRow.tsx` | |
| `member-lifecycle-offboard`, `offboard-reassign`, `offboard-kept` | `MemberLifecycleActions.tsx`, `OffboardMemberDialog.tsx` | bouton qui **ouvre** le dialogue |
| `member-assign-role`, `assign-role-select`, `assign-role-stack`, `assign-role-until`, `assign-role-until-hint` | `MemberSheet.tsx`, `AssignRoleDialog.tsx`, `RoleTermCard.tsx` | |
| `member-open-permissions`, `member-permissions-matrix`, `member-permissions-default` | `MemberSheet.tsx`, `MemberPermissionsSheet.tsx`, `PermissionSwitch.tsx` | |
| `pyramid-unplaced` (+ items), `pyramid-place-manager`, `pyramid-place-effect` | `UnplacedMembersPanel.tsx`, `PyramidPlacementSheet.tsx` | |
| `settings-roles-new`, `settings-roles-list` (+ items), `role-editor-name`, `role-editor-matrix`, `role-editor-color`, `role-editor-members` | `OrgRolesSettings.tsx`, `RoleEditorSheet.tsx` | |
| `my-permissions-card`, `my-permissions-source` | `MyPermissionsCard.tsx` | |
| `settings-transfer-ownership`, `transfer-new-owner`, `transfer-warning` | `OrgSettingsSection.tsx`, `TransferOwnershipDialog.tsx` | |
| `okr-new`, `okr-list` (+ items), `okr-kr-list` (+ items), `okr-form-objective`, `okr-form-krs`, `okr-form-audience`, `okr-link-project`, `okr-link-effect` | `TeamOKRTab.tsx`, `TeamOKRCard.tsx`, `TeamOKRModal.tsx`, `TeamOKRLinkFields.tsx` | |
| `kr-exec-value`, `kr-exec-comment` | `KRExecutionDialog.tsx` | |
| `overview-weekly-review`, `weekly-review-progress`, `weekly-review-blockers` | `MyWorkTab.tsx` / `TeamOverviewTab.tsx`, `WeeklyReviewSheet.tsx` | |
| `reports-list` (+ items), `report-period`, `report-scope` | `OrgReportsSection.tsx` | |
| `export-format`, `export-filters` | `OrgTasksExportSection.tsx` | |
| `org-profile-name`, `org-profile-logo`, `org-profile-timezone` | `OrgProfileForm.tsx` | |

Si un écran ne contient pas l'élément décrit (champ absent, flux différent), **ne pas inventer** : modifier le scénario de la tâche 5 pour qu'il pointe ce qui existe, et la clé de bulle avec, puis le signaler au bilan.

- [ ] **Étape 1 : poser les ancrages, un fichier à la fois**, en relançant la garde après chaque groupe :

Run : `npx vitest run src/components/org-guide/guide-scenarios.guard.test.ts ; echo "exit=$?"`

- [ ] **Étape 2 : garde verte, puis suite des composants touchés**

Run : `npx vitest run src/components/organization ; echo "exit=$?"`
Attendu : `exit=0`, nombre de fichiers égal à celui d'avant la tâche (comparer avec `git stash` si doute).

- [ ] **Étape 3 : commit (garde + ancrages ensemble)**

```bash
git add src/components/org-guide/guide-scenarios.guard.test.ts src/components/organization
git commit -m "feat(org-guide): ancrages data-guide-id et garde des scenarios"
```

---

### Tâche 8 : curseur, bulle, barre de contrôle

**Fichiers :**
- Créer : `src/components/org-guide/GuideCursor.tsx`, `GuideBubble.tsx`, `GuideControlBar.tsx`

- [ ] **Étape 1 : `GuideCursor.tsx`**

```tsx
// src/components/org-guide/GuideCursor.tsx
import { motion, useReducedMotion } from 'framer-motion';

export interface CursorPoint { x: number; y: number }

/** Curseur de démo : violet à contour blanc, distinct de la vraie souris. */
export function GuideCursor({ point, pressed }: { point: CursorPoint; pressed: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      aria-hidden="true"
      width={26}
      height={30}
      viewBox="0 0 26 30"
      className="pointer-events-none fixed left-0 top-0 z-[520]"
      initial={false}
      animate={{ x: point.x, y: point.y, scale: pressed ? 0.85 : 1 }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 22, mass: 0.9 }}
    >
      <path d="M3 2 L3 24 L9 18 L13 27 L17 25 L13 16 L21 16 Z" fill="#534AB7" stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
    </motion.svg>
  );
}
```

- [ ] **Étape 2 : `GuideBubble.tsx`**

```tsx
// src/components/org-guide/GuideBubble.tsx
import type { CursorPoint } from './GuideCursor';

/** Bulle collée au curseur, annoncée aux lecteurs d'écran par la région live de l'hôte. */
export function GuideBubble({ text, at, counter }: { text: string; at: CursorPoint | null; counter?: string }) {
  const style = at
    ? { left: Math.min(at.x + 30, window.innerWidth - 260), top: Math.min(at.y + 16, window.innerHeight - 120) }
    : { left: '50%', top: '40%', transform: 'translateX(-50%)' };
  return (
    <div className="pointer-events-none fixed z-[520] w-60 rounded-xl border border-border bg-popover p-3 text-sm text-popover-foreground shadow-lg" style={style}>
      {counter && <p className="mb-1 text-xs text-primary">{counter}</p>}
      <p className="leading-snug">{text}</p>
    </div>
  );
}
```

- [ ] **Étape 3 : `GuideControlBar.tsx`**

```tsx
// src/components/org-guide/GuideControlBar.tsx
import { Pause, Play, SkipForward, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Button } from '@/components/ui/button';

interface Props {
  actionLabel: string;
  current: number;
  total: number;
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onQuit: () => void;
}

export function GuideControlBar({ actionLabel, current, total, paused, onPause, onResume, onSkip, onQuit }: Props) {
  const { t } = useT('orgGuide');
  return (
    <div role="toolbar" aria-label={actionLabel} className="fixed bottom-6 left-1/2 z-[530] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-popover px-3 py-1.5 shadow-lg">
      <span className="px-2 text-xs text-muted-foreground">
        {t('control.progress', { action: actionLabel, current: String(current), total: String(total) })}
      </span>
      <Button type="button" size="icon" variant="ghost" aria-label={t(paused ? 'control.resume' : 'control.pause')} onClick={paused ? onResume : onPause}>
        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onSkip}>
        <SkipForward className="mr-1 h-4 w-4" />{t('control.skip')}
      </Button>
      <Button type="button" size="icon" variant="ghost" aria-label={t('control.quit')} onClick={onQuit}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

Vérifier la signature d'interpolation de `t()` dans `src/i18n/translate.ts` (valeurs `string` ou `number`) et ajuster les `String(...)` si besoin. Vérifier aussi les z-index dans `docs/UI-PATTERNS.md` (table z-index) : `PageTutorial` est à 500, le guide passe au-dessus (520/530) et doit être ajouté à cette table en tâche 13.

- [ ] **Étape 4 : vérifier et committer**

Run : `npm run typecheck ; echo "exit=$?"` et `npm run lint ; echo "exit=$?"` → deux `exit=0`.

```bash
git add src/components/org-guide/GuideCursor.tsx src/components/org-guide/GuideBubble.tsx src/components/org-guide/GuideControlBar.tsx
git commit -m "feat(org-guide): curseur, bulle et barre de controle"
```

---

### Tâche 9 : le tiroir

**Fichiers :**
- Créer : `src/components/org-guide/OrgGuideDrawer.tsx`
- Test : `src/components/org-guide/OrgGuideDrawer.test.tsx`

- [ ] **Étape 1 : test qui échoue**

```tsx
// src/components/org-guide/OrgGuideDrawer.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ORG_PERMISSION_KEYS, type OrgPermissionKey } from '@/modules/organizations/permissions';
import { OrgGuideDrawer } from './OrgGuideDrawer';
import type { GuideViewer } from './guide-types';

const can = (v: boolean) => Object.fromEntries(ORG_PERMISSION_KEYS.map((k) => [k, v])) as Record<OrgPermissionKey, boolean>;
const member: GuideViewer = { can: can(false), isAdmin: false, isManager: false, isOwner: false, customRolesAvailable: true };

describe('OrgGuideDrawer', () => {
  it('lance une action autorisée', () => {
    const onStart = vi.fn();
    render(<OrgGuideDrawer open viewer={member} onClose={() => {}} onStart={onStart} onSeeAdmins={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /mes propres droits|my own/i }));
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ id: 'me.permissions' }));
  });

  it('une action refusée montre la carte du droit manquant, sans lancer', () => {
    const onStart = vi.fn();
    render(<OrgGuideDrawer open viewer={member} onClose={() => {}} onStart={onStart} onSeeAdmins={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /créer un projet|create a project/i }));
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByText(/créer des projets|create projects/i)).toBeInTheDocument();
  });

  it('la recherche filtre', () => {
    render(<OrgGuideDrawer open viewer={member} onClose={() => {}} onStart={() => {}} onSeeAdmins={() => {}} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'équipe' } });
    expect(screen.queryByRole('button', { name: /exporter|export/i })).toBeNull();
    expect(screen.getByRole('button', { name: /créer une équipe|create a team/i })).toBeInTheDocument();
  });
});
```

Les libellés « Voir mes propres droits », « Créer un projet », « Créer une équipe », « Exporter les tâches » et le droit « Créer des projets » doivent exister tels quels dans `orgGuide.json` (tâche 4). Si l'environnement de test n'a pas de locale par défaut `fr`, regarder comment les autres tests de composants l'initialisent (`grep -rn "setLocale\|bootstrap" src/components/**/*.test.tsx | head`) et faire pareil.

- [ ] **Étape 2 : lancer, constater l'échec**

Run : `npx vitest run src/components/org-guide/OrgGuideDrawer.test.tsx` → FAIL, module introuvable.

- [ ] **Étape 3 : implémenter**

```tsx
// src/components/org-guide/OrgGuideDrawer.tsx
import { useMemo, useState } from 'react';
import { ChevronDown, Folder, Lock, Play, Shield, Target, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n/useT';
import { guideAccess } from './guide-access';
import { matchesGuideQuery } from './guide-search';
import { GUIDE_ACTIONS, GUIDE_CATEGORIES } from './scenarios';
import type { GuideAction, GuideCategory, GuideViewer } from './guide-types';

const ICONS: Record<GuideCategory, typeof Folder> = { work: Folder, people: Users, roles: Shield, steer: Target };

interface Props {
  open: boolean;
  viewer: GuideViewer;
  onClose: () => void;
  onStart: (action: GuideAction) => void;
  onSeeAdmins: () => void;
}

export function OrgGuideDrawer({ open, viewer, onClose, onStart, onSeeAdmins }: Props) {
  const { t } = useT('orgGuide');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<GuideCategory>>(new Set());
  const [denied, setDenied] = useState<GuideAction | null>(null);

  // Le catalogue est typé depuis le JSON ; les clés d'action sont construites,
  // d'où ce passage unique par une fonction de lecture tolérante.
  const tx = (key: string) => t(key as Parameters<typeof t>[0]);

  const groups = useMemo(() => GUIDE_CATEGORIES.map((cat) => ({
    cat,
    items: GUIDE_ACTIONS
      .filter((a) => a.category === cat)
      .map((a) => ({ action: a, access: guideAccess(a, viewer) }))
      .filter(({ access }) => access !== 'hidden')
      .filter(({ action }) => matchesGuideQuery(query, tx(`actions.${action.id}.label`), tx(`actions.${action.id}.synonyms`))),
  })).filter((g) => g.items.length > 0), [query, viewer]); // eslint-disable-line react-hooks/exhaustive-deps

  const badge = (a: GuideAction) => a.requires === 'admin' || a.requires === 'role.manage' ? 'badgeAdmin'
    : a.requires === 'owner' ? 'badgeOwner' : 'badgeManager';

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex w-[320px] flex-col gap-0 p-0 sm:max-w-[320px]">
        <SheetHeader className="px-4 pb-2 pt-4">
          <SheetTitle>{t('drawer.title')}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-2">
          <Input type="search" role="searchbox" value={query} placeholder={t('drawer.searchPlaceholder')} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {groups.length === 0 && <p className="px-3 py-6 text-sm text-muted-foreground">{t('drawer.noResult')}</p>}
          {groups.map(({ cat, items }) => {
            const Icon = ICONS[cat];
            const isOpen = query !== '' || !collapsed.has(cat);
            return (
              <section key={cat}>
                <button type="button" aria-expanded={isOpen} className="flex w-full items-center gap-2 px-3 pb-1 pt-3 text-xs text-muted-foreground"
                  onClick={() => setCollapsed((s) => { const n = new Set(s); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; })}>
                  <Icon className="h-4 w-4" aria-hidden="true" />{t(`categories.${cat}`)}
                  <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} aria-hidden="true" />
                </button>
                {isOpen && items.map(({ action, access }) => (
                  <button key={action.id} type="button"
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent ${access === 'denied' ? 'text-muted-foreground' : ''}`}
                    onClick={() => (access === 'allowed' ? onStart(action) : setDenied(action))}>
                    {access === 'allowed' ? <Play className="h-4 w-4 text-primary" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
                    {tx(`actions.${action.id}.label`)}
                    {access === 'denied' && <span className="ml-auto rounded bg-amber-100 px-1.5 text-[11px] text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">{t(`drawer.${badge(action)}`)}</span>}
                  </button>
                ))}
              </section>
            );
          })}
        </div>
        {denied && (
          <div role="alertdialog" aria-labelledby="org-guide-denied" className="m-3 rounded-xl border border-border bg-card p-3">
            <p id="org-guide-denied" className="mb-1 text-sm font-medium">{tx(`actions.${denied.id}.label`)}</p>
            <p className="mb-3 text-sm text-muted-foreground">
              {t('denied.body', { right: tx(`denied.rights.${denied.requires ?? 'admin'}`) })}
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onSeeAdmins}>{t('denied.seeAdmins')}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setDenied(null)}>{t('drawer.close')}</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

Points à vérifier en écrivant : 1) `denied.rights.task.create` a un point dans la clé, donc `t()` qui découpe sur les points ne la trouvera pas : renommer les clés de `denied.rights` en remplaçant `.` par `_` (`task_create`) dans les deux JSON, et construire `denied.rights.${req.replace('.', '_')}`. 2) La couleur ambre codée en dur : regarder si le design system a un token d'avertissement (`grep -rn "warning" src/index.css tailwind.config.*`) et l'utiliser à la place, comme l'exige le correctif de thème du 2026-07-23. 3) L'`eslint-disable` : supprimer si `tx` est stabilisée par `useCallback`.

- [ ] **Étape 4 : relancer**

Run : `npx vitest run src/components/org-guide ; echo "exit=$?"` → `exit=0`, 5 fichiers de test.

- [ ] **Étape 5 : commit**

```bash
git add src/components/org-guide/OrgGuideDrawer.tsx src/components/org-guide/OrgGuideDrawer.test.tsx src/locales
git commit -m "feat(org-guide): tiroir d'actions, recherche et droit manquant"
```

---

### Tâche 10 : l'hôte et le bouton flottant

**Fichiers :**
- Créer : `src/components/org-guide/OrgGuideHost.tsx`, `src/components/org-guide/OrgGuideFab.tsx`
- Modifier : `src/pages/OrganizationPage.tsx`

- [ ] **Étape 1 : `OrgGuideHost.tsx`**

```tsx
// src/components/org-guide/OrgGuideHost.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useReducedMotion } from 'framer-motion';
import { useT } from '@/i18n/useT';
import { orgSectionPath } from '@/components/organization/deep-link.helpers';
import { createGuideRun, type GuideRunResult } from './guide-runner';
import { GuideBubble } from './GuideBubble';
import { GuideControlBar } from './GuideControlBar';
import { GuideCursor, type CursorPoint } from './GuideCursor';
import { OrgGuideDrawer } from './OrgGuideDrawer';
import type { GuideAction, GuideViewer } from './guide-types';

const center = (el: HTMLElement): CursorPoint => {
  const r = el.getBoundingClientRect();
  return { x: r.left + Math.min(r.width / 2, 40), y: r.top + Math.min(r.height / 2, 18) };
};

interface Props { open: boolean; onClose: () => void; viewer: GuideViewer }

export default function OrgGuideHost({ open, onClose, viewer }: Props) {
  const { t } = useT('orgGuide');
  const tx = useCallback((key: string) => t(key as Parameters<typeof t>[0]), [t]);
  const navigate = useNavigate();
  const reduce = useReducedMotion() ?? false;
  const [running, setRunning] = useState<GuideAction | null>(null);
  const [step, setStep] = useState({ current: 0, total: 0 });
  const [paused, setPaused] = useState(false);
  const [cursor, setCursor] = useState<CursorPoint>({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  const [pressed, setPressed] = useState(false);
  const [bubble, setBubble] = useState<{ text: string; at: CursorPoint | null } | null>(null);
  const [ending, setEnding] = useState<GuideRunResult | null>(null);
  const runRef = useRef<ReturnType<typeof createGuideRun> | null>(null);

  const start = useCallback(async (action: GuideAction) => {
    onClose();
    setEnding(null);
    setBubble(null);
    setRunning(action);
    const run = createGuideRun(action.steps, {
      reducedMotion: reduce,
      find: (id) => document.querySelector<HTMLElement>(`[data-guide-id="${id}"]`),
      navigate: (section) => navigate(orgSectionPath(section)),
      moveCursor: async (el) => {
        el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
        setCursor(center(el));
        await new Promise((r) => setTimeout(r, reduce ? 50 : 700));
      },
      click: (el) => {
        setPressed(true);
        setTimeout(() => setPressed(false), 150);
        el.click();
      },
      showBubble: (key, el) => setBubble(key ? { text: tx(key), at: el ? center(el) : null } : null),
      onStep: (i, n) => setStep({ current: i + 1, total: n }),
    });
    runRef.current = run;
    const result = await run.start();
    runRef.current = null;
    setRunning(null);
    setPaused(false);
    setEnding(result.status === 'completed' || result.status === 'quit' ? null : result);
    if (result.status !== 'completed') setBubble(null);
  }, [navigate, onClose, reduce, tx]);

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') runRef.current?.quit(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [running]);

  // La bulle de fin (handoff) reste 4 s puis s'efface d'elle-même.
  useEffect(() => {
    if (running || !bubble) return;
    const id = setTimeout(() => setBubble(null), 4000);
    return () => clearTimeout(id);
  }, [running, bubble]);

  return (
    <>
      <OrgGuideDrawer open={open} viewer={viewer} onClose={onClose} onStart={start}
        onSeeAdmins={() => { onClose(); navigate(`${orgSectionPath('members')}?role=admin`); }} />
      {running && (
        <>
          {/* Calque de capture : l'écran ne réagit pas pendant la démo. */}
          <div className="fixed inset-0 z-[510] cursor-default" aria-hidden="true" />
          <GuideCursor point={cursor} pressed={pressed} />
          <GuideControlBar actionLabel={tx(`actions.${running.id}.label`)} current={step.current} total={step.total} paused={paused}
            onPause={() => { setPaused(true); runRef.current?.pause(); }}
            onResume={() => { setPaused(false); runRef.current?.resume(); }}
            onSkip={() => runRef.current?.skip()}
            onQuit={() => runRef.current?.quit()} />
        </>
      )}
      {bubble && <GuideBubble text={bubble.text} at={bubble.at} />}
      {ending && (
        <GuideBubble at={null} text={ending.status === 'empty' ? tx(ending.emptyKey) : t('end.missing')} />
      )}
      <div aria-live="polite" className="sr-only">{bubble?.text ?? ''}</div>
    </>
  );
}
```

Vérifier : 1) le filtre `?role=admin` existe dans `member-directory.filters.ts` ; sinon naviguer sans paramètre et le noter. 2) Le calque `z-[510]` doit laisser passer les clics **programmatiques** (`el.click()` ignore les calques : c'est voulu) mais bloquer ceux de l'utilisateur. 3) Les dialogues Radix ouverts pendant la démo ont un z-index propre : vérifier à l'écran (tâche 12) que le curseur et la barre restent au-dessus.

- [ ] **Étape 2 : `OrgGuideFab.tsx`**

```tsx
// src/components/org-guide/OrgGuideFab.tsx
import { lazy, Suspense, useState } from 'react';
import { Compass } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { safeParse } from '@/lib/safe-json';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import type { GuideViewer } from './guide-types';

const OrgGuideHost = lazy(() => import('./OrgGuideHost'));

const SEEN_KEY = 'cosmo_org_guide_seen';
const readSeen = (): boolean => {
  try { return safeParse<boolean>(localStorage.getItem(SEEN_KEY)) === true; } catch { return false; }
};
const markSeen = () => { try { localStorage.setItem(SEEN_KEY, 'true'); } catch { /* stockage bloqué : pastille gardée */ } };

/** Seul morceau eager du guide. Desktop uniquement (v1). */
export function OrgGuideFab({ viewer, openSignal }: { viewer: GuideViewer; openSignal?: number }) {
  const { t } = useT('orgGuide');
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const [lastSignal, setLastSignal] = useState(openSignal);

  if (openSignal !== lastSignal) { setLastSignal(openSignal); if (openSignal) { setMounted(true); setOpen(true); } }
  if (isMobile) return null;

  return (
    <>
      <button type="button" aria-label={t('fab.label')}
        className="fixed bottom-24 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-primary shadow-md hover:bg-accent"
        onClick={() => { setMounted(true); setOpen(true); if (!seen) { markSeen(); setSeen(true); } }}>
        <Compass className="h-5 w-5" aria-hidden="true" />
        {!seen && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />}
      </button>
      {mounted && (
        <Suspense fallback={null}>
          <OrgGuideHost open={open} onClose={() => setOpen(false)} viewer={viewer} />
        </Suspense>
      )}
    </>
  );
}
```

`bottom-24` place le bouton au-dessus du FAB de création rapide (`global-quick-add-fab`, dans `src/components/Layout.tsx`) : lire sa position réelle et ajuster pour garder 56 px d'écart.

- [ ] **Étape 3 : monter dans `OrganizationPage.tsx`**

Juste avant `<OrgSideNav` (vers la ligne 483), ajouter :

```tsx
      <OrgGuideFab viewer={guideViewer} />
```

et, après le calcul de `isAdmin` / `isManager` (vers la ligne 225) :

```tsx
  const guideViewer: GuideViewer = {
    can: myPerms.can,
    isAdmin,
    isManager,
    isOwner,
    customRolesAvailable: !rolesUnavailable,
  };
```

où `myPerms` est le résultat de `useMyOrgPermissions(myOrg?.id)` (le chercher : la page l'appelle sans doute déjà, sinon l'appeler **avant les early returns** comme le commentaire de la ligne 181 l'exige), `isOwner` existe déjà (ligne 242), et `rolesUnavailable` vient de `useOrgRoles(myOrg?.id).isError` (mig. 219 absente = lecture en échec, cf. `use-my-permissions.ts`). Imports :

```tsx
import { OrgGuideFab } from '@/components/org-guide/OrgGuideFab';
import type { GuideViewer } from '@/components/org-guide/guide-types';
```

- [ ] **Étape 4 : vérifier**

Run : `npm run typecheck ; echo "exit=$?"` ; `npm run lint ; echo "exit=$?"` ; `npx vitest run src/components/org-guide src/pages ; echo "exit=$?"`
Attendu : trois `exit=0`.

- [ ] **Étape 5 : commit**

```bash
git add src/components/org-guide src/pages/OrganizationPage.tsx
git commit -m "feat(org-guide): bouton flottant et orchestration de la demo"
```

---

### Tâche 11 : lien depuis la constellation

**Fichiers :**
- Modifier : composant du dernier écran de l'onboarding entreprise (le trouver : `grep -rln "constellation" src/components src/pages | head`)
- Modifier : `src/pages/OrganizationPage.tsx`

- [ ] **Étape 1 :** sur le dernier écran, ajouter un bouton secondaire « Découvrir le guide » (clé `orgGuide` absente du namespace de l'onboarding : ajouter `onboarding.discoverGuide` dans `src/locales/{fr,en}/onboarding.json`) qui navigue vers `/entreprise?guide=1`.
- [ ] **Étape 2 :** dans `OrganizationPage.tsx`, lire `searchParams.get('guide') === '1'`, passer `openSignal={Date.now()}` une seule fois au `OrgGuideFab` (mémoriser dans un `useState` initialisé paresseusement), puis retirer le paramètre de l'URL avec `setSearchParams` en `replace`.
- [ ] **Étape 3 :** vérifier `npm run typecheck ; echo "exit=$?"` et `npm run i18n:check ; echo "exit=$?"`, puis commit :

```bash
git add src/locales src/pages/OrganizationPage.tsx src/components
git commit -m "feat(org-guide): ouverture du guide depuis la fin de la constellation"
```

---

### Tâche 12 : vérification dans le navigateur (mode démo)

- [ ] **Étape 1 :** `preview_start` sur le serveur de dev (`.claude/launch.json`), se connecter en démo, aller sur `/entreprise`.
- [ ] **Étape 2 :** ouvrir le guide, lancer **une action par catégorie** (`project.create`, `team.create`, `role.create`, `okr.create`). Pour chacune vérifier : le curseur atteint chaque cible, le formulaire s'ouvre **vide**, les bulles s'enchaînent, Pause gèle, Passer avance, Échap quitte, aucun toast d'écriture.
- [ ] **Étape 3 :** `read_network_requests` pendant une démo : aucune requête d'écriture (en démo, rien vers Supabase ; vérifier aussi que `localStorage` des données démo n'a pas changé : comparer un `JSON.stringify` des clés `cosmo_*` avant/après via `javascript_tool`).
- [ ] **Étape 4 :** thème sombre (`resize_window` `colorScheme: dark`) : curseur, bulle, badge lisibles.
- [ ] **Étape 5 :** lancer les 30 actions une fois chacune ; noter toute cible manquante et corriger scénario ou ancrage (retour tâche 5/7), garde relancée.
- [ ] **Étape 6 :** capture d'écran d'une démo en cours pour le bilan.

---

### Tâche 13 : e2e, budget, documentation

**Fichiers :**
- Créer : `e2e/org-guide.spec.ts`
- Modifier : `docs/UI-PATTERNS.md` (section Onboarding & Tutoriels + table des z-index), `docs/MODULES.md` (écrans entreprise), `src/components/CLAUDE.md` si une règle d'ancrage doit y vivre (une ligne : « ne pas renommer un `data-guide-id` sans relancer la garde »)

- [ ] **Étape 1 : écrire l'e2e** en suivant un spec existant du mode démo (lire `e2e/CLAUDE.md` et copier son motif de connexion démo) :

```ts
// e2e/org-guide.spec.ts
import { expect, test } from '@playwright/test';

test.describe('guide entreprise', () => {
  test('une démo ouvre le formulaire sans rien écrire', async ({ page }) => {
    // Connexion démo : reprendre le helper utilisé par les autres specs (voir e2e/CLAUDE.md).
    await page.goto('/entreprise');
    const before = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => k.startsWith('cosmo_') && k !== 'cosmo_org_guide_seen').sort()));
    await page.getByRole('button', { name: /ouvrir le guide entreprise/i }).click();
    await page.getByRole('button', { name: /^créer une équipe$/i }).click();
    await expect(page.locator('[data-guide-id="team-form-name"]')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('toolbar')).toHaveCount(0);
    const after = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => k.startsWith('cosmo_') && k !== 'cosmo_org_guide_seen').sort()));
    expect(after).toBe(before);
  });
});
```

Remplacer le commentaire de connexion par l'appel réel au helper trouvé dans `e2e/`. Si une clé `cosmo_*` change légitimement à la simple navigation (filtre mémorisé, section épinglée), l'exclure **nommément** avec un commentaire qui dit pourquoi.

- [ ] **Étape 2 :** `npx playwright test e2e/org-guide.spec.ts ; echo "exit=$?"` → `exit=0`. Si les ports sont pris, suivre la mémoire « E2E quand les ports sont pris ».
- [ ] **Étape 3 : suite complète et gardes globales** (mémoire « Gardes globales avant push ») :

```bash
npm run lint
```
```bash
npm run typecheck
```
```bash
npm test
```
```bash
npm run check:bundle
```

Pour chacune, lire `$?` et comparer le nombre de fichiers de test au précédent run. `check:bundle` : seul `OrgGuideFab` doit grossir le lot entreprise ; si un plafond saute, déplacer du code vers `OrgGuideHost` (lazy), **ne jamais relever le plafond**.
- [ ] **Étape 4 : documentation**, dans `docs/UI-PATTERNS.md` § Onboarding & Tutoriels, un sous-titre « Guide entreprise » : rôle, fichiers, règle des ancrages, z-index 510/520/530, flag `cosmo_org_guide_seen`. Ajouter `org-guide` à la ligne « Écrans entreprise » de `docs/MODULES.md`. Puis `npm run check:docs ; echo "exit=$?"`.
- [ ] **Étape 5 : commit et push**

```bash
git add e2e/org-guide.spec.ts docs src/components/CLAUDE.md
git commit -m "test(org-guide): e2e demo sans ecriture, doc du guide entreprise"
git push
```

---

## Couverture de la spec

| Spec | Tâche |
|---|---|
| §2 Bouton flottant, tiroir, recherche, catégories | 9, 10 |
| §2 Démo auto, aucune écriture, bulles, handoff | 3, 10, 12, 13 |
| §2 Pause / Passer / Quitter, calque | 8, 10 |
| §2 Droit manquant grisé + carte | 1, 9 |
| §2 Desktop seul, démo, fr + en | 4, 10, 12 |
| §3 Runner (3 s, pas de submit, Échap, reduced-motion, pick-first vide) | 3, 6, 10 |
| §4 Droits via `effectivePermissions` | 1, 10 |
| §5 a11y, i18n, lazy | 4, 8, 9, 10, 13 |
| §6 Les 30 actions | 4, 5, 7 |
| §6.3 Mig. 219 absente masque les actions de rôles | 1, 10 |
| §7 Lien constellation + pastille | 10, 11 |
| §8 Tests et gardes | 1, 2, 3, 6, 9, 13 |

## Points remontés à Axel au bilan

1. `report.view` n'accepte que `report.org` (pas `report.allTeams`) en v1.
2. Les actions de rôles personnalisés (4 sur 30) sont masquées tant que la mig. 219 n'est pas appliquée en prod.
3. Tout écart scénario / écran réel corrigé pendant la tâche 7 ou 12.
