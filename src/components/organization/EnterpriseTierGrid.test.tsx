// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// La grille tarifaire est le seul écran où COSMO annonce un montant à un
// client. Ce test garde ce que le sélecteur mensuel/annuel doit produire :
// l'équivalent mensuel remisé en gros, le débit réel juste dessous.
//
// Sans lui, l'annuel n'est vérifiable qu'en basculant
// `ENTERPRISE_BILLING_ENFORCED` — un drapeau de production qu'on ne touche pas
// pour regarder un rendu.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ensureNamespaces } from '@/i18n/catalog';
import { EnterpriseTierGrid } from './EnterpriseTierGrid';

describe('EnterpriseTierGrid — périodicité', () => {
  // Depuis le découpage des catalogues (2026-08-25), seuls `common` et `errors`
  // sont en mémoire au démarrage. Dans l'app, `org` est chargé par le gate de
  // route (`lazyWithRetry`) AVANT que le composant ne rende ; un test qui monte
  // le composant directement doit reproduire ce préalable, sinon `t()` renvoie
  // les clés brutes et l'assertion porte sur `billing.free` au lieu du montant.
  //
  // ⚠️ À faire dans TOUT test de composant qui utilise un namespace non-eager.
  beforeAll(async () => {
    await ensureNamespaces(['org'], 'fr');
  });

  it('en mensuel, affiche le tarif mensuel et « par mois »', () => {
    render(<EnterpriseTierGrid interval="monthly" />);
    expect(screen.getAllByText('20,00 €').length).toBeGreaterThan(0);
    expect(screen.getAllByText('par mois').length).toBe(4);
  });

  it('en annuel, affiche l’équivalent mensuel remisé de 30 %', () => {
    render(<EnterpriseTierGrid interval="yearly" />);
    // 20 → 14, 50 → 35, 100 → 70, 200 → 140.
    ['14,00 €', '35,00 €', '70,00 €', '140,00 €'].forEach((amount) => {
      expect(screen.getAllByText(amount).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('20,00 €')).toBeNull();
  });

  it('en annuel, le débit réel est dit sous chaque prix', () => {
    render(<EnterpriseTierGrid interval="yearly" />);
    expect(screen.getByText('par mois, facturé 168,00 € par an')).toBeTruthy();
    expect(screen.getByText('par mois, facturé 1 680,00 € par an')).toBeTruthy();
    // « par mois » nu n'apparaît plus : il laisserait croire à un débit mensuel.
    expect(screen.queryByText('par mois')).toBeNull();
  });

  it('le palier gratuit reste gratuit dans les deux périodicités', () => {
    const { unmount } = render(<EnterpriseTierGrid interval="yearly" />);
    expect(screen.getAllByText('Gratuit').length).toBe(1);
    unmount();
    render(<EnterpriseTierGrid interval="monthly" />);
    expect(screen.getAllByText('Gratuit').length).toBe(1);
  });

  it('pendant l’offre de lancement, le prix barré suit la périodicité', () => {
    render(<EnterpriseTierGrid interval="yearly" dormant />);
    expect(screen.getByText('au lieu de 14 €')).toBeTruthy();
    expect(screen.queryByText('au lieu de 20 €')).toBeNull();
  });
});
