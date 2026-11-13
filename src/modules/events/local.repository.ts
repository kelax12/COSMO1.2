// ═══════════════════════════════════════════════════════════════════
// EVENTS MODULE - Implémentation de démo (localStorage)
// ═══════════════════════════════════════════════════════════════════

import { CalendarEvent, CreateEventInput, UpdateEventInput, EventFilters } from './types';
import { EVENTS_STORAGE_KEY } from './constants';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';
import { selectEventsInWindow } from './window';
import type { CreateOptions } from '@/lib/restore-id';
import { safeGetItem, safeParseArray, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import type { IEventsRepository } from './repository';
import { DEMO_EVENTS, seedMemberEvents, KNOWN_DEMO_MEMBER_IDS } from './local.seed';

const MEMBER_EVENTS_STORAGE_KEY = 'cosmo_demo_member_events';

// Mêmes refus et mêmes valeurs par défaut que la base (contrat de parité V12.2) :
// CHECK `end_after_start` (mig. 004), CHECK `events_recurrence_check` (mig. 010, 030),
// défauts de colonnes (`recurrence`, `recurrence_days`, `exceptions`, `is_private`)
// que `mapEventFromDb` rend à la lecture.
const RECURRENCES: ReadonlySet<string> = new Set(['none', 'daily', 'weekly', 'custom']);

function assertEvent(e: Pick<CalendarEvent, 'start' | 'end' | 'recurrence'>): void {
  if (e.recurrence !== undefined && !RECURRENCES.has(e.recurrence)) throw makeApiError('invalid_input');
  const start = Date.parse(e.start);
  const end = Date.parse(e.end);
  if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) throw makeApiError('invalid_input');
}

/** Une entrée de création, avec les valeurs que la base lui donnerait. */
function withDbDefaults(input: CreateEventInput): CreateEventInput {
  assertEvent(input);
  return {
    ...input,
    recurrence: input.recurrence ?? 'none',
    recurrenceDays: input.recurrenceDays ?? [],
    exceptions: input.exceptions ?? [],
    isPrivate: input.isPrivate ?? false,
    reviewDismissedAt: input.reviewDismissedAt ?? null,
  };
}

const byStartAsc = (a: CalendarEvent, b: CalendarEvent): number =>
  Date.parse(a.start) - Date.parse(b.start) || a.id.localeCompare(b.id);

// ═══════════════════════════════════════════════════════════════════
// LOCAL STORAGE REPOSITORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class LocalStorageEventsRepository implements IEventsRepository {
  /**
   * Get all events from localStorage (or initialize with demo data)
   */
  private getEvents(): CalendarEvent[] {
    const stored = safeParseArray<CalendarEvent>(safeGetItem(EVENTS_STORAGE_KEY));
    // Corrompu ou stockage indisponible : on re-seme plutot que de faire
    // tomber la page (regle B14, helper `safeParseArray`).
    if (!stored) {
      this.saveEvents(DEMO_EVENTS);
      return DEMO_EVENTS;
    }
    return stored;
  }

  /**
   * Save events to localStorage
   */
  private saveEvents(events: CalendarEvent[]): void {
    writeJsonOrThrow(EVENTS_STORAGE_KEY, events);
  }

  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  // Même ordre que la base : début croissant (`ORDER BY start_time, id`).
  async getAll(): Promise<CalendarEvent[]> {
    return [...this.getEvents()].sort(byStartAsc);
  }

  async getByTaskId(taskId: string): Promise<CalendarEvent[]> {
    const events = this.getEvents();
    return events.filter(e => e.taskId === taskId);
  }

  async getAllForExport(): Promise<CalendarEvent[]> {
    return this.getAll();
  }

  async getLinkedToTasks(): Promise<CalendarEvent[]> {
    return this.getEvents().filter((e) => !!e.taskId);
  }

  async getWindow(startISO: string, endISO: string): Promise<CalendarEvent[]> {
    return selectEventsInWindow(this.getEvents(), startISO, endISO).sort(byStartAsc);
  }

  // ── Agendas des membres (mode entreprise démo) ─────────────────────
  private getMemberStore(): Record<string, CalendarEvent[]> {
    const raw = safeGetItem(MEMBER_EVENTS_STORAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private saveMemberStore(store: Record<string, CalendarEvent[]>): void {
    writeJsonOrThrow(MEMBER_EVENTS_STORAGE_KEY, store);
  }

  /** Agenda d'un membre (seedé à la première lecture pour les subordonnés démo connus). */
  private getMemberEvents(userId: string): CalendarEvent[] {
    const store = this.getMemberStore();
    if (store[userId]) return store[userId];
    const seeded = KNOWN_DEMO_MEMBER_IDS.includes(userId) ? seedMemberEvents(userId) : [];
    store[userId] = seeded;
    this.saveMemberStore(store);
    return seeded;
  }

  async getWindowForUser(userId: string, startISO: string, endISO: string): Promise<CalendarEvent[]> {
    return selectEventsInWindow(this.getMemberEvents(userId), startISO, endISO);
  }

  async createForUser(userId: string, input: CreateEventInput): Promise<CalendarEvent> {
    const store = this.getMemberStore();
    const list = store[userId] ?? this.getMemberEvents(userId);
    // createdBy = le manager (utilisateur démo courant) : dans l'agenda perso
    // du subordonné, l'avatar du manager distinguera cet événement pro.
    const newEvent: CalendarEvent = { ...withDbDefaults(input), id: crypto.randomUUID(), createdBy: 'demo-user' };
    store[userId] = [...list, newEvent];
    this.saveMemberStore(store);
    return newEvent;
  }

  async getFiltered(filters: EventFilters): Promise<CalendarEvent[]> {
    let events = [...this.getEvents()].sort(byStartAsc);

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

  async create(input: CreateEventInput, options?: CreateOptions): Promise<CalendarEvent> {
    const events = this.getEvents();
    const newEvent: CalendarEvent = {
      ...withDbDefaults(input),
      // Parite avec le repository Supabase : `restoreId` vient d'un
      // « Annuler », jamais d'un formulaire (R-08).
      id: options?.restoreId ?? crypto.randomUUID(),
    };
    this.saveEvents([...events, newEvent]);
    return newEvent;
  }

  async update(id: string, updates: UpdateEventInput): Promise<CalendarEvent> {
    const events = this.getEvents();
    const index = events.findIndex(e => e.id === id);

    if (index === -1) {
      // Peut-être un événement d'un membre géré (mode entreprise démo).
      return this.updateMemberEvent(id, updates);
    }

    const updatedEvent: CalendarEvent = { ...events[index], ...updates };
    assertEvent(updatedEvent);
    events[index] = updatedEvent;
    this.saveEvents(events);
    return updatedEvent;
  }

  private updateMemberEvent(id: string, updates: UpdateEventInput): CalendarEvent {
    const store = this.getMemberStore();
    for (const uid of Object.keys(store)) {
      const idx = store[uid].findIndex(e => e.id === id);
      if (idx !== -1) {
        const updated: CalendarEvent = { ...store[uid][idx], ...updates };
        assertEvent(updated);
        store[uid][idx] = updated;
        this.saveMemberStore(store);
        return updated;
      }
    }
    throw makeApiError('not_found');
  }

  async delete(id: string): Promise<void> {
    const events = this.getEvents();
    const filtered = events.filter(e => e.id !== id);

    if (filtered.length === events.length) {
      // Peut-être un événement d'un membre géré (mode entreprise démo).
      const store = this.getMemberStore();
      for (const uid of Object.keys(store)) {
        const next = store[uid].filter(e => e.id !== id);
        if (next.length !== store[uid].length) {
          store[uid] = next;
          this.saveMemberStore(store);
          return;
        }
      }
      // Identifiant inconnu : sans effet, comme le DELETE de la base (zéro ligne,
      // pas d'erreur). Le retirer deux fois, c'est l'avoir retiré.
      return;
    }

    this.saveEvents(filtered);
  }

  async getPage(params: PaginationParams = {}): Promise<PaginatedResult<CalendarEvent>> {
    // Même ordre que la base : début décroissant (`ORDER BY start_time DESC, id DESC`).
    const events = [...this.getEvents()].sort((a, b) => byStartAsc(b, a));
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
