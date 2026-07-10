// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - LocalStorage Repository (mode démo)
// ═══════════════════════════════════════════════════════════════════
//
// Multi-org (v2) : deux entreprises fictives seedées au premier accès —
//   • « Nova Studio »  : l'utilisateur démo est ADMIN (6 membres, 1 demande
//     d'adhésion en attente pour tester l'inbox).
//   • « Atelier Lune » : l'utilisateur démo est MEMBRE simple (vue non-admin
//     + démonstration du switcher d'organisation).
// Seeds rechargées à chaque loginDemo() (sweep cosmo_* de clearDemoStorage).

import { IOrganizationsRepository } from './repository';
import { MyOrganization, Organization, OrgMember, OrgJoinRequest, OrgRole, UpdateOrganizationInput } from './types';
import {
  ORGS_STORAGE_KEY,
  ORG_MEMBERS_STORAGE_KEY,
  ORG_JOIN_REQUESTS_STORAGE_KEY,
} from './constants';

const DEMO_USER_ID = 'demo-user';
export const DEMO_ORG_ID = 'org-demo-1';
export const DEMO_ORG_2_ID = 'org-demo-2';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const DEMO_ORGS: Organization[] = [
  {
    id: DEMO_ORG_ID,
    name: 'Nova Studio',
    joinCode: 'COSMO-DEMO42',
    ownerId: DEMO_USER_ID,
    createdAt: new Date(Date.now() - 90 * DAY).toISOString(),
    description: 'Studio de création digitale — sites, apps et identités de marque.',
    industry: 'Design & Tech',
  },
  {
    id: DEMO_ORG_2_ID,
    name: 'Atelier Lune',
    joinCode: 'COSMO-LUNE77',
    ownerId: 'user-nina',
    createdAt: new Date(Date.now() - 45 * DAY).toISOString(),
    description: 'Collectif d\'artisans céramistes.',
    industry: 'Artisanat',
  },
];

// Pyramide Nova Studio (v2) — arbre N+1 :
//   demo-user (racine, admin)
//   ├── Marie Dupont (manager dérivé)
//   │   ├── Jean Martin
//   │   └── Sophie Bernard
//   └── Lucas Moreau
//   Camille Richard = NON PLACÉE (montre le flux de placement).
const DEMO_MEMBERS: OrgMember[] = [
  // ── Nova Studio (demo-user admin) ──
  { orgId: DEMO_ORG_ID, userId: DEMO_USER_ID, role: 'admin', managerId: null, joinedAt: new Date(Date.now() - 90 * DAY).toISOString(), displayName: 'Vous', email: 'demo@cosmo.app', avatar: '🚀' },
  { orgId: DEMO_ORG_ID, userId: 'friend-1', role: 'member', managerId: DEMO_USER_ID, joinedAt: new Date(Date.now() - 80 * DAY).toISOString(), displayName: 'Marie Dupont', email: 'marie.dupont@email.com', avatar: '👩' },
  { orgId: DEMO_ORG_ID, userId: 'friend-2', role: 'member', managerId: 'friend-1', joinedAt: new Date(Date.now() - 75 * DAY).toISOString(), displayName: 'Jean Martin', email: 'jean.martin@email.com', avatar: '👨' },
  { orgId: DEMO_ORG_ID, userId: 'friend-3', role: 'member', managerId: 'friend-1', joinedAt: new Date(Date.now() - 60 * DAY).toISOString(), displayName: 'Sophie Bernard', email: 'sophie.bernard@email.com', avatar: '👩‍💼' },
  { orgId: DEMO_ORG_ID, userId: 'user-lucas', role: 'member', managerId: DEMO_USER_ID, joinedAt: new Date(Date.now() - 45 * DAY).toISOString(), displayName: 'Lucas Moreau', email: 'lucas.moreau@email.com', avatar: '🧑' },
  { orgId: DEMO_ORG_ID, userId: 'user-camille', role: 'member', managerId: null, joinedAt: new Date(Date.now() - 30 * DAY).toISOString(), displayName: 'Camille Richard', email: 'camille.richard@email.com', avatar: '👩' },
  // ── Atelier Lune (demo-user membre simple, sous Nina) ──
  { orgId: DEMO_ORG_2_ID, userId: 'user-nina', role: 'admin', managerId: null, joinedAt: new Date(Date.now() - 45 * DAY).toISOString(), displayName: 'Nina Rousseau', email: 'nina.rousseau@email.com', avatar: '👩‍🎨' },
  { orgId: DEMO_ORG_2_ID, userId: DEMO_USER_ID, role: 'member', managerId: 'user-nina', joinedAt: new Date(Date.now() - 20 * DAY).toISOString(), displayName: 'Vous', email: 'demo@cosmo.app', avatar: '🚀' },
  { orgId: DEMO_ORG_2_ID, userId: 'user-theo', role: 'member', managerId: 'user-nina', joinedAt: new Date(Date.now() - 15 * DAY).toISOString(), displayName: 'Théo Garnier', email: 'theo.garnier@email.com', avatar: '🧔‍♂️' },
];

const DEMO_JOIN_REQUESTS: OrgJoinRequest[] = [
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

// Lecture défensive : clone des seeds (faille B12), JSON.parse protégé (B14).
function readOrSeed<T>(key: string, seed: T): T {
  const data = localStorage.getItem(key);
  if (!data) {
    const clone = JSON.parse(JSON.stringify(seed)) as T;
    localStorage.setItem(key, JSON.stringify(clone));
    return clone;
  }
  try {
    return JSON.parse(data) as T;
  } catch {
    const clone = JSON.parse(JSON.stringify(seed)) as T;
    localStorage.setItem(key, JSON.stringify(clone));
    return clone;
  }
}

export class LocalStorageOrganizationsRepository implements IOrganizationsRepository {
  private getOrgsArray(): Organization[] {
    return readOrSeed<Organization[]>(ORGS_STORAGE_KEY, DEMO_ORGS);
  }

  private saveOrgs(orgs: Organization[]): void {
    localStorage.setItem(ORGS_STORAGE_KEY, JSON.stringify(orgs));
  }

  private getMembersArray(): OrgMember[] {
    return readOrSeed<OrgMember[]>(ORG_MEMBERS_STORAGE_KEY, DEMO_MEMBERS);
  }

  private getRequestsArray(): OrgJoinRequest[] {
    return readOrSeed<OrgJoinRequest[]>(ORG_JOIN_REQUESTS_STORAGE_KEY, DEMO_JOIN_REQUESTS);
  }

  private saveRequests(requests: OrgJoinRequest[]): void {
    localStorage.setItem(ORG_JOIN_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  }

  // ─── Read ──────────────────────────────────────────────────────────

  async getMyOrganizations(): Promise<MyOrganization[]> {
    const orgs = this.getOrgsArray();
    const members = this.getMembersArray();
    return orgs
      .map((org) => {
        const me = members.find((m) => m.orgId === org.id && m.userId === DEMO_USER_ID);
        return me ? { ...org, myRole: me.role } : null;
      })
      .filter((o): o is MyOrganization => o !== null);
  }

  async getMembers(orgId: string): Promise<OrgMember[]> {
    return this.getMembersArray().filter((m) => m.orgId === orgId);
  }

  async getPendingJoinRequests(orgId: string): Promise<OrgJoinRequest[]> {
    return this.getRequestsArray().filter((r) => r.orgId === orgId && r.status === 'pending');
  }

  async getMySentJoinRequest(): Promise<OrgJoinRequest | null> {
    return this.getRequestsArray().find((r) => r.userId === DEMO_USER_ID && r.status === 'pending') ?? null;
  }

  // ─── Write ─────────────────────────────────────────────────────────

  async createOrganization(name: string): Promise<Organization> {
    // Multi-org : créer une nouvelle org est désormais possible en démo.
    const orgs = this.getOrgsArray();
    const org: Organization = {
      id: crypto.randomUUID(),
      name,
      joinCode: `COSMO-${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`,
      ownerId: DEMO_USER_ID,
      createdAt: new Date().toISOString(),
    };
    this.saveOrgs([...orgs, org]);
    const members = this.getMembersArray();
    members.push({
      orgId: org.id,
      userId: DEMO_USER_ID,
      role: 'admin',
      joinedAt: new Date().toISOString(),
      displayName: 'Vous',
      email: 'demo@cosmo.app',
      avatar: '🚀',
    });
    localStorage.setItem(ORG_MEMBERS_STORAGE_KEY, JSON.stringify(members));
    return org;
  }

  async requestJoin(code: string): Promise<{ orgName: string }> {
    const org = this.getOrgsArray().find((o) => o.joinCode === code.toUpperCase().trim());
    // Erreur générique (même comportement que la prod : pas de leak).
    if (!org) throw new Error('Code invalide');
    const isMember = this.getMembersArray().some(
      (m) => m.orgId === org.id && m.userId === DEMO_USER_ID,
    );
    if (isMember) throw new Error('Vous êtes déjà membre de cette entreprise');
    throw new Error('Demande envoyée — en mode démo, utilisez les entreprises fournies');
  }

  async respondJoinRequest(requestId: string, accept: boolean): Promise<void> {
    const requests = this.getRequestsArray();
    const req = requests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') {
      throw new Error('Demande introuvable ou déjà traitée');
    }
    req.status = accept ? 'accepted' : 'rejected';
    this.saveRequests(requests);

    if (accept) {
      const members = this.getMembersArray();
      if (!members.some((m) => m.orgId === req.orgId && m.userId === req.userId)) {
        members.push({
          orgId: req.orgId,
          userId: req.userId,
          role: 'member',
          joinedAt: new Date().toISOString(),
          displayName: req.requesterName ?? 'Membre',
          email: req.requesterEmail,
          avatar: req.requesterAvatar,
        });
        localStorage.setItem(ORG_MEMBERS_STORAGE_KEY, JSON.stringify(members));
      }
    }
  }

  async cancelJoinRequest(requestId: string): Promise<void> {
    this.saveRequests(this.getRequestsArray().filter((r) => r.id !== requestId));
  }

  async updateOrganization(orgId: string, input: UpdateOrganizationInput): Promise<Organization> {
    const orgs = this.getOrgsArray();
    const org = orgs.find((o) => o.id === orgId);
    if (!org) throw new Error('Entreprise introuvable');
    const me = this.getMembersArray().find((m) => m.orgId === orgId && m.userId === DEMO_USER_ID);
    if (me?.role !== 'admin') throw new Error('Seul un administrateur peut modifier le profil');
    if (input.name !== undefined) org.name = input.name;
    if (input.description !== undefined) org.description = input.description;
    if (input.industry !== undefined) org.industry = input.industry;
    this.saveOrgs(orgs);
    return org;
  }

  // ─── Administration ────────────────────────────────────────────────

  private saveMembers(members: OrgMember[]): void {
    localStorage.setItem(ORG_MEMBERS_STORAGE_KEY, JSON.stringify(members));
  }

  private adminCount(members: OrgMember[], orgId: string): number {
    return members.filter((m) => m.orgId === orgId && m.role === 'admin').length;
  }

  async setMemberRole(orgId: string, userId: string, role: OrgRole): Promise<void> {
    const members = this.getMembersArray();
    const member = members.find((m) => m.orgId === orgId && m.userId === userId);
    if (!member) throw new Error('Membre introuvable');
    if (member.role === 'admin' && role !== 'admin' && this.adminCount(members, orgId) <= 1) {
      throw new Error('Impossible de rétrograder le dernier administrateur');
    }
    member.role = role;
    this.saveMembers(members);
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    const members = this.getMembersArray();
    const member = members.find((m) => m.orgId === orgId && m.userId === userId);
    if (!member) throw new Error('Membre introuvable');
    if (member.role === 'admin' && this.adminCount(members, orgId) <= 1) {
      throw new Error('Impossible de retirer le dernier administrateur');
    }
    // Re-parentage des subordonnés vers le grand-parent (miroir de la RPC).
    const next = members
      .map((m) =>
        m.orgId === orgId && m.managerId === userId ? { ...m, managerId: member.managerId ?? null } : m,
      )
      .filter((m) => !(m.orgId === orgId && m.userId === userId));
    this.saveMembers(next);
  }

  async leaveOrganization(orgId: string): Promise<void> {
    const members = this.getMembersArray();
    const me = members.find((m) => m.orgId === orgId && m.userId === DEMO_USER_ID);
    if (!me) throw new Error('Vous ne faites pas partie de cette entreprise');
    if (me.role === 'admin' && this.adminCount(members, orgId) <= 1) {
      throw new Error('Transférez le rôle admin avant de quitter');
    }
    // Re-parentage des subordonnés vers le grand-parent (miroir de la RPC).
    const next = members
      .map((m) =>
        m.orgId === orgId && m.managerId === DEMO_USER_ID ? { ...m, managerId: me.managerId ?? null } : m,
      )
      .filter((m) => !(m.orgId === orgId && m.userId === DEMO_USER_ID));
    this.saveMembers(next);
  }

  // ─── Pyramide (v2) ────────────────────────────────────────────────

  /** Sous-arbre strict de `root` (ids), cap 50 niveaux (miroir SQL). */
  private subtreeOf(members: OrgMember[], orgId: string, root: string): Set<string> {
    const out = new Set<string>();
    let frontier = [root];
    for (let depth = 0; depth < 50 && frontier.length > 0; depth++) {
      const next: string[] = [];
      for (const m of members) {
        if (m.orgId === orgId && m.managerId && frontier.includes(m.managerId) && !out.has(m.userId)) {
          out.add(m.userId);
          next.push(m.userId);
        }
      }
      frontier = next;
    }
    return out;
  }

  async setMemberManager(orgId: string, userId: string, managerId: string | null): Promise<void> {
    const members = this.getMembersArray();
    const target = members.find((m) => m.orgId === orgId && m.userId === userId);
    if (!target) throw new Error('Membre introuvable');

    const me = members.find((m) => m.orgId === orgId && m.userId === DEMO_USER_ID);
    const isAdmin = me?.role === 'admin';
    if (!isAdmin) {
      const mySubtree = this.subtreeOf(members, orgId, DEMO_USER_ID);
      if (!mySubtree.has(userId)) {
        throw new Error('Vous ne pouvez déplacer que les membres sous vous');
      }
      if (managerId === null) {
        throw new Error('Seul un administrateur peut détacher un membre');
      }
      if (managerId !== DEMO_USER_ID && !mySubtree.has(managerId)) {
        throw new Error('La destination doit être dans votre équipe');
      }
    }

    if (managerId !== null) {
      if (managerId === userId) throw new Error('Un membre ne peut pas être son propre responsable');
      if (!members.some((m) => m.orgId === orgId && m.userId === managerId)) {
        throw new Error('Le responsable doit être membre de l\'entreprise');
      }
      // Anti-cycle : la destination ne peut pas être un descendant de la cible.
      if (this.subtreeOf(members, orgId, userId).has(managerId)) {
        throw new Error('Ce déplacement créerait un cycle dans la hiérarchie');
      }
    }

    target.managerId = managerId;
    this.saveMembers(members);
  }
}
