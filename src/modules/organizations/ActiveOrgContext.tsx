// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - Contexte « organisation active » (multi-org v2)
// ═══════════════════════════════════════════════════════════════════
//
// Un utilisateur peut appartenir à plusieurs entreprises. L'« org active »
// est une préférence par appareil ET par utilisateur, persistée en
// localStorage ({ userId, orgId } — safeParse B14) et exposée via contexte.
// Fallback : première org de la liste si aucune préférence valide.
//
// Monté dans App.tsx sous AuthProvider (dépend de useAuth) et sous
// QueryClientProvider (dépend de useMyOrganizations).

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/modules/auth/AuthContext';
import { useMyOrganizations } from './hooks';
import { ACTIVE_ORG_STORAGE_KEY } from './constants';
import type { MyOrganization } from './types';

interface StoredActiveOrg {
  userId: string;
  orgId: string;
}

function readStoredActiveOrg(): StoredActiveOrg | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredActiveOrg;
    if (typeof parsed?.userId === 'string' && typeof parsed?.orgId === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeStoredActiveOrg(value: StoredActiveOrg): void {
  try {
    const raw = localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
    const next = JSON.stringify(value);
    // Écriture idempotente : ce helper est désormais appelé depuis un effet à
    // chaque résolution de l'organisation active, pas seulement sur un
    // changement explicite.
    if (raw !== next) localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, next);
  } catch {
    // localStorage plein — préférence non persistée, sans gravité.
  }
}

function clearStoredActiveOrg(): void {
  try {
    localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
  } catch {
    // no-op
  }
}

interface ActiveOrgContextType {
  /** Toutes mes organisations (avec mon rôle dans chacune). */
  organizations: MyOrganization[];
  /** L'organisation active (préférence utilisateur, fallback première). */
  activeOrg: MyOrganization | null;
  /** Change l'organisation active (persisté par utilisateur). */
  setActiveOrgId: (orgId: string) => void;
  isLoading: boolean;
  /**
   * « Cet appareil a déjà vu cet utilisateur dans une organisation. »
   *
   * Sert UNIQUEMENT à réserver la place de l'entrée « Entreprise » dans les
   * barres de navigation pendant que la requête vole. Sans ça, la barre
   * latérale se peignait sans elle, puis la faisait apparaître : tout ce qui
   * suit (« Créer / rejoindre », la section AUTRE, les Paramètres) sautait
   * d'une ligne à chaque chargement de page. Sur mobile c'était pire — un
   * onglet changeait d'identité sous le doigt, « Habitudes » devenant
   * « Entreprise ».
   *
   * ⚠️ C'est un INDICE D'AFFICHAGE, jamais une autorisation. Il ne débloque
   * aucune donnée : la route `/entreprise` redirige toujours vers le dashboard
   * si `activeOrg` est nul une fois la requête résolue, et toute lecture reste
   * gouvernée par la RLS. Le pire cas est une entrée de nav affichée une
   * seconde de trop chez quelqu'un qui vient de quitter sa dernière
   * organisation depuis un autre appareil.
   */
  wasOrgMember: boolean;
}

const ActiveOrgContext = createContext<ActiveOrgContextType | undefined>(undefined);

export const ActiveOrgProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  // Ne requête les orgs qu'une fois authentifié (évite un appel anonyme).
  const { data: organizations = [], isLoading } = useMyOrganizations(isAuthenticated);
  const [preferredOrgId, setPreferredOrgId] = useState<string | null>(() => {
    return readStoredActiveOrg()?.orgId ?? null;
  });

  // Changement d'utilisateur : la préférence stockée ne vaut que pour SON id
  // (pas de fuite de choix entre comptes sur un appareil partagé).
  useEffect(() => {
    const stored = readStoredActiveOrg();
    if (stored && user && stored.userId !== user.id) {
      setPreferredOrgId(null);
    }
  }, [user?.id, user]);

  // Lu UNE fois au montage : c'est justement la valeur d'avant la requête.
  // La relire plus tard reviendrait à lire ce qu'on vient d'écrire.
  const [wasOrgMember] = useState<boolean>(() => {
    const stored = readStoredActiveOrg();
    return !!stored && (!user || stored.userId === user.id);
  });

  const activeOrg = useMemo(() => {
    if (organizations.length === 0) return null;
    return organizations.find((o) => o.id === preferredOrgId) ?? organizations[0];
  }, [organizations, preferredOrgId]);

  // L'indice n'existait que si l'utilisateur avait CHANGÉ d'organisation à la
  // main : `setActiveOrgId` était le seul à écrire, et le repli « première de
  // la liste » n'écrivait rien. Autrement dit il manquait exactement chez ceux
  // qui n'ont qu'une organisation, c'est-à-dire presque tout le monde.
  // On le pose donc dès qu'une organisation active est résolue, et on l'efface
  // quand la requête a répondu qu'il n'y en a aucune — sinon un ancien membre
  // verrait l'entreprise clignoter dans sa nav à chaque chargement, pour
  // toujours.
  useEffect(() => {
    if (!user) return;
    if (activeOrg) writeStoredActiveOrg({ userId: user.id, orgId: activeOrg.id });
    else if (!isLoading) clearStoredActiveOrg();
  }, [user, activeOrg, isLoading]);

  const setActiveOrgId = (orgId: string) => {
    setPreferredOrgId(orgId);
    if (user) writeStoredActiveOrg({ userId: user.id, orgId });
  };

  const value = useMemo(
    () => ({ organizations, activeOrg, setActiveOrgId, isLoading, wasOrgMember }),
    // setActiveOrgId stable par render — dépendances sur les données.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizations, activeOrg, isLoading, user?.id, wasOrgMember],
  );

  return <ActiveOrgContext.Provider value={value}>{children}</ActiveOrgContext.Provider>;
};

/**
 * L'organisation active + la liste + le switcher. Remplace l'ancien
 * useMyOrganization() (mono-org v1) dans tous les consommateurs.
 */
export const useActiveOrganization = (): ActiveOrgContextType => {
  const context = useContext(ActiveOrgContext);
  if (context === undefined) {
    throw new Error('useActiveOrganization must be used within an ActiveOrgProvider');
  }
  return context;
};
