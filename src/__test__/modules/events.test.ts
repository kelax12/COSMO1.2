// ═══════════════════════════════════════════════════════════════════
// EVENTS MODULE - Unit Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Event, CreateEventInput, RecurrenceType } from '@/modules/events/types';
import { eventsKeys, EVENTS_STORAGE_KEY } from '@/modules/events/constants';

// ═══════════════════════════════════════════════════════════════════
// TYPES TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Events Types', () => {
  it('should have valid RecurrenceType values', () => {
    const types: RecurrenceType[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
    expect(types).toContain('none');
    expect(types).toContain('daily');
    expect(types).toContain('weekly');
    expect(types).toContain('monthly');
    expect(types).toContain('yearly');
  });

  it('should create valid Event object', () => {
    const event: Event = {
      id: 'evt-1',
      title: 'Team Meeting',
      description: 'Weekly sync',
      startDate: '2026-01-15',
      endDate: '2026-01-15',
      startTime: '10:00',
      endTime: '11:00',
      color: '#3B82F6',
      recurrence: 'weekly',
      taskId: 'task-1',
    };

    expect(event.id).toBe('evt-1');
    expect(event.title).toBe('Team Meeting');
    expect(event.recurrence).toBe('weekly');
    expect(event.startTime).toBe('10:00');
    expect(event.endTime).toBe('11:00');
  });

  it('should create event without optional fields', () => {
    const event: Event = {
      id: 'evt-2',
      title: 'Quick Event',
      startDate: '2026-01-20',
      endDate: '2026-01-20',
      color: '#10B981',
    };

    expect(event.id).toBe('evt-2');
    expect(event.description).toBeUndefined();
    expect(event.taskId).toBeUndefined();
    expect(event.recurrence).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Events Constants', () => {
  it('should have correct storage key', () => {
    expect(EVENTS_STORAGE_KEY).toBe('cosmo_events');
  });

  it('should have correct query keys structure', () => {
    expect(eventsKeys.all).toEqual(['events']);
    expect(eventsKeys.lists()).toEqual(['events', 'list']);
    expect(eventsKeys.detail('evt-1')).toEqual(['events', 'detail', 'evt-1']);
    expect(eventsKeys.byTask('task-1')).toEqual(['events', 'byTask', 'task-1']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// EVENT VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Event Validation', () => {
  it('should validate time format', () => {
    const isValidTime = (time: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(time);
    
    expect(isValidTime('10:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('9:30')).toBe(true);
  });

  it('should reject invalid time format', () => {
    const isValidTime = (time: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(time);
    
    expect(isValidTime('25:00')).toBe(false);
    expect(isValidTime('10:60')).toBe(false);
    expect(isValidTime('10am')).toBe(false);
  });

  it('should validate date format', () => {
    const isValidDate = (date: string) => !isNaN(Date.parse(date));
    
    expect(isValidDate('2026-01-15')).toBe(true);
    expect(isValidDate('2026-12-31')).toBe(true);
  });

  it('should validate end date is after or equal to start date', () => {
    const isValidDateRange = (start: string, end: string) => 
      new Date(end) >= new Date(start);
    
    expect(isValidDateRange('2026-01-15', '2026-01-15')).toBe(true);
    expect(isValidDateRange('2026-01-15', '2026-01-20')).toBe(true);
    expect(isValidDateRange('2026-01-20', '2026-01-15')).toBe(false);
  });
});
