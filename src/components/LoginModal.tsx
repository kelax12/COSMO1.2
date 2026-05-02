import React, { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/modules/auth/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'login' | 'register';
  onSwitchMode: (mode: 'login' | 'register') => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, mode, onSwitchMode }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const { login, loginDemo, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      
      const timeout = 20000; // 20s timeout
      const withTimeout = <T,>(promise: Promise<T>): Promise<T> => 
        Promise.race([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Le serveur ne répond pas. Veuillez réessayer.')), timeout))
        ]);
            
      try {
        if (mode === 'login') {
          const result = await withTimeout(login(formData.email, formData.password));
          if (result.success) {
            toast.success('Connexion réussie !');
            onClose();
            navigate('/dashboard');
          } else {
            if (result.error?.includes('Invalid login credentials')) {
              toast.error('Email ou mot de passe incorrect');
            } else {
              toast.error(result.error || 'Erreur de connexion');
            }
          }
        } else {
          const result = await withTimeout(register(formData.name, formData.email, formData.password));
          
          if (result.success) {
            toast.success('Compte créé et connecté !');
            onClose();
            navigate('/dashboard');
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
    onClose();
    setTimeout(() => navigate('/dashboard'), 0);
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
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 w-full max-w-md relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </Button>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            {mode === 'login' ? 'Bon retour !' : 'Rejoignez Cosmo'}
          </h2>
          <p className="text-slate-400">
            {mode === 'login' 
              ? 'Connectez-vous à votre compte' 
              : 'Créez votre compte gratuitement'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Social buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleGoogleLogin()}
              disabled={isGoogleLoading}
              className="flex items-center justify-center gap-2.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-colors"
            >
              <GoogleIcon />
              {isGoogleLoading ? 'Redirection...' : 'Google'}
            </button>
            <button
              type="button"
              onClick={() => toast.info('Apple Sign-In bientôt disponible')}
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
              <span className="px-3 bg-slate-900 text-slate-500">ou continuer avec un email</span>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Nom complet
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
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
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
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
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Mot de passe
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-60 transition-all shadow-lg shadow-blue-500/20 mt-2"
          >
            {isLoading ? 'Chargement...' : (mode === 'login' ? 'Se connecter' : 'Créer mon compte')}
          </button>

          {mode === 'login' && (
            <button
              type="button"
              onClick={handleDemoMode}
              className="w-full py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all"
            >
              Mode Démo (Connexion rapide)
            </button>
          )}
        </form>

        <div className="mt-6 text-center">
          <p className="text-slate-400 dark:text-slate-400">
            {mode === 'login' ? "Pas encore de compte ?" : "Déjà un compte ?"}
            <Button
              variant="link"
              onClick={() => onSwitchMode(mode === 'login' ? 'register' : 'login')}
              className="text-blue-400 hover:text-blue-300 font-semibold ml-1 p-0 h-auto"
            >
              {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
