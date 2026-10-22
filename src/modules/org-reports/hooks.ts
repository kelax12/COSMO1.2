// ═══════════════════════════════════════════════════════════════════
// ORG-REPORTS MODULE - React Query hooks
// ═══════════════════════════════════════════════════════════════════
//
// Le dépôt est choisi ICI, pas dans `repository.factory.ts` : le factory vit
// dans le chunk d'entrée, et ce module n'est chargé que par la section
// Rapports (lazy). Le dépôt de démo, lui, n'arrive que par `import()`.

import { useQuery } from '@tanstack/react-query';
import { useIsDemo } from '@/lib/app-mode.store';
import type { IOrgReportsRepository } from './repository';
import type { ReportScope } from './types';
import { orgReportKeys } from './constants';
import { SupabaseOrgReportsRepository } from './supabase.repository';

const supabaseRepo = new SupabaseOrgReportsRepository();
const loadDemoRepo = (): Promise<IOrgReportsRepository> =>
  import('./local.repository').then((m) => new m.LocalOrgReportsRepository());

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
      const repo = isDemo ? await loadDemoRepo() : supabaseRepo;
      return repo.getReports(orgId as string, scope as ReportScope, from, to);
    },
    enabled: !!orgId && !!scope,
    // Une journée figée ne change plus : seule la nuit en ajoute une.
    staleTime: 1000 * 60 * 30,
  });
};
