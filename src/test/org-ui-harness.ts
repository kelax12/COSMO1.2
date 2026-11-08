// ═══════════════════════════════════════════════════════════════════
// Harnais des tests d'écran « entreprise » (vague 15.2, TST-02)
//
// Il se pose SUR `tasks-ui-harness.tsx` (vague 15.1) et ne le duplique pas :
// client de requêtes, routeur, viewport, traducteur paresseux et session
// simulée viennent de là. Ce fichier n'ajoute que ce qu'un écran entreprise a
// de propre : « Nova Studio », l'organisation de démonstration, ses quinze
// membres, ses projets et ses tâches, servis par les VRAIS dépôts de démo
// (`localStorage`), et les droits d'un membre précis.
//
// Les `vi.mock` ne se partagent pas : chaque fichier de test pose les siens
// (`useAuth`) et lit l'utilisateur courant dans `session`.
// ═══════════════════════════════════════════════════════════════════
import { appModeStore } from '@/lib/app-mode.store';
import { resetRepositories, getOrganizationsRepository } from '@/lib/repository.factory';
import { ORG_MEMBER_PERMISSIONS_STORAGE_KEY, ORG_MEMBERS_STORAGE_KEY } from '@/modules/organizations/constants';
import type { OrgMember } from '@/modules/organizations';
import type { OrgMemberPermissions, OrgPermissionKey } from '@/modules/organizations/permissions';
import { warmDemoCaches } from './tasks-ui-harness';

// Ré-exports NOMMÉS (un `export *` fait avertir react-refresh) : le sous-ensemble du harnais
// des tâches dont les écrans entreprise, agenda, statistiques et OKR ont besoin.
export {
  renderApp, setViewport, resetDemoWorld, lazyT, fakeAuth, fakeBilling, makeTask, dayKeyFromToday,
  storedTasks, findFiche, makeQueryClient, DEMO_USER, TODAY_KEY,
} from './tasks-ui-harness';

/** Identifiant de l'organisation de démonstration (« Nova Studio »). */
export const ORG_ID = 'org-demo-1';
/** Administrateur de « Nova Studio » : l'utilisateur de démonstration. */
export const ADMIN_ID = 'demo-user';
/** Un membre ordinaire : aucun droit d'administration, droits de base, aucun rôle personnalisé semé. */
export const MEMBER_ID = 'user-emma';

/** Utilisateur courant des tests, lu par le `useAuth` simulé de chaque fichier. */
export const session = { userId: ADMIN_ID };

/** Remet le monde entreprise à zéro : démo, dépôts neufs, stockage vide, admin connecté. */
export function resetOrgWorld(): void {
  localStorage.clear();
  appModeStore.setDemo(true);
  resetRepositories();
  session.userId = ADMIN_ID;
  // Tutoriels et accueils, déclarés vus : ils ne sont pas l'objet de ces tests.
  for (const page of ['tasks', 'agenda', 'okr', 'statistics', 'organization']) {
    for (const device of ['desktop', 'mobile']) localStorage.setItem(`cosmo_tutorial_seen_${page}_${device}`, '1');
  }
}

/** Les membres de « Nova Studio », tels que le dépôt de démonstration les sert. */
export async function demoMembers(): Promise<OrgMember[]> {
  return getOrganizationsRepository().getMembers(ORG_ID);
}

/**
 * Retire des droits à un membre : une surcharge explicite `false` par clé,
 * écrite là où le dépôt de démonstration la lit (comme le fait la fiche de
 * permissions d'un administrateur).
 */
export function denyPermissions(userId: string, keys: OrgPermissionKey[]): void {
  const row: OrgMemberPermissions = {
    orgId: ORG_ID,
    userId,
    overrides: Object.fromEntries(keys.map((k) => [k, false])),
    assignTargets: null,
  };
  localStorage.setItem(ORG_MEMBER_PERMISSIONS_STORAGE_KEY, JSON.stringify([row]));
}

export { warmDemoCaches };

/**
 * Fait de l'utilisateur de démonstration un simple membre de « Nova Studio ».
 *
 * Le dépôt de démo n'a qu'une identité (`getMyOrganizations` lit `demo-user`) : pour
 * voir l'écran d'un non-administrateur, on change SON rôle dans l'annuaire, comme le
 * ferait la transmission des droits d'administration à quelqu'un d'autre.
 */
export async function demoteDemoUserToMember(): Promise<void> {
  const members = await demoMembers();
  localStorage.setItem(
    ORG_MEMBERS_STORAGE_KEY,
    JSON.stringify(members.map((m) => (m.userId === ADMIN_ID ? { ...m, role: 'member' } : m))),
  );
}
