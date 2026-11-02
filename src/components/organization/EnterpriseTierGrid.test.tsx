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
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    expect(screen.getAllByText('70,00 €').length).toBeGreaterThan(0);
    expect(screen.getAllByText('par mois').length).toBe(5);
  });

  it('en annuel, affiche l’équivalent mensuel remisé de 25 %', () => {
    render(<EnterpriseTierGrid interval="yearly" />);
    // 20 → 14, 50 → 35, 100 → 70, 200 → 140.
    ['52,50 €', '112,50 €', '262,50 €', '525,00 €', '750,00 €'].forEach((amount) => {
      expect(screen.getAllByText(amount).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('70,00 €')).toBeNull();
  });

  it('en annuel, le débit réel est dit sous chaque prix', () => {
    render(<EnterpriseTierGrid interval="yearly" />);
    expect(screen.getByText('par mois, facturé 630,00 € TTC par an')).toBeTruthy();
    expect(screen.getByText('par mois, facturé 9 000,00 € TTC par an')).toBeTruthy();
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
    expect(screen.getByText('au lieu de 52,50 € TTC')).toBeTruthy();
    expect(screen.queryByText('au lieu de 70 € TTC')).toBeNull();
  });
});

describe('carte cliquable et palier conseillé', () => {
  it('la carte entière choisit le palier, nommée pour un lecteur d écran', () => {
    const onSelect = vi.fn();
    render(<EnterpriseTierGrid onSelect={onSelect} interval="monthly" />);
    fireEvent.click(screen.getByRole('button', { name: /choisir ce palier : 10 à 20 membres/i }));
    expect(onSelect).toHaveBeenCalledWith('t20');
  });

  it('la pastille « Conseillé » suit recommendedKey, jamais le palier actif', () => {
    const { rerender } = render(<EnterpriseTierGrid onSelect={vi.fn()} recommendedKey="t20" />);
    expect(screen.getAllByText('Conseillé pour votre équipe')).toHaveLength(1);
    rerender(<EnterpriseTierGrid onSelect={vi.fn()} recommendedKey="t20" currentTier="t20" />);
    expect(screen.queryByText('Conseillé pour votre équipe')).toBeNull();
  });

  it('sans onSelect (non propriétaire), aucune carte n est un bouton', () => {
    render(<EnterpriseTierGrid />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('boutons de carte : nom, description, exclusions', () => {
  const description = (el: HTMLElement) =>
    (el.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');

  it('en annuel, la description du bouton porte le débit réel et la pastille conseillée', () => {
    render(<EnterpriseTierGrid onSelect={vi.fn()} interval="yearly" recommendedKey="t20" />);
    const btn = screen.getByRole('button', { name: /choisir ce palier : 10 à 20 membres/i });
    expect(description(btn)).toContain('par mois, facturé');
    expect(description(btn)).toContain('Conseillé pour votre équipe');
  });

  it('le palier actif et le palier gratuit ne sont pas des boutons', () => {
    render(<EnterpriseTierGrid onSelect={vi.fn()} currentTier="t20" />);
    expect(screen.queryByRole('button', { name: /10 à 20 membres/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /0 à 5 membres/i })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('facturation éteinte (dormant) : aucun bouton, même avec onSelect', () => {
    render(<EnterpriseTierGrid onSelect={vi.fn()} dormant />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
