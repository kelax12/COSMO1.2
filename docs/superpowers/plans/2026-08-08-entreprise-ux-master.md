# Mode entreprise — 22 améliorations UI/UX : plan directeur

> **Pour les agents :** ce document est le **séquencement**, pas le plan d'exécution.
> Chaque vague a son propre plan détaillé (`…-vague-N.md`) à exécuter avec
> `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.

**Goal :** livrer 22 améliorations UI/UX du mode entreprise en 5 vagues, chacune
livrable et testable seule, sans jamais laisser `main` dans un état intermédiaire.

**Architecture :** on suit la découpe existante du module — logique pure dans
`*.helpers.ts` (testée en Vitest), composants de présentation dans
`src/components/organization/`, accès données par les hooks React Query des
modules `team-projects` / `team-okrs` / `organizations` / `org-teams`. Aucune
vague n'introduit de contexte global (garde-fou CLAUDE.md).

**Tech Stack :** React 18 + TS strict, TanStack Query 5, Tailwind + tokens
`rgb(var(--color-*))`, lucide-react, date-fns (locale via `@/i18n/format`),
i18n maison (catalogues JSON `src/locales/<locale>/org.json`), Vitest, Playwright.

---

## Les 22 items retenus

| # | Item | Vague | Migration SQL |
|---|---|---|---|
| 1 | Deep-link jusqu'à l'entité (`?task=`, `?project=`, `?member=`) | 1 | — |
| 2 | Chaînes FR en dur → catalogue i18n | 1 | — |
| 3 | Badges de compteur par onglet | 1 | — |
| 4 | Pastilles de stats cliquables (filtres) | 1 | — |
| 7 | Densité de liste réglable | 1 | — |
| 20 | `estimatedTime` exploité (affiché, sommé) | 1 | — |
| 11 | Drag & drop des tâches dans le kanban | 2 | — |
| 14 | Sélection multiple + actions groupées | 2 | — |
| 15 | Recherche globale entreprise (⌘K) | 2 | — |
| 18 | Fiche membre unifiée (page à onglets) | 2 | — |
| 9 | Statuts de tâche (remplace `completed`) | 3 | **091** |
| 12 | Sous-tâches / checklists | 3 | **092** |
| 13 | Labels transverses | 3 | **093** |
| 21 | Historique de tâche (audit trail) | 3 | **094** |
| 19 | Vue « Charge de l'équipe » | 4 | — |
| 28 | Pyramide augmentée (calque de données) | 4 | — |
| 25 | Timeline / Gantt léger | 4 | — |
| 26 | Revue hebdomadaire d'équipe | 4 | — |
| 22 | Gabarits de projet | 5 | — |
| 29 | Espace unifié « Aujourd'hui » | 5 | — |
| 17 | Centre de notifications entreprise | 5 | **095** |
| 30 | Automatisations déclaratives | 5 | **096** + Edge Function |

---

## Dépendances réelles

```
2 ──▶ (toutes les vagues : sans catalogue complet, chaque item rajoute de la dette FR)
20 ─▶ 19 ─▶ 28
        └─▶ 26
9 ──▶ 11 (colonnes = statuts), 14 (action groupée « passer en »), 25 (couleur de barre), 30 (déclencheur)
13 ─▶ 14 (action groupée « ajouter le label »), 15 (facette de recherche)
21 ─▶ 26 (ce qui a changé), 30 (journal d'exécution), 17 (source des notifs)
17 ─▶ 30 (une automatisation notifie)
```

**Conséquence de séquencement :** l'item **2** passe en premier de la vague 1.
Toute chaîne ajoutée ensuite naît dans le catalogue — on ne repasse jamais dessus.
L'item **9** est le point de bascule : il ouvre 4 items, donc la vague 3 ne peut
pas glisser après la vague 4.

---

## Vagues

### Vague 1 — « L'écran arrête de mentir » (aucune migration)
**Items 2, 1, 3, 4, 7, 20.** Plan détaillé : `2026-08-08-entreprise-ux-vague-1.md`

Rien de neuf fonctionnellement : on rend actionnable et honnête ce qui est déjà
affiché. Une pastille « 4 en retard » qui ne filtre pas, un `estimatedTime` saisi
et jamais lu, un onglet FR en dur dans une app i18n — ce sont des promesses non
tenues. Livrable seul, testable seul, zéro risque de régression données.

### Vague 2 — Manipulation directe (aucune migration)
**Items 11, 14, 15, 18.**

Le mode entreprise est aujourd'hui en lecture + modal. Cette vague le rend
manipulable : glisser une tâche, en traiter vingt d'un coup, tout retrouver au
clavier, voir une personne au même endroit. `showUndoToast` et le drag de
`PyramidTab` existent déjà — on réutilise, on n'invente pas.

### Vague 3 — Modèle de données (migrations 091–094)
**Items 9, 12, 13, 21.**

La seule vague qui touche Postgres. Ordre imposé : 091 (statuts) avant tout,
car `completed: boolean` est lu dans 14 fichiers et la bascule doit être faite
en une fois, avec vue de compatibilité le temps du déploiement.

⚠️ **Les migrations sont écrites ici mais appliquées par Axel** (flux établi :
Claude écrit + vérifie, Axel applique). Chaque migration doit passer
`npm run validate:migrations` et `npm run check:rls` avant d'être proposée.

### Vague 4 — Pilotage
**Items 19, 28, 25, 26.**

Là où le produit cesse d'être un gestionnaire de listes. Toute la donnée existe
après la vague 3 ; c'est de la restitution. `team-stats.helpers.ts` s'étend,
`PyramidTab` reçoit un calque, deux vues nouvelles apparaissent.

### Vague 5 — Plateforme (migrations 095–096)
**Items 22, 29, 17, 30.**

Les paris. **29** (unifier tâches perso + tâches d'équipe côté lecture, sans
fusionner les tables) et **30** (automatisations serveur) sont chacun de la
taille d'une vague entière — ils auront leur propre plan, potentiellement leur
propre branche.

---

## Garde-fous transverses (valables sur les 5 vagues)

- **i18n** : toute chaîne visible passe par `useT('org')` + `src/locales/fr/org.json`
  ET `src/locales/en/org.json`. Vérification : `npm run i18n:check`.
- **Couleurs** : jamais de `bg-white` / `dark:bg-slate-900` en dur — tokens
  `rgb(var(--color-*))` (leçon du fix modals 2026-07-23).
- **Logique pure** : toute décision (tri, filtre, autorisation, agrégat) va dans
  un `*.helpers.ts` testé, pas dans le JSX.
- **Mobile** : tout composant nouveau se vérifie en 375 px avant commit
  (`docs/MOBILE.md`), bottom-sheet et non modal centré.
- **Avant chaque push** : `npm run lint && npm run typecheck && npm test`
  (checklist `docs/TESTING.md`).
- **RLS** : aucune vue nouvelle ne lit `tasks` en direct — `get_my_tasks()`
  (garde-fou CLAUDE.md, Seq Scan global).

---

## Définition de « terminé » par vague

1. `npm run lint` → 0 erreur
2. `npm run typecheck` → 0 erreur
3. `npm test` → suite verte (référence : 1114/1114 au 2026-08-07 ; un échec est
   une vraie régression)
4. `npm run i18n:check` → 0 clé manquante
5. Vérification visuelle 375 px + 1280 px, thèmes clair et sombre
6. Commit + push (préférence utilisateur : automatique après vérification)
