// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGuideRun, type GuideRunDeps } from './guide-runner';
import type { GuideStep } from './guide-types';

const el = () => document.createElement('button');

const makeDeps = (found: Record<string, HTMLElement | null>): GuideRunDeps & { log: string[] } => {
  const log: string[] = [];
  return {
    log,
    reducedMotion: false,
    find: (id) => found[id] ?? null,
    navigate: (section) => { log.push(`nav:${section}`); },
    moveCursor: async (target) => { log.push(`move:${target.dataset.g ?? '?'}`); },
    click: (target) => { log.push(`click:${target.dataset.g ?? '?'}`); },
    showBubble: (key) => { log.push(`bubble:${key ?? 'none'}`); },
    onStep: (i, n) => { log.push(`step:${i + 1}/${n}`); },
  };
};

const tag = (g: string) => { const b = el(); b.dataset.g = g; return b; };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('createGuideRun', () => {
  it('joue les étapes dans l\'ordre et finit en handoff', async () => {
    const steps: GuideStep[] = [
      { kind: 'goto', section: 'projects', via: 'nav-projects' },
      { kind: 'click', target: 'projects-new' },
      { kind: 'field', target: 'project-form-name', bubbleKey: 'b.name' },
      { kind: 'handoff', bubbleKey: 'b.done' },
    ];
    const deps = makeDeps({ 'nav-projects': tag('nav'), 'projects-new': tag('new'), 'project-form-name': tag('name') });
    const run = createGuideRun(steps, deps);
    const done = run.start();
    await vi.runAllTimersAsync();
    expect(await done).toEqual({ status: 'completed' });
    expect(deps.log).toEqual([
      'step:1/4', 'move:nav', 'nav:projects',
      'step:2/4', 'move:new', 'click:new',
      'step:3/4', 'move:name', 'bubble:b.name',
      'step:4/4', 'bubble:b.done',
    ]);
  });

  it('cible absente : s\'arrête après 3 s avec le motif missing', async () => {
    const deps = makeDeps({});
    const run = createGuideRun([{ kind: 'click', target: 'nope' }], deps);
    const done = run.start();
    await vi.advanceTimersByTimeAsync(3100);
    expect(await done).toEqual({ status: 'missing', target: 'nope' });
  });

  it('cible qui apparaît tard est attendue', async () => {
    const found: Record<string, HTMLElement | null> = {};
    const deps = makeDeps(found);
    const run = createGuideRun([{ kind: 'click', target: 'late' }], deps);
    const done = run.start();
    await vi.advanceTimersByTimeAsync(1000);
    found.late = tag('late');
    await vi.runAllTimersAsync();
    expect(await done).toEqual({ status: 'completed' });
    expect(deps.log).toContain('click:late');
  });

  it('pick-first sur liste vide : motif empty', async () => {
    const deps = makeDeps({ list: document.createElement('div') });
    const run = createGuideRun([{ kind: 'pick-first', target: 'list', emptyKey: 'e.noProject' }], deps);
    const done = run.start();
    await vi.runAllTimersAsync();
    expect(await done).toEqual({ status: 'empty', emptyKey: 'e.noProject' });
  });

  it('quitter interrompt sans autre effet', async () => {
    const deps = makeDeps({ a: tag('a'), b: tag('b') });
    const run = createGuideRun([{ kind: 'click', target: 'a' }, { kind: 'click', target: 'b' }], deps);
    const done = run.start();
    run.quit();
    await vi.runAllTimersAsync();
    expect(await done).toEqual({ status: 'quit' });
    expect(deps.log).not.toContain('click:b');
  });

  it('pause gèle, reprise continue', async () => {
    const deps = makeDeps({ a: tag('a'), b: tag('b') });
    const run = createGuideRun([{ kind: 'click', target: 'a' }, { kind: 'click', target: 'b' }], deps);
    const done = run.start();
    await vi.advanceTimersByTimeAsync(10);
    run.pause();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(deps.log).not.toContain('click:b');
    run.resume();
    await vi.runAllTimersAsync();
    expect(await done).toEqual({ status: 'completed' });
    expect(deps.log).toContain('click:b');
  });
});
