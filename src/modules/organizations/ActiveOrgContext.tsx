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
    localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // localStorage plein — préférence non persistée, sans gravité.
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

  const activeOrg = useMemo(() => {
    if (organizations.length === 0) return null;
    return organizations.find((o) => o.id === preferredOrgId) ?? organizations[0];
  }, [organizations, preferredOrgId]);

  const setActiveOrgId = (orgId: string) => {
    setPreferredOrgId(orgId);
    if (user) writeStoredActiveOrg({ userId: user.id, orgId });
  };

  const value = useMemo(
    () => ({ organizations, activeOrg, setActiveOrgId, isLoading }),
    // setActiveOrgId stable par render — dépendances sur les données.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizations, activeOrg, isLoading, user?.id],
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
