// ═══════════════════════════════════════════════════════════════════
// EVENTS MODULE - Repository Pattern Implementation
// ═══════════════════════════════════════════════════════════════════

import { CalendarEvent, CreateEventInput, UpdateEventInput, EventFilters } from './types';
import { EVENTS_STORAGE_KEY } from './constants';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';

// ═══════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════

const DEMO_EVENTS: CalendarEvent[] = [
  {
    id: 'event-1',
    title: 'Réunion d\'équipe',
    start: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
    end: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(),
    color: '#3B82F6',
    description: 'Point hebdomadaire avec l\'équipe',
  },
  {
    id: 'event-2',
    title: 'Déjeuner client',
    start: new Date(new Date().setHours(12, 30, 0, 0)).toISOString(),
    end: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
    color: '#10B981',
    description: 'Restaurant Le Petit Bistrot',
  },
  {
    id: 'event-3',
    title: 'Formation React',
    start: new Date(new Date().setHours(15, 0, 0, 0)).toISOString(),
    end: new Date(new Date().setHours(17, 0, 0, 0)).toISOString(),
    color: '#8B5CF6',
    description: 'Module avancé sur les hooks',
  },
  {
    id: 'event-4',
    title: 'Sport',
    start: new Date(new Date().setHours(18, 30, 0, 0)).toISOString(),
    end: new Date(new Date().setHours(19, 30, 0, 0)).toISOString(),
    color: '#EF4444',
    description: 'Séance de running',
  },
];

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface IEventsRepository {
  // Read operations
  getAll(): Promise<CalendarEvent[]>;
  getById(id: string): Promise<CalendarEvent | null>;
  getByTaskId(taskId: string): Promise<CalendarEvent[]>;
  getFiltered(filters: EventFilters): Promise<CalendarEvent[]>;
  getPage(params?: PaginationParams): Promise<PaginatedResult<CalendarEvent>>;

  // Write operations
  create(input: CreateEventInput): Promise<CalendarEvent>;
  update(id: string, updates: UpdateEventInput): Promise<CalendarEvent>;
  delete(id: string): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════
// LOCAL STORAGE REPOSITORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class LocalStorageEventsRepository implements IEventsRepository {
  /**
   * Get all events from localStorage (or initialize with demo data)
   */
  private getEvents(): CalendarEvent[] {
    const data = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (!data) {
      this.saveEvents(DEMO_EVENTS);
      return DEMO_EVENTS;
    }
    return JSON.parse(data);
  }

  /**
   * Save events to localStorage
   */
  private saveEvents(events: CalendarEvent[]): void {
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
  }

  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<CalendarEvent[]> {
    return this.getEvents();
  }

  async getById(id: string): Promise<CalendarEvent | null> {
    const events = this.getEvents();
    return events.find(e => e.id === id) || null;
  }

  async getByTaskId(taskId: string): Promise<CalendarEvent[]> {
    const events = this.getEvents();
    return events.filter(e => e.taskId === taskId);
  }

  async getFiltered(filters: EventFilters): Promise<CalendarEvent[]> {
    let events = this.getEvents();

    if (filters.taskId) {
      events = events.filter(e => e.taskId === filters.taskId);
    }

    if (filters.startAfter) {
      events = events.filter(e => e.start >= filters.startAfter!);
    }

    if (filters.startBefore) {
      events = events.filter(e => e.start <= filters.startBefore!);
    }

    if (filters.endAfter) {
      events = events.filter(e => e.end >= filters.endAfter!);
    }

    if (filters.endBefore) {
      events = events.filter(e => e.end <= filters.endBefore!);
    }

    return events;
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateEventInput): Promise<CalendarEvent> {
    const events = this.getEvents();
    const newEvent: CalendarEvent = {
      ...input,
      id: crypto.randomUUID(),
    };
    this.saveEvents([...events, newEvent]);
    return newEvent;
  }

  async update(id: string, updates: UpdateEventInput): Promise<CalendarEvent> {
    const events = this.getEvents();
    const index = events.findIndex(e => e.id === id);

    if (index === -1) {
      throw new Error(`Event with id ${id} not found`);
    }

    const updatedEvent: CalendarEvent = { ...events[index], ...updates };
    events[index] = updatedEvent;
    this.saveEvents(events);
    return updatedEvent;
  }

  async delete(id: string): Promise<void> {
    const events = this.getEvents();
    const filtered = events.filter(e => e.id !== id);

    if (filtered.length === events.length) {
      throw new Error(`Event with id ${id} not found`);
    }

    this.saveEvents(filtered);
  }

  async getPage(params: PaginationParams = {}): Promise<PaginatedResult<CalendarEvent>> {
    const events = this.getEvents();
    const limit = params.limit ?? DEFAULT_PAGE_SIZE;
    let startIndex = 0;
    if (params.cursor) {
      const cursorIndex = events.findIndex(e => e.id === params.cursor);
      if (cursorIndex !== -1) startIndex = cursorIndex + 1;
    }
    const slice = events.slice(startIndex, startIndex + limit + 1);
    const hasMore = slice.length > limit;
    const items = hasMore ? slice.slice(0, limit) : slice;
    return {
      data: items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      nextCursorDate: null,
    };
  }
}
