import type { OrgSectionSegment } from '@/components/organization/deep-link.helpers';
import type { OrgPermissionKey } from '@/modules/organizations/permissions';

export type GuideCategory = 'work' | 'people' | 'roles' | 'steer';

/** Droit exigé : une clé de `ORG_PERMISSION_KEYS`, ou un statut sans clé dédiée. */
export type GuideRequirement = OrgPermissionKey | 'admin' | 'owner';

/**
 * Une étape ne SAISIT jamais rien et ne cible jamais un bouton qui écrit :
 * la garde `guide-scenarios.guard.test.ts` le vérifie sur le source.
 */
export type GuideStep<S extends string = OrgSectionSegment | 'overview'> =
  | { kind: 'goto'; section: S; via: string }
  /**
   * `emptyKey` : la cible n'existe qu'en présence de données (corbeille non
   * vide, équipe avec projet...). Absente au délai : fin `empty`, pas `missing`.
   * `optional` : cible propre à une seule vue ; absente, l'étape est sautée.
   */
  | { kind: 'click'; target: string; bubbleKey?: string; emptyKey?: string; optional?: boolean }
  | { kind: 'field'; target: string; bubbleKey: string; emptyKey?: string }
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
  isOwner: boolean;
  customRolesAvailable: boolean;
}
