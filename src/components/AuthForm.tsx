import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/modules/auth/AuthContext';
import { toast } from 'sonner';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

export interface AuthFormProps {
  mode: 'login' | 'register';
  /** Bascule entre login/register (modal: change l'état ; page: navigue vers l'autre route). */
  onSwitchMode: (mode: 'login' | 'register') => void;
  /** Appelé après une authentification réussie (modal: ferme + navigue ; page: navigue). */
  onSuccess: () => void;
  /** Balise du titre : `h1` pour les pages standalone (SEO), `h2` dans le modal. */
  headingAs?: 'h1' | 'h2';
  /** Affiche le bouton « Mode Démo » (login uniquement). Défaut: true. */
  showDemo?: boolean;
}

/**
 * Formulaire d'authentification partagé entre `LoginModal` (bottom-sheet) et
 * les pages routées `/login` & `/signup`. Source unique du design + de la
 * logique auth (login / register / Google / démo) pour éviter toute
 * divergence d'UI. Les chromes spécifiques (drag handle, bouton fermer du
 * modal ; <main> + SEO des pages) restent côté appelant.
 */
const AuthForm: React.FC<AuthFormProps> = ({ mode, onSwitchMode, onSuccess, headingAs = 'h2', showDemo = true }) => {
  const Heading = headingAs;
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const { login, loginDemo, register, loginWithGoogle } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const timeout = 20000; // 20s timeout
    const withTimeout = <T,>(promise: Promise<T>): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Le serveur ne répond pas. Veuillez réessayer.')), timeout)),
      ]);

    try {
      if (mode === 'login') {
        const result = await withTimeout(login(formData.email, formData.password));
        if (result.success) {
          toast.success('Connexion réussie !');
          onSuccess();
        } else if (result.error?.includes('Invalid login credentials')) {
          toast.error('Email ou mot de passe incorrect');
        } else {
          toast.error(result.error || 'Erreur de connexion');
        }
      } else {
        const result = await withTimeout(register(formData.name, formData.email, formData.password));
        if (result.success) {
          toast.success('Compte créé et connecté !');
          onSuccess();
        } else {
          toast.error(result.error || 'Erreur lors de la création du compte');
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoMode = () => {
    loginDemo();
    toast.success('Bienvenue dans la démo !');
    onSuccess();
  };

  const handleGoogleLogin = async () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    try {
      const result = await loginWithGoogle();
      if (!result.success) {
        toast.error(result.error || 'Erreur lors de la connexion avec Google');
        setIsGoogleLoading(false);
        return;
      }
      // En cas de succès, le navigateur est redirigé vers Google — pas de reset nécessaire
    } catch {
      toast.error('Erreur lors de la connexion avec Google');
      setIsGoogleLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <>
      <div className="text-center mb-8">
        <Heading className="text-3xl font-bold text-white mb-2">
          {mode === 'login' ? 'Bon retour !' : 'Rejoignez Cosmo'}
        </Heading>
        <p className="text-slate-400">
          {mode === 'login' ? 'Connectez-vous à votre compte' : 'Créez votre compte gratuitement'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Social buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            disabled={isGoogleLoading}
            aria-label="Continuer avec Google"
            className="flex items-center justify-center gap-2.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-colors"
          >
            <GoogleIcon />
            {isGoogleLoading ? 'Redirection...' : 'Google'}
          </button>
          <button
            type="button"
            onClick={() => toast.info('Apple Sign-In bientôt disponible')}
            aria-label="Continuer avec Apple"
            className="flex items-center justify-center gap-2.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium text-white transition-colors"
          >
            <AppleIcon />
            Apple
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-slate-900 text-slate-400">ou continuer avec un email</span>
          </div>
        </div>

        {mode === 'register' && (
          <div>
            <label htmlFor="auth-name" className="block text-xs font-medium text-slate-400 mb-1.5">
              Nom complet
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" aria-hidden="true" />
              <input
                id="auth-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full bg-slate-800 border-0 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                placeholder="Votre nom"
                required
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="auth-email" className="block text-xs font-medium text-slate-400 mb-1.5">
            Email
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" aria-hidden="true" />
            <input
              id="auth-email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full bg-slate-800 border-0 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
              placeholder="exemple@cosmo.app"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="auth-password" className="block text-xs font-medium text-slate-400 mb-1.5">
            Mot de passe
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" aria-hidden="true" />
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="w-full bg-slate-800 border-0 rounded-xl pl-9 pr-11 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
            >
              {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-60 transition-all shadow-lg shadow-blue-500/20 mt-2"
        >
          {isLoading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>

        {mode === 'login' && showDemo && (
          <button
            type="button"
            onClick={handleDemoMode}
            className="w-full py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all"
          >
            Mode Démo (Connexion rapide)
          </button>
        )}
      </form>

      <div className="mt-6 pt-6 border-t border-slate-700/50 text-center">
        <p className="text-sm text-slate-400">
          {mode === 'login' ? 'Pas encore de compte ?' : 'Déjà un compte ?'}
        </p>
        <button
          type="button"
          onClick={() => onSwitchMode(mode === 'login' ? 'register' : 'login')}
          className="mt-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
        >
          {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
        </button>
      </div>
    </>
  );
};

export default AuthForm;
