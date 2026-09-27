// @vitest-environment jsdom
// Création d'équipe : le responsable se désigne par la couronne, dans la liste
// des membres (maquette 1 du 2026-09-27). Ce test garde les deux invariants
// que l'ancien menu séparé portait : couronner ajoute aux membres, et décocher
// le responsable lui retire la couronne.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ensureNamespaces } from '@/i18n/catalog';
import type { OrgMember } from '@/modules/organizations';
import { CreateTeamForm } from './CreateTeamModal';

const member = (userId: string, displayName: string) => ({ orgId: 'o', userId, displayName }) as unknown as OrgMember;
const members = [member('me', 'Moi'), member('marie', 'Marie Dupont'), member('jean', 'Jean Martin')];

const setup = () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<CreateTeamForm members={members} currentUserId="me" isAdmin onSubmit={onSubmit} onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText(/Nom de l'équipe/), { target: { value: 'Marketing' } });
  return onSubmit;
};

describe('CreateTeamForm, couronne du responsable', () => {
  beforeAll(async () => {
    await ensureNamespaces(['org'], 'fr');
  });

  it('couronner quelqu’un le nomme responsable et l’ajoute aux membres', async () => {
    const onSubmit = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Nommer Marie Dupont responsable' }));
    expect(screen.getByRole('button', { name: 'Retirer Marie Dupont du rôle de responsable' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: "Créer l'équipe" }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ leadId: 'marie', memberIds: ['me', 'marie'] });
  });

  it('décocher le responsable lui retire la couronne', async () => {
    const onSubmit = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Nommer Marie Dupont responsable' }));
    fireEvent.click(screen.getByRole('button', { name: /^Marie Dupont/, pressed: true }));
    expect(screen.getByRole('button', { name: 'Nommer Marie Dupont responsable' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: "Créer l'équipe" }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ leadId: null, memberIds: ['me'] });
  });
});
