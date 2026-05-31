import { useNavigate } from 'react-router-dom';
import { useSeoMeta } from '@/lib/useSeoMeta';
import AuthForm from '@/components/AuthForm';

const LoginPage = () => {
  useSeoMeta({
    title: 'Connexion – Cosmo, application de productivité',
    description: 'Connectez-vous à Cosmo pour accéder à vos tâches, habitudes, agenda et OKR.',
    canonical: 'https://thecosmo.app/login',
  });
  const navigate = useNavigate();

  return (
    <main className="min-h-[100dvh] bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
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
