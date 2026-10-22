// @vitest-environment jsdom
//
// C-45 — la panne que cette sonde existe pour rendre VISIBLE est un SUCCÈS
// SILENCIEUX : GoTrue ignore un `redirectTo` non couvert par l'allow list du
// projet Supabase et sert le Site URL à la place. La connexion réussit,
// l'invitation d'entreprise se perd, et rien ne le dit.
//
// D'où la forme de ces tests : chaque cas où la sonde doit se TAIRE est
// doublé du cas voisin où elle doit PARLER. Une sonde qui rend toujours
// `null` passerait la moitié d'une suite écrite sans ce doublage, et c'est
// exactement la forme de garde qui a été prise en défaut quatre fois dans ce
// dépôt (« une garde se vérifie sur ce qu'elle REGARDE »).
import { describe, it, expect, beforeEach, vi } from 'vitest';

const captureMessage = vi.fn();
vi.mock('@/lib/monitoring', () => ({
  captureMessage: (...a: unknown[]) => captureMessage(...a),
}));

import {
  OAUTH_INTENT_KEY,
  OAUTH_INTENT_TTL_MS,
  compareOAuthLanding,
  consumeOAuthLandingMismatch,
  readOAuthRedirectIntent,
  recordOAuthRedirectIntent,
  redactOAuthPath,
  reportOAuthLandingMismatch,
} from './oauth-landing';

const T0 = 1_700_000_000_000;
const INVITE = 'https://thecosmo.app/en/org-invite/A1b2C3d4E5f6G7h8I9j0';
const SITE_URL = 'https://thecosmo.app/dashboard';

beforeEach(() => {
  sessionStorage.clear();
  captureMessage.mockClear();
  vi.restoreAllMocks();
});

describe('compareOAuthLanding — ce que la sonde regarde', () => {
  it('se tait quand aucun départ OAuth n’est en attente', () => {
    expect(compareOAuthLanding(null, SITE_URL, T0)).toBeNull();
  });

  it('PARLE quand GoTrue sert le Site URL au lieu du redirectTo demandé', () => {
    const mismatch = compareOAuthLanding({ url: INVITE, at: T0 }, `${SITE_URL}?code=xyz`, T0 + 4_000);
    expect(mismatch).toEqual({
      expected: 'https://thecosmo.app/en/org-invite/:token',
      actual: 'https://thecosmo.app/dashboard',
    });
  });

  it('se tait quand l’atterrissage EST la destination demandée', () => {
    expect(
      compareOAuthLanding({ url: INVITE, at: T0 }, `${INVITE}?code=xyz`, T0 + 4_000),
    ).toBeNull();
  });

  it('ignore query et fragment, que GoTrue ajoute lui-même', () => {
    expect(
      compareOAuthLanding({ url: INVITE, at: T0 }, `${INVITE}#access_token=abc`, T0),
    ).toBeNull();
    // …mais pas le CHEMIN, qui est ce qui se perd.
    expect(compareOAuthLanding({ url: INVITE, at: T0 }, `${SITE_URL}#access_token=abc`, T0)).not.toBeNull();
  });

  it('voit la perte du seul préfixe de locale (un anglophone rendu au produit français)', () => {
    const mismatch = compareOAuthLanding(
      { url: 'https://thecosmo.app/en/dashboard', at: T0 },
      SITE_URL,
      T0,
    );
    expect(mismatch).toEqual({
      expected: 'https://thecosmo.app/en/dashboard',
      actual: 'https://thecosmo.app/dashboard',
    });
  });

  it('ne compte pas un slash final comme un écart', () => {
    expect(
      compareOAuthLanding({ url: 'https://thecosmo.app/dashboard/', at: T0 }, SITE_URL, T0),
    ).toBeNull();
  });

  it('se tait passé le délai, parle juste avant', () => {
    expect(compareOAuthLanding({ url: INVITE, at: T0 }, SITE_URL, T0 + OAUTH_INTENT_TTL_MS + 1)).toBeNull();
    expect(compareOAuthLanding({ url: INVITE, at: T0 }, SITE_URL, T0 + OAUTH_INTENT_TTL_MS)).not.toBeNull();
  });

  it('se tait sur une URL inanalysable plutôt que de lever', () => {
    expect(compareOAuthLanding({ url: 'pas-une-url', at: T0 }, SITE_URL, T0)).toBeNull();
    expect(compareOAuthLanding({ url: INVITE, at: T0 }, 'pas-une-url', T0)).toBeNull();
  });
});

describe('redactOAuthPath — le jeton d’invitation ne part nulle part', () => {
  it('caviarde le segment qui porte le jeton à usage unique', () => {
    expect(redactOAuthPath('/en/org-invite/A1b2C3d4E5f6G7h8I9j0')).toBe('/en/org-invite/:token');
  });

  it('laisse les segments de route lisibles', () => {
    expect(redactOAuthPath('/en/dashboard')).toBe('/en/dashboard');
    expect(redactOAuthPath('/entreprise/onboarding')).toBe('/entreprise/onboarding');
  });
});

describe('intention persistée', () => {
  it('relit ce qu’elle a écrit', () => {
    recordOAuthRedirectIntent(INVITE, T0);
    expect(readOAuthRedirectIntent()).toEqual({ url: INVITE, at: T0 });
  });

  it('rend null sur une valeur corrompue au lieu de lever', () => {
    sessionStorage.setItem(OAUTH_INTENT_KEY, '{pas du json');
    expect(readOAuthRedirectIntent()).toBeNull();
    sessionStorage.setItem(OAUTH_INTENT_KEY, JSON.stringify({ url: 42 }));
    expect(readOAuthRedirectIntent()).toBeNull();
  });

  it('ne fait pas tomber la connexion quand sessionStorage jette', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => recordOAuthRedirectIntent(INVITE, T0)).not.toThrow();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(readOAuthRedirectIntent()).toBeNull();
  });

  it('se consomme UNE FOIS : la navigation suivante n’est plus accusée', () => {
    recordOAuthRedirectIntent(INVITE, T0);
    expect(consumeOAuthLandingMismatch(SITE_URL, T0)).not.toBeNull();
    expect(consumeOAuthLandingMismatch(SITE_URL, T0)).toBeNull();
    expect(readOAuthRedirectIntent()).toBeNull();
  });

  it('se consomme AUSSI quand l’atterrissage est bon', () => {
    recordOAuthRedirectIntent(INVITE, T0);
    expect(consumeOAuthLandingMismatch(INVITE, T0)).toBeNull();
    expect(readOAuthRedirectIntent()).toBeNull();
  });
});

describe('reportOAuthLandingMismatch — le signal qui survit au build prod', () => {
  it('émet vers Sentry, sans le jeton, et rend l’écart', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    recordOAuthRedirectIntent(INVITE, T0);
    const mismatch = reportOAuthLandingMismatch(`${SITE_URL}?code=xyz`, T0 + 1_000);

    expect(mismatch).not.toBeNull();
    expect(captureMessage).toHaveBeenCalledTimes(1);
    const [message, context] = captureMessage.mock.calls[0] as [string, Record<string, unknown>];
    expect(message).toMatch(/redirectTo/);
    expect(context).toMatchObject({ level: 'warning', tags: { context: 'oauth-redirect-allowlist' } });
    // Le jeton à usage unique ne quitte pas le navigateur.
    expect(JSON.stringify(context)).not.toContain('A1b2C3d4E5f6G7h8I9j0');
    expect(JSON.stringify(context)).toContain(':token');
    expect(err).toHaveBeenCalled();
  });

  it('n’émet RIEN quand l’atterrissage est conforme', () => {
    recordOAuthRedirectIntent(INVITE, T0);
    expect(reportOAuthLandingMismatch(INVITE, T0 + 1_000)).toBeNull();
    expect(captureMessage).not.toHaveBeenCalled();
  });
});
