// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { afterFirstPaint, PAINT_WAIT_CAP_MS } from './after-first-paint';

// C-116 : React ne doit monter qu'APRÈS la première peinture d'une page
// prérendue, sinon `createRoot` efface un `#seo-fallback` jamais peint et le
// LCP devient un nœud React (5,6 à 8,3 s en Lighthouse CI mobile).

type Callback = (list: { getEntriesByName: (name: string) => unknown[] }) => void;

let observers: { cb: Callback; disconnected: boolean }[] = [];

function emitPaint(name: string): void {
  for (const o of observers) {
    if (!o.disconnected) o.cb({ getEntriesByName: (n) => (n === name ? [{ name }] : []) });
  }
}

class FakeObserver {
  static supportedEntryTypes = ['paint', 'largest-contentful-paint'];
  private readonly entry: { cb: Callback; disconnected: boolean };
  constructor(cb: Callback) {
    this.entry = { cb, disconnected: false };
    observers.push(this.entry);
  }
  observe(): void {}
  disconnect(): void { this.entry.disconnected = true; }
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

beforeEach(() => {
  vi.useFakeTimers();
  observers = [];
  vi.stubGlobal('PerformanceObserver', FakeObserver);
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('afterFirstPaint (C-116)', () => {
  it('ne rend PAS la main avant la première peinture', () => {
    const cb = vi.fn();
    afterFirstPaint(cb);
    vi.advanceTimersByTime(PAINT_WAIT_CAP_MS - 1);
    expect(cb).not.toHaveBeenCalled();
  });

  it('rend la main juste après `first-contentful-paint`, une seule fois', () => {
    const cb = vi.fn();
    afterFirstPaint(cb);
    emitPaint('first-paint');
    vi.advanceTimersByTime(0);
    expect(cb).not.toHaveBeenCalled();
    emitPaint('first-contentful-paint');
    vi.advanceTimersByTime(0);
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(PAINT_WAIT_CAP_MS * 2);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('TÉMOIN du plafond : sans peinture, rend la main au plafond, pas plus tard', () => {
    const cb = vi.fn();
    afterFirstPaint(cb);
    vi.advanceTimersByTime(PAINT_WAIT_CAP_MS + 1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("rend la main tout de suite dans un onglet en arrière-plan, qui ne peint rien", () => {
    setVisibility('hidden');
    const cb = vi.fn();
    afterFirstPaint(cb);
    vi.advanceTimersByTime(0);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(observers).toHaveLength(0);
  });

  it('sans Paint Timing, attend deux frames (et le plafond en dernier recours)', () => {
    vi.stubGlobal('PerformanceObserver', { supportedEntryTypes: [] });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { frames.push(f); return frames.length; });
    const cb = vi.fn();
    afterFirstPaint(cb);
    frames.shift()?.(0);
    vi.advanceTimersByTime(0);
    expect(cb).not.toHaveBeenCalled();
    frames.shift()?.(16);
    vi.advanceTimersByTime(0);
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(PAINT_WAIT_CAP_MS);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
