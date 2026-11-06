// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installBootWatchdog, isBootScreenStuck, BOOT_STALL_MS } from './boot-watchdog';

// Incident du 2026-11-06 : spinner de démarrage éternel quand React ne monte
// pas. Ces tests prouvent la SORTIE : passé le délai, ou dès un échec
// d'amorçage, le spinner laisse place à deux gestes qui fonctionnent.

function bootDom(prerendered = false) {
  document.documentElement.lang = 'fr';
  if (prerendered) document.documentElement.setAttribute('data-prerendered', '');
  else document.documentElement.removeAttribute('data-prerendered');
  document.body.innerHTML =
    '<div id="root"><div id="boot-screen" role="status"><div class="ring"></div></div></div>';
}

describe('boot-watchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    bootDom();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute('data-prerendered');
  });

  it('remplace un spinner resté affiché après le délai par deux sorties', () => {
    const onReload = vi.fn();
    const onReset = vi.fn();
    installBootWatchdog({ onReload, onReset });

    vi.advanceTimersByTime(BOOT_STALL_MS - 1);
    expect(document.querySelector('#boot-screen .ring')).not.toBeNull();
    expect(document.getElementById('boot-rescue')).toBeNull();

    vi.advanceTimersByTime(1);
    const panel = document.getElementById('boot-rescue');
    expect(panel).not.toBeNull();
    expect(document.querySelector('#boot-screen .ring')).toBeNull();

    const [reload, reset] = Array.from(panel!.querySelectorAll('button'));
    reload.click();
    reset.click();
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('affiche la sortie tout de suite quand l’amorçage échoue', () => {
    const wd = installBootWatchdog({ onReload: vi.fn(), onReset: vi.fn() });
    wd.fail();
    expect(document.getElementById('boot-rescue')).not.toBeNull();
    // Le minuteur annulé ne double pas le panneau.
    vi.advanceTimersByTime(BOOT_STALL_MS);
    expect(document.querySelectorAll('#boot-rescue')).toHaveLength(1);
  });

  it('ne fait rien quand React a monté (le spinner a disparu de #root)', () => {
    installBootWatchdog({ onReload: vi.fn(), onReset: vi.fn() });
    // Premier commit de React : `#root` est vidé.
    document.getElementById('root')!.replaceChildren();
    vi.advanceTimersByTime(BOOT_STALL_MS);
    expect(document.getElementById('boot-rescue')).toBeNull();
  });

  it('ne fait rien sur une page prérendue (le contenu est peint, pas le spinner)', () => {
    bootDom(true);
    expect(isBootScreenStuck(document)).toBe(false);
    installBootWatchdog({ onReload: vi.fn(), onReset: vi.fn() });
    vi.advanceTimersByTime(BOOT_STALL_MS);
    expect(document.getElementById('boot-rescue')).toBeNull();
  });

  it('parle anglais sur une page servie en anglais', () => {
    document.documentElement.lang = 'en';
    installBootWatchdog({ onReload: vi.fn(), onReset: vi.fn() }).fail();
    expect(document.getElementById('boot-rescue')!.textContent).toContain('Reload');
  });
});
