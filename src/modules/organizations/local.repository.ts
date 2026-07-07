// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - LocalStorage Repository (mode démo)
// ═══════════════════════════════════════════════════════════════════
//
// Entreprise fictive « Nova Studio » seedée au premier accès : l'utilisateur
// démo est admin, 5 membres fictifs (mêmes personas que les seeds friends),
// 1 demande d'adhésion en attente pour tester l'acceptation via l'inbox.
// Seeds rechargées à chaque loginDemo() (sweep cosmo_* de clearDemoStorage).

import { IOrganizationsRepository } from './repository';
import { MyOrganization, Organization, OrgMember, OrgJoinRequest, OrgRole } from './types';
import {
  ORG_STORAGE_KEY,
  ORG_MEMBERS_STORAGE_KEY,
  ORG_JOIN_REQUESTS_STORAGE_KEY,
} from './constants';

const DEMO_USER_ID = 'demo-user';
const DEMO_ORG_ID = 'org-demo-1';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const DEMO_ORG: Organization = {
  id: DEMO_ORG_ID,
  name: 'Nova Studio',
  joinCode: 'COSMO-DEMO42',
  ownerId: DEMO_USER_ID,
  createdAt: new Date(Date.now() - 90 * DAY).toISOString(),
};

const DEMO_MEMBERS: OrgMember[] = [
  { orgId: DEMO_ORG_ID, userId: DEMO_USER_ID, role: 'admin', joinedAt: new Date(Date.now() - 90 * DAY).toISOString(), displayName: 'Vous', email: 'demo@cosmo.app', avatar: '🚀' },
  { orgId: DEMO_ORG_ID, userId: 'friend-1', role: 'manager', joinedAt: new Date(Date.now() - 80 * DAY).toISOString(), displayName: 'Marie Dupont', email: 'marie.dupont@email.com', avatar: '👩' },
  { orgId: DEMO_ORG_ID, userId: 'friend-2', role: 'member', joinedAt: new Date(Date.now() - 75 * DAY).toISOString(), displayName: 'Jean Martin', email: 'jean.martin@email.com', avatar: '👨' },
  { orgId: DEMO_ORG_ID, userId: 'friend-3', role: 'member', joinedAt: new Date(Date.now() - 60 * DAY).toISOString(), displayName: 'Sophie Bernard', email: 'sophie.bernard@email.com', avatar: '👩‍💼' },
  { orgId: DEMO_ORG_ID, userId: 'user-lucas', role: 'member', joinedAt: new Date(Date.now() - 45 * DAY).toISOString(), displayName: 'Lucas Moreau', email: 'lucas.moreau@email.com', avatar: '🧑' },
  { orgId: DEMO_ORG_ID, userId: 'user-camille', role: 'member', joinedAt: new Date(Date.now() - 30 * DAY).toISOString(), displayName: 'Camille Richard', email: 'camille.richard@email.com', avatar: '👩' },
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
  private getOrg(): Organization | null {
    return readOrSeed<Organization | null>(ORG_STORAGE_KEY, DEMO_ORG);
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

  async getMyOrganization(): Promise<MyOrganization | null> {
    const org = this.getOrg();
    if (!org) return null;
    const me = this.getMembersArray().find((m) => m.userId === DEMO_USER_ID);
    if (!me) return null;
    return { ...org, myRole: me.role };
  }

  async getMembers(orgId: string): Promise<OrgMember[]> {
    return this.getMembersArray().filter((m) => m.orgId === orgId);
  }

  async getPendingJoinRequests(orgId: string): Promise<OrgJoinRequest[]> {
    return this.getRequestsArray().filter((r) => r.orgId === orgId && r.status === 'pending');
  }

  async getMySentJoinRequest(): Promise<OrgJoinRequest | null> {
    // L'utilisateur démo est déjà membre : jamais de demande sortante.
    return this.getRequestsArray().find((r) => r.userId === DEMO_USER_ID && r.status === 'pending') ?? null;
  }

  // ─── Write ─────────────────────────────────────────────────────────

  async createOrganization(_name: string): Promise<Organization> {
    // V1 : une organisation max par utilisateur (même règle que la RPC prod).
    throw new Error('Vous appartenez déjà à une entreprise');
  }

  async requestJoin(_code: string): Promise<{ orgName: string }> {
    throw new Error('Vous appartenez déjà à une entreprise');
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
    this.saveMembers(members.filter((m) => !(m.orgId === orgId && m.userId === userId)));
  }

  async leaveOrganization(orgId: string): Promise<void> {
    const members = this.getMembersArray();
    const me = members.find((m) => m.orgId === orgId && m.userId === DEMO_USER_ID);
    if (!me) throw new Error('Vous ne faites pas partie de cette entreprise');
    if (me.role === 'admin' && this.adminCount(members, orgId) <= 1) {
      throw new Error('Transférez le rôle admin avant de quitter');
    }
    this.saveMembers(members.filter((m) => !(m.orgId === orgId && m.userId === DEMO_USER_ID)));
    // Démo : quitter réinitialise l'org (le compte redevient particulier).
    localStorage.removeItem(ORG_STORAGE_KEY);
  }
}
