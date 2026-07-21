// Résolution d'un événement calendrier à partir des données brutes fournies
// par FullCalendar (eventClick/eventDrop/eventResize/long-press).
import { getMasterId, type CalendarEvent } from '@/modules/events';

/**
 * Retrouve l'événement « source » (master) correspondant à un id FullCalendar
 * (potentiellement une instance récurrente `master::YYYY-MM-DD`) et, en repli
 * uniquement, à un `taskId`.
 *
 * PRIORITÉ ABSOLUE à l'id exact. Deux événements peuvent légitimement partager
 * le même `taskId` (la même tâche planifiée à deux créneaux différents, ou une
 * copie créée via « Dupliquer »). Un simple `find` avec un OU (`e.id === X ||
 * e.taskId === Y`) n'a AUCUNE priorité entre les deux branches : il retourne le
 * premier élément du tableau qui satisfait l'une OU l'autre, donc quand deux
 * événements partagent un taskId, on peut se retrouver à agir sur le MAUVAIS
 * (celui qui apparaît en premier dans le tableau) au lieu de celui réellement
 * cliqué/glissé — symptôme observé : après un drag, l'événement rouvert dans
 * la modale affiche encore ses ANCIENS horaires (c'est en fait un AUTRE
 * événement, homonyme par taskId, qui vient d'être mis à jour à sa place).
 *
 * Le fallback par taskId ne sert qu'au cas où l'id exact n'existe pas encore
 * dans le cache (ex. juste après un drop depuis la sidebar tâches, avant que
 * React Query ait reçu l'id serveur définitif).
 */
export function findSourceEvent(
  events: CalendarEvent[],
  rawId: string,
  taskId?: string,
): CalendarEvent | undefined {
  const masterId = getMasterId(rawId);
  const byId = events.find((e) => e.id === masterId);
  if (byId) return byId;
  return taskId ? events.find((e) => e.taskId === taskId) : undefined;
}
