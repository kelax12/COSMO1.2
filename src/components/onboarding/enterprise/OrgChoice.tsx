import { useNavigate, useSearchParams } from 'react-router';
import { ArrowRight } from 'lucide-react';
import Logo from '@/components/Logo';
import CreateOrJoinOrganization from '@/components/organization/CreateOrJoinOrganization';
import { useActiveOrganization, useMySentJoinRequest } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import { NAME_SLOT, splitAroundName } from '@/i18n/name-slot';
import { setBusinessPending } from '../first-run';

/**
 * Choix « créer ou rejoindre » de l'accueil entreprise. C'est la carte
 * d'avant la refonte du 2026-10-03, remise le 2026-10-09 à la demande
 * d'Axel : plus sobre que l'écran de bienvenue en constellation, qui
 * empilait trois paragraphes avant les deux seuls gestes possibles.
 *
 * Seul le CHOIX est revenu : une création ouvre toujours la mise en place
 * (`?setup=<org>`) d'`EnterpriseOnboarding`.
 */
const OrgChoice = () => {
  const { t, tp } = useT('org');
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { activeOrg, organizations, isLoading } = useActiveOrganization();
  const { data: sentRequest } = useMySentJoinRequest();

  const [orgSentenceBefore, orgSentenceAfter] = splitAroundName(
    t('onboarding.memberOfOrg', { name: NAME_SLOT }),
  );

  const later = () => {
    // Sans entreprise ni demande en cours, l'accueil perso rappellera celle
    // qui attend (sinon plus rien ne ramenait la personne ici).
    if (organizations.length === 0 && !sentRequest) setBusinessPending(true);
    navigate('/dashboard');
  };

  return (
    <main
      className="min-h-[100dvh] flex flex-col items-center justify-center p-4 gap-6"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}
    >
      <Logo showText />
      <div className="w-full max-w-md bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
            {t('onboarding.title')}
          </h1>
          <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">
            {t('onboarding.intro')}
          </p>
        </div>

        {/* Multi-org : déjà membre → raccourci vers l'org active, MAIS on
            peut toujours en créer/rejoindre une autre en dessous. */}
        {!isLoading && activeOrg && (
          <div className="mb-6 space-y-3 text-center">
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">
              {organizations.length > 1 ? (
                tp('onboarding.memberOfCount', organizations.length)
              ) : (
                <>
                  {orgSentenceBefore}
                  <span className="font-semibold text-[rgb(var(--color-text-primary))]">{activeOrg.name}</span>
                  {orgSentenceAfter}
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => navigate('/entreprise')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] transition-all shadow-lg shadow-blue-500/20 inline-flex items-center justify-center gap-2"
            >
              {t('onboarding.goToOrg')} <ArrowRight size={16} aria-hidden="true" />
            </button>
            <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('onboarding.orCreateAnother')}</p>
          </div>
        )}
        <CreateOrJoinOrganization
          onCreated={(org) => {
            setBusinessPending(false);
            setSearchParams({ setup: org.id });
          }}
          onJoinRequested={() => setBusinessPending(false)}
        />

        <div className="mt-6 pt-6 border-t border-[rgb(var(--color-border))] text-center">
          <button
            type="button"
            onClick={later}
            className="text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
          >
            {t('onboarding.later')}
          </button>
        </div>
      </div>
    </main>
  );
};

export default OrgChoice;
