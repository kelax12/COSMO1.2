// ═══════════════════════════════════════════════════════════════════
// Création d'un projet ou d'une équipe : UN formulaire par objet, ouvrable
// de partout (cohérence globale, 2026-09-25)
//
// Avant : un projet se créait à trois endroits (le formulaire complet de
// Projets, un champ « nom seul » dans les puces de Tâches, un autre dans le
// modal de tâche), une équipe à quatre (Membres, Pyramide, Projets, et un
// champ « nom + couleur » dans le modal d'OKR). Selon l'endroit, on obtenait
// un projet gris sans responsable, ou une équipe sans aucun membre.
//
// Désormais chaque bouton « Nouveau projet / Nouvelle équipe » appelle
// `useOrgCreate().openProject()` / `.openTeam()`, qui ouvre LE formulaire
// complet ; `onCreated` rend l'id créé à l'appelant (sélectionner le projet
// dans la tâche en cours, filtrer sur la nouvelle équipe…).
//
// ❌ Ne jamais réécrire un champ « créer un projet / une équipe » en ligne.
//    Garde : `org-create.guard.test.ts`.
// ═══════════════════════════════════════════════════════════════════

import { createContext, Suspense, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { lazyWithRetry } from '@/lib/lazy-with-retry';

export interface OpenProjectOptions {
  /** Équipe présélectionnée ('' = toute l'entreprise). */
  defaultTeamId?: string;
  /** Modèle présélectionné (« Nouveau projet depuis ce modèle »). */
  templateId?: string;
  onCreated?: (projectId: string) => void;
}

export interface OpenTeamOptions {
  onCreated?: (teamId: string) => void;
}

export type OrgCreateRequest =
  | { kind: 'project'; options: OpenProjectOptions }
  | { kind: 'team'; options: OpenTeamOptions };

interface OrgCreateApi {
  openProject: (options?: OpenProjectOptions) => void;
  openTeam: (options?: OpenTeamOptions) => void;
}

const OrgCreateContext = createContext<OrgCreateApi | null>(null);

// Avec les catalogues qu'il lit : le formulaire de projet parle `portfolio`, et
// ce fournisseur est aussi monté hors de /entreprise (modal de tâche de /tasks).
const OrgCreateForms = lazyWithRetry(() => import('./OrgCreateForms'), ['org', 'overlays', 'portfolio']);

/**
 * Porte l'unique formulaire de création projet / équipe d'une organisation.
 * Monté par `OrganizationPage` ; `OrgCreateBoundary` en pose un seulement là
 * où il n'y en a pas encore (le modal de tâche ouvert depuis la page Tâches
 * personnelle).
 */
export const OrgCreateProvider = ({ orgId, children }: { orgId: string; children: ReactNode }) => {
  const [request, setRequest] = useState<OrgCreateRequest | null>(null);
  const openProject = useCallback((options: OpenProjectOptions = {}) => setRequest({ kind: 'project', options }), []);
  const openTeam = useCallback((options: OpenTeamOptions = {}) => setRequest({ kind: 'team', options }), []);
  const api = useMemo(() => ({ openProject, openTeam }), [openProject, openTeam]);
  return (
    <OrgCreateContext.Provider value={api}>
      {children}
      {request && (
        <Suspense fallback={null}>
          <OrgCreateForms orgId={orgId} request={request} onClose={() => setRequest(null)} />
        </Suspense>
      )}
    </OrgCreateContext.Provider>
  );
};

/** Pose un `OrgCreateProvider` seulement s'il n'y en a pas au-dessus. */
export const OrgCreateBoundary = ({ orgId, children }: { orgId: string; children: ReactNode }) => {
  const existing = useContext(OrgCreateContext);
  if (existing || !orgId) return <>{children}</>;
  return <OrgCreateProvider orgId={orgId}>{children}</OrgCreateProvider>;
};

/**
 * Ouvre le formulaire unique. Hors de tout fournisseur (un test qui monte un
 * composant seul), les deux fonctions ne font rien plutôt que de lever.
 */
export const useOrgCreate = (): OrgCreateApi =>
  useContext(OrgCreateContext) ?? NOOP_API;

const NOOP_API: OrgCreateApi = { openProject: () => {}, openTeam: () => {} };
