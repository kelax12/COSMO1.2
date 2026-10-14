import OrgChoice from '@/components/onboarding/enterprise/OrgChoice';

/**
 * Onboarding entreprise : affiché juste après une inscription « Entreprise »
 * (SignupPage / LoginModal redirigent ici). Créer une entreprise ou en
 * rejoindre une par code ; la suite (vidéo d'accueil) se joue dans l'espace
 * entreprise lui-même.
 *
 * Page standalone plein écran (hors Layout) : l'utilisateur n'a pas encore
 * d'entreprise et n'a pas besoin de la nav applicative.
 */
const OrganizationOnboardingPage = () => <OrgChoice />;

export default OrganizationOnboardingPage;
