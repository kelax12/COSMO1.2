// @vitest-environment jsdom
//
// FRO-01 · les criteres (a) a (e) mesures sur des surfaces RADIX d'entreprise REELLES, montees
// une par une (et non seulement sur les enveloppes : `ui/modal-contract.test.tsx`). Complete
// `modal-a11y.surfaces.test.tsx`, meme harnais. Seuls les hooks de donnees sont simules.
//
// ⚠️ jsdom ne simule pas Tab natif : le piege est mesure en emettant Tab sur le dernier puis le
// premier element focalisable. Ce n'est PAS une mesure de navigateur ni de lecteur d'ecran.
import { useState, type ReactNode } from 'react';
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { installFocusHistory } from '@/lib/focus-history';

vi.mock('@/modules/org-teams', () => ({
  useTeamDeletionImpact: () => ({ data: { projects: 0, tasks: 0, members: 0 }, isLoading: false, isError: false }),
  useDeleteOrgTeam: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/modules/organizations/governance.hooks', () => ({
  useSetMemberAccess: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useNotificationSettings: () => ({ data: undefined }),
  useSaveNotificationSettings: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import OrgConfirmDialog from './organization/OrgConfirmDialog';
import ConfirmProjectAudienceDialog from './organization/ConfirmProjectAudienceDialog';
import TransferOwnershipDialog from './organization/TransferOwnershipDialog';
import DeleteTeamDialog from './organization/DeleteTeamDialog';
import MemberAccessDialog from './organization/MemberAccessDialog';
import OrgNotificationSettingsDialog from './organization/OrgNotificationSettingsDialog';

beforeAll(() => installFocusHistory());
afterEach(cleanup);

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  });
}

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 60)); });

function WithTrigger({ children }: { children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Declencheur</button>
      {open && children(() => setOpen(false))}
    </div>
  );
}

const team = { id: 'tm1', name: 'Equipe', parentId: null } as never;
const member = { id: 'm1', userId: 'u1', name: 'Membre', email: 'm@example.com', role: 'member' } as never;

const SURFACES: Array<[string, () => ReactNode]> = [
  ['OrgConfirmDialog', () => (
    <WithTrigger>{(close) => (
      <OrgConfirmDialog title="Supprimer" confirmLabel="Supprimer" onConfirm={close} onCancel={close} />
    )}</WithTrigger>
  )],
  ['ConfirmProjectAudienceDialog', () => (
    <WithTrigger>{(close) => (
      <ConfirmProjectAudienceDialog projectName="Projet" targetTeamName={null} orgMemberCount={4} onConfirm={close} onCancel={close} />
    )}</WithTrigger>
  )],
  ['TransferOwnershipDialog', () => (
    <WithTrigger>{(close) => (
      <TransferOwnershipDialog orgName="Org" candidates={[]} onConfirm={close} onCancel={close} />
    )}</WithTrigger>
  )],
  ['DeleteTeamDialog', () => (
    <WithTrigger>{(close) => <DeleteTeamDialog orgId="o1" team={team} teams={[]} onClose={close} />}</WithTrigger>
  )],
  ['MemberAccessDialog', () => (
    <WithTrigger>{(close) => <MemberAccessDialog orgId="o1" member={member} onClose={close} />}</WithTrigger>
  )],
  ['OrgNotificationSettingsDialog', () => (
    <WithTrigger>{(close) => <OrgNotificationSettingsDialog orgId="o1" open onOpenChange={(o) => { if (!o) close(); }} />}</WithTrigger>
  )],
];

function open(): HTMLElement {
  const trigger = screen.getByRole('button', { name: 'Declencheur' });
  act(() => trigger.focus());
  fireEvent.click(trigger);
  return trigger;
}
const anyDialog = (): HTMLElement =>
  (screen.queryByRole('alertdialog') ?? screen.getByRole('dialog')) as HTMLElement;

describe.each(SURFACES)('FRO-01 Radix reel · %s', (_name, make) => {
  it('(a) le focus entre dans la surface', async () => {
    render(make()); open(); await tick();
    expect(anyDialog().contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('(b) Tab et Maj+Tab restent dans la surface', async () => {
    render(make()); open(); await tick();
    const d = anyDialog();
    const items = Array.from(d.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [role="switch"], [role="combobox"]'));
    expect(items.length).toBeGreaterThan(0);
    act(() => items[items.length - 1].focus());
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
    expect(d.contains(document.activeElement)).toBe(true);
    act(() => items[0].focus());
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey: true });
    expect(d.contains(document.activeElement)).toBe(true);
  });

  it('(c) Echap ferme et (d) le focus revient au declencheur', async () => {
    render(make()); const trigger = open(); await tick();
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await tick();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('(e) role, aria-modal et nom accessible', async () => {
    render(make()); open(); await tick();
    const d = anyDialog();
    expect(['dialog', 'alertdialog']).toContain(d.getAttribute('role'));
    expect(d.getAttribute('aria-modal')).toBe('true');
    const labelledBy = d.getAttribute('aria-labelledby');
    const name = d.getAttribute('aria-label') ?? (labelledBy ? document.getElementById(labelledBy)?.textContent : null);
    expect((name ?? '').trim().length).toBeGreaterThan(0);
  });
});

