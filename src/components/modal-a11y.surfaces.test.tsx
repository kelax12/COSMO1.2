// @vitest-environment jsdom
//
// FRO-01 (vague 16.3) · les criteres (a) a (e) mesures sur les trois surfaces maison que
// `e2e/a11y-keyboard-audit*.spec.ts` ne parcourt pas, composant REEL monte :
//   · `TeamBulkAddToListDialog` et `TeamTaskListsField` : « dette » declaree par
//     `keyboard-audit-coverage.guard.test.ts` depuis le 2026-10-30 ;
//   · `PremiumGateModal` : inatteignable en produit (`PREMIUM_ENFORCED = false`), donc
//     inparcourable par un test de navigateur.
// (`PyramidPlacementSheet` n'est pas montee ici : l'organigramme est retire, la feuille n'a plus
// de point d'entree, et ses dependances d'organisation ne se simulent pas honnetement.)
//
// ⚠️ jsdom ne simule pas Tab natif : le piege est mesure en emettant Tab sur le dernier puis le
// premier element focalisable, comme `use-modal-a11y.guard.test.tsx`. Ce n'est PAS une mesure
// de navigateur ni de lecteur d'ecran.
import { useState, type ReactNode } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';

vi.mock('@/modules/team-lists', () => ({
  useTeamLists: () => ({
    data: [
      { id: 'l1', name: 'Liste un', color: 'blue', type: 'manual', taskIds: [] },
      { id: 'l2', name: 'Liste deux', color: 'red', type: 'manual', taskIds: [] },
    ],
    isLoading: false,
  }),
  useAddTaskToTeamList: () => ({ mutate: vi.fn() }),
  useRemoveTaskFromTeamList: () => ({ mutate: vi.fn() }),
  useCreateTeamList: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/modules/billing/billing.context', () => ({
  useBilling: () => ({ refreshBillingStatus: vi.fn() }),
}));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import TeamBulkAddToListDialog from './organization/TeamBulkAddToListDialog';
import TeamTaskListsField from './organization/TeamTaskListsField';
import { PremiumGateModal } from './PremiumGateModal';

afterEach(cleanup);

// jsdom n'implemente pas `matchMedia` (lu par `useIsMobile` et `useSheetMotion`).
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 60)); });

/** Un declencheur qui ouvre `children(open, close)` : la forme d'un parent reel. */
function WithTrigger({ children }: { children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Declencheur</button>
      {open && children(() => setOpen(false))}
    </div>
  );
}

const SURFACES: Array<[string, () => ReactNode, boolean]> = [
  [
    'TeamBulkAddToListDialog',
    () => (
      <WithTrigger>
        {(close) => <TeamBulkAddToListDialog orgId="o1" taskIds={['t1']} onClose={close} />}
      </WithTrigger>
    ),
    false,
  ],
  [
    'PremiumGateModal',
    () => (
      <WithTrigger>
        {(close) => <PremiumGateModal isOpen onClose={close} featureName="la collaboration" />}
      </WithTrigger>
    ),
    false,
  ],
  [
    // Ouverte par SON PROPRE bouton : le declencheur est dans le composant.
    'TeamTaskListsField',
    () => <TeamTaskListsField orgId="o1" value={[]} onChange={() => {}} />,
    true,
  ],
];

function dialogOf(): HTMLElement {
  return screen.getByRole('dialog');
}

function open(selfOpening: boolean): HTMLElement {
  const trigger = selfOpening
    ? (screen.getAllByRole('button').find((b) => b.getAttribute('aria-haspopup') === 'dialog') ??
      screen.getAllByRole('button')[0])
    : screen.getByRole('button', { name: 'Declencheur' });
  act(() => trigger.focus());
  fireEvent.click(trigger);
  return trigger;
}

describe.each(SURFACES)('FRO-01 · %s', (_name, make, selfOpening) => {
  it('(a) le focus entre dans la surface, sur un element sense', async () => {
    render(make());
    open(selfOpening);
    await tick();
    const d = dialogOf();
    expect(d.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('(b) Tab et Maj+Tab restent dans la surface', async () => {
    render(make());
    open(selfOpening);
    await tick();
    const d = dialogOf();
    const items = Array.from(d.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'));
    expect(items.length).toBeGreaterThan(1);
    act(() => items[items.length - 1].focus());
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
    expect(d.contains(document.activeElement)).toBe(true);
    act(() => items[0].focus());
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey: true });
    expect(d.contains(document.activeElement)).toBe(true);
  });

  it('(c) Echap ferme', async () => {
    render(make());
    open(selfOpening);
    await tick();
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await tick();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('(d) le focus revient a l\'element declencheur', async () => {
    render(make());
    const trigger = open(selfOpening);
    await tick();
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await tick();
    expect(document.activeElement).toBe(trigger);
  });

  it('(e) role dialog, aria-modal et nom accessible', async () => {
    render(make());
    open(selfOpening);
    await tick();
    const d = dialogOf();
    expect(['dialog', 'alertdialog']).toContain(d.getAttribute('role'));
    expect(d.getAttribute('aria-modal')).toBe('true');
    const labelledBy = d.getAttribute('aria-labelledby');
    const name =
      d.getAttribute('aria-label') ??
      (labelledBy ? document.getElementById(labelledBy)?.textContent : null);
    expect((name ?? '').trim().length).toBeGreaterThan(0);
  });
});
