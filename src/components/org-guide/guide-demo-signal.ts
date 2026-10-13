// src/components/org-guide/guide-demo-signal.ts
import { useEffect, useState } from 'react';

/**
 * Signal « une démo du guide est en cours », émis par `OrgGuideHost` (lazy)
 * et lu par la page. Un évènement plutôt qu'un contexte : la page ne charge
 * pas l'hôte du guide, elle n'en écoute que l'état.
 *
 * Sert à faire ressortir la navigation de droite : repliée, elle sort de
 * l'écran et devient inerte, et le curseur visait un lien invisible, donc on
 * ne voyait pas le changement de page (retour d'Axel du 2026-10-13).
 */
const EVENT = 'cosmo:org-guide-demo';

export const emitOrgGuideDemo = (active: boolean): void => {
  window.dispatchEvent(new CustomEvent<boolean>(EVENT, { detail: active }));
};

export const useOrgGuideDemoActive = (): boolean => {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setActive((e as CustomEvent<boolean>).detail === true);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return active;
};
