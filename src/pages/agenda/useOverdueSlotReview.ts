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
// ⚠️ `handleSlotPostpone` calcule TOUT dans l'espace d'affichage (l'heure du
// fuseau choisi) puis retire le décalage une seule fois à la fin. C'est le
// correctif R-18 : la version d'avant lisait l'heure de départ et posait
// « demain » en heure machine, donc le créneau reporté ne revenait pas à
// l'heure attendue pour qui a réglé un fuseau manuel.

import React from 'react';
import { findOverdueTaskSlots, type OverdueTaskSlot } from './overdue-slots';
import { showUndoToast } from '@/lib/undo-toast';
import { fromDisplayISO, toDisplayISO, displayNow, type TimezonePref } from '@/lib/timezone';
import type { Task } from '@/modules/tasks/types';
import type { CalendarEvent } from '@/modules/events';

/** Ce dont la revue a besoin pour agir, sans rien savoir de React Query. */
interface OverdueSlotReviewDeps {
  events: CalendarEvent[];
  tasks: Task[];
  tzPref: TimezonePref;
  /** Bascule la complétion d'une tâche (la file ne contient que des non complétées). */
  toggleTaskComplete: (taskId: string) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  deleteTask: (taskId: string) => void;
  /** Recree l'evenement supprime, sous SON identifiant (annulation). */
  restoreEvent: (event: CalendarEvent) => void;
  /** Recree la tache supprimee, sous SON identifiant (annulation). */
  restoreTask: (task: Task) => void;
  /** Libellé du toast d'annulation, traduit par l'appelant. */
  deletedLabel: string;
}

export function useOverdueSlotReview({
  events,
  tasks,
  tzPref,
  toggleTaskComplete,
  updateEvent,
  deleteEvent,
  deleteTask,
  restoreEvent,
  restoreTask,
  deletedLabel,
}: OverdueSlotReviewDeps) {
  // ⚠️ Plus AUCUN état local ici, et c'est le cœur du changement. L'ensemble
  // est entièrement dérivé des événements : « ignoré » est une colonne
  // (`reviewDismissedAt`, mig. 146), « validé » est la tâche cochée, « reporté »
  // est un créneau dont la fin est repassée dans le futur. Un `useState` de
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

  const findSlot = (eventId: string) =>
    overdueSlots.find((s) => s.event.id === eventId) ?? null;

  // Réalisée → valide la tâche côté tâche (comme partout ailleurs : toggle +
  // toast d'annulation). Filtrée à « non complétée », donc le toggle = valider.
  const handleSlotValidate = (slot: OverdueTaskSlot) => {
    if (!slot.task.completed) toggleTaskComplete(slot.task.id);
  };

  // Reporter → replace le créneau à DEMAIN (relatif à maintenant) en conservant
  // l'heure de début et la durée d'origine. Toujours dans le futur, même pour un
  // créneau en retard de plusieurs jours (sinon le modal réapparaîtrait).
  const handleSlotPostpone = (slot: OverdueTaskSlot) => {
    const origDisplay = new Date(toDisplayISO(slot.event.start, tzPref));
    const durationMs = Math.max(
      new Date(slot.event.end).getTime() - new Date(slot.event.start).getTime(),
      0,
    );
    const next = displayNow(tzPref);
    next.setDate(next.getDate() + 1);
    next.setHours(origDisplay.getHours(), origDisplay.getMinutes(), 0, 0);
    const newStart = fromDisplayISO(next.toISOString(), tzPref);
    const newEnd = fromDisplayISO(
      new Date(next.getTime() + durationMs).toISOString(),
      tzPref,
    );
    // `reviewDismissedAt: null` part dans la MÊME mise à jour que les horaires :
    // reporter un créneau qu'on avait ignoré le remet dans la file s'il est
    // raté une seconde fois. Sans ça, « Ignorer » puis « Reporter » éteindrait
    // la pastille pour toujours.
    updateEvent(slot.event.id, { start: newStart, end: newEnd, reviewDismissedAt: null });
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
  // (valider coche la tâche, reporter déplace le créneau, supprimer supprime).
  // Elle a donc sa propre colonne, écrite ici.
  const handleSlotIgnore = (slot: OverdueTaskSlot) => {
    updateEvent(slot.event.id, { reviewDismissedAt: new Date().toISOString() });
  };

  return {
    overdueSlots,
    reviewEventIds,
    findSlot,
    handleSlotValidate,
    handleSlotPostpone,
    handleSlotDelete,
    handleSlotIgnore,
  };
}
