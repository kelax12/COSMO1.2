// src/components/perso-guide/PersoGuideFab.tsx
import { Suspense, useState } from 'react';
import { Compass } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { safeParse } from '@/lib/safe-json';
import { lazyWithRetry } from '@/lib/lazy-with-retry';

// Le tiroir, les scénarios, le moteur de démo et le catalogue `persoGuide`
// arrivent au premier clic : le bouton seul vit dans le shell.
const PersoGuideHost = lazyWithRetry(() => import('./PersoGuideHost'), ['overlays', 'persoGuide']);

const SEEN_KEY = 'cosmo_perso_guide_seen';
const readSeen = (): boolean => {
  try { return safeParse<boolean>(localStorage.getItem(SEEN_KEY)) === true; } catch { return false; }
};
const markSeen = () => {
  try { localStorage.setItem(SEEN_KEY, 'true'); } catch { /* stockage bloqué : la pastille reste */ }
};

/**
 * Boussole du guide perso, jumelle d'`OrgGuideFab`. Desktop uniquement :
 * `Layout` ne la monte que dans son rendu desktop, et hors `/entreprise`,
 * qui a la sienne au même endroit.
 */
export function PersoGuideFab() {
  const { t } = useT('common');
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [seen, setSeen] = useState(readSeen);

  return (
    <>
      <button
        type="button"
        aria-label={t('nav.persoGuide')}
        title={t('nav.persoGuide')}
        data-perso-guide-fab=""
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-primary shadow-md hover:bg-accent"
        onClick={() => {
          setMounted(true);
          setOpen(true);
          if (!seen) { markSeen(); setSeen(true); }
        }}
      >
        <Compass className="h-5 w-5" aria-hidden="true" />
        {!seen && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />}
      </button>
      {mounted && (
        <Suspense fallback={null}>
          <PersoGuideHost open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

export default PersoGuideFab;
