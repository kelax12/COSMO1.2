// ═══════════════════════════════════════════════════════════════════
// MISE EN MOTS DES INSIGHTS DE LA PAGE STATISTIQUES
// ═══════════════════════════════════════════════════════════════════
//
// `src/lib/stats-insights.ts` MESURE (jours dominants, habitude fragile,
// dynamique de complétion) et rend des faits typés. Ce fichier les met en
// PHRASES via le catalogue `statistics`, et c'est la seule frontière qui
// compte : un module pur n'a pas de locale, un écran en a une.
//
// ⚠️ Extrait de `StatisticsPage.tsx` le 2026-09-03, imposé par le cliquet de
// taille (le fichier repassait au-dessus de 600 lignes). La coupe suit une
// frontière réelle plutôt qu'un découpage de convenance.

import { useCallback } from 'react';
import { useT } from '@/i18n/useT';
import type { Insight } from '@/lib/stats-insights';

/**
 * Rend un insight en une phrase de la langue active.
 *
 * Les noms de jours vivent dans `common` (`weekday.0` … `weekday.6`) et non
 * dans `statistics` : ils servent aussi ailleurs, et l'ancienne version les
 * portait en dur en français dans le module de mesure.
 */
export function useInsightText(): (insight: Insight) => string {
  const { t } = useT('statistics');
  const { t: tCommon } = useT('common');

  return useCallback(
    (insight: Insight): string => {
      switch (insight.kind) {
        case 'bestDay':
          return t('insights.bestDay', {
            day: tCommon(`weekday.${insight.weekday}` as Parameters<typeof tCommon>[0]),
            share: String(insight.share),
          });
        case 'fragileHabit':
          return t('insights.fragileHabit', {
            name: insight.name,
            missed: String(insight.missed),
          });
        case 'momentumFirst':
          return t('insights.momentumFirst', { count: String(insight.count) });
        case 'momentumUp':
          return t('insights.momentumUp', {
            count: String(insight.count),
            delta: String(insight.delta),
          });
        case 'momentumDown':
          return t('insights.momentumDown', {
            count: String(insight.count),
            delta: String(insight.delta),
          });
        case 'momentumStable':
          return t('insights.momentumStable', { count: String(insight.count) });
      }
    },
    [t, tCommon],
  );
}
