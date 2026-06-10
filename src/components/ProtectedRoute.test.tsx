// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockAuth = vi.fn();
vi.mock('@/modules/auth/AuthContext', () => ({ useAuth: () => mockAuth() }));

import ProtectedRoute from './ProtectedRoute';

function renderAt(path = '/tasks') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<div>PUBLIC LANDING</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/tasks" element={<div>PRIVATE CONTENT</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => mockAuth.mockReset());

describe('ProtectedRoute (gate auth)', () => {
  it('renders the protected outlet when authenticated', () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    renderAt();
    expect(screen.getByText('PRIVATE CONTENT')).toBeTruthy();
  });

  it('redirects to the public root when NOT authenticated', () => {
    mockAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    renderAt();
    expect(screen.queryByText('PRIVATE CONTENT')).toBeNull();
    expect(screen.getByText('PUBLIC LANDING')).toBeTruthy();
  });

  it('shows a spinner (and NO content) while the session is loading — pas de flash de redirect', () => {
    mockAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
    const { container } = renderAt();
    expect(screen.queryByText('PRIVATE CONTENT')).toBeNull();
    expect(screen.queryByText('PUBLIC LANDING')).toBeNull(); // ne redirige PAS pendant le chargement
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });
});
