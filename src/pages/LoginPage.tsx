import { Link, useNavigate } from 'react-router-dom';
import { useSeoMeta } from '@/lib/useSeoMeta';
import AuthForm from '@/components/AuthForm';
import Logo from '@/components/Logo';

const LoginPage = () => {
  useSeoMeta({
    title: 'Connexion – Cosmo, application de productivité',
    description: 'Connectez-vous à Cosmo pour accéder à vos tâches, habitudes, agenda et OKR.',
    canonical: 'https://thecosmo.app/login',
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
          mode="login"
          headingAs="h1"
          onSwitchMode={(m) => navigate(m === 'register' ? '/signup' : '/login')}
          onSuccess={() => navigate('/dashboard')}
        />
      </div>
    </main>
  );
};

export default LoginPage;
