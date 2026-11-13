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
// `LocalStorageEventsRepository` n'est PAS ré-exporté (V12.3) : il vit dans
// `./local.repository` et n'arrive que par `import()`, depuis le factory.

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

export {
  useEvents,
  useLoadAllEvents,
  useEventsWindow,
  useTaskLinkedEvents,
  useMemberEventsWindow,
  useUpcomingEvents,
  useGroupEventsWindow,
} from './hooks';

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Mutations)
// ═══════════════════════════════════════════════════════════════════

export {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useRestoreEvent,
  useCreateMemberEvent,
  useUpdateMemberEvent,
  useDeleteMemberEvent,
  useCreateGroupEvent,
} from './hooks';
export type { GroupEventResult } from './hooks';
