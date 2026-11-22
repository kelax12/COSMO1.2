// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';

const navigate = vi.fn();
const logout = vi.fn();
const setTheme = vi.fn();
let auth = { isAuthenticated: true };
let activeOrg: { id: string } | null = null;
let tasks: { id: string; name: string; completed: boolean }[] = [];
let habits: { id: string; name: string }[] = [];
let events: { id: string; title: string; start: string }[] = [];
let okrs: { id: string; title: string }[] = [];
let orgResults: { kind: string; id: string; label: string; detail: string | null }[] = [];

vi.mock('react-router', () => ({ useNavigate: () => navigate }));
vi.mock('@/hooks/useDarkMode', () => ({ useDarkMode: () => ({ theme: 'light', setTheme }) }));
vi.mock('@/modules/auth/AuthContext', () => ({
  useAuth: () => ({ logout, isAuthenticated: auth.isAuthenticated }),
}));
vi.mock('@/modules/billing/premium-config', () => ({ PREMIUM_ENFORCED: false }));
vi.mock('@/modules/tasks', () => ({
  useTasks: () => ({ data: tasks }),
  useTaskArchive: () => ({ data: undefined }),
}));
vi.mock('@/modules/habits', () => ({ useHabits: () => ({ data: habits }) }));
vi.mock('@/modules/events', () => ({ useEventsAroundToday: () => ({ data: events }) }));
vi.mock('@/modules/okrs', () => ({ useOkrs: () => ({ data: okrs }) }));
vi.mock('@/modules/organizations', () => ({
  useActiveOrganization: () => ({ activeOrg }),
}));
vi.mock('@/modules/organizations/search.hooks', () => ({
  useOrgSearch: () => ({ data: orgResults }),
}));

beforeAll(() => {
  // cmdk (liste virtuelle de sélection) exige ces API, absentes de jsdom.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
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
});

const open = () => act(() => { window.dispatchEvent(new Event('open-command-palette')); });
const pressCtrlK = () => fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

describe('CommandPalette', () => {
  beforeEach(() => {
    navigate.mockClear();
    logout.mockClear();
    setTheme.mockClear();
    auth = { isAuthenticated: true };
    activeOrg = null;
    tasks = [];
    habits = [];
    events = [];
    okrs = [];
    orgResults = [];
  });

  it('fermée par défaut ; Ctrl+K ouvre puis ferme', async () => {
    render(<CommandPalette />);
    expect(screen.queryByRole('dialog')).toBeNull();
    pressCtrlK();
    expect(screen.getByRole('dialog')).toBeTruthy();
    pressCtrlK();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it("s'ouvre aussi sur l'évènement open-command-palette", async () => {
    render(<CommandPalette />);
    await open();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('choisir « Tâches » navigue vers /tasks et ferme la palette', async () => {
    render(<CommandPalette />);
    await open();
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'todolist' } });
    const item = screen.getAllByRole('option')[0];
    fireEvent.click(item);
    expect(navigate).toHaveBeenCalledWith('/tasks', undefined);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('la recherche filtre par mot-clé et affiche « aucun résultat » sinon', async () => {
    render(<CommandPalette />);
    await open();
    const input = screen.getByRole('combobox');
    const total = screen.getAllByRole('option').length;
    fireEvent.change(input, { target: { value: 'graphite' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(total).toBeGreaterThan(1);
    fireEvent.change(input, { target: { value: 'zzzzzzzz' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('changer de thème appelle setTheme', async () => {
    render(<CommandPalette />);
    await open();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'graphite' } });
    fireEvent.click(screen.getByRole('option'));
    expect(setTheme).toHaveBeenCalledWith('gris');
  });

  it("l'action « créer un événement » passe l'état openCreate", async () => {
    render(<CommandPalette />);
    await open();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rendez-vous' } });
    fireEvent.click(screen.getByRole('option'));
    expect(navigate).toHaveBeenCalledWith('/agenda', { state: { openCreate: true } });
  });

  it('la déconnexion appelle logout', async () => {
    render(<CommandPalette />);
    await open();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'signout' } });
    fireEvent.click(screen.getByRole('option'));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('ajout rapide : émet open-quick-add', async () => {
    const listener = vi.fn();
    window.addEventListener('open-quick-add', listener);
    render(<CommandPalette />);
    await open();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'quick add' } });
    fireEvent.click(screen.getByRole('option'));
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('open-quick-add', listener);
  });

  it('déconnecté : aucune action ni recherche de données', async () => {
    auth = { isAuthenticated: false };
    tasks = [{ id: 't1', name: 'Facture client', completed: false }];
    render(<CommandPalette />);
    await open();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'facture' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('connecté : une recherche de 2+ lettres remonte tâches, habitudes, événements et objectifs', async () => {
    tasks = [{ id: 't1', name: 'Facture client', completed: true }];
    habits = [{ id: 'h1', name: 'Facture mensuelle' }];
    events = [{ id: 'e1', title: 'Facture revue', start: '2026-01-05T10:00:00' }];
    okrs = [{ id: 'o1', title: 'Facture zéro impayé' }];
    render(<CommandPalette />);
    await open();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'facture' } });
    expect(screen.getByText('Facture client')).toBeTruthy();
    fireEvent.click(screen.getByText('Facture client'));
    expect(navigate).toHaveBeenCalledWith('/tasks', { state: { openTaskId: 't1' } });
  });

  it("les résultats d'objectifs et d'habitudes mènent à leur écran", async () => {
    habits = [{ id: 'h1', name: 'Facture mensuelle' }];
    okrs = [{ id: 'o1', title: 'Facture zéro impayé' }];
    events = [{ id: 'e1', title: 'Facture revue', start: '2026-01-05T10:00:00' }];
    render(<CommandPalette />);
    await open();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'facture' } });
    fireEvent.click(screen.getByText('Facture mensuelle'));
    expect(navigate).toHaveBeenLastCalledWith('/habits', undefined);
    await open();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'facture' } });
    fireEvent.click(screen.getByText('Facture revue'));
    expect(navigate).toHaveBeenLastCalledWith('/agenda', undefined);
    await open();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'facture' } });
    fireEvent.click(screen.getByText('Facture zéro impayé'));
    expect(navigate).toHaveBeenLastCalledWith('/okr', { state: { selectedOKRId: 'o1' } });
  });

  it("avec une entreprise active : les raccourcis d'entreprise apparaissent", async () => {
    activeOrg = { id: 'org1' };
    render(<CommandPalette />);
    await open();
    const withOrg = screen.getAllByRole('option').length;
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'inviter' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.click(screen.getByRole('option'));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(String(navigate.mock.calls[0][0])).toContain('/entreprise');
    expect(withOrg).toBeGreaterThan(10);
  });

  it('résultats de recherche entreprise : un projet ouvre son lien', async () => {
    activeOrg = { id: 'org1' };
    orgResults = [{ kind: 'project', id: 'p1', label: 'Refonte facture', detail: 'active' }];
    render(<CommandPalette />);
    await open();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'facture' } });
    fireEvent.click(screen.getByText('Refonte facture'));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(String(navigate.mock.calls[0][0])).toContain('p1');
  });
});
