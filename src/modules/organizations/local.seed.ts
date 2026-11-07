// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS - Données de démonstration (seed)
// ═══════════════════════════════════════════════════════════════════
//
// Jeu de données seul (V12.3) : aucune lecture ni écriture de stockage ici. Le
// dépôt de démo voisin l'ensemence au premier accès.

import { Organization, OrgMember, OrgJoinRequest } from './types';

export const DEMO_USER_ID = 'demo-user';
export const DEMO_ORG_ID = 'org-demo-1';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
export const DEMO_ORGS: Organization[] = [
  {
    id: DEMO_ORG_ID,
    name: 'Nova Studio',
    joinCode: 'COSMO-DEMO42',
    ownerId: DEMO_USER_ID,
    createdAt: new Date(Date.now() - 90 * DAY).toISOString(),
    description: 'Studio de création digitale : sites, apps et identités de marque.',
    industry: 'Design & Tech',
  },
];

// Pyramide Nova Studio (v2) — arbre N+1 :
//   demo-user (racine, admin)
//   ├── Marie Dupont (manager dérivé)
//   │   ├── Jean Martin
//   │   ├── Sophie Bernard
//   │   ├── Chloé Petit
//   │   └── Emma Lambert
//   ├── Lucas Moreau (manager dérivé)
//   │   ├── Inès Benali
//   │   └── Antoine Girard
//   ├── Manon Faure (manager dérivé, Marketing)
//   │   ├── Paul Mercier
//   │   ├── Léa Fontaine
//   │   └── Karim Haddad
//   └── Yanis Chevalier
//   Camille Richard = NON PLACÉE (montre le flux de placement).
//   15 membres au total (2026-10-05) : une PME crédible, pas une équipe de six.
export const DEMO_MEMBERS: OrgMember[] = [
  // ── Nova Studio (demo-user admin) ──
  { orgId: DEMO_ORG_ID, userId: DEMO_USER_ID, role: 'admin', managerId: null, joinedAt: new Date(Date.now() - 90 * DAY).toISOString(), displayName: 'Vous', email: 'demo@cosmo.app' },
  { orgId: DEMO_ORG_ID, userId: 'friend-1', role: 'member', managerId: DEMO_USER_ID, joinedAt: new Date(Date.now() - 80 * DAY).toISOString(), displayName: 'Marie Dupont', email: 'marie.dupont@email.com' },
  { orgId: DEMO_ORG_ID, userId: 'friend-2', role: 'member', managerId: 'friend-1', joinedAt: new Date(Date.now() - 75 * DAY).toISOString(), displayName: 'Jean Martin', email: 'jean.martin@email.com' },
  { orgId: DEMO_ORG_ID, userId: 'friend-3', role: 'member', managerId: 'friend-1', joinedAt: new Date(Date.now() - 60 * DAY).toISOString(), displayName: 'Sophie Bernard', email: 'sophie.bernard@email.com' },
  { orgId: DEMO_ORG_ID, userId: 'user-lucas', role: 'member', managerId: DEMO_USER_ID, joinedAt: new Date(Date.now() - 45 * DAY).toISOString(), displayName: 'Lucas Moreau', email: 'lucas.moreau@email.com' },
  { orgId: DEMO_ORG_ID, userId: 'user-camille', role: 'member', managerId: null, joinedAt: new Date(Date.now() - 30 * DAY).toISOString(), displayName: 'Camille Richard', email: 'camille.richard@email.com' },
  { orgId: DEMO_ORG_ID, userId: 'user-manon', role: 'member', managerId: DEMO_USER_ID, joinedAt: new Date(Date.now() - 85 * DAY).toISOString(), displayName: 'Manon Faure', email: 'manon.faure@email.com' },
  { orgId: DEMO_ORG_ID, userId: 'user-chloe', role: 'member', managerId: 'friend-1', joinedAt: new Date(Date.now() - 70 * DAY).toISOString(), displayName: 'Chloé Petit', email: 'chloe.petit@email.com' },
  { orgId: DEMO_ORG_ID, userId: 'user-emma', role: 'member', managerId: 'friend-1', joinedAt: new Date(Date.now() - 28 * DAY).toISOString(), displayName: 'Emma Lambert', email: 'emma.lambert@email.com' },
  { orgId: DEMO_ORG_ID, userId: 'user-ines', role: 'member', managerId: 'user-lucas', joinedAt: new Date(Date.now() - 40 * DAY).toISOString(), displayName: 'Inès Benali', email: 'ines.benali@email.com' },
  { orgId: DEMO_ORG_ID, userId: 'user-antoine', role: 'member', managerId: 'user-lucas', joinedAt: new Date(Date.now() - 20 * DAY).toISOString(), displayName: 'Antoine Girard', email: 'antoine.girard@email.com' },
  { orgId: DEMO_ORG_ID, userId: 'user-paul', role: 'member', managerId: 'user-manon', joinedAt: new Date(Date.now() - 65 * DAY).toISOString(), displayName: 'Paul Mercier', email: 'paul.mercier@email.com' },
  { orgId: DEMO_ORG_ID, userId: 'user-lea', role: 'member', managerId: 'user-manon', joinedAt: new Date(Date.now() - 50 * DAY).toISOString(), displayName: 'Léa Fontaine', email: 'lea.fontaine@email.com' },
  { orgId: DEMO_ORG_ID, userId: 'user-karim', role: 'member', managerId: 'user-manon', joinedAt: new Date(Date.now() - 14 * DAY).toISOString(), displayName: 'Karim Haddad', email: 'karim.haddad@email.com' },
  { orgId: DEMO_ORG_ID, userId: 'user-yanis', role: 'member', managerId: DEMO_USER_ID, joinedAt: new Date(Date.now() - 55 * DAY).toISOString(), displayName: 'Yanis Chevalier', email: 'yanis.chevalier@email.com' },
];

export const DEMO_JOIN_REQUESTS: OrgJoinRequest[] = [
  {
    id: 'org-join-req-demo-1',
    orgId: DEMO_ORG_ID,
    userId: 'user-hugo',
    requestedAt: new Date(Date.now() - 5 * HOUR).toISOString(),
    status: 'pending',
    requesterName: 'Hugo Lefèvre',
    requesterEmail: 'hugo.lefevre@email.com',
    requesterAvatar: '🧔',
    orgName: 'Nova Studio',
  },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts. Le nom propre « Nova Studio »
// n'est pas traduit : c'est une marque, pas un mot de la langue.
export const DEMO_ORGS_EN: Record<string, Partial<Organization>> = {
  [DEMO_ORG_ID]: { description: 'Digital creative studio: websites, apps and brand identities.' },
};
