import { useCallback, useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════
// C-53 — le piège de focus des surfaces modales MAISON.
//
// Le dépôt ne contenait AUCUN utilitaire de piège de focus ni aucune capture
// de `document.activeElement` : 58 fichiers montent une surface modale hors
// `ui/dialog` (Radix), et aucun ne restituait le focus à son déclencheur.
//
// Mesuré au clavier le 2026-09-03 sur `/agenda` : Tab jusqu'à « Nouveau »,
// Entrée. `EventModal` s'ouvre et le focus RESTE sur le bouton derrière elle ;
// le premier Tab atteint un événement du calendrier masqué par l'overlay ;
// Échap ne fait rien. On remplit un formulaire qu'on ne peut pas atteindre, en
// parcourant une page qu'on ne voit plus.
//
// 🔴 POURQUOI UN ÉCOUTEUR SUR `document`, ET PAS UN `onKeyDown` SUR L'OVERLAY.
// `HabitModal` avait déjà un gestionnaire d'Échap — un `onKeyDown` React posé
// sur l'overlay, donc dépendant de la REMONTÉE d'un évènement depuis l'élément
// focalisé. Focus sorti de la modale, Échap mort. Un gestionnaire de modale ne
// peut pas dépendre de l'endroit où se trouve le focus : c'est précisément ce
// qu'il est là pour rattraper.
//
// ❌ Ne jamais réécrire ce comportement à la main dans une modale.
//    `src/hooks/use-modal-a11y.guard.test.tsx` en porte les témoins.
// ═══════════════════════════════════════════════════════════════════

/**
 * Pile des modales ouvertes.
 *
 * `EventModal` monte `ColorSettingsModal`, `ConfirmDiscardDialog` et
 * `RecurrenceDaysModal` DANS son propre arbre : sans pile, deux pièges
 * écouteraient `document` en même temps et Échap fermerait les deux, ou pire,
 * la modale du dessous volerait le focus à celle du dessus. Seule la dernière
 * empilée réagit.
 */
const openStack: symbol[] = [];

/** Vrai si `id` est la modale du dessus de la pile. */
function isTopmost(id: symbol): boolean {
  return openStack.length > 0 && openStack[openStack.length - 1] === id;
}

/**
 * Les derniers elements qui ont eu le focus, le plus recent en dernier.
 *
 * 🔴 POURQUOI UN HISTORIQUE, ET PAS `document.activeElement` A L'OUVERTURE.
 * Mesure du 2026-09-05 sur `HabitModal` : apres Echap, la trace des evenements
 * de focus ne contenait **aucun `focusin`** — la restitution ne partait jamais.
 * Cause : un `autoFocus` React est applique AU COMMIT, donc AVANT l'effet
 * passif qui capture le declencheur. A ce moment `document.activeElement` est
 * deja le champ de la modale, et le bouton d'origine est perdu.
 * `EventModal`, qui n'a pas d'`autoFocus`, restituait bien — d'ou une mesure
 * verte sur une surface et rouge sur l'autre, pour la meme implementation.
 *
 * On remonte donc l'historique jusqu'au dernier element qui n'est PAS dans la
 * modale. Borne a 10 : c'est un cache de reprise, pas un journal.
 */
const focusHistory: HTMLElement[] = [];
let historyInstalled = false;

function installFocusHistory(): void {
  if (historyInstalled || typeof document === 'undefined') return;
  historyInstalled = true;
  document.addEventListener(
    'focusin',
    () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return;
      const seen = focusHistory.indexOf(el);
      if (seen !== -1) focusHistory.splice(seen, 1);
      focusHistory.push(el);
      if (focusHistory.length > 10) focusHistory.shift();
    },
    true,
  );
}

/** Le dernier element focalise qui vit HORS de `root`, et existe encore. */
function lastFocusedOutside(root: HTMLElement | null): HTMLElement | null {
  for (let i = focusHistory.length - 1; i >= 0; i--) {
    const el = focusHistory[i];
    if (!el.isConnected) continue;
    if (root && root.contains(el)) continue;
    return el;
  }
  return null;
}

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

/**
 * Éléments réellement atteignables au clavier dans `root`.
 *
 * ⚠️ Le filtre de visibilité n'est pas cosmétique : une modale garde souvent
 * dans son DOM des contrôles masqués (variantes mobile et desktop rendues
 * ensemble, panneaux repliés). Les compter ferait boucler le piège sur un
 * élément que personne ne peut voir.
 */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.hasAttribute('inert') || el.getAttribute('aria-hidden') === 'true') return false;
    if (el.closest('[inert]')) return false;
    // jsdom ne calcule aucune boîte : `offsetParent` y est toujours nul et
    // `getClientRects()` toujours vide. On ne peut donc filtrer sur la
    // géométrie que dans un vrai navigateur.
    if (typeof el.getClientRects !== 'function') return true;
    const style = el.ownerDocument.defaultView?.getComputedStyle(el);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    return true;
  });
}

/**
 * Combine plusieurs refs sur un MEME element.
 *
 * Necessaire parce qu'une feuille porte deja `sheetRef` (`useBottomSheet`, qui
 * mesure sa hauteur pour le geste) : le piege de focus doit s'attacher au meme
 * noeud sans le lui prendre.
 */
export function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined | null>
): (node: T | null) => void {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

export interface ModalA11yOptions {
  /** La surface est-elle montée et visible ? */
  open: boolean;
  /** Fermeture demandée (Échap). Passer le MÊME chemin que le bouton « Fermer ». */
  onClose: () => void;
  /** Nom accessible de la boîte de dialogue. */
  label?: string;
  /** Alternative à `label` : l'id du titre déjà affiché. */
  labelledBy?: string;
  /** Élément à focaliser à l'ouverture. Par défaut : le premier focalisable. */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Échap ferme-t-il ? Faux seulement pour une surface bloquante assumée. */
  closeOnEscape?: boolean;
}

export interface ModalA11yDialogProps {
  role: 'dialog';
  'aria-modal': true;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  tabIndex: -1;
}

export interface ModalA11yResult<T extends HTMLElement> {
  /** À poser sur le conteneur de la modale (l'overlay). */
  ref: React.RefObject<T>;
  /**
   * À étaler sur ce même conteneur : `role="dialog"`, `aria-modal="true"` et
   * son nom accessible.
   *
   * ⚠️ `aria-modal` manquait PARTOUT, y compris sur le témoin Radix. C'est
   * acceptable pour Radix, qui neutralise les frères par `aria-hidden` ; ça ne
   * l'est pas pour une modale maison, qui ne fait ni l'un ni l'autre.
   */
  dialogProps: ModalA11yDialogProps;
}

/**
 * Piège de focus, restitution au déclencheur, Échap et sémantique ARIA d'une
 * surface modale maison.
 *
 * Usage :
 *   const { ref, dialogProps } = useModalA11y({ open: isOpen, onClose, label: t('title') });
 *   <div ref={ref} {...dialogProps} className="fixed inset-0 …" onClick={onClose}>
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>({
  open,
  onClose,
  label,
  labelledBy,
  initialFocusRef,
  closeOnEscape = true,
}: ModalA11yOptions): ModalA11yResult<T> {
  const ref = useRef<T>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const idRef = useRef<symbol | null>(null);
  if (idRef.current === null) idRef.current = Symbol('modal-a11y');

  // `onClose` change à chaque rendu du parent : le lire par ref évite de
  // réinstaller l'écouteur, donc de rejouer la mise au focus initiale à chaque
  // frappe dans le formulaire.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Installé au premier usage du hook, jamais au chargement du module : un
  // écouteur global posé par un import est un écouteur que personne ne peut
  // relier à une fonctionnalité.
  installFocusHistory();

  const moveFocusIn = useCallback(() => {
    const root = ref.current as HTMLElement | null;
    if (!root) return;
    // Un `autoFocus` React a pu se poser avant nous : ne pas le déplacer, sinon
    // on ramène le curseur au premier bouton au lieu du champ de saisie.
    if (root.contains(document.activeElement)) return;
    const target = initialFocusRef?.current ?? focusableWithin(root)[0] ?? root;
    target.focus?.({ preventScroll: true });
  }, [initialFocusRef]);

  useEffect(() => {
    if (!open) return;

    const id = idRef.current as symbol;
    openStack.push(id);

    // ⚠️ Le noeud est capturé ICI, pas relu dans le nettoyage. Un `useEffect`
    // est PASSIF : React a deja detache les refs quand son nettoyage tourne, et
    // `ref.current` y vaut `null`. On perdait donc le test « le focus est-il
    // encore dans la modale ? », donc la restitution au declencheur — mesure du
    // 2026-09-05, `focusReturned: false` sur HabitModal.
    const rootAtOpen = ref.current as HTMLElement | null;

    // Le déclencheur : le dernier élément focalisé qui vit HORS de la modale.
    // Lire `document.activeElement` ne suffit pas — un `autoFocus` React a pu
    // s'appliquer au commit, donc avant cet effet (cf. `focusHistory`).
    const active = document.activeElement as HTMLElement | null;
    const activeIsOutside =
      !!active && active !== document.body && !(rootAtOpen && rootAtOpen.contains(active));
    triggerRef.current = activeIsOutside ? active : lastFocusedOutside(rootAtOpen);

    // Après peinture : le contenu de la modale peut n'être monté qu'au frame
    // suivant (AnimatePresence, variantes mobile ou desktop).
    const raf = requestAnimationFrame(moveFocusIn);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTopmost(id)) return;
      const root = ref.current as HTMLElement | null;
      if (!root) return;

      if (e.key === 'Escape' && closeOnEscape) {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key !== 'Tab') return;

      const items = focusableWithin(root);
      if (items.length === 0) {
        // Rien à focaliser : garder le focus sur le conteneur plutôt que de le
        // laisser filer derrière l'overlay.
        e.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      // Focus déjà sorti (ouverture sans mise au focus, clic dans la page,
      // élément démonté) : Tab le RAMÈNE dedans au lieu de continuer la page.
      if (!active || !root.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? items[items.length - 1] : items[0]).focus({ preventScroll: true });
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    // Capture : un champ qui appelle `stopPropagation` sur ses touches (les
    // champs de date natifs le font) ne doit pas pouvoir désarmer le piège.
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      const idx = openStack.lastIndexOf(id);
      if (idx !== -1) openStack.splice(idx, 1);

      // Restitution : seulement si le focus est encore DANS la modale, ou nulle
      // part. Sinon quelqu'un l'a déjà déplacé volontairement (une modale
      // enfant, un champ ciblé par le code de fermeture) et le lui reprendre
      // serait pire que de ne rien faire.
      const active = document.activeElement as HTMLElement | null;
      const focusIsLoose =
        !active ||
        active === document.body ||
        (rootAtOpen ? rootAtOpen.contains(active) : false);
      const trigger = triggerRef.current;
      triggerRef.current = null;
      if (focusIsLoose && trigger && trigger.isConnected) {
        trigger.focus?.({ preventScroll: true });
      }
    };
  }, [open, closeOnEscape, moveFocusIn]);

  return {
    ref,
    dialogProps: {
      role: 'dialog',
      'aria-modal': true,
      ...(label ? { 'aria-label': label } : {}),
      ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
      tabIndex: -1,
    },
  };
}
