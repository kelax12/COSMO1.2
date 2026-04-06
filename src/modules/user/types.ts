// Re-export du type User depuis la source de vérité
export type { User } from '@/modules/auth/AuthContext';

export interface Message {
  id: string;
  read: boolean;
  content: string;
  senderId?: string;
  timestamp?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isDemo: boolean;
  loading: boolean;
}
