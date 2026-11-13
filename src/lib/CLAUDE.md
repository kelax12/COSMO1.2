# `src/lib/` · toasts, échéances, fuseau horaire

Lire en touchant `src/lib/**`, un `toast`, une échéance (`deadline`), une clé de jour. Le code fait foi.
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

## Échéances : un jour, pas un instant

`tasks.deadline` est un `timestamptz`, mais la personne saisit un **jour**. Un seul module fait foi : `src/lib/deadline.ts`.

```typescript
new Date(formData.deadline).toISOString()   // ❌ minuit UTC, la veille à l'ouest
task.deadline.slice(0, 10)                  // ❌ jour UTC, pas le jour vécu
deadlineFromDayKey(formData.deadline)       // ✅ écriture
deadlineDayKey(task.deadline)               // ✅ lecture
isDueToday(...) / isOverdue(...)            // ✅ comparaisons
```

- 🔴 Trois écritures divergentes ont produit, à l'ouest du méridien, « En retard » pour une tâche du jour. Invisible depuis la métropole : ne pas conclure de l'avoir vu marcher.
- ❌ Comparer des INSTANTS pour décider « en retard » (`new Date(deadline) < new Date()`) : on compare des jours.
- ⚠️ Les lignes écrites avant le correctif ne sont pas migrées, volontairement : la base ne connaît pas le fuseau de chaque compte.
- ✅ `team_tasks.deadline` est une `date` et traverse sans conversion ; `deadlineDayKey` gère les deux formes.

## Fuseau horaire

`src/lib/timezone.ts` porte l'affichage de l'agenda ET le découpage des journées (`dayKeyInTz`, `todayKeyInTz`, `dayStartInTz`) : réglage `manual` + décalage, et échéances, reports et « Aujourd'hui » suivent le jour choisi.

- ❌ Faire dépendre un jour de `toLocaleDateString('en-CA')` seul sur un chemin d'échéances : c'est le fuseau de la MACHINE.
- 🔴 **Gelé (C-03) : les clés de `habits.completions` restent en date MACHINE.** `habits/streak.ts`, `habits/supabase.repository.ts`, `HabitCard`, `HabitGlobalTracking`, `HabitTable`, `TodayHabits` appellent délibérément `toLocaleDateString('en-CA')` et doivent continuer. Pourquoi : convertir une clé de jour exige le fuseau de la personne CE jour-là, que la base ne stocke pas (une préférence courante seulement) ; migrer décalerait des journées et casserait séries et `streak_best`.
- ❌ « Corriger » une seule moitié (affichage sur `dayKeyInTz`, écriture en date machine) : jours cochés décalés d'une case, historique faux présenté comme juste.
- ⚠️ Divergence visible : seulement en `manual` avec un décalage qui change le jour par rapport à la machine (jamais en métropole). La série reste cohérente avec elle-même.
- ✅ Ce qui rouvrirait la question : une colonne qui enregistre le décalage AU MOMENT de la complétion. Rien ne l'écrit.
