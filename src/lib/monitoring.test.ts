// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// C-13 · C-14 — Sentry différé, et l'angle mort que ça crée
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CES TESTS EXISTENT. L'arbitrage du 2026-09-03 sort Sentry du
// chemin critique (49,3 ko) et nomme lui-même le risque : « les erreurs des
// premières millisecondes ne seraient plus capturées, et c'est exactement la
// fenêtre du bug de `Layout` du 2026-09-03 ».
//
// Le tampon EST la réponse à ce risque. Un tampon qui perd, qui réordonne ou
// qui laisse fuir une erreur ferait de la mise en différé une régression
// d'observabilité — et une régression d'observabilité ne se voit pas : elle se
// manifeste le jour où on cherche une erreur qui n'a jamais été envoyée.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  captureException,
  captureMessage,
  addBreadcrumb,
  setUser,
  installEarlyHandlers,
  startMonitoring,
  __bufferedForTest,
  __resetForTest,
} from './monitoring';

// `startMonitoring` fait un vrai `import('./sentry-client')`. On le remplace
// pour tester le TAMPON, qui est ce qui nous appartient — pas le SDK.
vi.mock('./sentry-client', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  browserTracingIntegration: vi.fn(),
}));

import * as sdk from './sentry-client';

/**
 * Dispatch un `ErrorEvent` SANS le laisser remonter en exception non
 * rattrapée : jsdom la ferait échouer la suite entière, alors que c'est
 * précisément l'événement qu'on veut observer.
 */
function dispatchGlobalError(message: string): void {
  const swallow = (e: Event) => e.preventDefault();
  window.addEventListener('error', swallow);
  window.dispatchEvent(new ErrorEvent('error', {
    error: new Error(message),
    message,
    cancelable: true,
  }));
  window.removeEventListener('error', swallow);
}

beforeEach(() => {
  __resetForTest();
  vi.clearAllMocks();
});

describe('avant le chargement de Sentry — rien ne se perd', () => {
  it('met les exceptions en tampon au lieu de les jeter', () => {
    captureException(new Error('tres tot'));
    expect(__bufferedForTest()).toHaveLength(1);
  });

  it('rejoue le tampon a l identique une fois le SDK charge', async () => {
    const boom = new Error('tres tot');
    captureException(boom, { tags: { context: 'boot' } });

    await startMonitoring(() => sdk.init({}));

    expect(sdk.captureException).toHaveBeenCalledWith(boom, { tags: { context: 'boot' } });
    // Le tampon est VIDE apres rejeu : sinon un second chargement le rejouerait
    // une seconde fois, et chaque erreur partirait en double.
    expect(__bufferedForTest()).toHaveLength(0);
  });

  it('passe DIRECTEMENT une fois charge, sans repasser par le tampon', async () => {
    await startMonitoring(() => sdk.init({}));

    captureException(new Error('apres'));
    expect(sdk.captureException).toHaveBeenCalledTimes(1);
    expect(__bufferedForTest()).toHaveLength(0);
  });

  it('respecte l ORDRE du rejeu : utilisateur, fils d Ariane, puis evenements', async () => {
    // ⚠️ Ce n'est pas cosmétique. L'utilisateur est un ÉTAT : posé après, les
    // premiers événements partent anonymes. Un fil d'Ariane n'a de valeur que
    // s'il PRÉCÈDE l'erreur qu'il explique.
    setUser({ id: 'u-1' });
    addBreadcrumb({ category: 'api', message: 'PGRST116' });
    captureException(new Error('apres le fil'));

    const order: string[] = [];
    vi.mocked(sdk.setUser).mockImplementation(() => { order.push('user'); });
    vi.mocked(sdk.addBreadcrumb).mockImplementation(() => { order.push('crumb'); });
    vi.mocked(sdk.captureException).mockImplementation(() => { order.push('error'); return ''; });

    await startMonitoring(() => sdk.init({}));
    expect(order).toEqual(['user', 'crumb', 'error']);
  });

  it('BORNE le tampon, et DIT combien il a perdu', async () => {
    // Un tampon non borné sur une boucle d'erreurs (un `useEffect` qui
    // relance, un rendu en échec) mangerait la mémoire de l'onglet. Mais
    // perdre en silence serait pire : on chercherait une erreur qui n'est
    // jamais partie.
    for (let i = 0; i < 60; i++) captureException(new Error(`e${i}`));
    expect(__bufferedForTest().length).toBeLessThanOrEqual(50);

    await startMonitoring(() => sdk.init({}));
    expect(sdk.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('perdus avant chargement'),
      'warning',
    );
  });
});

describe('les filets precoces — la fenetre du bug de Layout', () => {
  it('capturent une erreur globale avant tout chargement', () => {
    installEarlyHandlers();
    dispatchGlobalError('avant le montage');
    expect(__bufferedForTest()).toHaveLength(1);
  });

  it('sont RETIRES quand Sentry pose les siens', async () => {
    // Sinon chaque erreur globale part DEUX fois : une par notre filet, une
    // par celui du SDK.
    installEarlyHandlers();
    await startMonitoring(() => sdk.init({}));

    vi.mocked(sdk.captureException).mockClear();
    dispatchGlobalError('apres');
    // Notre filet ne doit plus rien ajouter : c'est le SDK qui écoute.
    expect(sdk.captureException).not.toHaveBeenCalled();
  });
});

describe('l observabilite ne casse jamais ce qu elle observe', () => {
  it('un SDK qui leve ne fait pas lever l appelant', async () => {
    await startMonitoring(() => sdk.init({}));
    vi.mocked(sdk.captureException).mockImplementation(() => { throw new Error('sentry casse'); });

    expect(() => captureException(new Error('x'))).not.toThrow();
    expect(() => captureMessage('y')).not.toThrow();
    expect(() => addBreadcrumb({ message: 'z' })).not.toThrow();
    expect(() => setUser({ id: 'u' })).not.toThrow();
  });

  it('un chargement qui echoue laisse l application vivante ET le tampon intact', async () => {
    // Bloqueur de pub, coupure reseau : l'app continue, et ce qu'on avait mis
    // de cote reste disponible pour un rechargement.
    captureException(new Error('en attente'));
    await startMonitoring(() => { throw new Error('init impossible'); });
    expect(__bufferedForTest()).toHaveLength(1);
  });
});
