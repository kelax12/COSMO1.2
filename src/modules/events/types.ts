// ═══════════════════════════════════════════════════════════════════
// EVENTS MODULE - Type Definitions
// ═══════════════════════════════════════════════════════════════════

/**
 * CalendarEvent - Represents a calendar event
 * 
 * Events can optionally be linked to a Task via taskId
 */
/**
 * EventRecurrence — fréquence de répétition d'un événement
 * - 'none'   : événement unique (par défaut)
 * - 'daily'  : tous les jours à la même heure
 * - 'weekly' : toutes les semaines au même jour de la semaine + heure
 * - 'custom' : sur des jours de semaine choisis (cf. recurrenceDays)
 */
export type EventRecurrence = 'none' | 'daily' | 'weekly' | 'custom';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;        // ISO date string
  end: string;          // ISO date string
  color?: string;       // Hex color for display
  description?: string; // Detailed description
  notes?: string;       // Additional notes
  taskId?: string;      // Optional link to a Task
  recurrence?: EventRecurrence; // Défaut: 'none'
  // Jours de la semaine (0=dimanche … 6=samedi) pour recurrence === 'custom'
  recurrenceDays?: number[];
  // Dates YYYY-MM-DD des occurrences supprimées individuellement (ne supprime pas le master)
  exceptions?: string[];
  /**
   * auth.users.id de l'AUTEUR. Diffère du propriétaire (user_id, implicite)
   * uniquement quand un manager a créé l'événement dans l'agenda d'un
   * subordonné (mode entreprise, mig. 079). Sert à afficher l'avatar du
   * créateur pour distinguer perso / pro. Absent en création (posé serveur).
   */
  createdBy?: string;
}

/**
 * Input type for creating a new event
 * - id is generated automatically
 */
export type CreateEventInput = Omit<CalendarEvent, 'id'>;

/**
 * Input type for updating an existing event
 * - All fields except id are optional
 */
export type UpdateEventInput = Partial<Omit<CalendarEvent, 'id'>>;

/**
 * Filter options for querying events
 */
export interface EventFilters {
  taskId?: string;
  startAfter?: string;
  startBefore?: string;
  endAfter?: string;
  endBefore?: string;
}
