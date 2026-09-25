import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Users, UsersRound, Settings, FolderKanban, Target, Network, BarChart3, ListTodo } from 'lucide-react';
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
  // #13 : statistiques collectives — admin (toute l'org) / manager (son périmètre).
  { id: 'stats', labelKey: 'tabs.stats', Icon: BarChart3, group: 'steer', managerOnly: true },
  // Un membre sans subordonné n'a rien à y arbitrer.
  { id: 'pyramid', labelKey: 'tabs.pyramid', Icon: Network, group: 'steer', managerOnly: true },
  // Audit Membres du 2026-09-24 : la section tenait « quatre pages en une »
  // (invitations, équipes, annuaire, zone de danger). Personnes garde
  // l'annuaire ; les équipes et les réglages ont leur propre adresse.
  { id: 'members', labelKey: 'tabs.members', Icon: Users, group: 'org' },
  { id: 'teams', labelKey: 'tabs.teams', Icon: UsersRound, group: 'org' },
  // M13 : un admin ne savait pas où chercher un réglage (profil sous un
  // crayon de l'en-tête, zone dangereuse au pied de l'annuaire, changement
  // d'organisation dans la barre latérale de l'app). Tout est ici.
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

/**
 * Raccourci vers un projet, dans le groupe « Épinglés » (ou « Récents » tant
 * que rien n'est épinglé) du panneau de droite et du sélecteur mobile.
 */
export interface OrgShortcut {
  id: string;
  label: string;
  /** Classe de pastille de couleur du projet (`projectColor(...).dot`). */
  dotClass: string;
  href: string;
  pinned: boolean;
}

/** Le groupe à peindre : ses entrées, et s'il s'agit d'épinglés ou de récents. */
export interface OrgShortcutGroup {
  kind: 'pinned' | 'recent';
  items: OrgShortcut[];
}
