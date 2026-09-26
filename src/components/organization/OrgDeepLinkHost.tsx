import { Suspense } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import type { OrgMember } from '@/modules/organizations';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { readEntityParam } from './deep-link.helpers';
import { entityRedirect } from './entity-redirect';

// ═══════════════════════════════════════════════════════════════════
// Liens profonds de /entreprise : UN lecteur, pour toutes les sections
//
// Règle (cohérence globale, 2026-09-25) : toute URL d'objet ouvre sa fiche
// depuis n'importe quel onglet. Avant, `?task=` n'était lu que par Projets :
// une notification ou un lien collé qui arrivait ailleurs n'ouvrait rien.
//
//   · fiche = PAGE (équipe, projet, objectif) → redirection vers sa section,
//     cf. `entityRedirect` ;
//   · fiche = SUPERPOSITION (tâche, membre) → ouverte sur place, ici.
//
// Pyramide et Membres gardent leur propre lecture de `?member=` : leur fiche
// porte des actions de placement que seule la pyramide sait mener. L'hôte ne
// l'ouvre donc que dans les autres sections, jamais deux fois.
//
// Ce composant vit dans le chunk de la page : la fiche et le modal sont lazy.
// ═══════════════════════════════════════════════════════════════════

const DeepTaskModal = lazyWithRetry(() => import('./DeepTaskModal'));
const DeepMemberSheet = lazyWithRetry(() => import('./DeepMemberSheet'));

/** Sections dont l'écran lit lui-même `?member=`. */
const MEMBER_SECTIONS: ReadonlySet<string> = new Set(['pyramid', 'members']);

interface OrgDeepLinkHostProps {
  orgId: string;
  /** Section affichée (`overview` pour l'Aperçu). */
  section: string;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  isManager: boolean;
}

const OrgDeepLinkHost = ({ orgId, section, members, currentUserId, isAdmin, isManager }: OrgDeepLinkHostProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  // `safeRedirectPath` comme toute destination lue dans l'URL, même construite
  // ici depuis une liste fermée (cf. no-open-redirect.test.ts).
  const redirect = safeRedirectPath(entityRedirect(section, searchParams));
  if (redirect) return <Navigate to={redirect} replace />;

  // Ce qui suit s'ouvre SUR PLACE : tâche (modal) et membre (fiche), jamais
  // une navigation. Les deux lectures d'URL ci-dessous ne nourrissent que des
  // identifiants, bornés par `readEntityParam`.

  const taskId = readEntityParam(searchParams, 'task');
  const memberId = MEMBER_SECTIONS.has(section) ? null : readEntityParam(searchParams, 'member');

  /** Refermer une fiche retire son paramètre : sinon elle se rouvrirait au rendu suivant. */
  const clear = (...keys: string[]) => {
    const next = new URLSearchParams(searchParams);
    for (const k of keys) next.delete(k);
    setSearchParams(next, { replace: true });
  };

  return (
    <Suspense fallback={null}>
      {taskId && (
        <DeepTaskModal
          key={taskId}
          orgId={orgId}
          taskId={taskId}
          members={members}
          isManager={isManager}
          onClose={() => clear('task')}
        />
      )}
      {memberId && (
        <DeepMemberSheet
          key={memberId}
          orgId={orgId}
          memberId={memberId}
          tab={searchParams.get('memberTab')}
          members={members}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => clear('member', 'memberTab')}
        />
      )}
    </Suspense>
  );
};

export default OrgDeepLinkHost;
