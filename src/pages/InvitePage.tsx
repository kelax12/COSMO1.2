import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/AuthContext';
import { isValidInviteToken, PENDING_INVITE_STORAGE_KEY } from '@/modules/friends';

/**
 * Route publique `/invite/:token` — point d'entrée des liens d'invitation de
 * partage de tâche (mig. 046). Ne claim PAS le lien elle-même : elle pose le
 * token dans localStorage puis redirige. C'est `ShareInviteClaimer` (monté au
 * niveau App) qui claim dès que l'utilisateur est authentifié et affiche la
 * popup Accepter/Refuser. Un seul mécanisme couvre les 3 cas :
 *   - déjà connecté        → '/' → popup immédiate ;
 *   - compte existant      → '/login' → popup après connexion ;
 *   - pas de compte        → '/signup' → popup à la fin de l'inscription.
 */
const InvitePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, isDemo } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isValidInviteToken(token)) {
      toast.error("Ce lien d'invitation est invalide.");
      navigate('/', { replace: true });
      return;
    }

    try {
      localStorage.setItem(PENDING_INVITE_STORAGE_KEY, token);
    } catch {
      /* localStorage indisponible : on continue, le claim échouera proprement */
    }

    if (isAuthenticated && !isDemo) {
      // ShareInviteClaimer (App-level) détecte le flag et claim aussitôt.
      navigate('/', { replace: true });
    } else {
      toast.info('Créez un compte ou connectez-vous pour voir la tâche partagée.');
      navigate('/signup', { replace: true });
    }
  }, [token, isAuthenticated, isLoading, isDemo, navigate]);

  // Écran de transition minimal (le redirect est quasi instantané).
  return (
    <main className="min-h-[100dvh] flex items-center justify-center" aria-busy="true">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
        <h1 className="text-sm text-slate-500">Ouverture de l'invitation…</h1>
      </div>
    </main>
  );
};

export default InvitePage;
