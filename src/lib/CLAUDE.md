# `src/lib/` · règles du dossier

> Repris de `CLAUDE.md` le 2026-09-16, **sans une coupe**. Chargé automatiquement dès
> qu un fichier de ce dossier est touché. Règles transversales : [`CLAUDE.md`](../../CLAUDE.md) à la racine.

---

## Toasts

```typescript
import { toast } from '@/lib/toast';   // ✅ façade différée
import { toast } from 'sonner';        // ❌ jamais, y compris dans une page lazy
toast.success('Message'); toast.error('Erreur');
// Jamais depuis un repository ni depuis normalizeApiError
```

✅ **Cette règle décrit `main` depuis le 2026-09-14** — commit `7134d7fe`, run CI
`34846164939` vert sur les cinq jobs. ⚠️ Elle ne le décrivait PAS pendant les
trois jours précédents : la façade existait sur un disque et dans aucun commit,
donc la règle était **invérifiable**, et trois `fix(build)` d'autres sessions
sont revenus à `sonner` parce que le module importé n'était pas suivi par git
(vert en local, rouge au build Vercel). Une règle qui ne s'appuie sur rien de
commité n'est pas une règle, c'est une intention.

🔴 **`sonner` ne s'importe que dans `src/lib/toast.ts`, et seulement en
`import()` dynamique.** La façade expose la même surface (`toast(...)`,
`.success` / `.error` / `.info` / `.warning` / `.message` / `.loading` /
`.custom` / `.dismiss`) ; elle ne rend pas d'identifiant, parce qu'avant
chargement il n'y en a pas — `toast.custom` reçoit le sien dans son rendu,
c'est le seul usage qu'en faisait le dépôt.

⚠️ **Retirer l'import du seul SHELL ne sert à rien, et c'est contre-intuitif.**
Tant qu'UNE page lazy garde `import { toast } from 'sonner'`, Rollup place le
module dans l'ancêtre commun des chunks qui le partagent, c'est-à-dire
l'ENTRÉE. Mesuré le 2026-09-11, même arbre, trois formes :

| Forme | Entrée | Chemin critique |
|---|---|---|
| 57 imports statiques, shell nettoyé | 77,0 ko | 316,4 ko |
| idem + `manualChunks: 'vendor-toast'` | 66,9 ko | **316,2 ko** — Vite le `modulepreload`e |
| **zéro import statique**, un seul `import()` | **66,9 ko** | **306,3 ko** |

La deuxième ligne est le piège : l'entrée maigrit de 10 ko et le chemin
critique de **162 octets**. Sortir un module de l'entrée sans le sortir du
chemin critique ne gagne rien. Cliquet : `src/lib/toast.guard.test.ts`
(4 tests, dont un témoin, vu rouge sur un import fautif avant d'être committé).

⚠️ Le `<Toaster>` d'`App.tsx` est monté en `lazy()` derrière son PROPRE
`<Suspense fallback={null}>` : il ne peint rien tant qu'aucun toast n'est émis,
et suspendre sur la frontière qui enveloppe les routes cacherait la page.


---

### 📅 Échéances — un jour, pas un instant (revue du 2026-09-02, R-01)

`tasks.deadline` est un `timestamptz`, mais ce que la personne saisit est un **jour**. Les deux ne
se convertissent ni par `new Date('YYYY-MM-DD')` (qui parse en **UTC**) ni par `.slice(0, 10')`
(qui rend le jour **UTC** de l'instant). Un seul module fait foi : **`src/lib/deadline.ts`**.

```typescript
new Date(formData.deadline).toISOString()   // ❌ minuit UTC → la veille à l'ouest
task.deadline.slice(0, 10)                  // ❌ jour UTC, pas le jour vécu
deadlineFromDayKey(formData.deadline)       // ✅ écriture
deadlineDayKey(task.deadline)               // ✅ lecture
isDueToday(...) / isOverdue(...)            // ✅ comparaisons
```

- 🔴 **Trois écritures divergentes coexistaient** (`save-task`, `snooze`, `TasksPage`), pour trois
  valeurs différentes du même jour choisi. Mesuré en prod : **467 des 601 échéances** portaient
  00:00:00 UTC. Conséquence, pour tout fuseau à décalage négatif : une tâche datée du jour même
  était classée « En retard » et absente de « Aujourd'hui ». **Invisible depuis la métropole**, ce
  qui la rendait introuvable en regardant l'application fonctionner.
- ❌ **Ne jamais comparer des INSTANTS pour décider « en retard ».** `new Date(deadline) < new Date()`
  faisait basculer en rouge une tâche due aujourd'hui dès 00 h 01. On compare des **jours**.
- ⚠️ **Les lignes écrites avant le correctif ne sont pas migrées, et c'est volontaire** : relues par
  `deadlineDayKey`, elles rendent exactement ce qu'elles rendaient avant (juste en métropole, fausses
  ailleurs). Aucune régression, et surtout aucune migration de données qui devrait deviner le fuseau
  de chaque compte — la base ne le connaît pas.
- ✅ **`team_tasks.deadline` est une `date`** et traverse sans conversion : elle ne porte aucun
  instant. `deadlineDayKey` gère les deux formes, c'est sa raison d'être.

### 🌍 Fuseau horaire — la préférence pilote AUSSI les journées

`src/lib/timezone.ts` portait un décalage d'**affichage** pour le seul agenda. Il porte désormais
le découpage des **journées** (`dayKeyInTz`, `todayKeyInTz`, `dayStartInTz`), ce qui permet à
quelqu'un en Guadeloupe, à La Réunion ou en Nouvelle-Calédonie de se détacher du découpage
métropolitain : réglage `manual` + décalage, et ses échéances, ses reports et ses listes
« Aujourd'hui » suivent SON jour.

- ❌ **Ne jamais faire dépendre un jour de `toLocaleDateString('en-CA')` seul** dans un chemin qui
  touche aux échéances : c'est le fuseau de la MACHINE, pas celui que la personne a choisi.
- 🔴 **GELÉ le 2026-09-12 (C-03) : les clés de `habits.completions` restent en date MACHINE**, et
  ce n'est plus « à traiter par une migration dédiée », c'est une décision rendue. Les quatre
  lectures qui les produisent (`habits/streak.ts`, `habits/supabase.repository.ts`,
  `HabitCard`, `HabitGlobalTracking`, `HabitTable`, `TodayHabits`) appellent délibérément
  `toLocaleDateString('en-CA')` et **doivent continuer**.

  **Pourquoi le gel plutôt que la migration.** Convertir une clé de jour d'un fuseau vers un autre
  demande de savoir dans quel fuseau était la personne **ce jour-là**. La base ne le sait pas : elle
  ne stocke qu'une préférence COURANTE, posée aujourd'hui, qui ne dit rien des trois ans
  d'historique derrière. Migrer reviendrait donc à appliquer le décalage d'aujourd'hui à des
  journées vécues ailleurs — et le prix se paie en **séries** : quelqu'un dont une seule journée se
  décale perd sa série entière, et `streak_best` avec. On casserait la donnée que les gens ont
  construite pour corriger une incohérence qu'ils ne voient pas.

  **Ce que la personne voit quand les deux découpages divergent.** Uniquement en réglage `manual`,
  et uniquement si le décalage choisi la fait changer de jour par rapport à sa machine — donc
  jamais en métropole, où les deux coïncident. Dans ce cas : sur le même écran, une tâche peut être
  « due aujourd'hui » pendant qu'une habitude cochée compte pour la veille (ou l'inverse), et la
  case du jour dans la grille d'habitudes ne correspond pas à la colonne « Aujourd'hui » de la
  liste de tâches. La série, elle, reste **cohérente avec elle-même** : elle est calculée de bout en
  bout en date machine, donc elle ne saute pas, elle est seulement calée sur un autre jour.

  ❌ **Ne jamais « corriger » une seule des deux moitiés.** Basculer l'affichage sur
  `dayKeyInTz` en laissant l'écriture en date machine ferait apparaître des jours cochés **décalés
  d'une case** dans la grille, c'est-à-dire un historique faux présenté comme juste — strictement
  pire que la divergence actuelle, qui est au moins interne à chaque module.

  ✅ **Ce qui rouvrirait la question** : une colonne qui enregistrerait le décalage AU MOMENT de la
  complétion. À partir de là, et seulement à partir de là, une migration saurait ce qu'elle
  convertit. Rien dans le produit ne l'écrit aujourd'hui.

