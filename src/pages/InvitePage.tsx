import React, { useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { AlertCircle, ArrowRight, Users, CalendarCheck, Sparkles } from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuth } from '@/modules/auth/AuthContext';
import { isValidInviteToken, PENDING_INVITE_STORAGE_KEY, usePreviewShareLink } from '@/modules/friends';
import { useT } from '@/i18n/useT';
import { NAME_SLOT, splitAroundName } from '@/i18n/name-slot';

/**
 * Route publique `/invite/:token` — point d'entrée des liens d'invitation de
 * partage de tâche (mig. 046).
 *
 * C'est le canal d'acquisition le plus qualifié du produit : quelqu'un a
 * recommandé COSMO nominativement. La page montre donc QUI invite et à QUOI
 * (RPC anonyme `preview_share_link`, mig. 098) avant de demander la création
 * de compte — auparavant elle redirigeait vers un formulaire nu.
 *
 * Elle ne claim PAS le lien : elle pose le token dans localStorage, et c'est
 * `ShareInviteClaimer` (monté au niveau App) qui claim dès que l'utilisateur
 * est authentifié. Un seul mécanisme couvre les 3 cas :
 *   - déjà connecté        → '/' → popup immédiate ;
 *   - compte existant      → '/login' → popup après connexion ;
 *   - pas de compte        → '/signup' → popup à la fin de l'inscription.
 */
const InvitePage: React.FC = () => {
  const { t } = useT('invite');
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, isDemo } = useAuth();

  const validToken = isValidInviteToken(token);
  // Un utilisateur déjà connecté est redirigé aussitôt : inutile de payer
  // l'aperçu, ShareInviteClaimer va afficher la vraie popup.
  const alreadyIn = isAuthenticated && !isDemo;
  const preview = usePreviewShareLink(token, validToken && !isLoading && !alreadyIn);

  // Le token est posé dès que possible : le visiteur peut partir vers /signup
  // par le CTA, mais aussi par le bouton retour ou un lien externe.
  useEffect(() => {
    if (!validToken) return;
    try {
      localStorage.setItem(PENDING_INVITE_STORAGE_KEY, token);
    } catch {
      /* localStorage indisponible : on continue, le claim échouera proprement */
    }
  }, [token, validToken]);

  useEffect(() => {
    if (isLoading || !validToken) return;
    if (alreadyIn) navigate('/', { replace: true });
  }, [alreadyIn, isLoading, validToken, navigate]);

  const ownerName = preview.data?.owner_name ?? t('someone');
  const taskName = preview.data?.task_name ?? '';
  const [headingBefore, headingAfter] = splitAroundName(t('heading', { name: NAME_SLOT }));

  // Un lien inconnu et un lien expiré sont indistinguables côté serveur ; une
  // erreur réseau est traitée comme un échec d'aperçu, pas comme un lien mort
  // (on laisse alors l'invité tenter l'inscription).
  const isExpired = preview.data?.expired === true;
  const showError = !validToken || isExpired;
  const errorKey = validToken ? 'expired' : 'invalid';

  const busy = isLoading || alreadyIn || (validToken && preview.isLoading);

  return (
    <main
      className="min-h-[100dvh] flex flex-col items-center justify-center p-4 gap-6"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}
    >
      <Link to="/" aria-label={t('backHome')} className="shrink-0">
        <Logo showText />
      </Link>

      <div className="w-full max-w-md bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-6 sm:p-8 shadow-2xl">
        {busy ? (
          // Squelette plutôt qu'un spinner : la page garde sa forme finale,
          // donc aucun saut de mise en page quand l'aperçu arrive.
          <div className="space-y-4 animate-pulse" aria-busy="true" aria-label={t('loading')}>
            <div className="w-14 h-14 rounded-2xl bg-[rgb(var(--color-hover))] mx-auto" />
            <div className="h-6 rounded-lg bg-[rgb(var(--color-hover))] w-4/5 mx-auto" />
            <div className="h-4 rounded-lg bg-[rgb(var(--color-hover))] w-3/5 mx-auto" />
            <div className="h-12 rounded-xl bg-[rgb(var(--color-hover))] mt-6" />
          </div>
        ) : showError ? (
          <div className="space-y-4 text-center">
            {/* Le titre reste un h1 : c'est le seul titre de la page, et
                `e2e/i18n-routing.spec.ts` s'appuie sur sa présence pour prouver
                que la route `/invite/*` n'a pas été avalée par le préfixe de
                locale. */}
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
              <AlertCircle size={26} className="text-red-500" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
              {t(`${errorKey}.title`)}
            </h1>
            <p className="text-sm text-[rgb(var(--color-text-secondary))]" role="alert">
              {t(`${errorKey}.text`)}
            </p>
            {/* On ne perd pas le visiteur : un lien mort reste une visite. */}
            <button
              type="button"
              onClick={() => navigate('/welcome')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] transition-colors inline-flex items-center justify-center gap-2"
            >
              {t(`${errorKey}.cta`)} <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[rgb(var(--color-accent-solid))]/10 flex items-center justify-center mx-auto mb-3">
                <Users size={26} className="text-[rgb(var(--color-accent-solid))]" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
                {headingBefore}
                <span className="text-[rgb(var(--color-accent-solid))]">{ownerName}</span>
                {headingAfter}
              </h1>
              {taskName && (
                <p className="mt-2 text-sm text-[rgb(var(--color-text-secondary))] break-words">
                  {t('onTask', { task: taskName })}
                </p>
              )}
            </div>

            <ul className="space-y-2.5 mb-6" aria-label={t('benefits.title')}>
              {([
                [Users, t('benefits.collaborate')],
                [CalendarCheck, t('benefits.organize')],
                [Sparkles, t('benefits.free')],
              ] as const).map(([Icon, label]) => (
                <li key={label} className="flex items-start gap-2.5 text-sm text-[rgb(var(--color-text-secondary))]">
                  <Icon size={16} className="shrink-0 mt-0.5 text-[rgb(var(--color-accent-solid))]" aria-hidden="true" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] transition-colors"
            >
              {t('cta')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full mt-2 py-3 rounded-xl text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
            >
              {t('hasAccount')}
            </button>
          </>
        )}
      </div>
    </main>
  );
};

export default InvitePage;
