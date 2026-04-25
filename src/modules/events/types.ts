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
 */
export type EventRecurrence = 'none' | 'daily' | 'weekly';

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
