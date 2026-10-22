// src/components/org-guide/use-guide-demo.tsx
import { useCallback, useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setGuideDemoActive } from '@/lib/guide-demo-active';
import { createGuideRun, type GuideRunResult } from './guide-runner';
import { dispatchGuideClick } from './guide-click';
import { GuideBubble } from './GuideBubble';
import { GuideControlBar } from './GuideControlBar';
import { GuideCursor, type CursorPoint } from './GuideCursor';
import type { GuideStep } from './guide-types';

/**
 * Traducteur tolérant du guide : les clés d'action sont construites
 * (`actions.<id>.label`), le catalogue typé ne peut pas les vérifier.
 * Les deux guides (entreprise, perso) portent les mêmes clés de chrome :
 * `control.*`, `end.*`, `drawer.close`.
 */
export type GuideT = (key: string, vars?: Record<string, string | number>) => string;

/** Phase de la démo, pour l'hôte qui doit adapter sa navigation (cf. guide-demo-signal). */
export type GuideDemoPhase = 'off' | 'nav' | 'hide';

export interface GuideDemoAction {
  id: string;
  steps: GuideStep<string>[];
}

const center = (el: HTMLElement): CursorPoint => {
  const r = el.getBoundingClientRect();
  return { x: r.left + Math.min(r.width / 2, 40), y: r.top + Math.min(r.height / 2, 18) };
};

/** Section du premier `goto` : là où « Ouvrir l'écran » emmène quand une ancre manque. */
const firstSection = (action: GuideDemoAction): string | null => {
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

interface Options {
  t: GuideT;
  /** Ouvre l'écran d'une section (`goto`, et « Ouvrir l'écran » en fin `missing`). */
  navigate: (section: string) => void;
  onPhase?: (phase: GuideDemoPhase) => void;
  /** Appelé au lancement : l'hôte y ferme son tiroir. */
  onStart?: () => void;
}

/**
 * Moteur de démo partagé par le guide entreprise et le guide perso : curseur,
 * bulles, barre de contrôle, note de fin. Rien n'est saisi ni enregistré, la
 * garde des scénarios de chaque guide le vérifie sur le source.
 */
export function useGuideDemo({ t, navigate, onPhase, onStart }: Options): { start: (action: GuideDemoAction) => Promise<void>; layer: ReactNode } {
  const reduce = useReducedMotion() ?? false;
  const [running, setRunning] = useState<GuideDemoAction | null>(null);
  const [step, setStep] = useState({ current: 0, total: 0 });
  const [paused, setPaused] = useState(false);
  const [cursor, setCursor] = useState<CursorPoint>(() => ({ x: window.innerWidth - 80, y: window.innerHeight - 80 }));
  const [pressed, setPressed] = useState(false);
  const [bubble, setBubble] = useState<{ text: string; at: CursorPoint | null } | null>(null);
  const [ending, setEnding] = useState<Ending | null>(null);
  const runRef = useRef<ReturnType<typeof createGuideRun> | null>(null);
  const onPhaseRef = useRef(onPhase);
  onPhaseRef.current = onPhase;

  // Quitter la page pendant une démo l'arrête : rien ne doit cliquer dans le vide.
  useEffect(() => () => { runRef.current?.quit(); onPhaseRef.current?.('off'); setGuideDemoActive(false); }, []);

  const start = useCallback(async (action: GuideDemoAction) => {
    runRef.current?.quit();
    onStart?.();
    setEnding(null);
    setBubble(null);
    setPaused(false);
    setStep({ current: 0, total: action.steps.length });
    setRunning(action);
    setGuideDemoActive(true);
    // Navigation de l'hôte : elle peut basculer (glisser 300 ms) à chaque
    // changement de phase et décaler le contenu. Le curseur attend donc la fin
    // de la bascule avant de mesurer sa cible.
    let navSettledAt = 0;
    const setNavPhase = (phase: 'nav' | 'hide') => {
      onPhaseRef.current?.(phase);
      navSettledAt = Date.now() + 350;
    };
    const run = createGuideRun(action.steps, {
      reducedMotion: reduce,
      find: (id) => document.querySelector<HTMLElement>(`[data-guide-id="${CSS.escape(id)}"]`),
      navigate,
      moveCursor: async (el) => {
        // On ne défile QUE si la cible sort de l'écran, et au plus court
        // (`nearest`) : centrer chaque champ faisait dérouler le formulaire
        // jusqu'en bas. Défilement instantané : la position se mesure APRÈS.
        const settle = navSettledAt - Date.now();
        if (settle > 0) await new Promise((res) => setTimeout(res, settle));
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
      showBubble: (key, el) => setBubble(key ? { text: t(key), at: el ? center(el) : null } : null),
      onStep: (i, n) => {
        setStep({ current: i + 1, total: n });
        setNavPhase(action.steps[i]?.kind === 'goto' ? 'nav' : 'hide');
      },
    });
    runRef.current = run;
    let result: GuideRunResult;
    try {
      result = await run.start();
    } catch {
      result = { status: 'quit' };
    }
    if (runRef.current === run) onPhaseRef.current?.('off');
    if (runRef.current !== run) return; // une autre démo a pris la main
    runRef.current = null;
    setGuideDemoActive(false);
    setRunning(null);
    setPaused(false);
    setBubble(null);
    // `completed` comme `quit` : aucune note de fin, le formulaire reste ouvert.
    if (result.status === 'missing' || result.status === 'empty') {
      setEnding({ result, section: firstSection(action) });
    }
  }, [navigate, onStart, reduce, t]);

  useEffect(() => {
    if (!running) return;
    // Capture sur window : passe avant Radix, sans l'empêcher de fermer son dialogue.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') runRef.current?.quit(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [running]);

  const layer = (
    <>
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
            t={t}
            actionLabel={t(`actions.${running.id}.label`)}
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
            {ending.result.status === 'empty' ? t(ending.result.emptyKey) : t('end.missing')}
          </p>
          <div className="flex gap-2">
            {ending.result.status === 'missing' && ending.section && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => { const s = ending.section; setEnding(null); if (s) navigate(s); }}
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

  return { start, layer };
}
