// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router';
import { Suspense, lazy } from 'react';

// Reproduit le montage de App.tsx : chaque page est lazy + enveloppée de
// Suspense. `v7_startTransition` change la façon dont React traite ce cas
// (l'ancienne page reste montée au lieu d'afficher le fallback) — ce test
// vérifie que dans les deux régimes, la page de destination finit par rendre.
const LazyAlpha = lazy(async () => ({ default: () => <div>ALPHA PAGE</div> }));
const LazyBeta = lazy(async () => ({ default: () => <div>BETA PAGE</div> }));

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/alpha']}>
      <nav>
        <Link to="/beta">go beta</Link>
        <Link to="/alpha">go alpha</Link>
      </nav>
      <Routes>
        <Route
          path="/alpha"
          element={<Suspense fallback={<div>LOADING</div>}><LazyAlpha /></Suspense>}
        />
        <Route
          path="/beta"
          element={<Suspense fallback={<div>LOADING</div>}><LazyBeta /></Suspense>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('navigation entre routes lazy', () => {
  it('rend la route initiale une fois le chunk resolu', async () => {
    renderApp();
    expect(await screen.findByText('ALPHA PAGE')).toBeTruthy();
  });

  it('navigue vers une autre route lazy et la rend', async () => {
    renderApp();
    await screen.findByText('ALPHA PAGE');

    fireEvent.click(screen.getByText('go beta'));

    expect(await screen.findByText('BETA PAGE')).toBeTruthy();
    expect(screen.queryByText('ALPHA PAGE')).toBeNull();
  });

  it('revient sur la route precedente (chunk deja en cache)', async () => {
    renderApp();
    await screen.findByText('ALPHA PAGE');

    fireEvent.click(screen.getByText('go beta'));
    await screen.findByText('BETA PAGE');

    fireEvent.click(screen.getByText('go alpha'));
    expect(await screen.findByText('ALPHA PAGE')).toBeTruthy();
  });
});
