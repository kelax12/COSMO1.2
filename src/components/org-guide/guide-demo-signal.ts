// src/components/org-guide/guide-demo-signal.ts
import { useEffect, useState } from 'react';

/**
 * Phase de la démo du guide, émise par `OrgGuideHost` (lazy) et lue par la
 * page. Un évènement plutôt qu'un contexte : la page ne charge pas l'hôte du
 * guide, elle n'en écoute que l'état.
 *
 * - `off`  : pas de démo, la navigation de droite suit le choix de l'utilisateur.
 * - `nav`  : le curseur change de page. Repliée, la navigation sort de l'écran
 *            et devient inerte : on la fait ressortir, sinon le curseur vise
 *            un lien invisible (retour d'Axel du 2026-10-13).
 * - `hide` : la bonne page est atteinte. On la masque, sinon le curseur clique
 *            des boutons qu'elle recouvre et on ne comprend plus ce qu'il fait
 *            (retour d'Axel du 2026-10-13).
 */
export type OrgGuideDemoPhase = 'off' | 'nav' | 'hide';

const EVENT = 'cosmo:org-guide-demo';

export const emitOrgGuideDemo = (phase: OrgGuideDemoPhase): void => {
  window.dispatchEvent(new CustomEvent<OrgGuideDemoPhase>(EVENT, { detail: phase }));
};

export const useOrgGuideDemoPhase = (): OrgGuideDemoPhase => {
  const [phase, setPhase] = useState<OrgGuideDemoPhase>('off');
  useEffect(() => {
    const on = (e: Event) => setPhase((e as CustomEvent<OrgGuideDemoPhase>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return phase;
};
