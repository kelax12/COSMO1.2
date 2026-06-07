// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders title and description with a status role', () => {
    render(<EmptyState icon={Inbox} title="Aucune tâche" description="Crée ta première tâche" />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Aucune tâche')).toBeTruthy();
    expect(screen.getByText('Crée ta première tâche')).toBeTruthy();
  });

  it('renders the CTA only when both label and handler are provided, and fires it', () => {
    const onAction = vi.fn();
    render(<EmptyState icon={Inbox} title="Vide" actionLabel="Ajouter" onAction={onAction} />);
    const btn = screen.getByRole('button', { name: 'Ajouter' });
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('omits the CTA when no handler is given', () => {
    render(<EmptyState icon={Inbox} title="Vide" actionLabel="Ajouter" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
