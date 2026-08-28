import { useState } from 'react';
import { Link } from 'react-router';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { supabase } from '@/lib/supabase';
import { sanitizeEmail, isValidEmail } from '@/lib/email';
import TurnstileWidget from '@/components/TurnstileWidget';
import { resetTurnstile } from '@/lib/turnstile';
import Logo from '@/components/Logo';
import { useT } from '@/i18n/useT';

/**
 * Demande de réinitialisation de mot de passe (amélioration UX n°1).
 * Envoie un lien magique Supabase qui redirige vers /reset-password.
 * Le message de succès est volontairement identique que l'email existe ou
 * non (pas d'énumération de comptes).
 */
const ForgotPasswordPage = () => {
  const { t } = useT('common');
  useSeoMeta({
    title: 'Mot de passe oublié – Cosmo',
    description: 'Réinitialisez le mot de passe de votre compte Cosmo.',
    canonical: 'https://thecosmo.app/forgot-password',
  });
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Reste `undefined` tant que Turnstile n'est pas configure : Supabase ignore
  // alors la cle, le parcours est inchange. Cf. `@/lib/turnstile`.
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = sanitizeEmail(email);
    if (!isValidEmail(clean)) {
      setError("Cette adresse email n'est pas valide.");
      return;
    }
    setIsLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(clean, {
        redirectTo: `${window.location.origin}/reset-password`,
        captchaToken,
      });
      if (resetError) {
        setError(t('auth.sendFailed'));
        return;
      }
      setSent(true);
    } catch {
      setError(t('auth.genericError'));
    } finally {
      setIsLoading(false);
      // Jeton a usage unique — cf. `@/lib/turnstile`.
      setCaptchaToken(undefined);
      resetTurnstile();
    }
  };

  return (
    <main
      className="min-h-[100dvh] flex flex-col items-center justify-center p-4 gap-6"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}
    >
      <Link to="/" aria-label={t('auth.backHome')} className="shrink-0">
        <Logo showText />
      </Link>
      <div className="w-full max-w-md bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-8 shadow-2xl">
        {sent ? (
          <div className="text-center" role="status">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-green-500" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))] mb-2">{t('auth.emailSentTitle')}</h1>
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">
              Si un compte existe pour <span className="font-medium">{sanitizeEmail(email)}</span>, vous
              recevrez un lien pour choisir un nouveau mot de passe. Pensez à vérifier vos spams.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))] mb-2">{t('auth.forgotTitle')}</h1>
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                Saisissez votre email : nous vous enverrons un lien pour en choisir un nouveau.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] pointer-events-none" aria-hidden="true" />
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] rounded-xl pl-9 pr-4 py-3 text-sm text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                    placeholder="exemple@cosmo.app"
                    required
                  />
                </div>
              </div>
              {/* Verification anti-robot — ne rend rien tant que Turnstile
                  n'est pas configure. La reinitialisation de mot de passe est,
                  avec l'inscription, l'autre point d'entree qui declenche un
                  envoi d'email : la proteger sans proteger celle-ci laisserait
                  la porte ouverte sur le meme quota. */}
              <TurnstileWidget onToken={(token) => setCaptchaToken(token ?? undefined)} />
              {error && (
                <div role="alert" className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] to-purple-600 hover:bg-[rgb(var(--color-accent-solid-hover))] hover:to-purple-500 disabled:opacity-60 transition-all shadow-lg shadow-blue-500/20"
              >
                {isLoading ? 'Envoi...' : 'Envoyer le lien'}
              </button>
            </form>
            <div className="mt-6 pt-6 border-t border-[rgb(var(--color-border))] text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ArrowLeft size={14} aria-hidden="true" /> Retour à la connexion
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default ForgotPasswordPage;
