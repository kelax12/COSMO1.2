import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Logo from '@/components/Logo';
import CreateOrJoinOrganization from '@/components/organization/CreateOrJoinOrganization';
import { useMyOrganization } from '@/modules/organizations';

/**
 * Onboarding entreprise — affiché juste après une inscription « Entreprise »
 * (SignupPage / LoginModal redirigent ici). L'utilisateur crée son entreprise
 * (code généré à partager) ou rejoint via un code (demande envoyée à l'admin).
 *
 * Page standalone plein écran (hors Layout) — l'utilisateur n'a pas encore
 * d'entreprise et n'a pas besoin de la nav applicative.
 */
const OrganizationOnboardingPage = () => {
  const navigate = useNavigate();
  const { data: myOrg, isLoading } = useMyOrganization();

  return (
    <main
      className="min-h-[100dvh] flex flex-col items-center justify-center p-4 gap-6"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}
    >
      <Logo showText />
      <div className="w-full max-w-md bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
            Votre espace entreprise
          </h1>
          <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">
            Créez votre entreprise ou rejoignez-en une pour collaborer avec votre équipe.
          </p>
        </div>

        {/* Déjà membre (org créée dans une session précédente) → accès direct. */}
        {!isLoading && myOrg ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">
              Vous faites partie de <span className="font-semibold text-[rgb(var(--color-text-primary))]">{myOrg.name}</span>.
            </p>
            <button
              type="button"
              onClick={() => navigate('/entreprise')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/20 inline-flex items-center justify-center gap-2"
            >
              Accéder à mon entreprise <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <CreateOrJoinOrganization onCreated={() => { /* le code s'affiche dans le composant */ }} />
        )}

        <div className="mt-6 pt-6 border-t border-[rgb(var(--color-border))] text-center">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
          >
            Plus tard, accéder à l'application
          </button>
        </div>
      </div>
    </main>
  );
};

export default OrganizationOnboardingPage;
