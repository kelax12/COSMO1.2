import { Link, useNavigate, useSearchParams } from 'react-router';
import { postAuthRoute, safeRedirectPath } from '@/lib/safe-redirect';
import { useSeoMeta } from '@/lib/useSeoMeta';
import AuthForm from '@/components/AuthForm';
import Logo from '@/components/Logo';
import { useT } from '@/i18n/useT';

const SignupPage = () => {
  const { t } = useT('common');
  // Les titres et descriptions vivent DEJA dans `seo.json` : le prerendu les
  // lit depuis ce catalogue, la page les recopiait a cote. Deux sources pour
  // la meme balise, c'est une occasion de les laisser diverger.
  const { t: tSeo } = useT('seo');
  useSeoMeta({
    title: tSeo('signup.title'),
    description: tSeo('signup.description'),
    canonical: 'https://thecosmo.app/signup',
  });
  const navigate = useNavigate();
  // Idem `LoginPage` : on honore `?redirect=` s'il est interne. Le repli
  // dépend du type de compte, l'onboarding entreprise restant la bonne
  // destination par défaut d'une inscription professionnelle.
  const [searchParams] = useSearchParams();
  const requestedRedirect = searchParams.get('redirect');
  // Basculer vers la connexion ne doit pas perdre le retour demandé.
  const safeRedirect = safeRedirectPath(requestedRedirect);
  const redirectQuery = safeRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : '';

  return (
    <main
      className="min-h-[100dvh] flex flex-col items-center justify-center p-4 gap-6"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}
    >
      <Link to="/" aria-label={t('auth.backHome')} className="shrink-0">
        <Logo showText />
      </Link>
      <div className="w-full max-w-md bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-8 shadow-2xl">
        <AuthForm
          mode="register"
          headingAs="h1"
          onSwitchMode={(m) => navigate(`${m === 'register' ? '/signup' : '/login'}${redirectQuery}`)}
          onSuccess={(accountType) =>
            navigate(
              postAuthRoute(
                requestedRedirect,
                accountType === 'business' ? '/entreprise/onboarding' : '/dashboard',
              ),
              { replace: true },
            )
          }
        />
      </div>
    </main>
  );
};

export default SignupPage;
