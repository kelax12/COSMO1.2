// src/components/org-guide/guide-runner.ts
import type { GuideStep } from './guide-types';

export interface GuideRunDeps {
  reducedMotion: boolean;
  /** Élément portant `data-guide-id="<id>"`, ou null. */
  find: (id: string) => HTMLElement | null;
  navigate: (section: string) => void;
  moveCursor: (target: HTMLElement) => Promise<void>;
  /** Vrai clic : uniquement sur des éléments qui OUVRENT (garde de scénarios). */
  click: (target: HTMLElement) => void;
  showBubble: (key: string | null, target: HTMLElement | null) => void;
  onStep: (index: number, total: number) => void;
}

export type GuideRunResult =
  | { status: 'completed' }
  | { status: 'quit' }
  | { status: 'missing'; target: string }
  | { status: 'empty'; emptyKey: string };

const POLL_MS = 100;
const TARGET_TIMEOUT_MS = 3000;
const FIELD_DWELL_MS = 2600;
const STEP_GAP_MS = 500;

class Quit extends Error {}

export const createGuideRun = (steps: GuideStep[], deps: GuideRunDeps) => {
  let quitted = false;
  let paused = false;
  let skipDwell: (() => void) | null = null;
  const resumeWaiters: (() => void)[] = [];

  const gate = async () => {
    if (quitted) throw new Quit();
    while (paused) {
      await new Promise<void>((r) => resumeWaiters.push(r));
      if (quitted) throw new Quit();
    }
  };

  const sleep = async (ms: number, skippable = false) => {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, deps.reducedMotion ? Math.min(ms, 300) : ms);
      if (skippable) skipDwell = () => { clearTimeout(t); resolve(); };
    });
    skipDwell = null;
    await gate();
  };

  const waitFor = async (id: string): Promise<HTMLElement | null> => {
    for (let waited = 0; waited <= TARGET_TIMEOUT_MS; waited += POLL_MS) {
      await gate();
      const found = deps.find(id);
      if (found) return found;
      await sleep(POLL_MS);
    }
    return null;
  };

  const run = async (): Promise<GuideRunResult> => {
    try {
      for (let i = 0; i < steps.length; i++) {
        await gate();
        const step = steps[i];
        deps.onStep(i, steps.length);
        if (step.kind === 'handoff') { deps.showBubble(step.bubbleKey, null); continue; }
        const id = step.kind === 'goto' ? step.via : step.target;
        const target = await waitFor(id);
        if (!target) return { status: 'missing', target: id };
        await deps.moveCursor(target);
        await gate();
        if (step.kind === 'goto') deps.navigate(step.section);
        else if (step.kind === 'click') { deps.click(target); if (step.bubbleKey) deps.showBubble(step.bubbleKey, target); }
        else if (step.kind === 'field') { deps.showBubble(step.bubbleKey, target); await sleep(FIELD_DWELL_MS, true); }
        else if (step.kind === 'pick-first') {
          const first = target.querySelector<HTMLElement>('[data-guide-item]');
          if (!first) return { status: 'empty', emptyKey: step.emptyKey };
          await deps.moveCursor(first);
          deps.click(first);
          if (step.bubbleKey) deps.showBubble(step.bubbleKey, first);
        }
        if (i < steps.length - 1) await sleep(STEP_GAP_MS);
      }
      return { status: 'completed' };
    } catch (e) {
      if (e instanceof Quit) return { status: 'quit' };
      throw e;
    }
  };

  return {
    start: run,
    pause: () => { paused = true; },
    resume: () => { paused = false; resumeWaiters.splice(0).forEach((r) => r()); },
    /** Passe la bulle en cours (étape `field`). */
    skip: () => { skipDwell?.(); },
    quit: () => { quitted = true; skipDwell?.(); resumeWaiters.splice(0).forEach((r) => r()); },
  };
};
