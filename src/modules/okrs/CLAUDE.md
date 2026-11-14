# OKR (`src/modules/okrs`)

**Quand lire** : en touchant `src/modules/okrs/**`, `kr_completions`, `/statistics`, le graphique « KR réalisés ». **Fait foi** : le code.
Règles transversales : [`../CLAUDE.md`](../CLAUDE.md).

## Journal append-only `kr_completions`

- 🔴 Quand un KR passe `completed: false → true`, les DEUX repositories insèrent une ligne dans `kr_completions` : `local.repository.ts → updateKeyResult` et `supabase.repository.ts → recordKRCompletion()` (appelé par `updateKeyResult` ET `updateKeyResultViaJsonb`). Sans elle le graphique du Dashboard reste à 0 en prod. ❌ Modifier sans vérifier le graphique, démo ET prod.
- ❌ Valider un calcul à deux implémentations (cliente, SQL) sur la seule démo.

## Temps OKR (C-77)

- ✅ `get_work_time_stats` alimente `okrTime` (`/statistics`) ; depuis la mig. `136` elle lit `kr_completions`, plus `history`. Temps = Σ minutes estimées du KR par complétion.
- ⚠️ Un KR sans `estimated_time` compte 0 minute : c'est juste. ❌ Relire ce zéro comme une panne : ce qui donne un chiffre est une saisie de durée, pas du code.

## « Annuler » rend aussi le journal (C-01)

`kr_completions` cascade depuis `okrs` ET `key_results`. `useRestoreOkrWithJournal` (`restore-journal.hooks.ts`) capture les lignes AVANT le `delete`, recrée l'objectif sous SON id, puis rejoue le journal : l'ordre est impératif (un id neuf orpheline chaque ligne).

- 🔴 L'écriture appartient au REPOSITORY (`restoreCompletions`), à côté de `recordKRReps` ; ❌ un `create()` client (INSERT libre dans un journal append-only). La borne `MAX_REPS_PER_WRITE` (B18, cap 100/write) vit avec lui, jamais dupliquée dans le hook.
- ⚠️ Les ids des lignes de journal ne sont pas restaurés, voulu : seul le contenu (`kr_id`, `okr_id`, `completed_at`) alimente le graphique.
- ❌ Documenter une perte de données comme « limite acceptée » : un trou documenté reste un trou.
