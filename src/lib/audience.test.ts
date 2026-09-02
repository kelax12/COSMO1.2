// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AUDIENCE_SCRIPT_SRC, AUDIENCE_SITE_KEY,
  stripLocale, isPublicPath, hasPersistedSession,
  shouldLoadAudienceScript, mountAudienceScript,
} from './audience';

/**
 * Faux localStorage minimal — on n'expose que ce que le module lit.
 *
 * `getItem` sert au consentement aux traceurs : depuis qu'il conditionne le
 * chargement, le module lit une valeur en plus des noms de clés. Le défaut est
 * « accepté », pour que les tests d'aiguillage historiques (page publique,
 * session persistée) continuent de mesurer CE QU'ILS mesurent et pas le
 * consentement. Le consentement a ses propres tests, plus bas.
 */
const storageWith = (
  ...keys: string[]
): Pick<Storage, 'key' | 'length' | 'getItem'> => ({
  length: keys.length,
  key: (i: number) => keys[i] ?? null,
  getItem: (k: string) => (k === 'cosmo_cookie_consent' ? 'accepted' : null),
});

/** Même faux stockage, mais avec une réponse de consentement choisie. */
const storageWithConsent = (
  consent: string | null,
  ...keys: string[]
): Pick<Storage, 'key' | 'length' | 'getItem'> => ({
  length: keys.length,
  key: (i: number) => keys[i] ?? null,
  getItem: (k: string) => (k === 'cosmo_cookie_consent' ? consent : null),
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

describe('consentement aux traceurs', () => {
  beforeEach(() => {
    document.head.querySelectorAll('script').forEach((n) => n.remove());
  });

  it('ne charge RIEN tant que l utilisateur n a pas repondu', () => {
    // `null` n'est pas une acceptation tacite : c'est tout l'enjeu de A4.
    const storage = storageWithConsent(null, 'cosmo_locale');
    expect(shouldLoadAudienceScript({ pathname: '/', storage })).toBe(false);
  });

  it('ne charge RIEN si l utilisateur a refuse', () => {
    const storage = storageWithConsent('refused', 'cosmo_locale');
    expect(shouldLoadAudienceScript({ pathname: '/', storage })).toBe(false);
  });

  it('charge apres acceptation explicite, sur page publique et hors session', () => {
    const storage = storageWithConsent('accepted', 'cosmo_locale');
    expect(shouldLoadAudienceScript({ pathname: '/', storage })).toBe(true);
  });

  it('le refus prime sur toutes les autres conditions reunies', () => {
    // Page publique + aucune session : tout serait vert SAUF le consentement.
    const storage = storageWithConsent('refused', 'cosmo_locale');
    expect(mountAudienceScript(document, { pathname: '/blog', storage })).toBe(false);
    expect(document.querySelector(`script[src="${AUDIENCE_SCRIPT_SRC}"]`)).toBeNull();
  });

  it('une valeur inattendue vaut absence de reponse, donc aucun chargement', () => {
    const storage = storageWithConsent('peut-etre', 'cosmo_locale');
    expect(shouldLoadAudienceScript({ pathname: '/', storage })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Régression du 2026-09-01 — le script ne doit JAMAIS tourner sur une
// page où l'on saisit son email.
//
// `vendor-watch.yml` a détecté que le script servi avait changé. Sa
// nouvelle version contient un `tryIdentify()` qui lit les champs d'un
// formulaire d'inscription, en extrait l'ADRESSE EMAIL et le NOM, et les
// envoie au fournisseur — déclenché sur `submit` ET sur un clic qui
// ressemble à une inscription, donc dans une SPA comme la nôtre.
//
// Le registre RGPD (art. 30, §T8) ne déclare que « adresse de la page,
// page référente, adresse IP, navigateur ». Un consentement recueilli
// pour une mesure d'audience ne couvre pas l'identité de la personne.
//
// Ces pages sont publiques et sans session : les trois conditions de
// chargement étaient réunies. Ce test est le cliquet.
// ═══════════════════════════════════════════════════════════════════
describe('pages à formulaire d’identifiants', () => {
  const consenti = {
    length: 0,
    key: () => null,
    getItem: (k: string) => (k === 'cosmo_cookie_consent' ? 'accepted' : null),
  };

  it('ne monte jamais la mesure là où l’on saisit un email', () => {
    for (const p of [
      '/signup', '/login', '/forgot-password', '/reset-password',
      '/invite/abc123', '/org-invite/abc123',
      '/en/signup', '/en/login', // le préfixe de locale ne doit pas rouvrir la porte
    ]) {
      expect(shouldLoadAudienceScript({ pathname: p, storage: consenti })).toBe(false);
    }
  });

  it('mesure toujours les pages de contenu, qui sont la finalité déclarée', () => {
    for (const p of ['/', '/blog', '/blog/mon-article', '/guide', '/a-propos', '/en/blog']) {
      expect(shouldLoadAudienceScript({ pathname: p, storage: consenti })).toBe(true);
    }
  });
});
