import { describe, expect, it } from 'vitest';

import { USE_CASES } from '@/content/use-cases.mjs';
import { resolveUseCase } from '@/content/use-cases.locale';
import { ALL_LOCALES } from '@/i18n/locale';
import { canonicalUrl, ROUTE_SLUGS, routeIdFromSlug, routeSlug } from '@/i18n/routes';

/** Identifiants de route servis par `UseCasePage` (cf. src/App.tsx). */
const USE_CASE_ROUTE_IDS = ['freelancers', 'students', 'managers', 'teams'] as const;

describe('resolveUseCase', () => {
  // `ALL_LOCALES` et non `SUPPORTED_LOCALES` : l'espagnol n'est pas encore
  // servi, mais ses slugs existent déjà. Verrouiller la résolution maintenant
  // évite que l'ouverture de la langue rouvre le bug.
  it('résout chaque use-case dans toutes les langues connues', () => {
    for (const routeId of USE_CASE_ROUTE_IDS) {
      for (const locale of ALL_LOCALES) {
        const useCase = resolveUseCase(routeSlug(routeId, locale));
        // Le corps reste français (phase 5 du chantier i18n) : ce qui compte
        // ici est qu'une URL anglaise ou espagnole trouve SA page, et non
        // `undefined` — auquel cas `UseCasePage` redirige vers l'accueil.
        expect(useCase, `${routeId} / ${locale}`).toBeDefined();
        expect(routeIdFromSlug(useCase!.slug)).toBe(routeId);
      }
    }
  });

  it('renvoie undefined pour un slug inconnu ou une route non use-case', () => {
    expect(resolveUseCase('slug-inexistant')).toBeUndefined();
    // `about` est bien un slug traduit connu, mais aucun use-case ne le sert :
    // la résolution ne doit pas retomber sur une page arbitraire.
    expect(resolveUseCase('a-propos')).toBeUndefined();
    expect(resolveUseCase('')).toBeUndefined();
  });

  it('couvre tout le registre de contenu — aucun use-case orphelin de route', () => {
    const served = new Set<string>(USE_CASE_ROUTE_IDS);
    for (const useCase of USE_CASES) {
      const routeId = routeIdFromSlug(useCase.slug);
      expect(routeId, `use-case sans entrée dans route-slugs.json : ${useCase.slug}`).not.toBeNull();
      expect(served.has(routeId!), `route non déclarée dans App.tsx : ${routeId}`).toBe(true);
    }
    expect(USE_CASES).toHaveLength(USE_CASE_ROUTE_IDS.length);
  });
});

describe('canonical des pages use-case', () => {
  it('pointe vers la langue servie, pas vers le français', () => {
    const useCase = resolveUseCase('for-teams')!;
    expect(canonicalUrl(`/${useCase.slug}`, 'fr')).toBe('https://thecosmo.app/pour-equipes');
    expect(canonicalUrl(`/${useCase.slug}`, 'en')).toBe('https://thecosmo.app/en/for-teams');
    expect(canonicalUrl(`/${useCase.slug}`, 'es')).toBe('https://thecosmo.app/es/para-equipos');
  });

  it('les slugs use-case du registre existent dans les trois langues', () => {
    for (const routeId of USE_CASE_ROUTE_IDS) {
      for (const locale of ALL_LOCALES) {
        expect(ROUTE_SLUGS[routeId][locale], `${routeId} / ${locale}`).toBeTruthy();
      }
    }
  });
});
