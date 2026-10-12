// src/components/org-guide/OrgGuideFab.tsx
import { lazy, Suspense, useState } from 'react';
import { Compass } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { safeParse } from '@/lib/safe-json';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import type { GuideViewer } from './guide-types';

const OrgGuideHost = lazy(() => import('./OrgGuideHost'));

const SEEN_KEY = 'cosmo_org_guide_seen';
const readSeen = (): boolean => {
  try { return safeParse<boolean>(localStorage.getItem(SEEN_KEY)) === true; } catch { return false; }
};
const markSeen = () => {
  try { localStorage.setItem(SEEN_KEY, 'true'); } catch { /* stockage bloqué : la pastille reste */ }
};

/**
 * Seul morceau eager du guide : le tiroir, les scénarios et la démo arrivent
 * au premier clic. Desktop uniquement (v1). En bas à droite : sur desktop,
 * il n'y a pas de FAB de création rapide (`global-quick-add-fab` est mobile).
 */
export function OrgGuideFab({ viewer, openSignal }: { viewer: GuideViewer; openSignal?: number }) {
  const { t } = useT('orgGuide');
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const [lastSignal, setLastSignal] = useState(openSignal);

  if (openSignal !== lastSignal) {
    setLastSignal(openSignal);
    if (openSignal) { setMounted(true); setOpen(true); }
  }
  if (isMobile) return null;

  return (
    <>
      <button
        type="button"
        aria-label={t('fab.label')}
        title={t('fab.label')}
        data-guide-fab=""
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
          <OrgGuideHost open={open} onClose={() => setOpen(false)} viewer={viewer} />
        </Suspense>
      )}
    </>
  );
}
