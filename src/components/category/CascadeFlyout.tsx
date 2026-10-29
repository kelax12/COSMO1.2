// ═══════════════════════════════════════════════════════════════════
// Sous-menu en cascade pour les sélecteurs de catégorie (2026-10-29).
//
// Survol d'un parent → ses enfants s'ouvrent dans un panneau collé à sa
// droite, comme les menus de Windows. Clavier : → ouvre, ← referme.
//
// 🔴 Souris uniquement (`useCanHover`). Au doigt, le survol n'existe pas :
// les appelants gardent leur arbre indenté à chevrons.
//
// Un `CascadeLevel` = une colonne. Il tient l'identifiant du parent ouvert
// dans cette colonne, pour qu'un survol voisin referme le précédent tout de
// suite. Le délai de fermeture (150 ms) laisse le temps de traverser jusqu'au
// panneau ; entrer dans un panneau annule les délais de TOUTES les colonnes
// ancêtres, sinon quitter la colonne 1 pour la 3 refermerait la 2.
// ═══════════════════════════════════════════════════════════════════
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

const CLOSE_DELAY_MS = 150;

interface LevelApi {
  activeId: string | null;
  viaKeyboard: boolean;
  open: (id: string, viaKeyboard?: boolean) => void;
  close: () => void;
  scheduleClose: () => void;
  cancelClose: () => void;
}

const LevelContext = createContext<LevelApi | null>(null);

export const CascadeLevel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const parent = useContext(LevelContext);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viaKeyboard, setViaKeyboard] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clear, []);

  const cancelClose = useCallback(() => { clear(); parent?.cancelClose(); }, [parent]);
  const open = useCallback((id: string, kbd = false) => { clear(); setViaKeyboard(kbd); setActiveId(id); }, []);
  const close = useCallback(() => { clear(); setActiveId(null); }, []);
  const scheduleClose = useCallback(() => {
    clear();
    timer.current = setTimeout(() => setActiveId(null), CLOSE_DELAY_MS);
  }, []);

  const api = useMemo(
    () => ({ activeId, viaKeyboard, open, close, scheduleClose, cancelClose }),
    [activeId, viaKeyboard, open, close, scheduleClose, cancelClose],
  );
  return <LevelContext.Provider value={api}>{children}</LevelContext.Provider>;
};

interface CascadeFlyoutProps {
  id: string;
  /** Ligne du parent (son bouton de sélection reste cliquable). */
  row: React.ReactNode;
  /** Contenu du panneau : les enfants, rendus par l'appelant. */
  children: React.ReactNode;
  ariaLabel: string;
  /** Mêmes classes que le panneau principal (z-index d'un hôte élevé). */
  panelClassName?: string;
}

export const CascadeFlyout: React.FC<CascadeFlyoutProps> = ({ id, row, children, ariaLabel, panelClassName = '' }) => {
  const level = useContext(LevelContext);
  const rowRef = useRef<HTMLDivElement>(null);
  if (!level) throw new Error('CascadeFlyout hors de CascadeLevel');
  const isOpen = level.activeId === id;

  return (
    <Popover open={isOpen} onOpenChange={(next) => { if (!next) level.close(); }}>
      <PopoverAnchor asChild>
        <div
          ref={rowRef}
          className={`flex items-center rounded-md ${isOpen ? 'bg-[rgb(var(--color-hover))]' : ''}`}
          onMouseEnter={() => level.open(id)}
          onMouseLeave={level.scheduleClose}
          onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); level.open(id, true); } }}
        >
          <div className="flex-1 min-w-0">{row}</div>
          <ChevronRight size={14} className="shrink-0 mr-2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
        </div>
      </PopoverAnchor>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={0}
        aria-label={ariaLabel}
        onOpenAutoFocus={(e) => { if (!level.viaKeyboard) e.preventDefault(); }}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={level.cancelClose}
        onMouseLeave={level.scheduleClose}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            level.close();
            rowRef.current?.querySelector<HTMLElement>('button')?.focus();
          }
        }}
        className={`w-56 max-h-80 overflow-y-auto p-1 rounded-l-none border-l-2 border-l-blue-600 ${panelClassName}`}
      >
        <CascadeLevel>
          <div role="group">{children}</div>
        </CascadeLevel>
      </PopoverContent>
    </Popover>
  );
};
