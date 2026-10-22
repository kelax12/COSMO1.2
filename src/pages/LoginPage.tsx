import { Link, useNavigate, useSearchParams } from 'react-router';
import { postAuthRoute } from '@/lib/safe-redirect';
import { useSeoMeta } from '@/lib/useSeoMeta';
import AuthForm from '@/components/AuthForm';
import Logo from '@/components/Logo';
import { useT } from '@/i18n/useT';

const LoginPage = () => {
  const { t } = useT('common');
  // Les titres et descriptions vivent DEJA dans `seo.json` : le prerendu les
  // lit depuis ce catalogue, la page les recopiait a cote. Deux sources pour
  // la meme balise, c'est une occasion de les laisser diverger.
  const { t: tSeo } = useT('seo');
  useSeoMeta({
    title: tSeo('login.title'),
    description: tSeo('login.description'),
    canonical: 'https://thecosmo.app/login',
  });
  const navigate = useNavigate();
  // Retour demandé par `?redirect=` (invitation d'entreprise notamment). Le
  // paramètre existait déjà dans les liens mais n'était lu nulle part : on
  // atterrissait sur le tableau de bord et le jeton d'invitation, à usage
  // unique, restait non consommé (risque R-04). `postAuthRoute` refuse toute
  // valeur qui pourrait sortir de l'origine.
  const [searchParams] = useSearchParams();
  const redirectTo = postAuthRoute(searchParams.get('redirect'));
  // Basculer vers l'inscription ne doit pas perdre le retour : sinon le lien
  // « créer un compte » repart sans le jeton d'invitation.
  const redirectQuery = redirectTo === '/dashboard' ? '' : `?redirect=${encodeURIComponent(redirectTo)}`;

  return (
    <main
      className="min-h-[100dvh] flex flex-col items-center justify-center max-md:justify-start max-md:items-stretch p-4 max-md:px-6 max-md:pt-6 gap-6"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}
    >
      {/* Maquettes 355 et 356 : sur mobile, le formulaire sur le fond, logo réduit en tête. */}
      <Link to="/" aria-label={t('auth.backHome')} className="shrink-0 max-md:self-start max-md:scale-90 max-md:origin-left">
        <Logo showText />
      </Link>
      <div className="w-full max-w-md bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-8 shadow-2xl max-md:bg-transparent max-md:border-0 max-md:shadow-none max-md:p-0">
        <AuthForm
          mode="login"
          headingAs="h1"
          onSwitchMode={(m) => navigate(`${m === 'register' ? '/signup' : '/login'}${redirectQuery}`)}
          onSuccess={() => navigate(redirectTo, { replace: true })}
        />
      </div>
    </main>
  );
};

export default LoginPage;
