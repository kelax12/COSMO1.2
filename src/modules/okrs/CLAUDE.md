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

### ⏱️ Le TEMPS OKR se calcule en base, depuis `kr_completions` (C-77)

`get_work_time_stats` alimente `okrTime` sur `/statistics`. Depuis la mig. `136`, **appliquée en
production le 2026-09-20** (ledger `20260920104729`, relu par `pg_get_functiondef` le 09-21), elle
lit `kr_completions` et **plus** `history`.

- 🔴 **Elle est restée commitée et DORMANTE dix-sept jours** (2026-09-03 → 09-20). Pendant ce
  temps `okrTime` valait **0** pour tous les comptes réels, et la **démo affichait juste** : le
  correctif du 09-02 n'avait réparé que la moitié cliente. ❌ Ne jamais valider un calcul à deux
  implémentations sur la seule démo.
- ⚠️ **Un KR sans `estimated_time` compte 0 minute, et c'est JUSTE.** Le temps OKR vaut
  `Σ minutes estimées du KR` par complétion. Trois KR sur cinq du compte principal portent
  `estimated_time = 0`, et ce sont eux qui portent les **95 complétions** d'août et septembre :
  ces deux mois restent donc à zéro **après** le correctif.
  ❌ **Ne jamais relire ce zéro comme une panne** — sans cette phrase, on ouvre `/statistics` sur
  le mois courant, on voit zéro, et on rouvre un défaut qui n'existe plus. Ce qui donnerait un
  chiffre à ces mois est une **saisie de durée**, pas du code.

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

