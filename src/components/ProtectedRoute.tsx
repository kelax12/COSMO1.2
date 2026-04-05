import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/modules/auth/AuthContext';

/**
 * ProtectedRoute — Redirects unauthenticated users to /login
 * Preserves the original destination via `state.from` for post-login redirect
 */
const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Don't redirect while auth is initializing (avoids flash redirect)
  if (isLoading) {
    return (
      <div className=\"min-h-screen bg-slate-950 flex items-center justify-center\">
        <div className=\"animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500\" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to=\"/login\" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
