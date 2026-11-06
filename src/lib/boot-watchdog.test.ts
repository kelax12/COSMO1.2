// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  installBootWatchdog,
  isBootScreenStuck,
  repairAssetCache,
  clearAssetRepairFlag,
  ASSET_REPAIR_FLAG,
  BOOT_STALL_MS,
} from './boot-watchdog';

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

  it('affiche la sortie tout de suite quand l’amorçage échoue (réparation déjà tentée)', () => {
    const wd = installBootWatchdog({ onReload: vi.fn(), onReset: vi.fn(), storage: null });
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
    installBootWatchdog({ onReload: vi.fn(), onReset: vi.fn(), storage: null }).fail();
    expect(document.getElementById('boot-rescue')!.textContent).toContain('Reload');
  });

  // ── Incident mesuré du 2026-11-06 : CSS de `main` refusé (copie `text/plain`
  // en cache `immutable`), `import('./main')` rejeté, page prérendue inerte. ──

  it('premier échec : répare le cache puis recharge, sans panneau', async () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const repair = vi.fn().mockResolvedValue(3);
    const reloadPage = vi.fn();
    installBootWatchdog({ storage, repair, reloadPage }).fail();
    expect(document.getElementById('boot-rescue')).toBeNull();
    await vi.runAllTimersAsync();
    expect(repair).toHaveBeenCalledTimes(1);
    expect(reloadPage).toHaveBeenCalledTimes(1);
    expect(store.get(ASSET_REPAIR_FLAG)).toBe('1');
  });

  it('second échec dans le même onglet : plus de boucle, les sorties s’affichent', () => {
    const storage = { getItem: () => '1', setItem: vi.fn() };
    const reloadPage = vi.fn();
    installBootWatchdog({ storage, repair: vi.fn().mockResolvedValue(0), reloadPage }).fail();
    expect(reloadPage).not.toHaveBeenCalled();
    expect(document.getElementById('boot-rescue')).not.toBeNull();
  });

  it('page prérendue : un échec certain retire la copie inerte et montre les sorties', () => {
    bootDom(true);
    const hero = document.createElement('div');
    hero.id = 'lp-hero';
    document.body.prepend(hero);
    installBootWatchdog({ onReload: vi.fn(), onReset: vi.fn(), storage: null }).fail();
    expect(document.documentElement.hasAttribute('data-prerendered')).toBe(false);
    expect(document.getElementById('lp-hero')).toBeNull();
    expect(document.getElementById('boot-rescue')).not.toBeNull();
  });

  it('les boutons par défaut réparent le cache AVANT de recharger', async () => {
    const order: string[] = [];
    const repair = vi.fn(async () => { order.push('repair'); });
    const reloadPage = vi.fn(() => { order.push('reload'); });
    installBootWatchdog({ storage: null, repair, reloadPage }).fail();
    document.querySelector<HTMLButtonElement>('#boot-rescue button')!.click();
    await vi.runAllTimersAsync();
    expect(order).toEqual(['repair', 'reload']);
  });

  it('repairAssetCache redemande chaque /assets/ de l’origine en contournant le cache', async () => {
    document.head.innerHTML =
      '<link rel="stylesheet" href="/assets/main-AAA.css">' +
      '<script type="module" src="/assets/index-BBB.js"></script>' +
      '<link rel="preload" href="/fonts/inter.woff2">' +
      '<script src="https://autre.example/assets/x.js"></script>';
    const perf = { getEntriesByType: () => [{ name: `${location.origin}/assets/main-CCC.js` }, { name: `${location.origin}/assets/main-AAA.css` }] } as unknown as Pick<Performance, 'getEntriesByType'>;
    const fetchImpl = vi.fn().mockResolvedValue(new Response(''));
    const n = await repairAssetCache(document, fetchImpl as unknown as typeof fetch, perf);
    const urls = fetchImpl.mock.calls.map((c) => new URL(c[0] as string).pathname).sort();
    expect(n).toBe(3);
    expect(urls).toEqual(['/assets/index-BBB.js', '/assets/main-AAA.css', '/assets/main-CCC.js']);
    expect(fetchImpl.mock.calls.every((c) => (c[1] as RequestInit).cache === 'reload')).toBe(true);
    document.head.innerHTML = '';
  });

  it('un fetch qui échoue ne fait pas lever la réparation', async () => {
    document.head.innerHTML = '<link rel="stylesheet" href="/assets/main-AAA.css">';
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('offline'));
    const perf = { getEntriesByType: () => [] } as unknown as Pick<Performance, 'getEntriesByType'>;
    await expect(repairAssetCache(document, fetchImpl as unknown as typeof fetch, perf)).resolves.toBe(1);
    document.head.innerHTML = '';
  });

  it('clearAssetRepairFlag rend sa réparation à la prochaine panne', () => {
    const removeItem = vi.fn();
    clearAssetRepairFlag({ removeItem });
    expect(removeItem).toHaveBeenCalledWith(ASSET_REPAIR_FLAG);
  });
});
