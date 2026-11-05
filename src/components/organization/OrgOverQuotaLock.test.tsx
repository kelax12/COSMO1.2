// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OrgOverQuotaLock } from './OrgOverQuotaLock';

afterEach(cleanup);

const base = { memberCount: 12, quota: 10, excess: 2, onManageMembers: vi.fn(), onChangePlan: vi.fn() };

describe('OrgOverQuotaLock', () => {
  it('membre ordinaire : le constat, aucun bouton', () => {
    render(<OrgOverQuotaLock {...base} canManageMembers={false} canChangePlan={false} />);
    expect(screen.getByRole('heading', { name: /en pause/i })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('12 membres pour 10 places');
    expect(screen.getByRole('status').textContent).toContain('2 membres de trop');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('admin : peut gérer les membres, pas changer de forfait', () => {
    const onManageMembers = vi.fn();
    render(<OrgOverQuotaLock {...base} onManageMembers={onManageMembers} canManageMembers canChangePlan={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gérer les membres' }));
    expect(onManageMembers).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Changer de forfait' })).toBeNull();
  });

  it('propriétaire : les deux sorties', () => {
    const onChangePlan = vi.fn();
    render(<OrgOverQuotaLock {...base} onChangePlan={onChangePlan} canManageMembers canChangePlan />);
    fireEvent.click(screen.getByRole('button', { name: 'Changer de forfait' }));
    expect(onChangePlan).toHaveBeenCalledOnce();
  });
});
