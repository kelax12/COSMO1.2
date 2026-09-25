import { Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/modules/auth/AuthContext';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { orgSetupPath, parseSetupScreen, type OrgSetupScreen } from '@/components/organization/org-setup.helpers';
import Logo from '@/components/Logo';
import CreateOrJoinOrganization from '@/components/organization/CreateOrJoinOrganization';
import { useActiveOrganization } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import { NAME_SLOT, splitAroundName } from '@/i18n/name-slot';

// L'assistant n'est téléchargé que par qui vient de créer une entreprise.
// Catalogues déclarés par la ROUTE (`App.tsx`), seule lue par
// `lazy-namespaces.guard.test.ts`.
const OrgSetupWizard = lazyWithRetry(() => import('@/components/organization/OrgSetupWizard'));

/**
 * Onboarding entreprise — affiché juste après une inscription « Entreprise »
 * (SignupPage / LoginModal redirigent ici). L'utilisateur crée son entreprise
 * (code généré à partager) ou rejoint via un code (demande envoyée à l'admin).
 *
 * Après une CRÉATION, la page devient l'assistant de démarrage (`?setup=<org>`,
 * étape dans `?step=`) : inviter par e-mail, une première équipe, un premier
 * projet à partir d'un modèle. Réservé à un admin de cette organisation, soit
 * celui qui vient de la créer ; tout autre cas retombe sur l'écran ordinaire.
 *
 * Page standalone plein écran (hors Layout) — l'utilisateur n'a pas encore
 * d'entreprise et n'a pas besoin de la nav applicative.
 */
const OrganizationOnboardingPage = () => {
  const { t, tp } = useT('org');
  const navigate = useNavigate();
  const { activeOrg, organizations, isLoading, setActiveOrgId } = useActiveOrganization();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const setupOrgId = searchParams.get('setup');
  const setupOrg = setupOrgId ? organizations.find((o) => o.id === setupOrgId && o.myRole === 'admin') : undefined;
  const screen = parseSetupScreen(searchParams.get('step'));
  // Sans `replace` : chaque étape est une entrée d'historique, le bouton
  // précédent ramène à la précédente au lieu de quitter l'assistant.
  //
  // ⚠️ La navigation part de `setupOrg.id`, jamais de `setupOrgId` : ce
  // dernier est lu dans l'URL, tel quel. `setupOrg` est une organisation de MA
  // liste, que j'administre (cf. `no-open-redirect.test.ts`).
  const goToScreen = (next: OrgSetupScreen) => {
    if (!setupOrg) return;
    navigate(orgSetupPath(setupOrg.id, next));
  };
  const finishSetup = () => {
    if (setupOrg) setActiveOrgId(setupOrg.id);
    navigate('/entreprise');
  };

  const [orgSentenceBefore, orgSentenceAfter] = splitAroundName(
    t('onboarding.memberOfOrg', { name: NAME_SLOT }),
  );

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

        {setupOrgId && (isLoading || setupOrg) ? (
          setupOrg ? (
            <Suspense fallback={<div className="h-40" aria-hidden="true" />}>
              <OrgSetupWizard
                orgId={setupOrg.id}
                orgName={setupOrg.name}
                currentUserId={user?.id}
                screen={screen}
                onScreen={goToScreen}
                onFinish={finishSetup}
              />
            </Suspense>
          ) : (
            <div className="h-40" aria-hidden="true" />
          )
        ) : (
        <>
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
              // `to-indigo-*` retirés : sans `bg-gradient-*` sur le même
              // élément, ils ne posaient qu'une variable que rien ne lit.
              className="w-full py-3 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] transition-all shadow-lg shadow-blue-500/20 inline-flex items-center justify-center gap-2"
            >
              {t('onboarding.goToOrg')} <ArrowRight size={16} aria-hidden="true" />
            </button>
            <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('onboarding.orCreateAnother')}</p>
          </div>
        )}
        <CreateOrJoinOrganization
          onCreated={(org) => setSearchParams({ setup: org.id })}
        />
        </>
        )}

        <div className="mt-6 pt-6 border-t border-[rgb(var(--color-border))] text-center">
          <button
            type="button"
            onClick={() => (setupOrg ? finishSetup() : navigate('/dashboard'))}
            className="text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
          >
            {t('onboarding.later')}
          </button>
        </div>
      </div>
    </main>
  );
};

export default OrganizationOnboardingPage;
