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
//
// 🔴 C-119, suite · 2026-10-01 — le rôle `region` de C-119 cassait la grille ARIA.
// FullCalendar range ses défileurs DANS sa table `role="grid"` :
// `grid > tbody[rowgroup] > tr/td[presentation] > .fc-scroller > … > row`.
// axe (critique, WCAG 1.3.1) relevait `aria-required-children` sur la grille
// et `aria-required-parent` sur les rangées : une `region` interposée coupe la
// chaîne d'appartenance. Mesuré dans le navigateur : retirer le rôle NE
// suffit PAS, axe compte aussi un élément simplement focalisable comme un
// enfant de plein droit. Le défileur doit donc rester focalisable (WebKit) ET
// porter un rôle que la grille accepte : il DEVIENT le `rowgroup`, et le
// `rowgroup` d'origine de FullCalendar (son `tbody`/`thead`) passe en
// `presentation`. Même nom accessible, même arrêt de tabulation, structure
// `grid > rowgroup > row` intacte. Hors d'une grille, `region` reste juste.
import React from 'react';

const SCROLLER = '.fc-scroller';
/** Pose sur le `rowgroup` de FullCalendar dont le rôle a été cédé au défileur. */
const YIELDED = 'data-rowgroup-yielded';

function isScrollable(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  const scrollY = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
  const scrollX = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth;
  return scrollY || scrollX;
}

/** Le `rowgroup` de la grille qui contient ce défileur, s'il y en a un. */
function enclosingRowgroup(el: HTMLElement): HTMLElement | null {
  return el.parentElement?.closest<HTMLElement>(`[role="rowgroup"], [${YIELDED}]`) ?? null;
}

function setAttr(el: HTMLElement, name: string, value: string): void {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

export function markScrollers(root: ParentNode, label: string): void {
  root.querySelectorAll<HTMLElement>(SCROLLER).forEach((el) => {
    const rowgroup = enclosingRowgroup(el);
    if (isScrollable(el)) {
      setAttr(el, 'tabindex', '0');
      setAttr(el, 'aria-label', label);
      if (rowgroup) {
        setAttr(rowgroup, 'role', 'presentation');
        setAttr(rowgroup, YIELDED, '');
        setAttr(el, 'role', 'rowgroup');
      } else {
        setAttr(el, 'role', 'region');
      }
    } else if (el.getAttribute('tabindex') === '0') {
      el.removeAttribute('tabindex');
      el.removeAttribute('role');
      el.removeAttribute('aria-label');
      // Un même `tbody` peut porter deux sections (toute la journée, horaires),
      // donc deux défileurs : on ne lui rend son rôle que quand plus aucun
      // n'est un `rowgroup`, sinon on fabriquerait un `rowgroup` imbriqué.
      if (
        rowgroup?.hasAttribute(YIELDED)
        && !rowgroup.querySelector(`${SCROLLER}[role="rowgroup"]`)
      ) {
        rowgroup.setAttribute('role', 'rowgroup');
        rowgroup.removeAttribute(YIELDED);
      }
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
