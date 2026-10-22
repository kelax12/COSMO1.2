// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLandingSeoMeta } from './useSeoMeta';
import { resolveMessage } from '@/i18n/catalog';

/**
 * `/` et `/entreprise-presentation` rendent le même composant `LandingPage`.
 * Jusqu'au 2026-10-12, les deux posaient les méta de la racine : React
 * réécrivait le canonical de la page entreprise vers la home, après un HTML
 * prérendu pourtant juste. Mesuré par Lighthouse en production (SEO 92,
 * audit `canonical` en échec), pas déduit.
 */
const canonical = () => document.querySelector('link[rel="canonical"]')?.getAttribute('href');

beforeEach(() => {
  document.head.innerHTML =
    '<meta name="description" content="" />' +
    '<link rel="canonical" href="https://thecosmo.app/entreprise-presentation" />';
  document.title = '';
});

describe('useLandingSeoMeta', () => {
  it('le parcours entreprise garde SON canonical, pas celui de la home', () => {
    renderHook(() => useLandingSeoMeta('entreprise'));
    expect(canonical()).toBe('https://thecosmo.app/entreprise-presentation');
    expect(document.title).toBe(resolveMessage('seo', 'enterprisePresentation.title', 'fr'));
  });

  it('le parcours perso pose les méta de la racine', () => {
    renderHook(() => useLandingSeoMeta('perso'));
    expect(canonical()).toBe('https://thecosmo.app/');
    expect(document.title).toBe(resolveMessage('seo', 'root.title', 'fr'));
  });
});
