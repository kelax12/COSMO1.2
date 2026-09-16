# Tâches · règles du dossier

> Repris de `CLAUDE.md` le 2026-09-16, **sans une coupe**. Ce fichier est chargé
> automatiquement dès qu un fichier de ce dossier est lu ou édité, et lui seul.
> Règles transversales : [`CLAUDE.md`](../../../CLAUDE.md) à la racine.

---

## 🔁 Récurrence des tâches — serveur uniquement

La génération de l'occurrence suivante appartient à `toggle_task_complete_v2` (mig. 086), **pas
au client**. Elle est atomique (même transaction que la bascule) et idempotente (index unique
`ux_tasks_recurrence_parent`). Le client ne fournit QUE la date suivante, calculée en date locale
(`nextOccurrenceDeadline`) — le serveur ne connaît pas son fuseau.

- ❌ Ne jamais recréer un `repository.create(nextOccurrence)` côté client (faille H1 : occurrence
  perdue si l'onglet se ferme, doublon si on décoche puis recoche, échec avalé).
- ❌ Ne jamais écrire `recurrence_parent_id` depuis le client — c'est la clé d'idempotence,
  `mapTaskToDb` ne l'émet volontairement pas.


> Les ÉCHÉANCES (`tasks.deadline`, un jour et non un instant) sont documentées dans
> [`src/lib/CLAUDE.md`](../../lib/CLAUDE.md) : le module qui fait foi est `src/lib/deadline.ts`.
