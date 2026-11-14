# `src/lib/` · toasts, échéances, fuseau horaire

**Quand lire** : en touchant `src/lib/**`, un `toast`, une échéance (`deadline`), une clé de jour. **Fait foi** : le code.
Règles transversales : [`CLAUDE.md`](../../CLAUDE.md).

## Toasts

```typescript
import { toast } from '@/lib/toast';   // ✅ façade différée
import { toast } from 'sonner';        // ❌ y compris dans une page lazy
```

- 🔴 `sonner` ne s'importe que dans `src/lib/toast.ts`, en `import()` dynamique. Un seul import statique dans une page lazy fait remonter le module dans le chunk d'entrée et le chemin critique ne maigrit pas (même avec `manualChunks`, Vite le `modulepreload`e). Garde : `src/lib/toast.guard.test.ts`.
- ❌ `toast` depuis un repository ou depuis `normalizeApiError`.
- ✅ La façade garde la surface de sonner (`.success` `.error` `.info` `.warning` `.message` `.loading` `.custom` `.dismiss`) mais ne rend aucun identifiant ; `toast.custom` reçoit le sien dans son rendu.
- ⚠️ Le `<Toaster>` d'`App.tsx` est en `lazy()` derrière son PROPRE `<Suspense fallback={null}>` : suspendre sur la frontière des routes cacherait la page.
- ⚠️ Une règle qui ne s'appuie sur aucun fichier commité n'est qu'une intention : vérifier que la façade est suivie par git avant de la citer.

## Échéances : un jour, pas un instant (DAT-01)

La personne saisit un **jour**. Dans le front, `Task.deadline` et `TeamTask.deadline` sont des clés `'YYYY-MM-DD'` (`''` = aucune) ; seules les frontières (repository Supabase, démo, CLI) parlent aux colonnes. Module qui fait foi : `src/lib/deadline.ts`.

```typescript
new Date(task.deadline)                     // ❌ minuit UTC, la veille à l'ouest
task.deadline.slice(0, 10)                  // ❌ jour UTC d'un instant hérité
updates: { deadline: dayKey }               // ✅ écriture : la clé de jour
deadlineDayKey(task.deadline)               // ✅ lecture (tolère un instant hérité)
deadlineLocalDate(task.deadline)            // ✅ Date locale à midi, pour formater
isDueToday(...) / isOverdue(...)            // ✅ comparaisons de jours
```

- 🔴 Base : `tasks.due_date date` (mig. `251`) remplace `tasks.deadline timestamptz`, retirée par la `253` (`supabase/migration-differee/`, après vérification). Le front est déployé avant : `tasks/deadline-columns.ts` tient l'état sondé une fois par session, le repository lit, filtre et écrit la forme que la base porte ; le CLI fait de même.
- 🔴 Ancien instant → jour : `dayKeyFromStoredDeadline` (front, CLI) et `public.echeance_jour` (SQL) sont miroirs. Instant au quart d'heure près = minuit écrit dans le fuseau de son auteur, jour de l'instant + 13 h en UTC (exact de UTC-10 à UTC+13) ; autre instant : jour à Paris. Aucun fuseau n'est stocké par compte.
- ⚠️ `toggle_task_complete_v2` garde sa signature : le front envoie `storedDeadlineInstant(jour)`, la RPC écrit `due_date = echeance_jour(...)`.
- ❌ Comparer des INSTANTS pour décider « en retard » : on compare des jours. Invisible depuis la métropole : ne pas conclure de l'avoir vu marcher.
- ✅ `team_tasks.deadline` reste une `date` et garde son nom : même type que `due_date`, et un renommage toucherait le journal `team_task_activity` (champ `'deadline'` écrit), les agrégats et le contrat sortant des webhooks, sans changer aucun comportement.

## Fuseau horaire

`src/lib/timezone.ts` porte l'affichage de l'agenda ET le découpage des journées (`dayKeyInTz`, `todayKeyInTz`, `dayStartInTz`) : réglage `manual` + décalage, et échéances, reports et « Aujourd'hui » suivent le jour choisi.

- ❌ Faire dépendre un jour de `toLocaleDateString('en-CA')` seul sur un chemin d'échéances : c'est le fuseau de la MACHINE.
- 🔴 **Gelé (C-03) : les clés de `habits.completions` restent en date MACHINE.** `habits/streak.ts`, `habits/supabase.repository.ts`, `HabitCard`, `HabitGlobalTracking`, `HabitTable`, `TodayHabits` appellent délibérément `toLocaleDateString('en-CA')` et doivent continuer. Pourquoi : convertir une clé de jour exige le fuseau de la personne CE jour-là, que la base ne stocke pas (une préférence courante seulement) ; migrer décalerait des journées et casserait séries et `streak_best`.
- ❌ « Corriger » une seule moitié (affichage sur `dayKeyInTz`, écriture en date machine) : jours cochés décalés d'une case, historique faux présenté comme juste.
- ⚠️ Divergence visible : seulement en `manual` avec un décalage qui change le jour par rapport à la machine (jamais en métropole). La série reste cohérente avec elle-même.
- ✅ Ce qui rouvrirait la question : une colonne qui enregistre le décalage AU MOMENT de la complétion. Rien ne l'écrit.
