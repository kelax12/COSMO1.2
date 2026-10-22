// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PRERENDER_HERO_ID,
  dropPrerenderHeroIfLocaleDiffers,
  prerenderHeroShown,
  releasePrerenderHero,
} from './prerender-hero';

// La copie du hero peinte par le prérendu de la home : elle ne doit être vue
// que d'un visiteur sans session, et partir à chaque sortie, sinon elle
// couvrirait l'app (calque fixe au-dessus de React).

function poserCopie(locale = 'fr'): HTMLElement {
  const el = document.createElement('div');
  el.id = PRERENDER_HERO_ID;
  el.dataset.locale = locale;
  document.body.prepend(el);
  return el;
}

beforeEach(() => {
  document.documentElement.setAttribute('data-prerendered', '');
});

afterEach(() => {
  document.getElementById(PRERENDER_HERO_ID)?.remove();
  document.documentElement.removeAttribute('data-prerendered');
});

describe('prerenderHeroShown', () => {
  it('vrai quand la copie est posée sur une page prérendue', () => {
    poserCopie();
    expect(prerenderHeroShown()).toBe(true);
  });

  it("faux sans copie (toutes les pages prérendues sauf la home, la coquille de l'app)", () => {
    expect(prerenderHeroShown()).toBe(false);
  });

  it('faux pour une personne connectée : le script inline a retiré data-prerendered, la copie n’est pas peinte', () => {
    poserCopie();
    document.documentElement.removeAttribute('data-prerendered');
    expect(prerenderHeroShown()).toBe(false);
  });
});

describe('releasePrerenderHero', () => {
  it('retire la copie, et ne lève pas si elle est déjà partie', () => {
    poserCopie();
    releasePrerenderHero();
    expect(document.getElementById(PRERENDER_HERO_ID)).toBeNull();
    expect(() => releasePrerenderHero()).not.toThrow();
  });
});

describe('dropPrerenderHeroIfLocaleDiffers', () => {
  it('garde la copie quand la langue de la page est la sienne', () => {
    poserCopie('fr');
    dropPrerenderHeroIfLocaleDiffers('fr');
    expect(document.getElementById(PRERENDER_HERO_ID)).not.toBeNull();
    expect(document.documentElement.hasAttribute('data-prerendered')).toBe(true);
  });

  it('retire la copie ET data-prerendered (donc spinner) quand l’amorçage a choisi une autre langue', () => {
    poserCopie('fr');
    dropPrerenderHeroIfLocaleDiffers('en');
    expect(document.getElementById(PRERENDER_HERO_ID)).toBeNull();
    expect(document.documentElement.hasAttribute('data-prerendered')).toBe(false);
  });

  it('ne touche à rien sans copie : les autres pages prérendues gardent leur rendu', () => {
    dropPrerenderHeroIfLocaleDiffers('en');
    expect(document.documentElement.hasAttribute('data-prerendered')).toBe(true);
  });
});
