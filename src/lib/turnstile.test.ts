// @vitest-environment jsdom
//
// Le test qui compte ici n'est pas « le widget marche » — il n'y a pas de
// Cloudflare dans un test. C'est le TÉMOIN : tant que la clé n'est pas posée,
// **rien ne change**. Ni script tiers chargé, ni jeton produit, ni parcours
// modifié. C'est ce qui rend ce code sûr à déployer avant que le compte
// Cloudflare existe, et c'est exactement l'état de la production aujourd'hui.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const withSiteKey = async (key: string | undefined) => {
  vi.resetModules();
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', key ?? '');
  return import('./turnstile');
};

beforeEach(() => {
  document.head.replaceChildren();
  delete window.turnstile;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('turnstile — désactivé tant que la clé publique est absente', () => {
  it('ne signale aucune protection quand la clé est vide', async () => {
    const { isTurnstileEnabled, turnstileSiteKey } = await withSiteKey('');
    expect(isTurnstileEnabled()).toBe(false);
    expect(turnstileSiteKey()).toBeNull();
  });

  it("traite une clé faite d'espaces comme absente", async () => {
    const { isTurnstileEnabled } = await withSiteKey('   ');
    expect(isTurnstileEnabled()).toBe(false);
  });

  // 🔴 LE test de ce fichier. Charger le script d'un fournisseur qu'on n'utilise
  // pas encore, ce serait une requête réseau et une dépendance de disponibilité
  // imposées à tous les visiteurs, y compris celui qui rebondit.
  it("n'injecte AUCUN script tiers quand la protection n'est pas configurée", async () => {
    const { loadTurnstile } = await withSiteKey('');
    await expect(loadTurnstile()).resolves.toBeNull();
    expect(document.querySelector(`script[src="${SCRIPT_SRC}"]`)).toBeNull();
  });
});

describe('turnstile — actif quand la clé est posée', () => {
  it('rend la clé et injecte le script une seule fois', async () => {
    const { isTurnstileEnabled, turnstileSiteKey, loadTurnstile } = await withSiteKey('0x4AAA');
    expect(isTurnstileEnabled()).toBe(true);
    expect(turnstileSiteKey()).toBe('0x4AAA');

    void loadTurnstile();
    void loadTurnstile();
    expect(document.querySelectorAll(`script[src="${SCRIPT_SRC}"]`)).toHaveLength(1);
  });

  // Un CAPTCHA injoignable ne doit jamais devenir une porte fermée : extension
  // de navigateur, réseau filtrant, panne du fournisseur. On résout `null`, et
  // l'appelant laisse soumettre — c'est le serveur qui tranchera.
  it('résout null si le script échoue à charger, sans lever', async () => {
    const { loadTurnstile } = await withSiteKey('0x4AAA');
    const pending = loadTurnstile();
    document.querySelector(`script[src="${SCRIPT_SRC}"]`)?.dispatchEvent(new Event('error'));
    await expect(pending).resolves.toBeNull();
  });
});

describe('resetTurnstile', () => {
  it('ne lève pas quand le script est absent', async () => {
    const { resetTurnstile } = await withSiteKey('0x4AAA');
    expect(() => resetTurnstile()).not.toThrow();
  });

  it('réarme le widget quand le script est là', async () => {
    const { resetTurnstile } = await withSiteKey('0x4AAA');
    const reset = vi.fn();
    window.turnstile = { render: vi.fn(), reset, remove: vi.fn() };
    resetTurnstile();
    expect(reset).toHaveBeenCalledOnce();
  });
});
