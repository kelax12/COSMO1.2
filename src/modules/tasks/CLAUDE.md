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


## 🗂️ Statut et État (mig. `214`, appliquée le 2026-10-08)

`tasks.status` (`todo`, `in_progress`, `blocked`, `done`) et `tasks.health` (`on_track`,
`at_risk`, `off_track`, NULL). Le trigger `sync_task_status` (`SECURITY INVOKER`) tient
`status` et `completed` d'accord ; `applyStatusSync` (`status-sync.ts`) en est le miroir pour la
démo et les mises à jour optimistes. `review` n'existe pas en perso, exprès.

- ❌ **Ne jamais écrire `update({ status: 'done' })` pour terminer une tâche À SOI.** Passer par
  `toggleComplete` : seule `toggle_task_complete_v2` génère l'occurrence récurrente (Tableau :
  `use-move-task.ts`). Depuis la mig. `215`, la RPC laisse la RLS décider : un ami « editor »
  coche une tâche reçue, l'occurrence suivante reste réservée au propriétaire.
- ❌ **Ne jamais déduire un statut dans `mapTaskFromDb`, ni en ajouter un dans le cache à une
  ligne qui n'en a pas.** Une tâche lue repart entière dans « Annuler » et « Dupliquer » : un
  statut inventé partirait en base.
- ❌ **La fiche (`save-task.ts`) n'envoie pas `completed`.** Elle ne l'édite pas, et le Statut de
  la fiche peut cocher la tâche pendant qu'elle est ouverte : renvoyer la valeur de l'ouverture
  la décocherait.

> Les ÉCHÉANCES (`tasks.deadline`, un jour et non un instant) sont documentées dans
> [`src/lib/CLAUDE.md`](../../lib/CLAUDE.md) : le module qui fait foi est `src/lib/deadline.ts`.
