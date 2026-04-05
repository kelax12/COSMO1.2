// ═══════════════════════════════════════════════════════════════════
// USER MODULE - Type Definitions
// ═══════════════════════════════════════════════════════════════════

/**
 * User - Represents the current authenticated user
 */
export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

/**
 * Message - User notification/message
 */
export interface Message {
  id: string;
  read: boolean;
  content: string;
  senderId?: string;
  timestamp?: string;
}

/**
 * Auth state
 */
export interface AuthState {
  isAuthenticated: boolean;
  isDemo: boolean;
  loading: boolean;
}
