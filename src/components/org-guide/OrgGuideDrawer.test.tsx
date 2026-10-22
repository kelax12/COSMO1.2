// @vitest-environment jsdom
// src/components/org-guide/OrgGuideDrawer.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ensureNamespaces } from '@/i18n/catalog';
import { ORG_PERMISSION_KEYS, type OrgPermissionKey } from '@/modules/organizations/permissions';
import fr from '@/locales/fr/orgGuide.json';
import { OrgGuideDrawer } from './OrgGuideDrawer';
import { deniedRightKey } from './guide-access';
import { GUIDE_ACTIONS } from './scenarios';
import type { GuideViewer } from './guide-types';

const can = (v: boolean) => Object.fromEntries(ORG_PERMISSION_KEYS.map((k) => [k, v])) as Record<OrgPermissionKey, boolean>;
const member: GuideViewer = { can: can(false), isAdmin: false, isManager: false, isOwner: false, customRolesAvailable: true };

// « Créer un projet » sans attraper « Créer un projet depuis un modèle ».
const createProject = /^cr[ée]er un projet(?! depuis)|^create a project(?! from)/i;

describe('OrgGuideDrawer', () => {
  beforeAll(async () => {
    await ensureNamespaces(['orgGuide'], 'fr');
  });

  it('les catégories sont repliées par défaut', () => {
    render(<OrgGuideDrawer open viewer={member} onClose={() => {}} onStart={() => {}} onSeeAdmins={() => {}} />);
    expect(screen.queryByRole('button', { name: createProject })).toBeNull();
    for (const b of screen.getAllByRole('button', { expanded: false })) expect(b.getAttribute('aria-expanded')).toBe('false');
  });

  it('lance une action autorisée', () => {
    const onStart = vi.fn();
    render(<OrgGuideDrawer open viewer={member} onClose={() => {}} onStart={onStart} onSeeAdmins={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /rôles et permissions|roles and permissions/i }));
    fireEvent.click(screen.getByRole('button', { name: /mes propres droits|my own/i }));
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ id: 'me.permissions' }));
  });

  it('une action refusée montre la carte du droit manquant, sans lancer', () => {
    const onStart = vi.fn();
    render(<OrgGuideDrawer open viewer={member} onClose={() => {}} onStart={onStart} onSeeAdmins={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /projets et tâches|projects and tasks/i }));
    fireEvent.click(screen.getByRole('button', { name: createProject }));
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByText(/créer des projets|create projects/i)).toBeTruthy();
  });

  it('la recherche filtre', () => {
    render(<OrgGuideDrawer open viewer={member} onClose={() => {}} onStart={() => {}} onSeeAdmins={() => {}} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'équipe' } });
    expect(screen.queryByRole('button', { name: /exporter|export/i })).toBeNull();
    expect(screen.getByRole('button', { name: /créer une équipe|create a team/i })).toBeTruthy();
  });

  it('chaque droit exigé a son libellé dans denied.rights', () => {
    const rights = fr.denied.rights as Record<string, string>;
    for (const a of GUIDE_ACTIONS.filter((x) => x.requires)) {
      expect(rights[deniedRightKey(a).replace('denied.rights.', '')], a.id).toBeTruthy();
    }
  });
});
