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

import React, { Suspense, useEffect, useState } from 'react';
import { lazyWithRetry } from '@/lib/lazy-with-retry';

const MobileScheduleSheetLazy = lazyWithRetry(() => import('./MobileScheduleSheet'));
const QuickEventCardLazy = lazyWithRetry(() => import('./QuickEventCard'));
const RecurringEventsManagerLazy = lazyWithRetry(() => import('./RecurringEventsManager'));

/** Vrai dès la première ouverture, et le reste. */
function useMountedAfterFirstOpen(open: boolean): boolean {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);
  return mounted || open;
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
