import { describe, it, expect } from 'vitest';
import { trackFromPathname } from './use-landing-track';

describe('trackFromPathname', () => {
  it('sert le parcours perso sur la racine, avec ou sans barre finale', () => {
    expect(trackFromPathname('/', 'fr')).toBe('perso');
    expect(trackFromPathname('/en', 'en')).toBe('perso');
    expect(trackFromPathname('/en/', 'en')).toBe('perso');
  });

  it('sert le parcours entreprise sur son slug localisé', () => {
    expect(trackFromPathname('/entreprise-presentation', 'fr')).toBe('entreprise');
    expect(trackFromPathname('/en/for-companies', 'en')).toBe('entreprise');
    // Sous `basename="/en"`, le routeur rend le chemin déjà privé du préfixe.
    expect(trackFromPathname('/for-companies', 'en')).toBe('entreprise');
  });

  // Mesuré en production le 2026-10-16 : le HTML prérendu était entreprise,
  // puis l'hydratation rendait le parcours perso, titre et canonical de
  // l'accueil compris. C'est l'URL que mesure Lighthouse CI.
  it('ne perd pas le parcours entreprise sur la barre oblique finale', () => {
    expect(trackFromPathname('/entreprise-presentation/', 'fr')).toBe('entreprise');
    expect(trackFromPathname('/en/for-companies/', 'en')).toBe('entreprise');
    expect(trackFromPathname('/for-companies/', 'en')).toBe('entreprise');
  });

  it('ne reconnaît pas le slug d’une autre locale', () => {
    expect(trackFromPathname('/for-companies', 'fr')).toBe('perso');
    expect(trackFromPathname('/entreprise-presentation', 'en')).toBe('perso');
  });
});
