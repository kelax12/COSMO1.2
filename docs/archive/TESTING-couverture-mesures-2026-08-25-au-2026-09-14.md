> ⚠️ **ARCHIVE : mesures de couverture datées et récit du cliquet, extrait de `docs/TESTING.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/TESTING.md`](../TESTING.md). Les notes /100 ont cessé (ADR 0012) : [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

### Couverture · mesure du 2026-09-11

✅ **VERTE au 2026-09-14** : **2 586 tests / 228 fichiers**, zéro échec, `exit 0`, aucun seuil
franchi — 31,15 L · 30,73 S · 24,41 F · 26,31 B.

⚠️ **Les pourcentages BAISSENT alors que 116 tests ont été ajoutés** depuis le 09-11 (31,32 L pour
2 470 / 221). Ce n'est pas une régression : le **dénominateur** bouge aussi, du code neuf étant
arrivé avec. Un taux de couverture ne se lit jamais seul, toujours avec le nombre de lignes qu'il
rapporte — sans quoi on « corrige » une baisse qui n'en est pas une, ou on rate une vraie.

*Mesure précédente, conservée :* ✅ **VERTE** : 2 470 tests / 221 fichiers, zéro échec, aucun seuil franchi.

| | 2026-08-29 | **2026-09-11** | Seuil global |
|---|---|---|---|
| Lines | 29,17 | **31,32** | 26 |
| Statements | 28,81 | **30,91** | 26 |
| Functions | 23,41 | **24,56** | 21 |
| Branches | 24,17 | **26,37** | 22 |

🔴 **Le cliquet du glob `supabase.repository.ts` a MORDU le 2026-09-08.** `functions` est tombé
à **89,83 %**, sous son seuil de 90, et la gate est passée au rouge. C'est exactement ce pour quoi
ce cliquet-là existe : il mord avant le plancher global, qui, lui, montait tranquillement.

**Les fonctions manquantes n'étaient pas dispersées, elles étaient datées.** 24 fonctions non
couvertes sur 236, dont six livrées après la campagne de tests du 2026-08-25 :

| Repository | Fonctions non couvertes | Livrées par |
|---|---|---|
| `tasks` | `getDependencies` · `addDependency` · `removeDependency` | mig. **132**, le 2026-08-30 |
| `okrs` | `restoreCompletions` | contrat `useRestoreX` (R-08) |
| `organizations` | `getMyOrgInbox` | mig. **129** + **142** |
| `team-projects` | `addTaskDependency` · `removeTaskDependency` | mig. **108** + **117** |
| `tasks` | `getPendingSharedTasks` · `delete` | antérieures, jamais couvertes |
| `lists` | `getByTaskId` · `delete` | antérieures, jamais couvertes |
| `habits` | `updateHabit` | antérieure, jamais couverte |

❌ **Aucun seuil n'a été baissé.** 126 tests ont été écrits sur ces six fichiers, couvrant
13 fonctions. Le glob est passé de **89,83 → 95,34 %** de fonctions, et **six repositories sont
maintenant à 100 %** (`tasks`, `organizations`, `team-projects`, `habits`, `events`, `categories`).
Restent sous la barre : `lists` (9/12) et `okrs` (28/33).

Les seuils du glob sont **remontés** en conséquence (`vitest.config.ts`), à ~2 points sous le
mesuré, comme le veut la convention du fichier :

| | Avant | **Après** | Mesuré |
|---|---|---|---|
| lines | 88 | **90** | 92,99 |
| statements | 74 | **76** | 78,85 |
| functions | 90 | **93** | 95,34 |
| branches | 63 | **65** | 67,91 |

⚠️ **Les planchers GLOBAUX n'ont PAS été remontés**, et c'est une décision, pas un oubli : leurs
marges valent maintenant 5,32 / 4,91 / 3,56 / 4,37 points. La marge de `functions` était de
**0,32 point** le 2026-08-25 ; elle est confortable pour la première fois. À remonter à la
prochaine mesure verte, pas dans le même geste que celui qui vient de réparer la gate.

⚠️ **Comment mesurer sur cette machine.** Le run prend ~11 minutes, et il **meurt en silence** :
pas de résumé, pas de rapport, pas de message, si une autre session fait tourner sa suite en
parallèle (mesuré six fois le 2026-09-09 : workers qui ne démarrent pas, tests à 30 s de timeout,
processus tué sans trace). Mesurer machine libre, ou dans un worktree isolé, avec
`--maxWorkers=4`. ❌ **Ne jamais conclure d'un run mort que la couverture a baissé** : un run sans
bloc « Coverage summary » n'a rien mesuré du tout.
