// ═══════════════════════════════════════════════════════════════════
// EVENTS MODULE - Interface du repository (contrat des deux implémentations)
// ═══════════════════════════════════════════════════════════════════
//
// Forme unique (V12.3, src/modules/CLAUDE.md § Forme d'un module) : ce fichier ne
// porte que l'interface et ses types. Démo : `local.repository.ts`, seed :
// `local.seed.ts`, production : `supabase.repository.ts`.

import type { CalendarEvent, CreateEventInput, UpdateEventInput, EventFilters } from './types';
import type { PaginationParams, PaginatedResult } from '@/lib/pagination.types';
import type { CreateOptions } from '@/lib/restore-id';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface IEventsRepository {
  // Read operations
  getAll(): Promise<CalendarEvent[]>;
  getFiltered(filters: EventFilters): Promise<CalendarEvent[]>;
  getPage(params?: PaginationParams): Promise<PaginatedResult<CalendarEvent>>;
  /** Événements de la fenêtre [startISO, endISO] + TOUS les récurrents (cf. window.ts). */
  getWindow(startISO: string, endISO: string): Promise<CalendarEvent[]>;
  /**
   * Tous les événements PERSONNELS liés à une tâche (`task_id` non nul), sans
   * plafond (V14.2). C'est ce que lit la barre de tâches de l'agenda pour dire
   * si une tâche est déjà placée, où que soit son créneau dans le temps : la
   * fenêtre visible n'y suffit pas, l'historique complet n'y sert à rien.
   */
  getLinkedToTasks(): Promise<CalendarEvent[]>;
  /**
   * Agenda d'un AUTRE membre (mode entreprise) : réservé à sa hiérarchie
   * (RLS `events_manager_select`, mig. 077). Même sémantique que getWindow.
   */
  getWindowForUser(userId: string, startISO: string, endISO: string): Promise<CalendarEvent[]>;

  // Write operations
  create(input: CreateEventInput, options?: CreateOptions): Promise<CalendarEvent>;
  /** Crée un événement DANS l'agenda d'un subordonné (manager — RLS mig. 077). */
  createForUser(userId: string, input: CreateEventInput): Promise<CalendarEvent>;
  update(id: string, updates: UpdateEventInput): Promise<CalendarEvent>;
  delete(id: string): Promise<void>;
}
