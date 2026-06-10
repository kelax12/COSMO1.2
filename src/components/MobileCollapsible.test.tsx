// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockIsMobile = vi.fn();
vi.mock('@/lib/hooks/use-mobile', () => ({ useIsMobile: () => mockIsMobile() }));

import MobileCollapsible from './MobileCollapsible';

beforeEach(() => mockIsMobile.mockReset());

describe('MobileCollapsible', () => {
  it('desktop : rend les enfants directement, sans bouton', () => {
    mockIsMobile.mockReturnValue(false);
    render(<MobileCollapsible title="Section"><div>CONTENU</div></MobileCollapsible>);
    expect(screen.getByText('CONTENU')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('mobile : replié par défaut, toggle au clic avec aria-expanded', () => {
    mockIsMobile.mockReturnValue(true);
    render(<MobileCollapsible title="Section"><div>CONTENU</div></MobileCollapsible>);

    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('CONTENU')).toBeNull();

    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('CONTENU')).toBeTruthy();

    fireEvent.click(btn);
    expect(screen.queryByText('CONTENU')).toBeNull();
  });

  it('mobile : affiche le badge sauf quand il vaut 0', () => {
    mockIsMobile.mockReturnValue(true);
    const { rerender } = render(
      <MobileCollapsible title="Section" badge={5}><div /></MobileCollapsible>
    );
    expect(screen.getByText('5')).toBeTruthy();

    rerender(<MobileCollapsible title="Section" badge={0}><div /></MobileCollapsible>);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('mobile : defaultOpen=true démarre déplié', () => {
    mockIsMobile.mockReturnValue(true);
    render(<MobileCollapsible title="S" defaultOpen><div>CONTENU</div></MobileCollapsible>);
    expect(screen.getByText('CONTENU')).toBeTruthy();
  });
});
