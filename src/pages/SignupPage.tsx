import { useNavigate } from 'react-router-dom';
import { useSeoMeta } from '@/lib/useSeoMeta';
import AuthForm from '@/components/AuthForm';

const SignupPage = () => {
  useSeoMeta({
    title: 'Inscription gratuite – Cosmo, app productivité tâches et OKR',
    description: "Créez votre compte Cosmo gratuitement. Gérez vos tâches, habitudes, agenda et objectifs OKR. Connexion possible via Google.",
    canonical: 'https://thecosmo.app/signup',
  });
  const navigate = useNavigate();

  return (
    <main className="min-h-[100dvh] bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <AuthForm
          mode="register"
          headingAs="h1"
          onSwitchMode={(m) => navigate(m === 'register' ? '/signup' : '/login')}
          onSuccess={() => navigate('/dashboard')}
        />
      </div>
    </main>
  );
};

export default SignupPage;
