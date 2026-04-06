// ═══════════════════════════════════════════════════════════════════
// EVENTS MODULE - Unit Tests
// Synchronisé avec src/modules/events/types.ts
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventsKeys, EVENTS_STORAGE_KEY } from '@/modules/events/constants';
import { CalendarEvent, CreateEventInput } from '@/modules/events/types';

// ═══════════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════════

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

// ═══════════════════════════════════════════════════════════════════
// TYPES TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Events Types', () => {
  it('should create a valid CalendarEvent object', () => {
    const event: CalendarEvent = {
      id: 'event-1',
      title: 'Réunion équipe',
      startTime: '2026-01-15T10:00:00.000Z',
      endTime: '2026-01-15T11:00:00.000Z',
    };

    expect(event.id).toBe('event-1');
    expect(event.title).toBe('Réunion équipe');
    expect(event.startTime).toBeDefined();
    expect(event.endTime).toBeDefined();
  });

  it('should allow optional fields', () => {
    const event: CalendarEvent = {
      id: 'event-2',
      title: 'Sport',
      startTime: '2026-01-16T07:00:00.000Z',
      endTime: '2026-01-16T08:00:00.000Z',
      color: '#10B981',
      description: 'Session de sport matinale',
      taskId: 'task-123',
    };

    expect(event.color).toBe('#10B981');
    expect(event.taskId).toBe('task-123');
  });

  it('should create a valid CreateEventInput', () => {
    const input: CreateEventInput = {
      title: 'Démo client',
      startTime: '2026-02-01T14:00:00.000Z',
      endTime: '2026-02-01T15:00:00.000Z',
    };

    expect(input.title).toBe('Démo client');
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Events Constants', () => {
  it('should have correct storage key', () => {
    // Correction : la vraie valeur est 'cosmo_demo_events' (pas 'cosmo_events')
    expect(EVENTS_STORAGE_KEY).toBe('cosmo_demo_events');
  });

  it('should have correct query keys structure', () => {
    expect(eventsKeys.all).toEqual(['events']);
    expect(eventsKeys.lists()).toEqual(['events', 'list']);
    expect(eventsKeys.detail('event-1')).toEqual(['events', 'detail', 'event-1']);
    // Correction : byTask génère ['events', 'task', taskId] (pas 'byTask')
    expect(eventsKeys.byTask('task-1')).toEqual(['events', 'task', 'task-1']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// EVENT FILTERING LOGIC TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Event Filtering Logic', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it('should filter events by date', () => {
    const events: CalendarEvent[] = [
      { id: '1', title: 'Event A', startTime: '2026-01-15T10:00:00.000Z', endTime: '2026-01-15T11:00:00.000Z' },
      { id: '2', title: 'Event B', startTime: '2026-01-16T10:00:00.000Z', endTime: '2026-01-16T11:00:00.000Z' },
      { id: '3', title: 'Event C', startTime: '2026-01-15T14:00:00.000Z', endTime: '2026-01-15T15:00:00.000Z' },
    ];

    const targetDate = '2026-01-15';
    const filtered = events.filter((e) => e.startTime.startsWith(targetDate));

    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.startTime.startsWith(targetDate))).toBe(true);
  });

  it('should filter events linked to a specific task', () => {
    const events: CalendarEvent[] = [
      { id: '1', title: 'Event A', startTime: '2026-01-15T10:00:00.000Z', endTime: '2026-01-15T11:00:00.000Z', taskId: 'task-1' },
      { id: '2', title: 'Event B', startTime: '2026-01-16T10:00:00.000Z', endTime: '2026-01-16T11:00:00.000Z' },
      { id: '3', title: 'Event C', startTime: '2026-01-17T10:00:00.000Z', endTime: '2026-01-17T11:00:00.000Z', taskId: 'task-1' },
    ];

    const taskEvents = events.filter((e) => e.taskId === 'task-1');

    expect(taskEvents).toHaveLength(2);
  });

  it('should sort events by startTime ascending', () => {
    const events: CalendarEvent[] = [
      { id: '2', title: 'B', startTime: '2026-01-16T10:00:00.000Z', endTime: '2026-01-16T11:00:00.000Z' },
      { id: '1', title: 'A', startTime: '2026-01-15T08:00:00.000Z', endTime: '2026-01-15T09:00:00.000Z' },
      { id: '3', title: 'C', startTime: '2026-01-15T14:00:00.000Z', endTime: '2026-01-15T15:00:00.000Z' },
    ];

    const sorted = [...events].sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    expect(sorted[0].title).toBe('A');
    expect(sorted[1].title).toBe('C');
    expect(sorted[2].title).toBe('B');
  });

  it('should return empty array when no events match date', () => {
    const events: CalendarEvent[] = [
      { id: '1', title: 'Event', startTime: '2026-01-15T10:00:00.000Z', endTime: '2026-01-15T11:00:00.000Z' },
    ];

    const filtered = events.filter((e) => e.startTime.startsWith('2025-12-01'));
    expect(filtered).toHaveLength(0);
  });
});
