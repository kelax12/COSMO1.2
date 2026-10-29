// ═══════════════════════════════════════════════════════════════════
// OKR · les dialogues ouverts à la demande, chargés à la demande
// ═══════════════════════════════════════════════════════════════════
//
// La refonte mobile du 2026-10-11 a fait passer OKRPage à 15,3 ko pour un
// plafond de 15,0. La fiche de création/édition d'un objectif (OKRModalSheet,
// ~28 ko de source, importée par cette seule page), le point hebdomadaire et
// la confirmation de suppression ne s'affichent qu'après un geste : ils sortent
// du chunk.
// Montés à leur première ouverture puis gardés, pour animer leur fermeture
// (cf. `useMountedAfterFirstOpen`).

import React, { Suspense } from 'react';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { useMountedAfterFirstOpen } from '@/lib/hooks/use-mounted-after-first-open';

const DeleteObjectiveConfirmLazy = lazyWithRetry(() => import('./DeleteObjectiveConfirm'));
const OKRModalSheetLazy = lazyWithRetry(() => import('@/components/OKRModalSheet'));

export function DeleteObjectiveConfirm(props: React.ComponentProps<typeof DeleteObjectiveConfirmLazy>) {
  const mounted = useMountedAfterFirstOpen(props.deletingObjective !== null);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <DeleteObjectiveConfirmLazy {...props} />
    </Suspense>
  );
}

export function OKRModalSheet(props: React.ComponentProps<typeof OKRModalSheetLazy>) {
  const mounted = useMountedAfterFirstOpen(props.isOpen);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <OKRModalSheetLazy {...props} />
    </Suspense>
  );
}
