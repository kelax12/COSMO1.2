import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, UserRound, Building2, MailCheck } from 'lucide-react';
import { useAuth, type AccountType } from '@/modules/auth/AuthContext';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { MIN_PASSWORD_LENGTH, passwordStrength } from '@/lib/password-policy';
import { useT } from '@/i18n/useT';
import TurnstileWidget from '@/components/TurnstileWidget';
import { resetTurnstile } from '@/lib/turnstile';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export interface AuthFormProps {
  mode: 'login' | 'register';
  /** Bascule entre login/register (modal: change l'état ; page: navigue vers l'autre route). */
  onSwitchMode: (mode: 'login' | 'register') => void;
  /** Appelé après une authentification réussie (modal: ferme + navigue ; page: navigue).
   *  En inscription, reçoit le type de compte choisi pour router vers l'onboarding
   *  entreprise le cas échéant. */
  onSuccess: (accountType?: AccountType) => void;
  /** Balise du titre : `h1` pour les pages standalone (SEO), `h2` dans le modal. */
  headingAs?: 'h1' | 'h2';
  /** Affiche le bouton « Mode Démo » (login uniquement). Défaut: true. */
  showDemo?: boolean;
}

// AUD-10 — source unique de la politique (était dupliquée ici, dans
// ResetPasswordPage et en dur dans SettingsPage).
export { passwordStrength };

const STRENGTH_LABELS = ['', 'Faible', 'Correct', 'Fort'] as const;
const STRENGTH_COLORS = ['transparent', '#ef4444', '#eab308', '#22c55e'] as const;

const inputClasses =
  'w-full bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] rounded-xl pl-9 pr-4 py-3 sm:py-2.5 text-sm text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all';

/**
 * Formulaire d'authentification partagé entre `LoginModal` (bottom-sheet) et
 * les pages routées `/login` & `/signup`. Source unique du design + de la
 * logique auth (login / register / Google / démo). Erreurs affichées inline
 * (bandeau role="alert" au-dessus du submit), jamais en toast.
 */
const AuthForm: React.FC<AuthFormProps> = ({ mode, onSwitchMode, onSuccess, headingAs = 'h2', showDemo = true }) => {
  const { t } = useT('common');
  const Heading = headingAs;
  const isMobile = useIsMobile();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  // Type de compte (inscription uniquement) : particulier par défaut.
  const [accountType, setAccountType] = useState<AccountType>('personal');
  // Erreur globale du formulaire — inline, persistante (pas un toast fugace).
  const [formError, setFormError] = useState<string | null>(null);
  // Erreur du champ mot de passe (validation client au blur / submit, signup).
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // Après ~4 s d'attente, le libellé du bouton précise que ça prend du temps.
  const [slowHint, setSlowHint] = useState(false);
  // Inscription acceptée SANS session ouverte : le projet Supabase exige une
  // confirmation d'email. Porte l'adresse à afficher, `null` sinon.
  //
  // ⚠️ Inerte tant que les confirmations sont désactivées sur le projet — et
  // elles le sont au 2026-08-27 (mesuré : `confirmation_sent_at` renseigné sur
  // 1 compte sur 28, délai création → confirmation de 15 ms). Ce chemin existe
  // pour que les activer ne casse rien : sans lui, `signUp` renvoie
  // `session: null`, l'écran navigue quand même vers `/dashboard`, et
  // `ProtectedRoute` renvoie l'inscrit sur `/login` sans un mot d'explication.
  // Cf. docs/DEPLOYMENT.md §2ter.
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(null);
  // Jeton anti-robot. Reste `undefined` tant que Turnstile n'est pas configuré :
  // Supabase ignore alors la clé, et rien ne change. Cf. `@/lib/turnstile`.
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(undefined);
  const passwordRef = useRef<HTMLInputElement>(null);
  const { login, loginDemo, register, loginWithGoogle } = useAuth();

  // Reset des erreurs quand on bascule login ↔ register.
  useEffect(() => {
    setFormError(null);
    setPasswordError(null);
    setPendingConfirmation(null);
  }, [mode]);

  const validatePassword = (pwd: string): string | null => {
    if (mode === 'register' && pwd.length > 0 && pwd.length < MIN_PASSWORD_LENGTH) {
      return t('auth.passwordTooShort', { count: MIN_PASSWORD_LENGTH });
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (mode === 'register' && formData.password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(t('auth.passwordTooShort', { count: MIN_PASSWORD_LENGTH }));
      passwordRef.current?.focus();
      return;
    }

    setIsLoading(true);
    // Au-delà de 4 s, on change le libellé pour montrer que ça travaille.
    const slowTimer = setTimeout(() => setSlowHint(true), 4000);

    const timeout = 10000; // 10 s — au-delà, mieux vaut échouer vite et proposer de réessayer.
    const withTimeout = <T,>(promise: Promise<T>): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(t('auth.serverTimeout'))), timeout)),
      ]);

    try {
      if (mode === 'login') {
        const result = await withTimeout(login(formData.email, formData.password, captchaToken));
        if (result.success) {
          onSuccess();
        } else if (result.error?.includes('Invalid login credentials')) {
          setFormError(t('auth.badCredentials'));
          setFormData((prev) => ({ ...prev, password: '' }));
          passwordRef.current?.focus();
        } else {
          setFormError(result.error || t('auth.loginError'));
        }
      } else {
        const result = await withTimeout(register(formData.name, formData.email, formData.password, accountType, captchaToken));
        if (result.success) {
          // Compte créé mais aucune session : on ne navigue pas vers un écran
          // protégé qui rejetterait l'inscrit. On lui dit quoi faire.
          if (result.needsEmailConfirmation) setPendingConfirmation(formData.email);
          else onSuccess(accountType);
        } else {
          setFormError(result.error || t('auth.registerError'));
        }
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('auth.genericError'));
    } finally {
      // Le jeton est a usage unique : sans ce rearmement, la tentative suivante
      // echouerait pour une raison qui n a rien a voir avec ce que
      // l utilisateur vient de corriger.
      setCaptchaToken(undefined);
      resetTurnstile();
      clearTimeout(slowTimer);
      setSlowHint(false);
      setIsLoading(false);
    }
  };

  const handleDemoMode = () => {
    loginDemo();
    onSuccess();
  };

  const handleGoogleLogin = async () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    setFormError(null);
    try {
      const result = await loginWithGoogle();
      if (!result.success) {
        setFormError(result.error || 'Erreur lors de la connexion avec Google.');
        setIsGoogleLoading(false);
        return;
      }
      // En cas de succès, le navigateur est redirigé vers Google — pas de reset nécessaire
    } catch {
      setFormError('Erreur lors de la connexion avec Google.');
      setIsGoogleLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === 'password' && passwordError) setPasswordError(null);
  };

  const strength = passwordStrength(formData.password);

  // Même forme que l'écran « Email envoyé » de ForgotPasswordPage : une seule
  // grammaire pour « on t'a écrit, va voir ta boîte ».
  if (pendingConfirmation) {
    return (
      <div className="text-center" role="status">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <MailCheck size={28} className="text-green-500" aria-hidden="true" />
        </div>
        <Heading className="text-2xl font-bold text-[rgb(var(--color-text-primary))] mb-2">
          {t('auth.confirmTitle')}
        </Heading>
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">
          {t('auth.confirmBody', { email: pendingConfirmation })}
        </p>
        <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">{t('auth.confirmSpam')}</p>
        <button
          type="button"
          onClick={() => onSwitchMode('login')}
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
        >
          {t('auth.backToLogin')}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-4">
        <Heading className="text-2xl sm:text-3xl font-bold text-[rgb(var(--color-text-primary))] mb-1.5">
          {mode === 'login' ? t('auth.welcomeBack') : t('auth.joinCosmo')}
        </Heading>
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">
          {mode === 'login' ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Google seul, pleine largeur (Apple retiré tant que le flow n'existe pas) */}
        <button
          type="button"
          onClick={() => handleGoogleLogin()}
          disabled={isGoogleLoading}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-border))] border border-[rgb(var(--color-border))] disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-[rgb(var(--color-text-primary))] transition-colors"
        >
          <GoogleIcon />
          {isGoogleLoading ? t('auth.redirecting') : t('auth.continueGoogle')}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[rgb(var(--color-border))]"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-muted))]">{t('auth.orEmail')}</span>
          </div>
        </div>

        {mode === 'register' && (
          <fieldset>
            <legend className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1.5">
              Type de compte
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'personal' as const, label: 'Particulier', desc: 'Usage personnel', Icon: UserRound },
                { value: 'business' as const, label: t('auth.accountBusiness'), desc: t('auth.accountBusinessDesc'), Icon: Building2 },
              ]).map(({ value, label, desc, Icon }) => {
                const selected = accountType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAccountType(value)}
                    aria-pressed={selected}
                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                      selected
                        ? 'border-[rgb(var(--color-accent-solid))] bg-[rgb(var(--color-accent-solid))]/10 ring-2 ring-blue-500/40'
                        : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] hover:border-[rgb(var(--color-text-muted))]'
                    }`}
                  >
                    <Icon size={18} className={`shrink-0 ${selected ? 'text-blue-400' : 'text-[rgb(var(--color-text-muted))]'}`} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[rgb(var(--color-text-primary))]">{label}</span>
                      <span className="block text-[11px] text-[rgb(var(--color-text-muted))]">{desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {mode === 'register' && (
          <div>
            <label htmlFor="auth-name" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1.5">
              {t('auth.fullName')}
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] pointer-events-none" aria-hidden="true" />
              <input
                id="auth-name"
                type="text"
                name="name"
                autoComplete="name"
                autoFocus={!isMobile}
                value={formData.name}
                onChange={handleInputChange}
                className={inputClasses}
                placeholder={t('auth.yourNamePlaceholder')}
                required
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="auth-email" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1.5">
            {t('auth.email')}
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] pointer-events-none" aria-hidden="true" />
            <input
              id="auth-email"
              type="email"
              name="email"
              autoComplete="email"
              autoFocus={!isMobile && mode === 'login'}
              value={formData.email}
              onChange={handleInputChange}
              className={inputClasses}
              placeholder="exemple@cosmo.app"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="auth-password" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))]">
              {t('auth.password')}
            </label>
            {mode === 'login' && (
              <Link
                to="/forgot-password"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {t('auth.forgotPassword')}
              </Link>
            )}
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] pointer-events-none" aria-hidden="true" />
            <input
              ref={passwordRef}
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={formData.password}
              onChange={handleInputChange}
              onBlur={() => setPasswordError(validatePassword(formData.password))}
              aria-invalid={!!passwordError}
              aria-describedby={mode === 'register' ? 'auth-password-help' : undefined}
              className={`${inputClasses} pr-11 ${passwordError ? 'ring-2 ring-red-500/50' : ''}`}
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
          {mode === 'register' && (
            <div id="auth-password-help" className="mt-1.5 flex items-center gap-3">
              {passwordError ? (
                <p className="text-xs text-red-400 flex-1" role="alert">{passwordError}</p>
              ) : (
                <p className="text-xs text-[rgb(var(--color-text-muted))] flex-1">{t('auth.minChars', { count: MIN_PASSWORD_LENGTH })}</p>
              )}
              {/* Jauge sur la MÊME ligne que l'aide : sinon elle ajoute un cran de
                  hauteur dès la première frappe et rend le modal scrollable. */}
              {formData.password.length > 0 && (
                <div className="flex items-center gap-2 shrink-0" aria-hidden="true">
                  <div className="flex gap-1 w-16">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-colors"
                        style={{ backgroundColor: strength >= i ? STRENGTH_COLORS[strength] : 'rgb(var(--color-border))' }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-[rgb(var(--color-text-muted))] w-12 text-right">
                    {STRENGTH_LABELS[strength]}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vérification anti-robot. Ne rend rien tant que Turnstile n'est pas
            configuré (`VITE_TURNSTILE_SITE_KEY`), donc aucun script tiers n'est
            chargé et le parcours est inchangé. */}
        <TurnstileWidget onToken={(token) => setCaptchaToken(token ?? undefined)} />

        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] to-purple-600 hover:bg-[rgb(var(--color-accent-solid-hover))] hover:to-purple-500 disabled:opacity-60 transition-all shadow-lg shadow-blue-500/20 mt-1"
        >
          {isLoading
            ? slowHint
              ? t('auth.signingInSlow')
              : 'Chargement...'
            : mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
        </button>

        {mode === 'login' && showDemo && (
          <button
            type="button"
            onClick={handleDemoMode}
            className="w-full py-3 rounded-xl text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-border))] transition-all"
          >
            {t('auth.tryDemo')}
          </button>
        )}
      </form>

      <div className="mt-4 pt-4 border-t border-[rgb(var(--color-border))] text-center">
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">
          {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}
        </p>
        <button
          type="button"
          onClick={() => onSwitchMode(mode === 'login' ? 'register' : 'login')}
          className="mt-1 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
        >
          {mode === 'login' ? t('auth.createOne') : t('auth.signIn')}
        </button>
      </div>
    </>
  );
};

export default AuthForm;
