import EnterpriseOnboarding from '@/components/onboarding/enterprise/EnterpriseOnboarding';

/**
 * Onboarding entreprise — affiché juste après une inscription « Entreprise »
 * (SignupPage / LoginModal redirigent ici). Créer une entreprise puis la
 * mettre en place, ou en rejoindre une par code.
 *
 * Page standalone plein écran (hors Layout) : l'utilisateur n'a pas encore
 * d'entreprise et n'a pas besoin de la nav applicative. Tout l'écran vit dans
 * `EnterpriseOnboarding` (refait le 2026-10-03, constellation).
 */
const OrganizationOnboardingPage = () => <EnterpriseOnboarding />;

export default OrganizationOnboardingPage;
