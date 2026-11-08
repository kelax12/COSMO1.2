// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Page OKR (vague 15.2, TST-02)
//
// La vraie page, les vrais hooks React Query, le dépôt de démo
// (`cosmo-okrs-v5`) : seule la session est simulée. Vérifie ce que voit la
// personne : les objectifs et leurs résultats clés, l'état vide, l'avancement
// d'un résultat clé (bouton, saisie, clôture à la cible), la création d'un
// objectif et sa suppression avec annulation.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, within, waitFor, fireEvent } from '@testing-library/react';
import {
  renderApp, setViewport, resetDemoWorld, warmDemoCaches, lazyT, fakeAuth, fakeBilling,
} from '@/test/tasks-ui-harness';
import { OKRS_STORAGE_KEY } from '@/modules/okrs/constants';

vi.mock('@/modules/auth/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/auth/AuthContext')>()),
  useAuth: () => fakeAuth(),
}));
vi.mock('@/modules/billing/billing.context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/billing/billing.context')>()),
  useBilling: () => fakeBilling(),
}));

import OKRPage from './OKRPage';

const okr = lazyT('okr');

interface StoredKeyResult { id: string; title: string; currentValue: number; targetValue: number; completed: boolean }
interface StoredOkr { id: string; title: string; completed: boolean; keyResults: StoredKeyResult[] }

const storedOkrs = () => JSON.parse(localStorage.getItem(OKRS_STORAGE_KEY) ?? '[]') as StoredOkr[];
const storedKr = (id: string) => storedOkrs().flatMap((o) => o.keyResults).find((k) => k.id === id);

beforeAll(async () => {
  await warmDemoCaches();
});

beforeEach(() => {
  resetDemoWorld();
  localStorage.setItem('cosmo_tutorial_seen_okr_desktop', '1');
  localStorage.setItem('cosmo_tutorial_seen_okr_mobile', '1');
  setViewport('desktop');
});

const KR_TITLE = 'Terminer 8 semaines sans tâche en retard';

describe('OKRPage, rendu des données', () => {
  it('montre les objectifs en cours et leurs résultats clés', async () => {
    renderApp(<OKRPage />, { route: '/okr' });

    // Les cartes montrent leurs résultats clés dans deux mises en page (tableau et feuille
    // mobile) : un texte peut donc figurer plusieurs fois, jamais zéro.
    expect((await screen.findAllByText('Améliorer ma productivité Q2 2026')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(KR_TITLE).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Compléter 90 tâches').length).toBeGreaterThan(0);
  });

  it('dit « aucun OKR » et propose d’en créer un quand il n’y en a pas', async () => {
    localStorage.setItem(OKRS_STORAGE_KEY, '[]');
    renderApp(<OKRPage />, { route: '/okr' });

    expect(await screen.findByText(okr.t('page.empty.allTitle'))).toBeTruthy();
    expect(screen.getByRole('button', { name: okr.t('page.createOkr') })).toBeTruthy();
  });
});

describe('OKRPage, avancement d’un résultat clé', () => {
  it('incrémente un résultat clé avec le bouton « + » et l’écrit dans le dépôt', async () => {
    renderApp(<OKRPage />, { route: '/okr' });
    await screen.findAllByText(KR_TITLE);
    const before = storedKr('kr-2')!.currentValue;

    fireEvent.click(screen.getAllByRole('button', { name: okr.t('card.increase', { title: KR_TITLE }) })[0]);

    await waitFor(() => expect(storedKr('kr-2')!.currentValue).toBe(before + 1));
    expect(storedKr('kr-2')!.completed).toBe(false);
  });

  it('décrémente sans jamais passer sous zéro', async () => {
    renderApp(<OKRPage />, { route: '/okr' });
    await screen.findAllByText(KR_TITLE);

    const input = screen.getAllByRole('spinbutton', { name: okr.t('card.progressOf', { title: KR_TITLE, target: 8 }) })[0];
    fireEvent.change(input, { target: { value: '0' } });
    await waitFor(() => expect(storedKr('kr-2')!.currentValue).toBe(0));

    fireEvent.click(screen.getAllByRole('button', { name: okr.t('card.decrease', { title: KR_TITLE }) })[0]);
    await waitFor(() => expect(storedKr('kr-2')!.currentValue).toBe(0));
  });

  it('marque le résultat clé atteint dès que la saisie rejoint la cible', async () => {
    renderApp(<OKRPage />, { route: '/okr' });
    await screen.findAllByText(KR_TITLE);

    fireEvent.change(
      screen.getAllByRole('spinbutton', { name: okr.t('card.progressOf', { title: KR_TITLE, target: 8 }) })[0],
      { target: { value: '8' } },
    );

    await waitFor(() => expect(storedKr('kr-2')!.completed).toBe(true));
    expect(storedKr('kr-2')!.currentValue).toBe(8);
  });
});

describe('OKRPage, création et suppression', () => {
  it('ouvre le formulaire de création au clic sur « Nouvel objectif »', async () => {
    renderApp(<OKRPage />, { route: '/okr' });
    await screen.findAllByText(KR_TITLE);

    fireEvent.click(screen.getByRole('button', { name: okr.t('page.createObjective') }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('crée un objectif avec un résultat clé : le bouton reste grisé tant qu’il manque le titre ou un résultat clé', async () => {
    renderApp(<OKRPage />, { route: '/okr' });
    await screen.findAllByText(KR_TITLE);
    const avant = storedOkrs().length;

    fireEvent.click(screen.getByRole('button', { name: okr.t('page.createObjective') }));
    const dialog = await screen.findByRole('dialog');
    // Deux boutons « Créer » coexistent dans le DOM (barre mobile et pied de la feuille) : on les
    // suit tous, et c'est celui du pied qu'on clique.
    // Le bouton du pied porte `disabled`, celui de la barre mobile `aria-disabled`.
    const off = (b: HTMLButtonElement) => b.disabled || b.getAttribute('aria-disabled') === 'true';
    const creates = () => within(dialog).getAllByRole('button', { name: okr.t('modal.create') }) as HTMLButtonElement[];
    expect(creates().length).toBeGreaterThan(0);
    expect(creates().every(off)).toBe(true);

    fireEvent.change(within(dialog).getByLabelText(okr.t('modal.objective')), { target: { value: 'Courir un semi-marathon' } });
    expect(creates().every(off)).toBe(true);

    fireEvent.change(within(dialog).getAllByPlaceholderText(okr.t('modal.keyResultPlaceholder'))[0], { target: { value: 'Courir 3 fois par semaine' } });
    expect(creates().every((b) => !off(b))).toBe(true);
    fireEvent.change(within(dialog).getAllByLabelText(okr.t('modal.target'))[0], { target: { value: '36' } });
    fireEvent.click(creates()[creates().length - 1]);

    await waitFor(() => expect(storedOkrs().length).toBe(avant + 1));
    const cree = storedOkrs().find((o) => o.title === 'Courir un semi-marathon')!;
    expect(cree.keyResults.map((k) => k.title)).toEqual(['Courir 3 fois par semaine']);
    expect(cree.keyResults[0].targetValue).toBe(36);
    expect(cree.keyResults[0].currentValue).toBe(0);
    // Le nouvel objectif apparaît dans la liste.
    expect((await screen.findAllByText('Courir un semi-marathon')).length).toBeGreaterThan(0);
  });

  it('supprime un objectif après confirmation', async () => {
    renderApp(<OKRPage />, { route: '/okr' });
    await screen.findAllByText('Améliorer ma productivité Q2 2026');

    fireEvent.click(screen.getAllByRole('button', { name: okr.t('card.deleteObjective') })[0]);

    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getAllByRole('button').find((b) => /supprimer/i.test(b.textContent ?? ''))!);

    await waitFor(() => expect(storedOkrs().length).toBeLessThan(4));
  });
});
