# OKR · règles du dossier

> Repris de `CLAUDE.md` le 2026-09-16, **sans une coupe**. Ce fichier est chargé
> automatiquement dès qu un fichier de ce dossier est lu ou édité, et lui seul.
> Règles transversales : [`CLAUDE.md`](../../../CLAUDE.md) à la racine.

---

### Pattern critique : journal append-only `kr_completions`

Quand un KR passe `completed: false → true`, **les deux repositories OKR doivent insérer une
ligne dans `kr_completions`** atomiquement. Cette table alimente le graphique « KR réalisés » du
Dashboard.

- **LocalStorage** : `src/modules/okrs/repository.ts → updateKeyResult`
- **Supabase** : `src/modules/okrs/supabase.repository.ts → recordKRCompletion()`
  (appelé depuis `updateKeyResult` ET `updateKeyResultViaJsonb`)

> **Ne jamais retirer cette logique** : sans elle, le graphique reste à 0 en production.

---

### ↩️ « Annuler » rend AUSSI le journal (C-01)

`kr_completions` cascade depuis `okrs` **ET** `key_results`. `useRestoreOkr` ramenait l'objectif,
ses KR et les `task.krId` qui les visent, mais pas le journal : le graphique gardait son trou,
**définitivement**, alors que la personne venait de dire qu'elle ne voulait PAS supprimer.

`useRestoreOkrWithJournal` (`restore-journal.hooks.ts`) capture les lignes **avant** le `delete`
(elles disparaissent avec l'OKR), recrée l'objectif sous **SON** identifiant, puis rejoue le
journal. L'ordre n'est pas négociable : un id neuf rendrait chaque ligne orpheline.

- 🔴 **L'écriture appartient au REPOSITORY** (`restoreCompletions`), au même endroit que
  `recordKRReps`. Jamais un `create()` client : un INSERT libre dans un journal append-only est
  exactement ce que l'arbitrage du 2026-09-03 fait supprimer, et passer par le repository plutôt
  que par le hook garderait le défaut en changeant son nom. La borne `MAX_REPS_PER_WRITE` (B18)
  vit avec lui, jamais dupliquée dans le hook.
- ⚠️ **Ce que ça ne rattrape pas** : les identifiants des lignes de journal. C'est voulu, un
  journal est un ensemble d'événements et non un graphe ; rien ne référence une de ses lignes,
  seul son contenu (`kr_id`, `okr_id`, `completed_at`) alimente le graphique.
- ❌ **Une limite écrite dans un `CLAUDE.md` reste une perte de données.** Celle-ci a vécu deux
  semaines dans `src/modules/CLAUDE.md` § R-08, décrite comme acceptée. Documenter un trou ne le
  referme pas.

---

