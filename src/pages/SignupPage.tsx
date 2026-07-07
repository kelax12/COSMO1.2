import { Link, useNavigate } from 'react-router-dom';
import { useSeoMeta } from '@/lib/useSeoMeta';
import AuthForm from '@/components/AuthForm';
import Logo from '@/components/Logo';

const SignupPage = () => {
  useSeoMeta({
    title: 'Inscription gratuite – Cosmo, app productivité tâches et OKR',
    description: "Créez votre compte Cosmo gratuitement. Gérez vos tâches, habitudes, agenda et objectifs OKR. Connexion possible via Google.",
    canonical: 'https://thecosmo.app/signup',
  });
  const navigate = useNavigate();

  return (
    <main
      className="min-h-[100dvh] flex flex-col items-center justify-center p-4 gap-6"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}
    >
      <Link to="/" aria-label="Retour à l'accueil Cosmo" className="shrink-0">
        <Logo showText />
      </Link>
      <div className="w-full max-w-md bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-8 shadow-2xl">
        <AuthForm
          mode="register"
          headingAs="h1"
          onSwitchMode={(m) => navigate(m === 'register' ? '/signup' : '/login')}
          onSuccess={(accountType) =>
            navigate(accountType === 'business' ? '/entreprise/onboarding' : '/dashboard')
          }
        />
      </div>
    </main>
  );
};

export default SignupPage;
