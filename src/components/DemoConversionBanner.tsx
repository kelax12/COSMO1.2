import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CloudUpload } from 'lucide-react';
import { useAuth } from '@/modules/auth/AuthContext';

const DISMISS_KEY = 'cosmo_demo_banner_dismissed';

/**
 * Bannière de conversion démo → compte (amélioration UX n°9).
 *
 * Visible uniquement en mode démo : rappelle que les données sont locales à
 * l'appareil et propose de créer un compte (avec migration automatique des
 * données, cf. lib/demo-migration.ts). Dismissible — le flag localStorage est
 * balayé par clearDemoStorage(), donc la bannière revient à chaque nouvelle
 * session démo, pas à chaque page.
 */
const DemoConversionBanner: React.FC = () => {
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
      aria-label="Mode démo"
      className="flex items-center gap-3 px-4 py-2.5 bg-blue-500/10 border-b border-blue-500/20 text-sm"
    >
      <CloudUpload size={16} className="shrink-0 text-blue-400" aria-hidden="true" />
      <p className="flex-1 text-[rgb(var(--color-text-secondary))] leading-snug">
        <span className="font-medium text-[rgb(var(--color-text-primary))]">Mode démo</span>
        {' '}— vos données sont locales à cet appareil.{' '}
        <button
          type="button"
          onClick={() => navigate('/signup')}
          className="font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
        >
          Créez un compte
        </button>
        {' '}pour les conserver.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Masquer la bannière démo"
        className="shrink-0 p-1.5 rounded-lg text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
};

export default DemoConversionBanner;
