// Chemin des panneaux de sous-catégories ouverts dans la modale de gestion
// (cascade au survol, 2026-10-29). `openPath[i]` = parent dont le panneau de
// profondeur i+1 est ouvert.
//
// ⚠️ La fermeture différée ne referme PAS un panneau qu'on est en train
// d'éditer : un champ focalisé dedans, ou un menu d'actions Radix ouvert (rendu
// en portail, donc HORS du panneau pour la souris), le garde ouvert. Sinon
// aller cliquer « Supprimer » dans le menu d'une sous-catégorie refermait le
// panneau, et le menu avec.
import { useCallback, useEffect, useRef, useState } from 'react';

const CLOSE_DELAY_MS = 250;

export interface CascadePath {
  openPath: string[];
  /** Survol d'une ligne de profondeur `depth` (1 = racine). `id` null = sans enfants. */
  hover: (depth: number, id: string | null) => void;
  keep: () => void;
  leave: () => void;
  closeAll: () => void;
  registerPanel: (depth: number, el: HTMLElement | null) => void;
}

export function useCascadePath(): CascadePath {
  const [openPath, setOpenPath] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panels = useRef(new Map<number, HTMLElement>());

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clear, []);

  const hover = useCallback((depth: number, id: string | null) => {
    clear();
    setOpenPath((prev) => {
      const base = prev.slice(0, depth - 1);
      return id ? [...base, id] : base;
    });
  }, []);

  const editingInside = () => {
    if (document.querySelector('[role="menu"][data-state="open"]')) return true;
    const active = document.activeElement;
    return [...panels.current.values()].some((el) => el.contains(active));
  };

  const keep = useCallback(() => clear(), []);
  const closeAll = useCallback(() => { clear(); setOpenPath([]); }, []);
  const leave = useCallback(() => {
    clear();
    timer.current = setTimeout(() => {
      if (!editingInside()) setOpenPath([]);
    }, CLOSE_DELAY_MS);
  }, []);

  const registerPanel = useCallback((depth: number, el: HTMLElement | null) => {
    if (el) panels.current.set(depth, el); else panels.current.delete(depth);
  }, []);

  return { openPath, hover, keep, leave, closeAll, registerPanel };
}
