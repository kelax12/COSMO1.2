// ═══════════════════════════════════════════════════════════════════
// REVUE DES CRÉNEAUX DE TÂCHE PASSÉS
// ═══════════════════════════════════════════════════════════════════
//
// Extrait d'`AgendaPage` le 2026-09-02. Motif : le cliquet d'architecture
// (`src/architecture.guard.test.ts`) est un budget de lignes qui ne remonte
// jamais. Les correctifs R-16 et R-18 ont fait grossir quatre fichiers déjà
// hors budget de 36 lignes au total ; la réponse du dépôt à ce cas est
// documentée et n'est pas de relever le plafond, c'est de compenser par un
// découpage. Ce bloc était le meilleur candidat : quatre gestionnaires, un
// état et un dérivé, qui ne parlent qu'entre eux.
//
// ⚠️ Le 2026-09-13, la POPUP que ce hook alimentait a disparu. Elle s'ouvrait
// seule, par-dessus ce que la personne était en train de faire, et coupait son
// geste pour poser une question qui pouvait attendre. La demande est désormais
// portée par une pastille peinte sur le bloc d'événement, plus un panneau dans
// l'EventModal : deux accès à la MÊME question, tous deux dérivés de
// `findOverdueTaskSlots`. Le hook ne rend donc plus « le créneau courant » mais
// l'ensemble des créneaux en attente, et une cinquième action est apparue
// (« Ignorer »), la seule qui avait besoin d'être écrite quelque part.
//
// 🔴 `handleSlotPostpone` a changé de NATURE le même jour (retour utilisateur).
// La version d'avant (R-18) recalculait « demain, même heure, même fuseau » et
// déplaçait le créneau — donc la tâche restait « ✓ Déjà planifiée » dans la
// sidebar (`TaskSidebar.isTaskPlacedInCalendar` : un événement existe encore
// avec ce `taskId`). Ce n'est PAS ce que « Reporter » doit dire : une tâche
// reportée doit redevenir une tâche NON PLACÉE, à glisser sur un nouveau
// créneau quand la personne le décide elle-même — pas se voir réattribuer une
// heure devinée par l'app. « Reporter » DÉTACHE donc le créneau (l'événement
// est supprimé, la tâche ne l'est pas), avec la même annulation que toute
// suppression du produit (R-07). Le calcul « demain à la même heure » et ses
// imports de fuseau (`fromDisplayISO`/`toDisplayISO`/`displayNow`) partent
// avec lui : il n'y a plus de nouvelle date à poser.

import { showUndoToast } from '@/lib/undo-toast';
import { findOverdueTaskSlots, findDoneTaskEvents, type OverdueTaskSlot } from './overdue-slots';
import type { Task } from '@/modules/tasks/types';
import type { CalendarEvent } from '@/modules/events';
import React from 'react';

/** Ce dont la revue a besoin pour agir, sans rien savoir de React Query. */
interface OverdueSlotReviewDeps {
  events: CalendarEvent[];
  tasks: Task[];
  /** Bascule la complétion d'une tâche (la file ne contient que des non complétées). */
  toggleTaskComplete: (taskId: string) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  deleteTask: (taskId: string) => void;
  /** Recree l'evenement supprime, sous SON identifiant (annulation). */
  restoreEvent: (event: CalendarEvent) => void;
  /** Recree la tache supprimee, sous SON identifiant (annulation). */
  restoreTask: (task: Task) => void;
  /** Libellé du toast d'annulation (suppression tâche + créneau), traduit par l'appelant. */
  deletedLabel: string;
  /** Libellé du toast d'annulation (créneau détaché par « Reporter »), traduit par l'appelant. */
  postponedLabel: string;
}

export function useOverdueSlotReview({
  events,
  tasks,
  toggleTaskComplete,
  updateEvent,
  deleteEvent,
  deleteTask,
  restoreEvent,
  restoreTask,
  deletedLabel,
  postponedLabel,
}: OverdueSlotReviewDeps) {
  // ⚠️ Plus AUCUN état local ici, et c'est le cœur du changement. L'ensemble
  // est entièrement dérivé des événements : « ignoré » est une colonne
  // (`reviewDismissedAt`, mig. 146), « validé » est la tâche cochée, « reporté »
  // est un créneau qui n'existe plus (détaché, cf. plus haut). Un `useState` de
  // session aurait fait revenir toutes les pastilles au premier rechargement,
  // ce qui est sans conséquence pour une popup qu'on chasse d'un geste mais pas
  // pour un marqueur qui reste peint sur le calendrier.
  const overdueSlots = React.useMemo(
    () => findOverdueTaskSlots(events, tasks),
    [events, tasks],
  );

  /** Les identifiants d'événement qui portent une pastille. */
  const reviewEventIds = React.useMemo(
    () => new Set(overdueSlots.map((s) => s.event.id)),
    [overdueSlots],
  );

  /** Les identifiants d'événement qui portent un check (tâche déjà validée). */
  const doneEventIds = React.useMemo(
    () => findDoneTaskEvents(events, tasks),
    [events, tasks],
  );

  const findSlot = (eventId: string) =>
    overdueSlots.find((s) => s.event.id === eventId) ?? null;

  // Réalisée → valide la tâche côté tâche (comme partout ailleurs : toggle +
  // toast d'annulation). Filtrée à « non complétée », donc le toggle = valider.
  const handleSlotValidate = (slot: OverdueTaskSlot) => {
    if (!slot.task.completed) toggleTaskComplete(slot.task.id);
  };

  // Reporter → détache le créneau (l'événement est supprimé, la TÂCHE ne
  // l'est pas). La tâche redevient « non placée » dans la sidebar
  // (`TaskSidebar.isTaskPlacedInCalendar` ne trouve plus d'événement portant
  // son id) : à la personne de la glisser sur un nouveau créneau quand elle le
  // décide, plutôt que de recevoir une heure devinée par l'app. Réversible
  // (toast « Annuler », R-07) : annuler remet le MÊME événement, à la MÊME
  // heure, sous SON identifiant (R-08).
  const handleSlotPostpone = (slot: OverdueTaskSlot) => {
    const eventSnapshot = slot.event;
    deleteEvent(eventSnapshot.id);
    showUndoToast(postponedLabel, () => restoreEvent(eventSnapshot));
  };

  // Abandonner → supprime la tâche et son créneau agenda, AVEC annulation.
  //
  // 🔴 R-07. C'était la seule action irréversible du produit, et elle se
  // trouvait dans le seul modal qui s'ouvre sans qu'on l'ait demandé : un clic
  // mal placé sur un dialogue inattendu détruisait une tâche définitivement,
  // alors que toutes les autres suppressions ont leur toast « Annuler ».
  //
  // Les deux objets reviennent sous LEURS identifiants (R-08), sinon la tâche
  // restaurée perdrait son rattachement à ses listes et à son KR.
  const handleSlotDelete = (slot: OverdueTaskSlot) => {
    const eventSnapshot = slot.event;
    const taskSnapshot = slot.task;
    deleteEvent(eventSnapshot.id);
    deleteTask(taskSnapshot.id);
    showUndoToast(deletedLabel, () => {
      restoreTask(taskSnapshot);
      restoreEvent(eventSnapshot);
    });
  };

  // Ignorer → la seule des quatre actions qui ne laisse aucune trace ailleurs
  // (valider coche la tâche, reporter détache le créneau, supprimer supprime).
  // Elle a donc sa propre colonne, écrite ici.
  const handleSlotIgnore = (slot: OverdueTaskSlot) => {
    updateEvent(slot.event.id, { reviewDismissedAt: new Date().toISOString() });
  };

  return {
    overdueSlots,
    reviewEventIds,
    doneEventIds,
    findSlot,
    handleSlotValidate,
    handleSlotPostpone,
    handleSlotDelete,
    handleSlotIgnore,
  };
}
