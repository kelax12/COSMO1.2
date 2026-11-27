// @vitest-environment jsdom
// Onglets gardés montés : une page quittée reste dans le DOM, masquée, avec
// son état ; elle voit encore SON URL, pas celle de la page visible.
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, Link, Route, RouterProvider, createRoutesFromElements, useLocation } from 'react-router';
import { KeepAliveOutlet } from './KeepAliveOutlet';

function Counter({ name }: { name: string }) {
  const [count, setCount] = useState(0);
  const { pathname, search } = useLocation();
  return (
    <div data-testid={name}>
      <button type="button" onClick={() => setCount((c) => c + 1)}>{`${name} ${count}`}</button>
      <span data-testid={`${name}-url`}>{pathname + search}</span>
    </div>
  );
}

function Shell() {
  return (
    <main id="main-content">
      <Link to="/tasks">tasks</Link>
      <Link to="/habits?filtre=x">habits</Link>
      <Link to="/settings">settings</Link>
      <KeepAliveOutlet />
    </main>
  );
}

function renderApp() {
  const router = createMemoryRouter(createRoutesFromElements(
    <Route element={<Shell />}>
      <Route path="tasks" element={<Counter name="tasks" />} />
      <Route path="habits" element={<Counter name="habits" />} />
      <Route path="settings" element={<Counter name="settings" />} />
    </Route>,
  ), { initialEntries: ['/tasks'] });
  render(<RouterProvider router={router} />);
}

const go = (label: string) => act(() => { fireEvent.click(screen.getByRole('link', { name: label })); });

describe('KeepAliveOutlet', () => {
  it('garde l’état d’un onglet quitté, y compris après une page non gardée', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'tasks 0' }));
    await go('habits');
    await go('settings');
    // `/settings` n'est pas gardée : seule elle est rendue en plus des onglets.
    expect(screen.getByTestId('settings')).toBeTruthy();
    await go('tasks');
    expect(screen.getByRole('button', { name: 'tasks 1' })).toBeTruthy();
    expect(screen.queryByTestId('settings')).toBeNull();
  });

  it('masque l’onglet quitté et lui laisse sa propre URL', async () => {
    renderApp();
    await go('habits');
    const tasks = screen.getByTestId('tasks');
    expect(getComputedStyle(tasks).display).toBe('none');
    expect(screen.getByTestId('tasks-url').textContent).toBe('/tasks');
    expect(screen.getByTestId('habits-url').textContent).toBe('/habits?filtre=x');
  });
});
