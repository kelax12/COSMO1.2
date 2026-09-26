import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Users, FolderKanban, Target, Network, BarChart3, ListTodo, Settings } from 'lucide-react';
import type { KeyOf } from '@/i18n/catalog';
import type { OrgSectionSegment } from './deep-link.helpers';

/** Une destination de l'espace entreprise. `billing` n'en est pas une (cf. plus bas). */
export type OrgSection = 'overview' | OrgSectionSegment;

/** Trois familles, dans l'ordre du panneau : ce que je fais, ce qu'on pilote, qui on est. */
export type OrgSectionGroup = 'mine' | 'steer' | 'org';

export const ORG_SECTION_GROUPS: { id: OrgSectionGroup; labelKey: KeyOf<'org'> }[] = [
  { id: 'mine', labelKey: 'sideNav.groupMine' },
  { id: 'steer', labelKey: 'sideNav.groupSteer' },
  { id: 'org', labelKey: 'sideNav.groupOrg' },
];

export interface OrgSectionDef {
  id: OrgSection;
  labelKey: KeyOf<'org'>;
  Icon: LucideIcon;
  group: OrgSectionGroup;
  /** Réservé à qui encadre au moins une personne (ou admin). */
  managerOnly?: boolean;
}

/**
 * Sections de la navigation entreprise, dans l'ordre d'affichage.
 *
 * Libellés = CLÉS : cette constante est évaluée au premier import, y écrire du
 * texte figerait la navigation en français pour toute la session.
 *
 * ⚠️ `billing` n'est PAS une entrée : la facturation ne concerne qu'un seul
 * compte sur toute l'organisation, elle ne mérite pas une place permanente dans
 * une barre que tout le monde lit. Elle reste une route (`/entreprise/billing`,
 * URL de retour de Stripe) atteinte depuis la pastille de forfait de l'en-tête.
 */
export const ORG_SECTIONS: OrgSectionDef[] = [
  { id: 'overview', labelKey: 'tabs.overview', Icon: LayoutDashboard, group: 'mine' },
  { id: 'tasks', labelKey: 'tabs.tasks', Icon: ListTodo, group: 'mine' },
  { id: 'projects', labelKey: 'tabs.projects', Icon: FolderKanban, group: 'steer' },
  { id: 'okr', labelKey: 'tabs.okr', Icon: Target, group: 'steer' },
  // #13 : statistiques collectives. Ouvertes depuis l'audit 2026-09-23 (M3)
  // aux responsables d'équipe, qui n'encadrent pas forcément dans la pyramide :
  // la page décide par `canSeeStats`, pas par `managerOnly`.
  { id: 'stats', labelKey: 'tabs.stats', Icon: BarChart3, group: 'steer' },
  // Un membre sans subordonné n'a rien à y arbitrer.
  { id: 'pyramid', labelKey: 'tabs.pyramid', Icon: Network, group: 'steer', managerOnly: true },
  { id: 'members', labelKey: 'tabs.members', Icon: Users, group: 'org' },
  // M13 : les réglages ont une adresse. Visible par tous (préférences de
  // notification, quitter l'organisation) ; les onglets s'ouvrent selon les droits.
  { id: 'settings', labelKey: 'tabs.settings', Icon: Settings, group: 'org' },
];

/** Une entrée prête à peindre, construite par la page (libellé traduit, pastilles). */
export interface OrgNavItem {
  id: OrgSection;
  label: string;
  Icon: LucideIcon;
  group: OrgSectionGroup;
  /** Compteur de nouveautés (0 = rien). */
  badgeCount: number;
  /** Nom accessible du compteur (« 3 nouveautés »). */
  badgeAriaLabel?: string;
  /** Pastille desktop avec aperçu au survol, déjà construite par la page. */
  badge?: React.ReactNode;
}
