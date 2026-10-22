import { describe, expect, it } from 'vitest';
import { ORG_PERMISSION_KEYS, type OrgPermissionKey } from '@/modules/organizations/permissions';
import { guideAccess } from './guide-access';
import type { GuideAction, GuideViewer } from './guide-types';

const allCan = (value: boolean) =>
  Object.fromEntries(ORG_PERMISSION_KEYS.map((k) => [k, value])) as Record<OrgPermissionKey, boolean>;

const viewer = (over: Partial<GuideViewer> = {}): GuideViewer => ({
  can: allCan(false), isAdmin: false, isManager: false, isOwner: false, customRolesAvailable: true, ...over,
});
const action = (over: Partial<GuideAction> = {}): GuideAction => ({ id: 'x', category: 'work', steps: [], ...over });

describe('guideAccess', () => {
  it('autorise une action sans exigence', () => {
    expect(guideAccess(action(), viewer())).toBe('allowed');
  });
  it('suit la clé de permission', () => {
    const a = action({ requires: 'project.create' });
    expect(guideAccess(a, viewer())).toBe('denied');
    expect(guideAccess(a, viewer({ can: { ...allCan(false), 'project.create': true } }))).toBe('allowed');
  });
  it('admin, manager et propriétaire', () => {
    expect(guideAccess(action({ requires: 'admin' }), viewer({ isManager: true }))).toBe('denied');
    expect(guideAccess(action({ requires: 'manager' }), viewer({ isAdmin: true }))).toBe('allowed');
    expect(guideAccess(action({ requires: 'owner' }), viewer({ isAdmin: true }))).toBe('denied');
    expect(guideAccess(action({ requires: 'owner' }), viewer({ isOwner: true }))).toBe('allowed');
  });
  it('masque une action de rôle quand la mig. 219 manque, même pour un admin', () => {
    const a = action({ requires: 'role.manage', needsCustomRoles: true });
    expect(guideAccess(a, viewer({ isAdmin: true, can: allCan(true), customRolesAvailable: false }))).toBe('hidden');
  });
});
