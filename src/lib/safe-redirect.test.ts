import { describe, it, expect } from 'vitest';
import { safeRedirectPath, postAuthRoute, DEFAULT_POST_AUTH_ROUTE } from './safe-redirect';

describe('safeRedirectPath — accepte un chemin interne', () => {
  it('laisse passer le cas qui motive la fonction', () => {
    const token = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';
    expect(safeRedirectPath(`/org-invite/${token}`)).toBe(`/org-invite/${token}`);
  });

  it('accepte une requête et un fragment', () => {
    expect(safeRedirectPath('/entreprise?tab=billing')).toBe('/entreprise?tab=billing');
    expect(safeRedirectPath('/guide#okr')).toBe('/guide#okr');
  });

  it('accepte un chemin préfixé de locale', () => {
    expect(safeRedirectPath('/en/about')).toBe('/en/about');
  });
});

describe('safeRedirectPath — refuse tout ce qui peut sortir de l’origine', () => {
  // Le point de cette fonction : la page de connexion ne doit jamais servir de
  // tremplin d'hameçonnage. Chaque entrée ci-dessous est une forme réellement
  // suivie par au moins un navigateur.
  const hostiles = [
    ['URL absolue', 'https://evil.example/login'],
    ['URL absolue sans schéma explicite', 'http://evil.example'],
    ['protocol-relative', '//evil.example'],
    ['protocol-relative avec antislash', '/\\evil.example'],
    ['protocol-relative encodé', '/%2fevil.example'],
    ['protocol-relative encodé, majuscules', '/%2Fevil.example'],
    ['protocol-relative doublement encodé', '/%252fevil.example'],
    ['schéma javascript', '/javascript:alert(1)'],
    ['schéma data', '/data:text/html,<script>'],
    ['chemin relatif', 'dashboard'],
    ['remontée relative', '../admin'],
    ['encodage invalide', '/%zz'],
    ['chaîne vide', ''],
    ['absent', null],
    ['non défini', undefined],
  ] as const;

  it.each(hostiles)('refuse : %s', (_label, input) => {
    expect(safeRedirectPath(input)).toBeNull();
  });

  it('refuse un retour à la ligne glissé dans le chemin', () => {
    // Construit par code point : un caractère de contrôle dans le source du
    // test serait invisible à la relecture.
    const withNewline = '/dashboard' + String.fromCharCode(10) + 'Location: https://evil.example';
    const withCarriageReturn = '/dashboard' + String.fromCharCode(13);
    const withNull = '/dashboard' + String.fromCharCode(0);
    expect(safeRedirectPath(withNewline)).toBeNull();
    expect(safeRedirectPath(withCarriageReturn)).toBeNull();
    expect(safeRedirectPath(withNull)).toBeNull();
  });
});

describe('postAuthRoute', () => {
  it('retombe sur le tableau de bord quand le retour est absent ou hostile', () => {
    expect(postAuthRoute(null)).toBe(DEFAULT_POST_AUTH_ROUTE);
    expect(postAuthRoute('https://evil.example')).toBe(DEFAULT_POST_AUTH_ROUTE);
  });

  it('respecte un repli explicite (parcours entreprise)', () => {
    expect(postAuthRoute(null, '/entreprise/onboarding')).toBe('/entreprise/onboarding');
    expect(postAuthRoute('/org-invite/abc', '/entreprise/onboarding')).toBe('/org-invite/abc');
  });
});
