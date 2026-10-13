// src/components/org-guide/OrgGuideHost.tsx
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import { useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Button } from '@/components/ui/button';
import { orgSectionPath } from '@/components/organization/deep-link.helpers';
import { DIRECTORY_PARAMS } from '@/components/organization/member-directory.filters';
import { createGuideRun, type GuideRunResult } from './guide-runner';
import { dispatchGuideClick } from './guide-click';
import { GuideBubble } from './GuideBubble';
import { GuideControlBar } from './GuideControlBar';
import { GuideCursor, type CursorPoint } from './GuideCursor';
import { OrgGuideDrawer } from './OrgGuideDrawer';
import type { GuideAction, GuideViewer } from './guide-types';

const center = (el: HTMLElement): CursorPoint => {
  const r = el.getBoundingClientRect();
  return { x: r.left + Math.min(r.width / 2, 40), y: r.top + Math.min(r.height / 2, 18) };
};

/** Section du premier `goto` : là où « Ouvrir l'écran » emmène quand une ancre manque. */
const firstSection = (action: GuideAction): string | null => {
  const goto = action.steps.find((s) => s.kind === 'goto');
  return goto && goto.kind === 'goto' ? goto.section : null;
};

/**
 * Le calque et les contrôles arrêtent la propagation : un dialogue Radix ouvert
 * par la démo écoute `pointerdown` sur le document pour se fermer au clic
 * extérieur, et un clic de l'utilisateur sur le calque refermerait le formulaire.
 */
const swallow = (e: SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); };
const stop = (e: SyntheticEvent) => e.stopPropagation();

type Ending = { result: Exclude<GuideRunResult, { status: 'completed' } | { status: 'quit' }>; section: string | null };

interface Props { open: boolean; onClose: () => void; viewer: GuideViewer }

export default function OrgGuideHost({ open, onClose, viewer }: Props) {
  const { t } = useT('orgGuide');
  const tx = useCallback((key: string) => t(key as Parameters<typeof t>[0]), [t]);
  const navigate = useNavigate();
  const reduce = useReducedMotion() ?? false;
  const [running, setRunning] = useState<GuideAction | null>(null);
  const [step, setStep] = useState({ current: 0, total: 0 });
  const [paused, setPaused] = useState(false);
  const [cursor, setCursor] = useState<CursorPoint>(() => ({ x: window.innerWidth - 80, y: window.innerHeight - 80 }));
  const [pressed, setPressed] = useState(false);
  const [bubble, setBubble] = useState<{ text: string; at: CursorPoint | null } | null>(null);
  const [ending, setEnding] = useState<Ending | null>(null);
  const runRef = useRef<ReturnType<typeof createGuideRun> | null>(null);

  // Quitter la page pendant une démo l'arrête : rien ne doit cliquer dans le vide.
  useEffect(() => () => runRef.current?.quit(), []);

  const start = useCallback(async (action: GuideAction) => {
    runRef.current?.quit();
    onClose();
    setEnding(null);
    setBubble(null);
    setPaused(false);
    setStep({ current: 0, total: action.steps.length });
    setRunning(action);
    const run = createGuideRun(action.steps, {
      reducedMotion: reduce,
      find: (id) => document.querySelector<HTMLElement>(`[data-guide-id="${CSS.escape(id)}"]`),
      navigate: (section) => navigate(orgSectionPath(section)),
      moveCursor: async (el) => {
        // On ne défile QUE si la cible sort de l'écran, et au plus court
        // (`nearest`) : centrer chaque champ faisait dérouler le formulaire
        // jusqu'en bas. Défilement instantané : la position se mesure APRÈS.
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.left < 0 || r.bottom > window.innerHeight || r.right > window.innerWidth) {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
        }
        setCursor(center(el));
        // Durée du trajet du curseur (GuideCursor), plus un temps d'arrêt.
        await new Promise((res) => setTimeout(res, 1400));
      },
      click: (el) => {
        setPressed(true);
        setTimeout(() => setPressed(false), 150);
        dispatchGuideClick(el);
      },
      showBubble: (key, el) => setBubble(key ? { text: tx(key), at: el ? center(el) : null } : null),
      onStep: (i, n) => setStep({ current: i + 1, total: n }),
    });
    runRef.current = run;
    let result: GuideRunResult;
    try {
      result = await run.start();
    } catch {
      result = { status: 'quit' };
    }
    if (runRef.current !== run) return; // une autre démo a pris la main
    runRef.current = null;
    setRunning(null);
    setPaused(false);
    if (result.status === 'missing' || result.status === 'empty') {
      setBubble(null);
      setEnding({ result, section: firstSection(action) });
    } else {
      // `completed` comme `quit` : aucune note de fin, le formulaire reste ouvert.
      setBubble(null);
    }
  }, [navigate, onClose, reduce, tx]);

  useEffect(() => {
    if (!running) return;
    // Capture sur window : passe avant Radix, sans l'empêcher de fermer son dialogue.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') runRef.current?.quit(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [running]);

  const seeAdmins = () => {
    onClose();
    navigate(`${orgSectionPath('members')}?${DIRECTORY_PARAMS.role}=admin`);
  };

  return (
    <>
      <OrgGuideDrawer open={open} viewer={viewer} onClose={onClose} onStart={start} onSeeAdmins={seeAdmins} />
      {running && (
        <>
          {/* Calque de capture : l'écran ne réagit pas aux clics de l'utilisateur
              pendant la démo. Les clics de la démo sont des évènements émis
              directement sur la cible, le calque ne les voit pas. */}
          <div
            className="pointer-events-auto fixed inset-0 z-[10010] cursor-default"
            aria-hidden="true"
            onPointerDown={swallow}
            onMouseDown={swallow}
            onClick={swallow}
          />
          <GuideCursor point={cursor} pressed={pressed} />
          <GuideControlBar
            actionLabel={tx(`actions.${running.id}.label`)}
            current={step.current}
            total={step.total}
            paused={paused}
            onPause={() => { setPaused(true); runRef.current?.pause(); }}
            onResume={() => { setPaused(false); runRef.current?.resume(); }}
            onSkip={() => runRef.current?.skip()}
            onQuit={() => runRef.current?.quit()}
          />
        </>
      )}
      {bubble && <GuideBubble text={bubble.text} at={bubble.at} />}
      {ending && (
        <div
          role="status"
          onPointerDown={stop}
          onMouseDown={stop}
          className="pointer-events-auto fixed left-1/2 top-[40%] z-[10030] w-72 -translate-x-1/2 rounded-xl border border-border bg-popover p-3 text-sm text-popover-foreground shadow-lg"
        >
          <p className="mb-3 leading-snug">
            {ending.result.status === 'empty' ? tx(ending.result.emptyKey) : t('end.missing')}
          </p>
          <div className="flex gap-2">
            {ending.result.status === 'missing' && ending.section && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => { const s = ending.section; setEnding(null); navigate(orgSectionPath(s)); }}
              >
                {t('end.openDirect')}
              </Button>
            )}
            <Button type="button" size="icon-sm" variant="ghost" className="ml-auto" aria-label={t('drawer.close')} onClick={() => setEnding(null)}>
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
      <div aria-live="polite" className="sr-only">{bubble?.text ?? ''}</div>
    </>
  );
}
