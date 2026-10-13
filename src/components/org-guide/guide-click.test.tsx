// @vitest-environment jsdom
// Le clic de démo doit ouvrir un déclencheur Radix (qui réagit à `pointerdown`,
// pas à `click`) : c'est ce que `el.click()` seul ne fait pas.
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { dispatchGuideClick } from './guide-click';

describe('dispatchGuideClick', () => {
  it('ouvre un DropdownMenu Radix', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>ouvrir</DropdownMenuTrigger>
        <DropdownMenuContent><DropdownMenuItem>entrée</DropdownMenuItem></DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.queryByText('entrée')).toBeNull();
    act(() => dispatchGuideClick(screen.getByText('ouvrir')));
    expect(screen.getByText('entrée')).toBeTruthy();
  });

  it('un bouton ordinaire reçoit un seul click', () => {
    const onClick = vi.fn();
    render(<button type="button" onClick={onClick}>b</button>);
    act(() => dispatchGuideClick(screen.getByText('b')));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
