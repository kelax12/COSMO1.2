// ═══════════════════════════════════════════════════════════════════
// ORG-REPORTS MODULE - React Query hooks
// ═══════════════════════════════════════════════════════════════════
//
// Le dépôt est déclaré ICI, pas dans `repository.factory.ts` : le factory vit
// dans le chunk d'entrée, et ce module n'est chargé que par la section
// Rapports (lazy). Même mécanisme que le factory (`defineRepository`, V12.3) ;
// le dépôt de démo n'arrive que par `import()`.

import { useQuery } from '@tanstack/react-query';
import { useIsDemo } from '@/lib/app-mode.store';
import type { IOrgReportsRepository } from './repository';
import type { ReportScope } from './types';
import { orgReportKeys } from './constants';
import { SupabaseOrgReportsRepository } from './supabase.repository';
import { defineRepository, eager, lazy } from '@/lib/define-repository';

const getOrgReportsRepository = defineRepository<IOrgReportsRepository>(
  lazy(() => import('./local.repository').then((m) => new m.LocalOrgReportsRepository())),
  eager(() => new SupabaseOrgReportsRepository()),
);

export const useActivityReports = (
  orgId: string | undefined,
  scope: ReportScope | null,
  from: string,
  to: string,
) => {
  const isDemo = useIsDemo();
  return useQuery({
    queryKey: [...orgReportKeys.range(orgId ?? '', scope ?? { kind: 'org' }, from, to), isDemo],
    queryFn: async () => {
      return getOrgReportsRepository().getReports(orgId as string, scope as ReportScope, from, to);
    },
    enabled: !!orgId && !!scope,
    // Une journée figée ne change plus : seule la nuit en ajoute une.
    staleTime: 1000 * 60 * 30,
  });
};
