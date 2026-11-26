import React from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useForcedLightTheme } from '@/hooks/use-forced-light-theme';
import { useOptionalAuth } from '@/modules/auth/AuthContext';
import { enterWithTheme } from '@/lib/theme';

// Cadre commun des outils gratuits (plan SEO C7) : en-tête, titre, appel à
// l'action et section « comment faire ». `useOptionalAuth` : la page est aussi
// rendue par le prérendu, sans AuthProvider.
interface ToolShellProps {
  /** Préfixe des `data-cta` mesurés par src/lib/traffic.ts (ex. `outil-pomodoro`). */
  cta: string;
  title: string;
  intro: string;
  ctaTitle: string;
  ctaText: string;
  howTitle: string;
  how: readonly string[];
  /** Page de l'app où mène la démo. */
  demoPath?: string;
  children: React.ReactNode;
}

const ToolShell: React.FC<ToolShellProps> = ({ cta, title, intro, ctaTitle, ctaText, howTitle, how, demoPath = '/dashboard', children }) => {
  useForcedLightTheme();
  const { t } = useT('landing');
  const auth = useOptionalAuth();
  const navigate = useNavigate();
  const ouvrirDemo = () => {
    enterWithTheme('light');
    auth?.loginDemo();
    setTimeout(() => navigate(demoPath), 0);
  };
  return (
    <div className="min-h-[100dvh] bg-white text-slate-900">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-900/10 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm">
            <img src="/logo-128.webp" alt="Cosmo" className="w-7 h-7 rounded-lg object-contain" />
            <span className="font-semibold text-slate-900">Cosmo</span>
          </Link>
          <Link to="/signup" data-cta={`${cta}-signup-entete`} className="text-sm text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5">
            {t('blog.createFreeAccount')}
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-slate-900">{title}</h1>
        <p className="text-slate-500 mb-8 max-w-2xl print:hidden">{intro}</p>
        {children}
        <aside className="mt-12 rounded-2xl border border-slate-900/10 bg-slate-50 p-6 sm:p-8 text-center print:hidden">
          <p className="text-lg font-semibold mb-2">{ctaTitle}</p>
          <p className="text-slate-500 text-sm mb-5">{ctaText}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" data-cta={`${cta}-demo`} onClick={ouvrirDemo} className="rounded-xl bg-blue-600 text-white font-semibold px-5 py-2.5 hover:bg-blue-700 transition-colors">
              {t('blog.demoCta')}
            </button>
            <Link to="/signup" data-cta={`${cta}-signup`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 font-semibold hover:bg-white">
              {t('blog.startFree')} <ArrowRight size={16} />
            </Link>
          </div>
        </aside>
        <section className="mt-12 max-w-2xl text-slate-600 space-y-3 leading-relaxed print:hidden">
          <h2 className="text-xl font-bold text-slate-900">{howTitle}</h2>
          {how.map((p) => <p key={p}>{p}</p>)}
        </section>
      </main>
    </div>
  );
};

export default ToolShell;

/** Lit et écrit un état JSON dans `localStorage`, après le montage seulement (prérendu sans `window`). */
export function usePersistedState<T>(key: string, initial: T, lire: (brut: string | null) => T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [etat, setEtat] = React.useState<T>(initial);
  const [charge, setCharge] = React.useState(false);
  // `lire` passe par une ref : une fonction recréée à chaque rendu ne doit pas relancer la lecture.
  const lireRef = React.useRef(lire);
  lireRef.current = lire;
  React.useEffect(() => {
    setEtat(lireRef.current(window.localStorage.getItem(key)));
    setCharge(true);
  }, [key]);
  React.useEffect(() => {
    if (!charge) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(etat));
    } catch {
      // Stockage refusé (navigation privée stricte) : l'outil reste utilisable pour la session.
    }
  }, [key, etat, charge]);
  return [etat, setEtat];
}
