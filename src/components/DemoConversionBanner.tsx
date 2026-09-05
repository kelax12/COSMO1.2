import { useState } from 'react';
import { useNavigate } from 'react-router';
import { X, CloudUpload } from 'lucide-react';
import { useAuth } from '@/modules/auth/AuthContext';
import { useT } from '@/i18n/useT';

const DISMISS_KEY = 'cosmo_demo_banner_dismissed';

/**
 * Bannière de conversion démo → compte (amélioration UX n°9).
 *
 * Visible uniquement en mode démo : rappelle que les données démo sont locales
 * à l'appareil (elles ne sont PAS transférées vers le compte) et propose de
 * créer un compte. Dismissible — le flag localStorage est balayé par
 * clearDemoStorage(), donc la bannière revient à chaque nouvelle session démo,
 * pas à chaque page.
 */
const DemoConversionBanner: React.FC = () => {
  const { t } = useT('common');
  const { isDemo } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  if (!isDemo || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <div
      role="region"
      aria-label={t('demoBanner.aria')}
      // Maquette 02 — « Bandeau à 26 px ». Sur 375 px de large, la phrase
      // complète se repliait sur trois lignes : ~72 px, un cinquième du
      // téléphone, tous les jours, pour une information qu'on lit une fois.
      // Mobile → une seule ligne : ce qu'on est, et quoi faire pour en sortir.
      // Desktop (`md:`) inchangé, la phrase entière y tient sur une ligne.
      className="flex items-center gap-2 md:gap-3 px-gutter md:px-4 py-1.5 md:py-2.5 bg-[rgb(var(--color-accent-solid))]/10 border-b border-[rgb(var(--color-accent-solid))]/20 text-caption md:text-sm"
    >
      <CloudUpload size={16} className="hidden md:block shrink-0 text-[rgb(var(--color-accent-solid))]" aria-hidden="true" />

      {/* ── Mobile : une ligne, deux éléments ── */}
      <p className="md:hidden flex-1 min-w-0 truncate leading-none text-[rgb(var(--color-text-secondary))]">
        <span className="font-medium text-[rgb(var(--color-text-primary))]">{t('demoBanner.label')}</span>
        <span aria-hidden="true"> · </span>
        <button
          type="button"
          onClick={() => navigate('/signup')}
          className="font-semibold text-[rgb(var(--color-accent-solid))] underline underline-offset-2"
        >
          {t('demoBanner.createAccount')}
        </button>
      </p>

      {/* ── Desktop (inchangé) ── */}
      <p className="hidden md:block flex-1 text-[rgb(var(--color-text-secondary))] leading-snug">
        <span className="font-medium text-[rgb(var(--color-text-primary))]">{t('demoBanner.label')}</span>
        {t('demoBanner.text')}
        <button
          type="button"
          onClick={() => navigate('/signup')}
          className="font-semibold text-[rgb(var(--color-accent-solid))] hover:text-[rgb(var(--color-accent-solid-hover))] underline underline-offset-2 transition-colors"
        >
          {t('demoBanner.createAccount')}
        </button>
        {t('demoBanner.rest')}
      </p>

      {/* La cible tactile dépasse le dessin (maquette 76) : le bandeau fait
          26 px, la zone cliquable du ✕ en fait 44 grâce au débord vertical —
          rapetisser la cible avec le bandeau aurait échangé une règle
          d'accessibilité contre des pixels. */}
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('demoBanner.hide')}
        className="relative shrink-0 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] md:hover:bg-[rgb(var(--color-hover))] transition-colors md:min-w-0 md:min-h-0 md:p-1.5 before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] md:before:hidden"
      >
        <X size={14} className="md:hidden" aria-hidden="true" />
        <X size={16} className="hidden md:block" aria-hidden="true" />
      </button>
    </div>
  );
};

export default DemoConversionBanner;
