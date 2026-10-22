> ⚠️ **ARCHIVE — plan/spec exécuté, instantané du 2026-08-08, non maintenu.**
> Le code livré fait foi, pas ce document. Sources vivantes :
> [`CLAUDE.md`](../../../../CLAUDE.md) · [`docs/`](../../../README.md).

# Mode entreprise — vague 5 : les 3 items restants

> **Prérequis : lire `2026-08-08-entreprise-PASSATION.md` en entier.** Il porte
> l'état de la base de production, cinq pièges déjà payés, et les conventions.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
> ou superpowers:executing-plans. Les étapes utilisent des cases `- [ ]`.

**Goal :** finir les items 18 (fiche membre unifiée), 26 (revue hebdomadaire),
29 (vue « Aujourd'hui » unifiée).

**Tech Stack :** React 18 + TS strict, TanStack Query 5, Tailwind (tokens
`rgb(var(--color-*))`), lucide-react, date-fns via `@/i18n/format`, i18n maison,
Vitest.

**Aucune de ces trois tâches n'exige de migration SQL.** Toute la donnée existe.

---

# Item 18 — Fiche membre unifiée

**Ce qui est déjà fait** (commit `2c75db3`) : `?member=<id>` ouvre la fiche
depuis `PyramidTab`, et un bouton « copier le lien » produit l'URL absolue.

**Ce qui reste :** fusionner les TROIS sheets en une vue à onglets.

## Le problème

Trois composants montrent la même personne, chacun avec son propre habillage de
bottom-sheet, ouverts depuis des menus différents :

| Fichier | LOC | Contenu |
|---|---|---|
| `MemberProfileSheet.tsx` | ~206 | identité, manager, équipes, actions pyramide |
| `MemberInsightsSheet.tsx` | ~383 | onglets Tâches / Contribution |
| `MemberAgendaSheet.tsx` | ~473 | calendrier FullCalendar éditable |

Un manager qui veut « voir Marie » doit choisir *à l'avance* laquelle des trois
il ouvre, et rouvrir un menu pour passer de l'une à l'autre.

## Architecture visée

Un hôte unique qui possède le chrome (overlay, en-tête, barre d'onglets) et
délègue le CORPS à trois composants de présentation dépouillés de leur chrome.

```
MemberSheet (nouveau)          ← overlay + en-tête + onglets + deep-link
├── MemberProfileBody          ← extrait de MemberProfileSheet
├── MemberTasksBody            ← extrait de MemberInsightsSheet
├── MemberContributionBody     ← extrait de MemberInsightsSheet
└── MemberAgendaBody           ← extrait de MemberAgendaSheet
```

**Pourquoi extraire plutôt qu'imbriquer :** les trois sheets créent chacun leur
`createPortal` + overlay `fixed inset-0`. Les imbriquer superposerait trois
overlays et trois pièges de focus. Le chrome doit être possédé par un seul.

## Files

- Create: `src/components/organization/MemberSheet.tsx`
- Create: `src/components/organization/member-sheet.helpers.ts`
- Create: `src/components/organization/member-sheet.helpers.test.ts`
- Modify: `MemberProfileSheet.tsx` → exporte `MemberProfileBody`
- Modify: `MemberInsightsSheet.tsx` → exporte `MemberTasksBody`, `MemberContributionBody`
- Modify: `MemberAgendaSheet.tsx` → exporte `MemberAgendaBody`
- Modify: `PyramidTab.tsx`, `MemberDirectory.tsx` (sites d'ouverture)
- Modify: `src/locales/{fr,en}/org.json`

## Tâches

### Task 1 : helper d'onglets (logique pure, testée)

- [ ] **Step 1 : écrire le test qui échoue**

`src/components/organization/member-sheet.helpers.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { visibleMemberTabs, isValidMemberTab } from './member-sheet.helpers';

describe('visibleMemberTabs', () => {
  it('un pair ne voit que le profil', () => {
    expect(visibleMemberTabs({ canSeeInsights: false, canSeeAgenda: false }))
      .toEqual(['profile']);
  });

  it('un supérieur voit tout', () => {
    expect(visibleMemberTabs({ canSeeInsights: true, canSeeAgenda: true }))
      .toEqual(['profile', 'tasks', 'contribution', 'agenda']);
  });

  it("l'agenda peut être refusé indépendamment des tâches", () => {
    expect(visibleMemberTabs({ canSeeInsights: true, canSeeAgenda: false }))
      .toEqual(['profile', 'tasks', 'contribution']);
  });
});

describe('isValidMemberTab', () => {
  it('accepte un onglet visible', () => {
    expect(isValidMemberTab('tasks', ['profile', 'tasks'])).toBe(true);
  });

  it('refuse un onglet non autorisé — une URL forgée ne doit pas ouvrir un onglet interdit', () => {
    expect(isValidMemberTab('agenda', ['profile'])).toBe(false);
  });

  it('refuse une valeur inconnue', () => {
    expect(isValidMemberTab('<script>', ['profile'])).toBe(false);
  });
});
```

- [ ] **Step 2 : lancer, vérifier l'échec**

`npx vitest run src/components/organization/member-sheet.helpers.test.ts`
→ module introuvable.

- [ ] **Step 3 : implémenter**

```ts
// ═══════════════════════════════════════════════════════════════════
// Onglets de la fiche membre unifiée (item #18)
// ═══════════════════════════════════════════════════════════════════

export type MemberTab = 'profile' | 'tasks' | 'contribution' | 'agenda';

export interface MemberTabAccess {
  /** Supérieur hiérarchique : voit tâches et contribution. */
  canSeeInsights: boolean;
  /** Agenda éditable — droit distinct (mig. 077, agenda manager). */
  canSeeAgenda: boolean;
}

/**
 * Onglets visibles, dans l'ordre d'affichage. Le profil est toujours là :
 * c'est le seul contenu qu'un pair a le droit de voir.
 */
export const visibleMemberTabs = (access: MemberTabAccess): MemberTab[] => {
  const tabs: MemberTab[] = ['profile'];
  if (access.canSeeInsights) tabs.push('tasks', 'contribution');
  if (access.canSeeAgenda) tabs.push('agenda');
  return tabs;
};

/**
 * Un onglet venu de l'URL doit être validé contre les onglets AUTORISÉS, pas
 * seulement contre la liste des noms possibles : sinon `?memberTab=agenda`
 * ouvrirait l'agenda d'un collègue à quelqu'un qui n'y a pas droit.
 * (La RLS reste la frontière réelle — ceci évite un écran vide et trompeur.)
 */
export const isValidMemberTab = (value: string, allowed: MemberTab[]): boolean =>
  (allowed as string[]).includes(value);
```

- [ ] **Step 4 : lancer, vérifier le succès** (6 tests)
- [ ] **Step 5 : commit**

```bash
git add src/components/organization/member-sheet.helpers.ts src/components/organization/member-sheet.helpers.test.ts
git commit -m "feat(entreprise): helper d'onglets de la fiche membre"
```

### Task 2 : extraire les corps

- [ ] **Step 1 :** dans `MemberProfileSheet.tsx`, séparer en deux exports —
      `MemberProfileBody` (tout ce qui est SOUS l'en-tête) et le sheet actuel,
      qui devient `MemberProfileBody` enveloppé dans son chrome existant.
      **Ne pas supprimer l'ancien export** tant que tous les appelants n'ont
      pas migré : la suite doit rester verte à chaque commit.
- [ ] **Step 2 :** idem pour `MemberInsightsSheet.tsx` — les vues `TasksView`
      et la vue contribution existent déjà comme sous-composants internes ;
      les exporter.
- [ ] **Step 3 :** idem `MemberAgendaSheet.tsx`.
      ⚠️ FullCalendar mesure son conteneur au montage. Le corps agenda doit
      être monté **uniquement quand son onglet est actif**, sinon il calcule sa
      hauteur dans un conteneur masqué et rend une grille écrasée.
- [ ] **Step 4 :** `npm run typecheck && npm test` — doit rester vert.
- [ ] **Step 5 : commit**

### Task 3 : l'hôte

- [ ] **Step 1 :** créer `MemberSheet.tsx` : `createPortal`, overlay, en-tête
      (avatar + nom + bouton copier-lien + fermer), barre d'onglets filtrée par
      `visibleMemberTabs`, corps monté selon l'onglet actif.
- [ ] **Step 2 :** deep-link `?member=<id>&memberTab=<tab>`.
      Étendre `EntityParam` de `deep-link.helpers.ts` si besoin, ou lire
      `memberTab` directement avec la même validation d'alphabet.
      **Valider l'onglet avec `isValidMemberTab(value, allowed)`.**
- [ ] **Step 3 :** clés i18n dans la section `member` des DEUX catalogues.
- [ ] **Step 4 :** remplacer les ouvertures dans `PyramidTab.tsx` et
      `MemberDirectory.tsx`. Supprimer les anciens exports de sheet devenus
      inutilisés (`npm run lint` signalera les imports morts).
- [ ] **Step 5 :** vérification complète + **vérification navigateur 375 px**
      (les 4 onglets, dont l'agenda).
- [ ] **Step 6 : commit**

---

# Item 26 — Revue hebdomadaire d'équipe

## Le problème

Le mode perso a `WeeklyCheckinModal`. Rien d'équivalent en équipe. Un manager
qui veut préparer son lundi doit ouvrir Statistiques, Projets, Pyramide, et
recouper à la main.

## Ce qui rend ça faisable sans migration

Tout est déjà calculé dans `team-stats.helpers.ts` :
`velocityByWeek`, `completionTrend`, `memberWorkload`, `overdueByMember`,
`projectBreakdown`, `okrBreakdown`. Et depuis la mig. 094, `team_task_activity`
donne **ce qui a changé** — la seule donnée qui manquait.

## Architecture

Un flux guidé en 4 étapes, pas un tableau de bord de plus.

```
WeeklyReviewSheet
├── 1. Ce qui a avancé      → velocityByWeek (semaine N vs N-1)
├── 2. Ce qui a dérapé      → tâches dont la deadline a bougé (activity)
├── 3. Qui est en tension   → memberWorkload + workloadTone === 'over'
└── 4. Arbitrages           → liste d'actions, chacune ouvrant la tâche
```

**La 4ᵉ étape est ce qui distingue une revue d'un tableau de bord** : elle doit
produire des décisions cliquables, pas des chiffres.

## Files

- Create: `src/components/organization/WeeklyReviewSheet.tsx`
- Create: `src/components/organization/weekly-review.helpers.ts`
- Create: `src/components/organization/weekly-review.helpers.test.ts`
- Modify: `TeamOverviewTab.tsx` (bouton d'ouverture)
- Modify: `src/locales/{fr,en}/org.json`

## Helper à écrire (tout le calcul, testé)

```ts
export interface WeeklyReview {
  completedThisWeek: number;
  completedLastWeek: number;
  /** Variation en % ; null si la semaine précédente était à 0 (division impossible). */
  velocityChange: number | null;
  /** Tâches dont la deadline a été repoussée dans la fenêtre. */
  slipped: { taskId: string; from: string; to: string }[];
  /** Membres au-dessus de 1.5× la médiane. */
  overloaded: MemberWorkload[];
  /** Tâches en retard non terminées, les plus anciennes d'abord. */
  needsArbitration: TeamTask[];
}

export function buildWeeklyReview(
  tasks: TeamTask[],
  members: OrgMember[],
  activity: TeamTaskActivity[],
  now: Date = new Date(),
): WeeklyReview
```

**Points à tester impérativement :**

- `velocityChange` vaut `null` — pas `0`, pas `Infinity` — quand la semaine
  précédente est à 0. Une équipe qui passe de 0 à 5 n'a pas fait « +∞ % ».
- `slipped` ne retient que les entrées `field === 'deadline'` dont `new_value >
  old_value` (repoussée), pas avancée.
- `now` injectable (convention du projet, audit H6).
- Semaine lundi→dimanche, `weekStartsOn: 1` **codé en dur** — dériver de la
  locale ferait démarrer la semaine le dimanche en anglais et changerait les
  chiffres d'un utilisateur à l'autre (déjà tranché dans `weekBuckets`).

## Étapes

- [ ] Test du helper (les 4 points ci-dessus au minimum)
- [ ] Vérifier l'échec
- [ ] Implémenter
- [ ] Vérifier le succès
- [ ] Composant `WeeklyReviewSheet` (bottom-sheet, cf. `docs/MOBILE.md`)
- [ ] Bouton dans `TeamOverviewTab`, visible managers/admin seulement
- [ ] i18n fr + en
- [ ] Vérification complète + navigateur
- [ ] Commit

---

# Item 29 — Vue « Aujourd'hui » unifiée

> ⚠️ **Le plus structurant et le plus risqué des trois. À faire en dernier,
> sur sa propre branche.**

## Le problème

Un collaborateur membre d'une organisation a **deux listes de tâches sans
jonction** :

| | Perso | Équipe |
|---|---|---|
| Table | `tasks` | `team_tasks` |
| Module | `src/modules/tasks/` | `src/modules/team-projects/` |
| Écran | `/tasks` | `/entreprise?tab=projects` |
| Modèle | `completed`, `bookmarked`, listes, catégories, récurrence, partage | `status`, `assignee_ids`, projet, labels, sous-tâches |

Il n'existe aucun endroit répondant à « qu'est-ce que je dois faire
aujourd'hui ? ». C'est le plus gros défaut structurel du mode entreprise.

## Le piège à éviter absolument

**Ne PAS fusionner les tables.** Les deux modèles ont des règles de sécurité,
des cycles de vie et des fonctionnalités différents. Une migration qui les
fusionnerait serait irréversible sur une base sans PITR.

**Unifier en LECTURE seulement**, avec un type de vue commun et une écriture qui
retourne vers le module d'origine.

## Architecture

```ts
/** Élément d'agenda unifié — vue de LECTURE, jamais persistée. */
export interface TodayItem {
  id: string;
  source: 'personal' | 'team';
  name: string;
  deadline: string | null;
  done: boolean;
  priority: number;
  /** Contexte affiché : nom de liste (perso) ou de projet (équipe). */
  contextLabel: string | null;
  /** Ouvre l'écran d'origine — jamais d'édition inline dans cette vue. */
  href: string;
}
```

**Règle non négociable :** cette vue **lit** et **route**. Cocher une tâche
appelle la mutation du module d'origine (`useUpdateTask` ou
`useUpdateTeamTask`). Aucune écriture ne doit passer par un chemin unifié —
c'est là que les deux modèles divergent (récurrence serveur côté perso,
triggers de statut côté équipe).

## Contraintes de performance

- ❌ **Ne jamais lire `tasks` en direct.** Utiliser `get_my_tasks()` (RPC).
  Garde-fou `CLAUDE.md` : la policy `tasks_select_own_or_shared` est un `OR`
  non indexable → `Seq Scan` de la table globale.
- ⚠️ La vue monte deux sources. Vérifier qu'elle ne double pas le polling
  existant : `useTeamTasks` a déjà un `refetchInterval` de 5 min (filet de
  sécurité derrière le Realtime de `useSharedTasksRealtime`). **Ne pas monter
  un second canal Realtime** — c'est un WebSocket par écran (garde-fou CLAUDE.md).

## Files

- Create: `src/modules/today/types.ts`
- Create: `src/modules/today/today.helpers.ts` + test
- Create: `src/modules/today/hooks.ts`
- Create: `src/pages/TodayPage.tsx`
- Modify: `src/App.tsx` (route + `RequireModule` ?), `Layout.tsx`, `MobileTabBar.tsx`

## Décisions à trancher AVANT de coder

1. **Où vit la vue ?** Nouvel onglet de nav, ou remplacement du Dashboard ?
   Un onglet de plus dans une nav déjà chargée est un coût réel.
2. **Que montre-t-elle exactement ?** « Échéance ≤ aujourd'hui » ou « à faire
   maintenant » ? Les deux définitions donnent des listes très différentes.
3. **En mode démo ?** Les deux sources existent en démo — vérifier la parité.

**Ces trois questions appartiennent à Axel, pas à l'agent.** Les poser avant
d'écrire la première ligne.

## Étapes

- [ ] Poser les 3 questions ci-dessus, obtenir les réponses
- [ ] Helper `mergeTodayItems(personal, team, now)` + tests (tri, dédoublonnage,
      fuseau — dates locales `YYYY-MM-DD`, convention en-CA du projet)
- [ ] Hooks composés des deux sources existantes (aucune requête nouvelle)
- [ ] Page + route + nav
- [ ] i18n (nouveau namespace `today` : `catalog.ts` + import fr + `CatalogShapes`)
- [ ] Vérification complète + navigateur + parité démo
- [ ] Commit

---

## Définition de « terminé » (les trois items)

1. `npm run lint` → 0 erreur
2. `npm run typecheck` → 0 erreur
3. `npm test` → suite verte (référence : **1212**)
4. `npm run i18n:check` → 0 erreur
5. `npm run i18n:scan` → **toujours 0 fichier `organization/`**
6. Vérification visuelle 375 px + 1280 px, thèmes clair et sombre
7. Commit + push
