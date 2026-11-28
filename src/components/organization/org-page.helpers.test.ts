import { describe, it, expect } from 'vitest';
import {
  badgePreviewKey,
  orgSectionBadge,
  resolveOrgRoute,
  resolveOrgTab,
  visibleOrgSections,
} from './org-page.helpers';
import { ORG_SECTIONS } from './org-sections';

const UUID = '11111111-2222-4333-8444-555555555555';

describe('resolveOrgRoute', () => {
  it('segment inconnu → aperçu', () => {
    expect(resolveOrgRoute('xyz', undefined)).toEqual({ redirect: '/entreprise' });
  });

  it('second segment hors teams ou sans forme d id → la section', () => {
    expect(resolveOrgRoute('members', UUID).redirect).toBe('/entreprise/members');
    expect(resolveOrgRoute('teams', 'pas un id').redirect).toBe('/entreprise/teams');
  });

  it('page d une équipe : pas de redirection, id lu', () => {
    expect(resolveOrgRoute('teams', UUID)).toEqual({ redirect: null, teamId: UUID });
  });

  it('section simple : pas de redirection, pas d équipe', () => {
    expect(resolveOrgRoute('tasks', undefined)).toEqual({ redirect: null, teamId: null });
    expect(resolveOrgRoute(undefined, undefined)).toEqual({ redirect: null, teamId: null });
  });
});

describe('resolveOrgTab', () => {
  const owner = { isOwner: true, canStats: true };
  const member = { isOwner: false, canStats: false };

  it('billing : propriétaire seul', () => {
    expect(resolveOrgTab('billing', owner)).toBe('billing');
    expect(resolveOrgTab('billing', member)).toBe('overview');
  });

  it('pyramid : masqué pour tous', () => {
    expect(resolveOrgTab('pyramid', owner)).toBe('overview');
  });

  it('stats : suit le droit', () => {
    expect(resolveOrgTab('stats', owner)).toBe('stats');
    expect(resolveOrgTab('stats', member)).toBe('overview');
  });

  it('reports vit dans Paramètres ; le reste passe tel quel', () => {
    expect(resolveOrgTab('reports', member)).toBe('settings');
    expect(resolveOrgTab('tasks', member)).toBe('tasks');
  });
});

describe('visibleOrgSections', () => {
  const ids = (v: Parameters<typeof visibleOrgSections>[1]) => visibleOrgSections(ORG_SECTIONS, v).map((s) => s.id);

  it('les sections masquées ne sortent jamais, même pour un admin', () => {
    const v = ids({ canStats: true, isAdmin: true, isOwner: true, overQuota: false });
    expect(v).not.toContain('stats');
    expect(v).not.toContain('pyramid');
    expect(v).toEqual(['overview', 'tasks', 'projects', 'okr', 'members', 'teams', 'settings']);
  });

  it('une section réservée sort pour un admin, pas pour un membre', () => {
    const defs = [{ id: 'okr' as const, managerOnly: true }, { id: 'stats' as const }];
    expect(visibleOrgSections(defs, { canStats: false, isAdmin: false, isOwner: false, overQuota: false })).toEqual([]);
    expect(visibleOrgSections(defs, { canStats: true, isAdmin: true, isOwner: false, overQuota: false }).map((d) => d.id)).toEqual(['okr', 'stats']);
  });

  it('au-dessus du quota : restent les sections qui permettent d en sortir', () => {
    expect(ids({ canStats: true, isAdmin: true, isOwner: false, overQuota: true })).toEqual(['members', 'settings']);
    expect(ids({ canStats: true, isAdmin: false, isOwner: false, overQuota: true })).toEqual([]);
  });
});

describe('orgSectionBadge', () => {
  const badges = { projects: 2, projectItems: ['p1', 'p2'], members: 1, memberItems: ['m1'] };
  const none = {
    tasks: { count: 0, kinds: [] },
    projects: { count: 0, kinds: [] },
    okr: { count: 0, kinds: [] },
    pyramid: { count: 0, kinds: [] },
  };
  const label = (k: string) => `L:${k}`;

  it('projets : compteur dérivé plus notifications', () => {
    const sb = { ...none, projects: { count: 1, kinds: ['project_at_risk' as const] } };
    expect(orgSectionBadge('projects', badges, sb, label)).toEqual({ count: 3, items: ['p1', 'p2', 'L:project_at_risk'] });
  });

  it('membres : compteur dérivé seul', () => {
    expect(orgSectionBadge('members', badges, none, label)).toEqual({ count: 1, items: ['m1'] });
  });

  it('autres : notifications non lues, zéro sans entrée', () => {
    const sb = { ...none, tasks: { count: 4, kinds: ['mention' as const, 'comment' as const] } };
    expect(orgSectionBadge('tasks', badges, sb, label)).toEqual({ count: 4, items: ['L:mention', 'L:comment'] });
    expect(orgSectionBadge('settings', badges, sb, label)).toEqual({ count: 0, items: [] });
  });
});

describe('badgePreviewKey', () => {
  it('membres, projets, puis le titre générique', () => {
    expect(badgePreviewKey('members')).toBe('page.badgePreviewMembers');
    expect(badgePreviewKey('projects')).toBe('page.badgePreviewProjects');
    expect(badgePreviewKey('okr')).toBe('page.badgePreviewSection');
  });
});
