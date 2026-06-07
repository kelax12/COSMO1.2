// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as Sentry from '@sentry/react';
import { AppErrorBoundary } from './AppErrorBoundary';

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

const Boom = () => {
  throw new Error('kaboom');
};

beforeEach(() => {
  // React logs the caught error to console.error — silence it for clean output.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('AppErrorBoundary', () => {
  it('renders a generic fallback (no raw error message) and reports to Sentry', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    // Generic, user-facing copy — never the raw error text (faille V7).
    expect(screen.getByText(/erreur inattendue/i)).toBeTruthy();
    expect(screen.queryByText(/kaboom/)).toBeNull();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('renders children unchanged when there is no error', () => {
    render(
      <AppErrorBoundary>
        <p>contenu sain</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('contenu sain')).toBeTruthy();
  });
});
