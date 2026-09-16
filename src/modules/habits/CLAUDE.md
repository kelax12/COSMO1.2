# Habitudes · règles du dossier

> Repris de `CLAUDE.md` le 2026-09-16, **sans une coupe**. Ce fichier est chargé
> automatiquement dès qu un fichier de ce dossier est lu ou édité, et lui seul.
> Règles transversales : [`CLAUDE.md`](../../../CLAUDE.md) à la racine.

---

## 📉 Habitudes — `completions` est BORNÉ à la lecture (mig. 119)

`habits.completions` est un JSONB qui gagnait une entrée **par jour et par habitude**,
sans aucune borne : 12,7 octets/jour mesurés, soit ~280 ko par ouverture de la page
Habitudes à trois ans pour 20 habitudes.

```typescript
supabase.from('habits').select('*')                       // ❌ payload sans borne
supabase.rpc('get_my_habits', { p_days: 400 })            // ✅ mig. 119
```

La RPC renvoie `completions` **filtré aux 400 derniers jours**, ET quatre agrégats
calculés **serveur sur l'historique entier** : `streak_current`, `streak_best`,
`completions_total`, `first_completion_date`. C'est ce qui rend la troncature acceptable.

- 🔴 **Ne jamais faire juger « aujourd'hui » par le serveur.** La base est en **UTC**, les clés
  de `completions` sont écrites en date LOCALE (`toLocaleDateString('en-CA')`). Toute fonction qui
  raisonne sur un jour prend `p_today` du client (`get_my_habits`, `toggle_habit_completion_v2`).
  Utiliser `CURRENT_DATE` a produit une série affichée à **zéro** en Amérique du Nord entre 19 h
  et minuit, et un compteur qui **baissait** en cochant entre 00 h et 02 h en France (mig. 119,
  corrigé par la mig. 122). C'est la même classe de bug que celle éradiquée en juin 2026, revenue
  par le SQL.
- ❌ **Ne jamais dériver une série ou un total de `habit.completions`.** Utiliser
  `habitStreak(habit)` (`src/modules/habits/streak.ts`), `habit.completionsTotal` et
  `habit.firstCompletionDate`. Sur la fenêtre, un utilisateur assidu depuis trois ans
  verrait sa série plafonner à 400 — un chiffre faux, affiché comme s'il était juste.
- ❌ **Ne jamais compter les complétions dans un export.** L'export est le support du
  droit à la portabilité (RGPD art. 20) : il utilise `completionsTotal`.
- ⚠️ Les agrégats sont **absents en mode démo et local** (le repository local a toute la
  donnée) : chaque helper retombe alors sur le calcul JS. Garder ce repli.
- ⚠️ Augmenter la fenêtre réintroduit le problème proportionnellement (+12,7 o/jour et
  par habitude). La RPC plafonne à 3 650 quoi qu'on demande.
- La table n'est PAS modifiée : rien n'est supprimé, c'est la LECTURE qui est bornée.


---

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

