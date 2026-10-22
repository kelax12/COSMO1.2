// src/components/org-guide/guide-click.ts

/**
 * Clic de démo complet. `el.click()` seul n'émet qu'un `click` : les
 * déclencheurs Radix (DropdownMenu, Select) s'ouvrent sur `pointerdown`, les
 * onglets sur `mousedown`. On rejoue donc la séquence d'une vraie souris.
 * Select ignore ensuite le `click` (pointerType « mouse » déjà traité), et
 * DropdownMenu ne bascule que sur `pointerdown` : pas de double ouverture.
 */
export const dispatchGuideClick = (el: HTMLElement): void => {
  const r = el.getBoundingClientRect();
  const base: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    clientX: r.left + r.width / 2,
    clientY: r.top + r.height / 2,
  };
  const pointer = (type: string, buttons: number) =>
    typeof PointerEvent === 'function'
      ? new PointerEvent(type, { ...base, buttons, pointerId: 1, pointerType: 'mouse', isPrimary: true })
      : new MouseEvent(type, { ...base, buttons });
  el.dispatchEvent(pointer('pointerdown', 1));
  el.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
  el.dispatchEvent(pointer('pointerup', 0));
  el.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
  el.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0 }));
};
