import React, { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useTasks } from '../context/TaskContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
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
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const { login, register, loginWithGoogle } = useTasks();
  const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      console.log('[DEBUG] Submit mode:', mode);
      
      const timeout = 20000; // 20s timeout
      const withTimeout = <T,>(promise: Promise<T>): Promise<T> => 
        Promise.race([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Le serveur ne répond pas. Veuillez réessayer.')), timeout))
        ]);
            
      try {
        if (mode === 'login') {
          console.log('[DEBUG] Calling login function...');
          const result = await withTimeout(login(formData.email, formData.password));
          console.log('[DEBUG] Login result:', result);
          if (result.success) {
            toast.success('Connexion réussie !');
            onClose();
            navigate('/dashboard');
          } else {
            console.error('[DEBUG] Login failed:', result.error);
            if (result.error?.includes('Invalid login credentials')) {
              toast.error('Email ou mot de passe incorrect');
            } else {
              toast.error(result.error || 'Erreur de connexion');
            }
          }
        } else {
          console.log('[DEBUG] Calling register function...');
          const result = await withTimeout(register(formData.name, formData.email, formData.password));
          console.log('[DEBUG] Register result:', result);
          
          if (result.success) {
            toast.success('Compte créé et connecté !');
            onClose();
            navigate('/dashboard');
          } else {
            console.error('[DEBUG] Registration failed:', result.error);
            toast.error(result.error || 'Erreur lors de la création du compte');
          }
        }
      } catch (error) {
        console.error('[DEBUG] Unexpected error in handleSubmit:', error);
        toast.error(error instanceof Error ? error.message : 'Une erreur est survenue');
      } finally {
        setIsLoading(false);
      }
    };


  const handleDemoMode = async () => {
    setIsLoading(true);
    try {
      const demoEmail = 'demo@cosmo.app';
      const demoPassword = 'CosmoDemo2026!';
      
      console.log('[DEBUG] Attempting Demo Mode login...');
      const result = await login(demoEmail, demoPassword);
      
      if (result.success) {
        toast.success('Mode démo activé !');
        onClose();
        navigate('/dashboard');
      } else if (result.error?.includes('Invalid login credentials')) {
        console.log('[DEBUG] Demo account missing, creating it...');
        const regResult = await register('Utilisateur Démo', demoEmail, demoPassword);
        if (regResult.success) {
          toast.success('Mode démo activé (nouveau compte) !');
          onClose();
          navigate('/dashboard');
        } else {
          toast.error('Erreur lors de l\'activation du mode démo');
        }
      } else {
        toast.error(result.error || 'Erreur mode démo');
      }
    } catch (error) {
      console.error('[DEBUG] Demo mode error:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('Erreur Google Login:', error);
      toast.error('Erreur lors de la connexion avec Google');
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
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

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

        <form onSubmit={handleSubmit} className="space-y-6">
          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            className="w-full bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-3"
          >
            <GoogleIcon />
            {mode === 'login' ? 'Se connecter avec Google' : 'S\'inscrire avec Google'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-600 dark:border-slate-500"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-900 dark:bg-slate-800 text-slate-400 dark:text-slate-300">ou</span>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 dark:text-slate-300 mb-2">
                Nom complet
              </label>
              <div className="relative">
                <User size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full bg-slate-800 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white dark:text-white placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Votre nom"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 dark:text-slate-300 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full bg-slate-800 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white dark:text-white placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="votre@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 dark:text-slate-300 mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full bg-slate-800 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg pl-10 pr-12 py-3 text-white dark:text-white placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-400 hover:text-white dark:hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Chargement...' : (mode === 'login' ? 'Se connecter' : 'Créer mon compte')}
          </button>

          {mode === 'login' && (
            <button
              type="button"
              onClick={handleDemoMode}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-lg font-semibold transition-all duration-300 border border-slate-700"
            >
              Mode Démo (Aperçu rapide)
            </button>
          )}
        </form>

        <div className="mt-6 text-center">
          <p className="text-slate-400 dark:text-slate-400">
            {mode === 'login' ? "Pas encore de compte ?" : "Déjà un compte ?"}
            <button
              onClick={() => onSwitchMode(mode === 'login' ? 'register' : 'login')}
              className="text-blue-400 dark:text-blue-400 hover:text-blue-300 dark:hover:text-blue-300 font-semibold ml-1 transition-colors"
            >
              {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
