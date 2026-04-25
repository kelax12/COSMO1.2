// ═══════════════════════════════════════════════════════════════════
// EVENTS MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type {
  CalendarEvent,
  CreateEventInput,
  UpdateEventInput,
  EventFilters,
  EventRecurrence,
} from './types';

export { expandRecurringEvents, getMasterId, isInstanceId } from './recurrence';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS & QUERY KEYS
// ═══════════════════════════════════════════════════════════════════

export { eventsKeys, EVENTS_STORAGE_KEY } from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════

export type { IEventsRepository } from './repository';
export { LocalStorageEventsRepository } from './repository';

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

export {
  useEvents,
  useEvent,
  useEventsByTask,
} from './hooks';

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Mutations)
// ═══════════════════════════════════════════════════════════════════

export {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from './hooks';
