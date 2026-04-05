// ═══════════════════════════════════════════════════════════════════
// USER MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

import { User } from './types';

/**
 * LocalStorage key for user data
 */
export const USER_STORAGE_KEY = 'cosmo_user';
export const MESSAGES_STORAGE_KEY = 'cosmo_messages';

/**
 * Demo user for development/demo mode
 */
export const DEMO_USER: User = {
  id: 'demo-user',
  name: 'Demo',
  email: 'demo@cosmo.app',
  avatar: '👤',
};

/**
 * React Query keys for user
 */
export const userKeys = {
  all: ['user'] as const,
  current: () => [...userKeys.all, 'current'] as const,
  messages: () => [...userKeys.all, 'messages'] as const,
  settings: () => [...userKeys.all, 'settings'] as const,
};
