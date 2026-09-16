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

