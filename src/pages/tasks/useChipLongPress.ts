import type React from 'react';
import { useRef, useState } from 'react';

// Menu d'actions de liste (mobile) — ouvert par appui long sur une chip.
// Remplace les micro-boutons flottants hover-only (inaccessibles au tap).
/**
 * Chemin CLAVIER vers le menu d'une liste (WCAG 2.1.1) : touche « menu contextuel » ou
 * Maj+F10 sur la puce focalisée. Lues en `keydown` : Safari n'émet aucun `contextmenu`
 * au clavier (C-118, cf. `TaskCard`), et `preventDefault` évite le menu natif ailleurs.
 */
export function chipMenuKeyProps(open: ((listId: string) => void) | undefined, cancel: () => void, listId: string) {
  if (!open) return {};
  return {
    'aria-keyshortcuts': 'Shift+F10',
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== 'ContextMenu' && !(e.key === 'F10' && e.shiftKey)) return;
      e.preventDefault();
      cancel();
      open(listId);
    },
  };
}

export function useChipLongPress(isMobile: boolean) {
  const [actionSheetListId, setActionSheetListId] = useState<string | null>(null);
  const chipLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipLongPressFired = useRef(false);
  const startChipLongPress = (listId: string) => {
    if (!isMobile) return;
    chipLongPressFired.current = false;
    chipLongPressTimer.current = setTimeout(() => {
      chipLongPressFired.current = true;
      setActionSheetListId(listId);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    }, 500);
  };
  const cancelChipLongPress = () => {
    if (chipLongPressTimer.current) {
      clearTimeout(chipLongPressTimer.current);
      chipLongPressTimer.current = null;
    }
  };

  return { actionSheetListId, setActionSheetListId, chipLongPressFired, startChipLongPress, cancelChipLongPress };
}
