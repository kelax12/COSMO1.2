import { useCallback, useLayoutEffect, useRef } from 'react';
import {
  installFocusHistory,
  lastFocusedOutside,
  menuTriggerOf,
  reconnected,
} from '@/lib/focus-history';

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

/**
 * FRO-01 (vague 16.3) · la restitution du focus des surfaces RADIX, par le MEME historique.
 *
 * 🔴 Radix ne rend le focus qu'a `DialogTrigger` : son `onCloseAutoFocus` fait
 * `event.preventDefault()` puis `context.triggerRef.current?.focus()`. Le produit pilote toutes
 * ses surfaces par un etat (`open` / `onOpenChange`), sans aucun `DialogTrigger` : `triggerRef`
 * est nul, le focus tombait sur `body`. Pareil pour une surface ouverte depuis l'entree d'un
 * menu, qui disparait avec lui.
 *
 * 🔴 LE DECLENCHEUR N'EST PAS LU DANS `onOpenAutoFocus` : il ne part pas quand un enfant
 * `autoFocus` a deja pris le focus au commit (piege de `HabitModal`, cf. `focusHistory`). Il est
 * lu par un `ref` pose sur le contenu, dans l'historique des focus.
 *
 * 🔴 ET UN DECLENCHEUR PEUT AVOIR ETE RECREE. Mesure du 2026-11-07 dans un navigateur (`/tasks`,
 * « Nouvelle tâche », Entree, Echap) : le meme rendu qui ouvre la surface RECREE le bouton, l'element
 * d'origine est detache avant le montage de la surface, et le focus tombait sur BODY. La capture
 * garde donc un element detache (`allowDetached`), et la restitution lui retrouve son equivalent
 * (`reconnected`).
 *
 * A la fermeture on ne touche a rien si Radix (ou l'appelant) a deja pose le focus quelque
 * part : seul un focus perdu sur `body` est rattrape. Le `preventDefault()` de l'appelant est
 * respecte (un menu en cascade qui gere lui-meme son focus).
 */
export function useRadixFocusReturn<E extends Event>(
  userOnCloseAutoFocus?: (event: E) => void,
  userRef?: React.Ref<HTMLDivElement>,
): {
  ref: (node: HTMLDivElement | null) => void;
  onCloseAutoFocus: (event: E) => void;
} {
  const openerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(userOnCloseAutoFocus);
  const userRefRef = useRef(userRef);
  closeRef.current = userOnCloseAutoFocus;
  userRefRef.current = userRef;
  installFocusHistory();

  // Stable : un `ref` dont l'identite change est rappele a chaque rendu.
  const ref = useCallback((node: HTMLDivElement | null) => {
    const forwarded = userRefRef.current;
    if (typeof forwarded === 'function') forwarded(node);
    else if (forwarded) (forwarded as React.MutableRefObject<HTMLDivElement | null>).current = node;
    // Une seule capture par ouverture : remise a zero par la fermeture.
    if (!node || openerRef.current) return;
    const active = document.activeElement as HTMLElement | null;
    const activeIsOutside = !!active && active !== document.body && !node.contains(active);
    openerRef.current = menuTriggerOf(activeIsOutside ? active : lastFocusedOutside(node, true));
  }, []);

  const onCloseAutoFocus = useCallback((event: E) => {
    closeRef.current?.(event);
    const opener = openerRef.current;
    openerRef.current = null;
    // L'appelant a pris le focus en charge : on lui laisse, sans repli.
    if (event.defaultPrevented) return;
    // Radix pose son propre focus dans la meme tache : le repli passe APRES lui.
    setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body) return;
      const target = reconnected(opener) ?? lastFocusedOutside(null);
      target?.focus?.({ preventScroll: true });
    }, 0);
  }, []);

  return { ref, onCloseAutoFocus };
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
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Échap ferme-t-il ? Faux seulement pour une surface bloquante assumée. */
  closeOnEscape?: boolean;
  /**
   * Rôle ARIA de la surface. `alertdialog` pour une confirmation destructive :
   * il demande aux lecteurs d'écran d'annoncer le contenu à l'ouverture, ce que
   * `dialog` ne fait pas.
   *
   * ❌ Ne jamais rétrograder un `alertdialog` existant en `dialog` au motif que
   * c'est la valeur par défaut du hook : on perdrait l'annonce, sans que rien
   * ne le signale.
   */
  role?: 'dialog' | 'alertdialog';
}

export interface ModalA11yDialogProps {
  role: 'dialog' | 'alertdialog';
  'aria-modal': true;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  tabIndex: -1;
}

export interface ModalA11yResult<T extends HTMLElement> {
  /** À poser sur le conteneur de la modale (l'overlay). */
  ref: React.RefObject<T | null>;
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
  role = 'dialog',
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

  // 🔴 `useLayoutEffect`, PAS `useEffect` : l'écouteur d'Échap doit être posé
  // AVANT que la surface ne soit peinte. Un effet passif tourne APRÈS la
  // peinture, dans une tâche à part : entre les deux, la feuille est à l'écran,
  // cliquable, et Échap n'y fait RIEN. Mesuré le 2026-10-22 sous WebKit en CI
  // (`OrgSectionSheet`, chargée en lazy, donc commitée par une relance de
  // Suspense) : Échap envoyé dès la feuille visible, perdu, la feuille restée
  // ouverte 10 s avec le focus déjà dedans. Instable 2 fois sur 5 runs.
  useLayoutEffect(() => {
    if (!open) return;

    const id = idRef.current as symbol;
    openStack.push(id);

    // ⚠️ Le noeud est capturé ICI, pas relu dans le nettoyage. Écrit quand cet
    // effet était PASSIF : React avait alors deja detache les refs quand son
    // nettoyage tournait, et `ref.current` y valait `null`. On perdait donc le test « le focus est-il
    // encore dans la modale ? », donc la restitution au declencheur — mesure du
    // 2026-09-05, `focusReturned: false` sur HabitModal.
    const rootAtOpen = ref.current as HTMLElement | null;

    // Le déclencheur : le dernier élément focalisé qui vit HORS de la modale.
    // Lire `document.activeElement` ne suffit pas — un `autoFocus` React a pu
    // s'appliquer au commit, donc avant cet effet (cf. `focusHistory`).
    const active = document.activeElement as HTMLElement | null;
    const activeIsOutside =
      !!active && active !== document.body && !(rootAtOpen && rootAtOpen.contains(active));
    triggerRef.current = menuTriggerOf(activeIsOutside ? active : lastFocusedOutside(rootAtOpen, true));

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
      const opener = triggerRef.current;
      triggerRef.current = null;
      // 🔴 EN MICROTACHE, PAS DANS LE NETTOYAGE. Mesure du 2026-11-07 dans un navigateur
      // (`MobileDisplaySheet`, largeur mobile, Echap) : le nettoyage rendait bien le focus au
      // declencheur, puis React le REPRENAIT. Apres un commit, `restoreSelection` refocalise
      // l'element qui avait le focus AVANT le commit, s'il est encore dans le document, et une
      // feuille en sortie (`AnimatePresence`) garde ses boutons montes pendant l'animation. Le
      // focus retournait donc dans la feuille, puis tombait sur `body` quand elle disparaissait.
      // La microtache passe APRES ce commit synchrone, et l'etat du focus y est lu a jour.
      queueMicrotask(() => {
        // Restitution : seulement si le focus est encore DANS la modale, ou nulle
        // part. Sinon quelqu'un l'a déjà déplacé volontairement (une modale
        // enfant, un champ ciblé par le code de fermeture) et le lui reprendre
        // serait pire que de ne rien faire.
        const active = document.activeElement as HTMLElement | null;
        const focusIsLoose =
          !active ||
          active === document.body ||
          (rootAtOpen ? rootAtOpen.contains(active) : false);
        // Un déclencheur DÉMONTÉ (l'entrée d'un menu Radix, refermé en ouvrant
        // la modale) ne peut plus reprendre le focus : il revient alors au
        // dernier élément extérieur encore monté, en pratique le bouton qui avait
        // ouvert ce menu. Sans ce repli, le focus tombait sur `body` (mesuré le
        // 2026-10-22, `AssignRoleDialog` ouverte depuis « Actions pour … »).
        const trigger = reconnected(opener) ?? lastFocusedOutside(rootAtOpen);
        if (focusIsLoose && trigger) {
          trigger.focus?.({ preventScroll: true });
        }
      });
    };
  }, [open, closeOnEscape, moveFocusIn]);

  return {
    ref,
    dialogProps: {
      role,
      'aria-modal': true,
      ...(label ? { 'aria-label': label } : {}),
      ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
      tabIndex: -1,
    },
  };
}
