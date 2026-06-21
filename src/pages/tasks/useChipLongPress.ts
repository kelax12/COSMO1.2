import { useRef, useState } from 'react';

// Menu d'actions de liste (mobile) — ouvert par appui long sur une chip.
// Remplace les micro-boutons flottants hover-only (inaccessibles au tap).
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
