import type { OrgSectionSegment } from '@/components/organization/deep-link.helpers';
import type { OrgPermissionKey } from '@/modules/organizations/permissions';

export type GuideCategory = 'work' | 'people' | 'roles' | 'steer';

/** Droit exigé : une clé de `ORG_PERMISSION_KEYS`, ou un statut sans clé dédiée. */
export type GuideRequirement = OrgPermissionKey | 'admin' | 'manager' | 'owner';

/**
 * Une étape ne SAISIT jamais rien et ne cible jamais un bouton qui écrit :
 * la garde `guide-scenarios.guard.test.ts` le vérifie sur le source.
 */
export type GuideStep =
  | { kind: 'goto'; section: OrgSectionSegment | 'overview'; via: string }
  | { kind: 'click'; target: string; bubbleKey?: string }
  | { kind: 'field'; target: string; bubbleKey: string }
  | { kind: 'pick-first'; target: string; emptyKey: string; bubbleKey?: string }
  | { kind: 'handoff'; bubbleKey: string };

export interface GuideAction {
  /** Identifiant stable, aussi suffixe des clés i18n `actions.<id>.*`. */
  id: string;
  category: GuideCategory;
  requires?: GuideRequirement;
  /** Masquée tant que la fonctionnalité serveur manque (mig. 219). */
  needsCustomRoles?: boolean;
  steps: GuideStep[];
}

export type GuideAccess = 'allowed' | 'denied' | 'hidden';

export interface GuideViewer {
  can: Record<OrgPermissionKey, boolean>;
  isAdmin: boolean;
  isManager: boolean;
  isOwner: boolean;
  customRolesAvailable: boolean;
}
