// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AUDIENCE_SCRIPT_SRC, AUDIENCE_SITE_KEY,
  stripLocale, isPublicPath, hasPersistedSession,
  shouldLoadAudienceScript, mountAudienceScript,
} from './audience';

/** Faux localStorage minimal — on n'expose que ce que le module lit. */
const storageWith = (...keys: string[]): Pick<Storage, 'key' | 'length'> => ({
  length: keys.length,
  key: (i: number) => keys[i] ?? null,
});

const NO_SESSION = storageWith('cosmo_locale', 'cosmo_active_modules');
const WITH_SESSION = storageWith('cosmo_locale', 'sb-ykeugqfgklejcdbrmawy-auth-token');

describe('stripLocale', () => {
  it('retire un prefixe de locale connu', () => {
    expect(stripLocale('/en/tasks')).toBe('/tasks');
    expect(stripLocale('/fr/')).toBe('/');
  });

  it('laisse intact un chemin sans prefixe', () => {
    expect(stripLocale('/tasks')).toBe('/tasks');
    expect(stripLocale('/')).toBe('/');
  });

  it("ne confond pas un segment de deux lettres avec une locale inconnue", () => {
    expect(stripLocale('/de/tasks')).toBe('/de/tasks');
  });
});

describe('isPublicPath', () => {
  it('reconnait les pages publiques', () => {
    for (const p of ['/', '/blog', '/guide', '/login', '/signup', '/invite/abc', '/a-propos']) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });

  it("reconnait les ecrans de l'app authentifiee", () => {
    for (const p of ['/dashboard', '/tasks', '/settings', '/admin', '/entreprise', '/okr']) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });

  it('applique la regle aussi sous un prefixe de locale', () => {
    expect(isPublicPath('/en/dashboard')).toBe(false);
    expect(isPublicPath('/en/blog')).toBe(true);
  });

  it("couvre les sous-routes d'un ecran protege", () => {
    expect(isPublicPath('/entreprise/onboarding')).toBe(false);
  });
});

describe('hasPersistedSession', () => {
  it('detecte la cle de session auth-js', () => {
    expect(hasPersistedSession(WITH_SESSION)).toBe(true);
  });

  it('renvoie false quand aucune cle de session n’est presente', () => {
    expect(hasPersistedSession(NO_SESSION)).toBe(false);
  });

  it('ne confond pas une cle voisine avec une session', () => {
    expect(hasPersistedSession(storageWith('sb-projet-auth-token-backup', 'sbauth-token'))).toBe(false);
  });

  it('localStorage inaccessible → suppose une session (on ne charge pas)', () => {
    const hostile = {
      get length(): number { throw new DOMException('SecurityError'); },
      key: () => null,
    };
    expect(hasPersistedSession(hostile)).toBe(true);
  });
});

describe('shouldLoadAudienceScript', () => {
  it('charge sur une page publique sans session', () => {
    expect(shouldLoadAudienceScript({ pathname: '/blog', storage: NO_SESSION })).toBe(true);
  });

  it('ne charge JAMAIS quand une session existe, meme sur une page publique', () => {
    expect(shouldLoadAudienceScript({ pathname: '/', storage: WITH_SESSION })).toBe(false);
  });

  it("ne charge JAMAIS sur un ecran de l'app, meme sans session detectee", () => {
    expect(shouldLoadAudienceScript({ pathname: '/dashboard', storage: NO_SESSION })).toBe(false);
  });
});

describe('mountAudienceScript', () => {
  beforeEach(() => { document.head.innerHTML = ''; });

  it('injecte la balise avec la cle de site, en async', () => {
    expect(mountAudienceScript(document, { pathname: '/', storage: NO_SESSION })).toBe(true);

    const el = document.head.querySelector<HTMLScriptElement>(`script[src="${AUDIENCE_SCRIPT_SRC}"]`);
    expect(el).not.toBeNull();
    expect(el?.async).toBe(true);
    expect(el?.dataset.key).toBe(AUDIENCE_SITE_KEY);
  });

  it("n'injecte rien quand une session existe", () => {
    expect(mountAudienceScript(document, { pathname: '/', storage: WITH_SESSION })).toBe(false);
    expect(document.head.querySelector('script')).toBeNull();
  });

  it('est idempotent — pas de balise en double', () => {
    mountAudienceScript(document, { pathname: '/', storage: NO_SESSION });
    expect(mountAudienceScript(document, { pathname: '/', storage: NO_SESSION })).toBe(false);
    expect(document.head.querySelectorAll('script')).toHaveLength(1);
  });
});
