import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, AlertCircle, ArrowRight } from 'lucide-react';
import Logo from '@/components/Logo';
import OrgConsentNotice from '@/components/organization/OrgConsentNotice';
import { useAuth } from '@/modules/auth/AuthContext';
import { useClaimOrgInvite } from '@/modules/organizations';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Page de claim d'un lien d'invitation placé (/org-invite/:token).
 * Le lien est single-use : on demande le consentement RGPD AVANT de le
 * consommer. Déconnecté → redirection login avec retour ici après.
 */
const ClaimOrgInvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [consent, setConsent] = useState(false);
  const [joinedOrg, setJoinedOrg] = useState<string | null>(null);
  const claimMutation = useClaimOrgInvite();

  const validToken = !!token && UUID_RE.test(token);

  const handleJoin = () => {
    if (!token) return;
    claimMutation.mutate(token, {
      onSuccess: (result) => setJoinedOrg(result.orgName),
    });
  };

  return (
    <main
      className="min-h-[100dvh] flex flex-col items-center justify-center p-4 gap-6"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}
    >
      <Link to="/" aria-label="Retour à l'accueil Cosmo" className="shrink-0">
        <Logo showText />
      </Link>
      <div className="w-full max-w-md bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-3">
            <Building2 size={26} className="text-indigo-500" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
            Invitation d'entreprise
          </h1>
        </div>

        {joinedOrg ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">
              Vous avez rejoint <span className="font-semibold text-[rgb(var(--color-text-primary))]">{joinedOrg}</span> !
            </p>
            <button
              type="button"
              onClick={() => navigate('/entreprise')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] to-indigo-600 hover:bg-[rgb(var(--color-accent-solid-hover))] hover:to-indigo-500 transition-all inline-flex items-center justify-center gap-2"
            >
              Découvrir mon espace <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        ) : !validToken || claimMutation.isError ? (
          <div className="space-y-4 text-center">
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400 text-left" role="alert">
              <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span>Ce lien d'invitation n'est pas valide. Il a peut-être expiré ou déjà été utilisé — demandez-en un nouveau à votre entreprise.</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
            >
              Retour à l'application
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500" />
          </div>
        ) : !isAuthenticated ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">
              Connectez-vous ou créez un compte pour accepter cette invitation.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/login?redirect=/org-invite/${token}`)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] to-indigo-600 hover:bg-[rgb(var(--color-accent-solid-hover))] hover:to-indigo-500 transition-all"
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => navigate(`/signup?redirect=/org-invite/${token}`)}
              className="w-full py-3 rounded-xl text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-border))] transition-all"
            >
              Créer un compte
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[rgb(var(--color-text-secondary))] text-center">
              On vous invite à rejoindre une entreprise sur COSMO, directement à votre place dans l'équipe.
            </p>
            <OrgConsentNotice checked={consent} onChange={setConsent} />
            <button
              type="button"
              onClick={handleJoin}
              disabled={!consent || claimMutation.isPending}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] to-indigo-600 hover:bg-[rgb(var(--color-accent-solid-hover))] hover:to-indigo-500 disabled:opacity-50 transition-all"
            >
              {claimMutation.isPending ? 'Adhésion…' : "Rejoindre l'entreprise"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
};

export default ClaimOrgInvitePage;
