import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Choix du nouveau mot de passe (amélioration UX n°1). Consommée depuis le
 * lien email Supabase (type=recovery) : le SDK pose la session de
 * récupération automatiquement (detectSessionInUrl), il reste à appeler
 * updateUser({ password }).
 */
const ResetPasswordPage = () => {
  useSeoMeta({
    title: 'Nouveau mot de passe – Cosmo',
    description: 'Choisissez un nouveau mot de passe pour votre compte Cosmo.',
    canonical: 'https://thecosmo.app/reset-password',
  });
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sans session de récupération, updateUser échouera — on prévient d'emblée.
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Le token du lien peut mettre quelques centaines de ms à être consommé
    // par detectSessionInUrl — on tolère un court délai avant de conclure.
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setHasSession(true);
      } else {
        setTimeout(async () => {
          const { data: retry } = await supabase.auth.getSession();
          if (!cancelled) setHasSession(!!retry.session);
        }, 1200);
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError('Impossible de mettre à jour le mot de passe. Le lien a peut-être expiré — refaites une demande.');
        return;
      }
      navigate('/dashboard');
    } catch {
      setError('Une erreur est survenue. Réessayez.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses =
    'w-full bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] rounded-xl pl-9 pr-11 py-3 text-sm text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all';

  return (
    <main
      className="min-h-[100dvh] flex flex-col items-center justify-center p-4 gap-6"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}
    >
      <Link to="/" aria-label="Retour à l'accueil Cosmo" className="shrink-0">
        <Logo showText />
      </Link>
      <div className="w-full max-w-md bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))] mb-2">Nouveau mot de passe</h1>
          <p className="text-sm text-[rgb(var(--color-text-secondary))]">
            Choisissez le nouveau mot de passe de votre compte.
          </p>
        </div>

        {hasSession === false && (
          <div role="alert" className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Ce lien est invalide ou a expiré.{' '}
              <Link to="/forgot-password" className="underline underline-offset-2 font-semibold">
                Refaire une demande
              </Link>
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reset-password" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1.5">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] pointer-events-none" aria-hidden="true" />
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClasses}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] transition-colors p-1"
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-[rgb(var(--color-text-muted))]">{MIN_PASSWORD_LENGTH} caractères minimum</p>
          </div>

          <div>
            <label htmlFor="reset-confirm" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1.5">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] pointer-events-none" aria-hidden="true" />
              <input
                id="reset-confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClasses}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || hasSession === false}
            className="w-full py-3 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] to-purple-600 hover:bg-[rgb(var(--color-accent-solid-hover))] hover:to-purple-500 disabled:opacity-60 transition-all shadow-lg shadow-blue-500/20"
          >
            {isLoading ? 'Enregistrement...' : 'Enregistrer le mot de passe'}
          </button>
        </form>
      </div>
    </main>
  );
};

export default ResetPasswordPage;
