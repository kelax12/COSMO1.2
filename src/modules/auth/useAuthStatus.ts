import { useAuth } from './AuthContext';

export const useAuthStatus = () => {
  const { isAuthenticated, isDemo, isLoading } = useAuth();
  
  return {
    isAuthenticated,
    isDemo,
    isLoading
  };
};
