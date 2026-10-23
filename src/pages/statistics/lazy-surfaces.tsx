// ═══════════════════════════════════════════════════════════════════
// Statistiques · ce qui n'est pas peint à l'ouverture, chargé à part
// ═══════════════════════════════════════════════════════════════════
//
// StatisticsPage pesait 13,0 ko gzip pour un plafond de 13,0 (2026-10-22) :
// le prochain ajout l'aurait fait rougir. Deux surfaces ne servent pas au
// premier rendu et sortent du chunk :
//
// - la modale Premium, montée seulement quand on clique sur un verrou, puis
//   gardée pour qu'elle anime sa fermeture ;
// - la heatmap des habitudes, tout en bas de la page, sous la ligne de
//   flottaison à toutes les largeurs. Son chunk part dès le rendu de la
//   page, en parallèle des données : elle est là avant qu'on y descende.
//
// Les catalogues i18n (`premium`, `statistics`) sont déjà déclarés par la
// route dans `App.tsx` : rien à attendre ici.

import React, { Suspense } from 'react';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { useMountedAfterFirstOpen } from '@/lib/hooks/use-mounted-after-first-open';

const PremiumGateModalLazy = lazyWithRetry(() => import('@/components/PremiumGateModal'));
const HabitHeatmapLazy = lazyWithRetry(() => import('./HabitHeatmap'));

export function PremiumGateModal(props: React.ComponentProps<typeof PremiumGateModalLazy>) {
  const mounted = useMountedAfterFirstOpen(props.isOpen);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <PremiumGateModalLazy {...props} />
    </Suspense>
  );
}

export function HabitHeatmap(props: React.ComponentProps<typeof HabitHeatmapLazy>) {
  // Réserve une hauteur pendant le chargement : rien ne saute sous le doigt.
  return (
    <Suspense fallback={<div className="card p-6 h-[220px] animate-pulse" aria-hidden="true" />}>
      <HabitHeatmapLazy {...props} />
    </Suspense>
  );
}
