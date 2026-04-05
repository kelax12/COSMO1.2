// ═══════════════════════════════════════════════════════════════════
// Repository Factory - Centralized repository selection
// ═══════════════════════════════════════════════════════════════════

import { appModeStore } from './app-mode.store';

// Tasks
import { ITasksRepository } from '@/modules/tasks/repository';
import { LocalStorageTasksRepository } from '@/modules/tasks/local.repository';
import { SupabaseTasksRepository } from '@/modules/tasks/supabase.repository';

// Habits
import { IHabitsRepository } from '@/modules/habits/repository';
import { LocalStorageHabitsRepository } from '@/modules/habits/local.repository';
import { SupabaseHabitsRepository } from '@/modules/habits/supabase.repository';

// Events
import { IEventsRepository } from '@/modules/events/repository';
import { LocalStorageEventsRepository } from '@/modules/events/repository';
import { SupabaseEventsRepository } from '@/modules/events/supabase.repository';

// Categories
import { ICategoriesRepository } from '@/modules/categories/repository';
import { LocalStorageCategoriesRepository } from '@/modules/categories/repository';
import { SupabaseCategoriesRepository } from '@/modules/categories/supabase.repository';

// Lists
import { IListsRepository } from '@/modules/lists/repository';
import { LocalStorageListsRepository } from '@/modules/lists/repository';
import { SupabaseListsRepository } from '@/modules/lists/supabase.repository';

// Friends
import { IFriendsRepository } from '@/modules/friends/repository';
import { LocalStorageFriendsRepository } from '@/modules/friends/repository';
import { SupabaseFriendsRepository } from '@/modules/friends/supabase.repository';

// OKRs
import { IOKRsRepository } from '@/modules/okrs/repository';
import { LocalStorageOKRsRepository } from '@/modules/okrs/repository';
import { SupabaseOKRsRepository } from '@/modules/okrs/supabase.repository';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY SINGLETONS
// ═══════════════════════════════════════════════════════════════════

let tasksRepository: ITasksRepository | null = null;
let habitsRepository: IHabitsRepository | null = null;
let eventsRepository: IEventsRepository | null = null;
let categoriesRepository: ICategoriesRepository | null = null;
let listsRepository: IListsRepository | null = null;
let friendsRepository: IFriendsRepository | null = null;
let okrsRepository: IOKRsRepository | null = null;

// ═══════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get the Tasks repository based on current mode
 */
export function getTasksRepository(): ITasksRepository {
  if (!tasksRepository) {
    tasksRepository = appModeStore.isDemo
      ? new LocalStorageTasksRepository()
      : new SupabaseTasksRepository();
  }
  return tasksRepository;
}

/**
 * Get the Habits repository based on current mode
 */
export function getHabitsRepository(): IHabitsRepository {
  if (!habitsRepository) {
    habitsRepository = appModeStore.isDemo
      ? new LocalStorageHabitsRepository()
      : new SupabaseHabitsRepository();
  }
  return habitsRepository;
}

/**
 * Get the Events repository based on current mode
 */
export function getEventsRepository(): IEventsRepository {
  if (!eventsRepository) {
    eventsRepository = appModeStore.isDemo
      ? new LocalStorageEventsRepository()
      : new SupabaseEventsRepository();
  }
  return eventsRepository;
}

/**
 * Get the Categories repository based on current mode
 */
export function getCategoriesRepository(): ICategoriesRepository {
  if (!categoriesRepository) {
    categoriesRepository = appModeStore.isDemo
      ? new LocalStorageCategoriesRepository()
      : new SupabaseCategoriesRepository();
  }
  return categoriesRepository;
}

/**
 * Get the Lists repository based on current mode
 */
export function getListsRepository(): IListsRepository {
  if (!listsRepository) {
    listsRepository = appModeStore.isDemo
      ? new LocalStorageListsRepository()
      : new SupabaseListsRepository();
  }
  return listsRepository;
}

/**
 * Get the Friends repository based on current mode
 */
export function getFriendsRepository(): IFriendsRepository {
  if (!friendsRepository) {
    friendsRepository = appModeStore.isDemo
      ? new LocalStorageFriendsRepository()
      : new SupabaseFriendsRepository();
  }
  return friendsRepository;
}

/**
 * Get the OKRs repository based on current mode
 */
export function getOKRsRepository(): IOKRsRepository {
  if (!okrsRepository) {
    okrsRepository = appModeStore.isDemo
      ? new LocalStorageOKRsRepository()
      : new SupabaseOKRsRepository();
  }
  return okrsRepository;
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if app is running in demo mode
 */
export function isInDemoMode(): boolean {
  return appModeStore.isDemo;
}

/**
 * Reset all repository singletons (useful for testing)
 */
export function resetRepositories(): void {
  tasksRepository = null;
  habitsRepository = null;
  eventsRepository = null;
  categoriesRepository = null;
  listsRepository = null;
  friendsRepository = null;
  okrsRepository = null;
}
