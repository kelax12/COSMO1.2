// ═══════════════════════════════════════════════════════════════════
// Agenda · les surfaces ouvertes à la demande, chargées à la demande
// ═══════════════════════════════════════════════════════════════════
//
// La feuille « Planifier une tâche » (maquette 170), la carte de création
// rapide et la gestion des récurrences avaient fait passer AgendaPage à
// 19,5 ko pour un plafond de 18,5 (2026-10-10). Aucune ne s'affiche à
// l'ouverture de la page : elles sortent du chunk et arrivent au premier
// geste qui les demande.
//
// Les deux surfaces qui ANIMENT leur fermeture (feuille, gestionnaire) sont
// montées à leur PREMIÈRE ouverture puis gardées : démontées à la fermeture,
// elles disparaîtraient d'un coup au lieu de glisser.
//
// Module à part pour une seconde raison : AgendaPage tutoie la limite de
// 600 lignes de `architecture.guard`, et l'a franchie avec ce code inline.
//
// 2026-10-22 : AgendaPage de nouveau à 18,2 ko pour 18,5. Trois surfaces de
// plus sortent du chunk : le tutoriel (et ses étapes desktop et mobile), qui
// ne s'ouvre qu'à la première visite, et le panneau de revue d'un créneau
// passé, qui ne vit que dans la modale d'édition d'un événement. Puis la
// pastille de revue elle-même : elle ne se pose que sur un créneau de tâche
// passé et non tranché, et arrive un instant après la grille.

import React, { Suspense } from 'react';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { useMountedAfterFirstOpen } from '@/lib/hooks/use-mounted-after-first-open';

const MobileScheduleSheetLazy = lazyWithRetry(() => import('./MobileScheduleSheet'));
const QuickEventCardLazy = lazyWithRetry(() => import('./QuickEventCard'));
const RecurringEventsManagerLazy = lazyWithRetry(() => import('./RecurringEventsManager'));
const AgendaTutorialLazy = lazyWithRetry(() => import('./AgendaTutorial'));
const SlotReviewPanelLazy = lazyWithRetry(() => import('./SlotReviewPanel'));
const SlotReviewMenuLazy = lazyWithRetry(() => import('./SlotReviewMenu'));

export function AgendaTutorial(props: React.ComponentProps<typeof AgendaTutorialLazy>) {
  // Gardé monté après la première ouverture : le tutoriel anime sa fermeture.
  const mounted = useMountedAfterFirstOpen(props.isOpen);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <AgendaTutorialLazy {...props} />
    </Suspense>
  );
}

export function SlotReviewPanel(props: React.ComponentProps<typeof SlotReviewPanelLazy>) {
  return (
    <Suspense fallback={null}>
      <SlotReviewPanelLazy {...props} />
    </Suspense>
  );
}

export function MobileScheduleSheet(props: React.ComponentProps<typeof MobileScheduleSheetLazy>) {
  const mounted = useMountedAfterFirstOpen(props.open);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <MobileScheduleSheetLazy {...props} />
    </Suspense>
  );
}

export function QuickEventCard(props: React.ComponentProps<typeof QuickEventCardLazy>) {
  return (
    <Suspense fallback={null}>
      <QuickEventCardLazy {...props} />
    </Suspense>
  );
}

export function RecurringEventsManager(props: React.ComponentProps<typeof RecurringEventsManagerLazy>) {
  const mounted = useMountedAfterFirstOpen(props.isOpen);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <RecurringEventsManagerLazy {...props} />
    </Suspense>
  );
}

export function SlotReviewMenu(props: React.ComponentProps<typeof SlotReviewMenuLazy>) {
  return (
    <Suspense fallback={null}>
      <SlotReviewMenuLazy {...props} />
    </Suspense>
  );
}
