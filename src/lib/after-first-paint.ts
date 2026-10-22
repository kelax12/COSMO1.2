// C-116 · laisser PEINDRE le prérendu avant que React ne le remplace.
//
// `createRoot` vide `#root`, donc `#seo-fallback`, à son premier commit. Monté
// avant la première peinture, il effaçait un prérendu que personne n'avait vu :
// le LCP devenait un nœud rendu par React, donc dépendant de tout le JS du
// chemin critique (5,6 à 8,3 s en Lighthouse CI mobile, 2026-10-10).
//
// On attend la PREUVE de la peinture, l'entrée `first-contentful-paint`, et non
// un `requestAnimationFrame` : pendant le chargement, Chrome exécute le rAF sans
// présenter la frame, et le prérendu n'était peint qu'une passe sur deux.
//
// Plafond : si la peinture tarde (CSS bloquant plus lent que le JS), on rend
// la main quand même, comme avant. Un onglet en arrière-plan ne peint rien :
// on y rend la main tout de suite.

export const PAINT_WAIT_CAP_MS = 1500;

export function afterFirstPaint(cb: () => void, capMs: number = PAINT_WAIT_CAP_MS): void {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    setTimeout(cb, 0);
  };

  if (document.visibilityState === 'hidden') {
    run();
    return;
  }

  try {
    if (!PerformanceObserver.supportedEntryTypes?.includes('paint')) throw new Error('paint');
    const observer = new PerformanceObserver((list) => {
      if (list.getEntriesByName('first-contentful-paint').length > 0) {
        observer.disconnect();
        run();
      }
    });
    observer.observe({ type: 'paint', buffered: true });
    setTimeout(() => {
      observer.disconnect();
      run();
    }, capMs);
  } catch {
    // Pas de Paint Timing : deux frames, au mieux.
    requestAnimationFrame(() => requestAnimationFrame(run));
    setTimeout(run, capMs);
  }
}
