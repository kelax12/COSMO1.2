// C-119 · 2026-09-29 — la grille horaire de `/agenda` est atteignable au
// clavier sous Safari.
//
// axe relevait `scrollable-region-focusable` (serious) sous WebKit sur
// `.fc-scroller` : Chromium rend un défileur focalisable de lui-même, WebKit
// NON. Sans descendant focalisable (une journée sans événement), la grille ne
// défile donc ni au clavier ni pour un lecteur d'écran piloté au clavier.
// Même correctif que le calendrier de `/statistics` (C-120) : le défileur
// devient un arrêt de tabulation nommé.
//
// Pourquoi un MutationObserver plutôt qu'un rappel FullCalendar : les
// défileurs sont créés par la bibliothèque et RECRÉÉS à chaque changement de
// vue (mois ↔ jour), sans rappel garanti après leur montage. On ne pose les
// attributs que sur un défileur qui déborde vraiment : un arrêt de tabulation
// sur une zone qui ne défile pas n'est qu'un arrêt de plus pour rien (C-54 :
// le bouton « Nouveau » reste le chemin clavier de création).
import React from 'react';

const SCROLLER = '.fc-scroller';

function isScrollable(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  const scrollY = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
  const scrollX = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth;
  return scrollY || scrollX;
}

export function markScrollers(root: ParentNode, label: string): void {
  root.querySelectorAll<HTMLElement>(SCROLLER).forEach((el) => {
    if (isScrollable(el)) {
      if (el.getAttribute('tabindex') !== '0') el.setAttribute('tabindex', '0');
      if (el.getAttribute('role') !== 'region') el.setAttribute('role', 'region');
      if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
    } else if (el.getAttribute('tabindex') === '0') {
      el.removeAttribute('tabindex');
      el.removeAttribute('role');
      el.removeAttribute('aria-label');
    }
  });
}

export function useFocusableScrollers(
  rootRef: React.RefObject<HTMLElement>,
  label: string,
  enabled = true,
): void {
  React.useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => markScrollers(root, label));
    };
    schedule();
    // FullCalendar dimensionne ses défileurs APRÈS leur création, par `style` :
    // sans ces attributs observés, le débordement apparaît sans mutation vue
    // (mesuré sous WebKit : violation axe encore présente à 1,5 s). Filtre
    // restreint à `style`/`class` : nos propres écritures (`tabindex`, `role`,
    // `aria-label`) ne relancent pas l'observateur.
    const observer = new MutationObserver(schedule);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [rootRef, label, enabled]);
}
