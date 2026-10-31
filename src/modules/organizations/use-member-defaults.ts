// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - Droits par défaut d'un membre (mig. 232)
// ═══════════════════════════════════════════════════════════════════
//
// Lit `org_settings.member_default_perms` par la MÊME clé que
// `useOrgSettings` : un admin qui coche une case dans Paramètres invalide
// cette clé, et les droits de tout l'écran suivent. On passe par le
// sélecteur paresseux d'org-config (`repository.instance`), jamais par son
// baril : ses écrans d'administration n'ont rien à faire dans ce chunk.

import { useQuery } from '@tanstack/react-query';
import { orgConfigKeys } from '@/modules/org-config/constants';
import { getOrgConfigRepository } from '@/modules/org-config/repository.instance';

/** `null` tant que rien n'est réglé (ou chargé) : défaut historique. */
export const useOrgMemberDefaults = (orgId: string | undefined) => {
  const { data, isLoading } = useQuery({
    queryKey: orgConfigKeys.settings(orgId ?? ''),
    queryFn: () => getOrgConfigRepository().getSettings(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60,
  });
  return { memberDefaults: data?.memberDefaultPerms ?? null, isLoading: !!orgId && isLoading };
};
