// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setConsent } from './cookie-consent';
import {
  hasCredentialForm,
  isPublicPath,
  referrerHost,
  shouldMeasure,
  startTrafficMeasurement,
  utmParams,
} from './traffic';
import { parseUserAgent } from './traffic-ua';

/**
 * La mesure d'audience remplace un script tiers (Veske). Ce qui compte ici est
 * ce qu'elle N'ENVOIE PAS : rien sans accord, rien sur un écran connecté ou un
 * formulaire d'identifiants, rien de la query string hors `utm_*`.
 */

const sessionKey = 'sb-ykeugqfgklejcdbrmawy-auth-token';

function go(path: string) {
  window.history.pushState({}, '', path);
}

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
}

describe('règles de mesure', () => {
  it('public, hors app connectée et hors formulaire d identifiants', () => {
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/en/blog/okr')).toBe(true);
    expect(isPublicPath('/tasks')).toBe(false);
    expect(isPublicPath('/en/dashboard')).toBe(false);
    expect(hasCredentialForm('/signup')).toBe(true);
    expect(hasCredentialForm('/es/login')).toBe(true);
    expect(hasCredentialForm('/blog')).toBe(false);
  });

  it('exige un accord explicite : null n est pas une acceptation', () => {
    const empty = { key: () => null, length: 0 };
    expect(shouldMeasure('/', empty, null)).toBe(false);
    expect(shouldMeasure('/', empty, 'refused')).toBe(false);
    expect(shouldMeasure('/', empty, 'accepted')).toBe(true);
  });

  it('se coupe dès qu une session existe', () => {
    const withSession = { key: () => sessionKey, length: 1 };
    expect(shouldMeasure('/', withSession, 'accepted')).toBe(false);
  });

  it('ne garde du référent que l hôte, et seulement s il est externe', () => {
    expect(referrerHost('https://www.google.com/search?q=cosmo', 'thecosmo.app')).toBe('google.com');
    expect(referrerHost('https://thecosmo.app/blog', 'thecosmo.app')).toBeUndefined();
    expect(referrerHost('', 'thecosmo.app')).toBeUndefined();
  });

  it('ne retient de la query string que les utm', () => {
    expect(utmParams('?utm_source=insta&email=a@b.c&utm_campaign=lancement'))
      .toEqual({ utm_source: 'insta', utm_campaign: 'lancement' });
  });
});

describe('startTrafficMeasurement', () => {
  let sent: Array<Record<string, unknown>>;
  let stop: () => void;
  let clock: number;

  beforeEach(() => {
    localStorage.clear();
    sent = [];
    clock = 1_000;
    go('/');
  });

  afterEach(() => stop?.());

  const start = () => {
    stop = startTrafficMeasurement({
      win: window,
      doc: document,
      send: (body) => sent.push(JSON.parse(body) as Record<string, unknown>),
      now: () => clock,
    });
  };

  it('n envoie rien sans accord, puis compte la page dès l accord', () => {
    start();
    expect(sent).toEqual([]);
    setConsent('accepted');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: 'view', path: '/' });
  });

  it('compte chaque navigation et la durée de la page quittée', async () => {
    setConsent('accepted');
    start();
    clock = 6_000;
    go('/blog');
    await flush();
    expect(sent.map((e) => e.kind)).toEqual(['view', 'leave', 'view']);
    expect(sent[1]).toMatchObject({ kind: 'leave', path: '/', duration_ms: 5_000 });
    expect(sent[2]).toMatchObject({ path: '/blog' });
  });

  it('ne compte jamais un formulaire d identifiants ni un écran connecté', async () => {
    setConsent('accepted');
    start();
    sent = [];
    go('/signup');
    await flush();
    go('/tasks');
    await flush();
    expect(sent.filter((e) => e.kind === 'view')).toEqual([]);
  });

  it('s arrête dès qu une session apparaît, sans rechargement', async () => {
    setConsent('accepted');
    start();
    sent = [];
    localStorage.setItem(sessionKey, '{}');
    go('/blog');
    await flush();
    expect(sent).toEqual([]);
  });

  it('compte un clic sur un bouton marqué data-cta', () => {
    setConsent('accepted');
    start();
    const button = document.createElement('button');
    button.setAttribute('data-cta', 'Commencer gratuitement');
    document.body.appendChild(button);
    button.click();
    expect(sent.at(-1)).toMatchObject({ kind: 'cta', cta: 'Commencer gratuitement', path: '/' });
    button.remove();
  });

  it('ne dépose rien sur l appareil', () => {
    setConsent('accepted');
    const before = Object.keys(localStorage).sort();
    start();
    go('/blog');
    expect(Object.keys(localStorage).sort()).toEqual(before);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });
});

describe('parseUserAgent', () => {
  it('reconnaît les familles courantes', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(parseUserAgent(iphone)).toMatchObject({ browser: 'Safari', os: 'iOS', device: 'mobile', bot: false });
    const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0';
    expect(parseUserAgent(edge)).toMatchObject({ browser: 'Edge', os: 'Windows', device: 'desktop' });
    const tablet = 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    expect(parseUserAgent(tablet).device).toBe('tablet');
  });

  it('écarte les robots et les user-agents vides', () => {
    expect(parseUserAgent('Googlebot/2.1 (+http://www.google.com/bot.html)').bot).toBe(true);
    expect(parseUserAgent('').bot).toBe(true);
  });
});
