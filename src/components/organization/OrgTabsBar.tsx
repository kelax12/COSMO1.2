import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export interface OrgTabItem {
  id: string;
  label: string;
  Icon: LucideIcon;
  /** Pastille de compteur, déjà construite par la page. */
  badge?: React.ReactNode;
}

interface Props {
  items: OrgTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * Barre d'onglets de l'espace entreprise.
 *
 * POURQUOI CE COMPOSANT EXISTE, et pourquoi il ne se contente pas d'un
 * `overflow-x-auto` : sur un écran de 375 px, **quatre destinations sur sept
 * étaient hors champ**, dans un conteneur `hide-scrollbar` — donc sans barre de
 * défilement, sans dégradé, sans le moindre indice qu'il y avait autre chose à
 * droite. Finding P1 de la critique UI du 2026-08-27. Le mode entreprise est
 * l'offre qui se vend, et la moitié de sa navigation était invisible.
 *
 * Deux corrections, et la première est un vrai bug, pas un confort :
 *
 * 1. **L'onglet actif est ramené dans le champ.** Ouvrir `/entreprise?tab=members`
 *    depuis un lien affichait « Aperçu » sélectionné à gauche et l'onglet
 *    réellement actif hors écran : l'utilisateur voyait le contenu de Membres
 *    sans voir lequel était coché.
 * 2. **Des dégradés aux bords disent qu'il y a autre chose.** C'est l'affordance
 *    que `hide-scrollbar` avait supprimée sans la remplacer.
 *
 * ⚠️ **Pas de `role="tablist"` / `role="tab"`, et c'est délibéré.** Le motif ARIA
 * « onglets » impose une navigation aux flèches, `aria-controls` et des
 * `tabpanel` — revendiquer le rôle sans le comportement dessert un lecteur
 * d'écran plus qu'il ne l'aide. Ce sont des boutons qui écrivent `?tab=` dans
 * l'URL ; `aria-current="page"` dit lequel est actif, ce qui est exact.
 * (Essayé le 2026-08-28, puis retiré : ça cassait aussi trois tests e2e qui
 * cherchaient légitimement des boutons.)
 *
 * ⚠️ **Ne pas « simplifier » en `scrollIntoView()`** : cette méthode remonte la
 * chaîne des ancêtres scrollables et fait sauter la PAGE entière, pas seulement
 * la barre. Le positionnement est calculé à la main sur le conteneur, exprès.
 */
const OrgTabsBar: React.FC<Props> = ({ items, activeId, onSelect }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [overflowLeft, setOverflowLeft] = useState(false);
  const [overflowRight, setOverflowRight] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const syncEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    // 1 px de tolérance : les navigateurs rendent des largeurs fractionnaires,
    // et un `scrollLeft` de 0,5 ferait clignoter le dégradé de gauche.
    setOverflowLeft(el.scrollLeft > 1);
    setOverflowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  // Signature du contenu : change quand un onglet apparaît, disparaît, ou
  // qu'une pastille de compteur s'ajoute — c'est-à-dire chaque fois que la
  // largeur du rail peut bouger.
  //
  // ⚠️ Elle n'est PAS décorative. Mesuré dans le navigateur à 375 px, avant de
  // l'ajouter : ouvrir `/entreprise?tab=members` centrait l'onglet actif, puis
  // la pastille « 1 » arrivait avec les données et l'élargissait de 8 px. Le
  // centrage, lui, ne se rejouait pas — et les 8 derniers pixels de l'onglet
  // actif restaient coupés. Un décalage invisible à l'œil, et exactement le
  // genre de chose qu'on ne trouve pas en relisant le code.
  const layoutSignature = items.map((i) => `${i.id}${i.badge ? '!' : ''}`).join('|');

  // Le premier positionnement est INSTANTANÉ, les suivants peuvent glisser.
  const hasPositioned = useRef(false);

  /**
   * Ramène l'onglet actif dans le champ, en le centrant quand c'est possible.
   *
   * `onlyIfHidden` : appelé après un changement de LARGEUR, on ne recentre que
   * si l'onglet actif est réellement sorti du champ. Sans cette réserve, un
   * simple retour de clavier virtuel ramènerait de force la barre sur l'onglet
   * actif alors que l'utilisateur venait de faire défiler ailleurs — on
   * corrigerait un défaut en en créant un autre.
   */
  const centerActive = useCallback(
    (onlyIfHidden = false) => {
      const el = scroller.current;
      const active = el?.querySelector<HTMLElement>('[data-active="true"]');
      if (!el || !active) return;

      const visible =
        active.offsetLeft >= el.scrollLeft - 1 &&
        active.offsetLeft + active.offsetWidth <= el.scrollLeft + el.clientWidth + 1;
      if (onlyIfHidden && visible) return;

      const target = Math.max(0, active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2);

      // ⚠️ Instantané à l'arrivée, et ce n'est pas un détail de finition.
      //
      // Un `scrollTo({ behavior: 'smooth' })` est ANNULABLE : une autre écriture
      // de `scrollLeft`, un relayout, une machine chargée, et l'animation
      // s'arrête en chemin sans que rien ne la reprenne. Le glissement est
      // conservé là où il sert — un changement d'onglet DEMANDÉ, qui aide à
      // suivre le déplacement — et abandonné là où seul le résultat compte.
      const smooth = hasPositioned.current && !prefersReducedMotion;
      hasPositioned.current = true;
      el.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' });
    },
    [prefersReducedMotion],
  );

  useEffect(() => {
    centerActive();
  }, [activeId, layoutSignature, centerActive]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    syncEdges();
    el.addEventListener('scroll', syncEdges, { passive: true });

    // ⚠️ DEUX cibles observées, et il a fallu deux mesures ratées pour le
    // comprendre.
    //
    // `ResizeObserver` observe la BOÎTE d'un élément. Celle du conteneur ne
    // bouge pas quand son CONTENU s'élargit : observer le seul conteneur ne
    // voit donc jamais l'arrivée d'une pastille de compteur. Mesuré en e2e le
    // 2026-08-28 : le rail passait de 805 à 832 px quand la pastille « 1 » de
    // Membres se posait, l'onglet actif se retrouvait 27 px hors champ, et
    // rien ne rattrapait — le test passait seul et échouait dans la suite
    // complète. Ça se lisait comme de la flakiness, c'était le code.
    //
    // On observe donc le conteneur (largeur DISPONIBLE) **et** le rail
    // (largeur du CONTENU).
    const observer = new ResizeObserver(() => {
      syncEdges();
      centerActive(true);
    });
    observer.observe(el);
    if (rail.current) observer.observe(rail.current);

    return () => {
      el.removeEventListener('scroll', syncEdges);
      observer.disconnect();
    };
  }, [syncEdges, centerActive, items.length]);

  const fade =
    'pointer-events-none absolute top-0 bottom-0 w-8 transition-opacity duration-200';

  return (
    <div className="relative mb-6">
      <div
        ref={scroller}
        data-org-tabs=""
        className="border-b border-[rgb(var(--color-border))] overflow-x-auto hide-scrollbar"
      >
        {/* Rail interne : c'est LUI dont la largeur suit le contenu, et c'est
            lui que la ResizeObserver surveille. Le conteneur, lui, garde la
            largeur de l'écran. */}
        <div ref={rail} className="flex gap-1 pb-0.5 w-max">
        {items.map(({ id, label, Icon, badge }) => (
          <button
            key={id}
            type="button"
            data-active={activeId === id}
            onClick={() => onSelect(id)}
            aria-current={activeId === id ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-4 min-h-11 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              activeId === id
                ? 'border-[rgb(var(--color-accent))] text-[rgb(var(--color-text-primary))]'
                : 'border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
            }`}
          >
            <Icon size={16} aria-hidden={true} /> {label}
            {badge}
          </button>
        ))}
        </div>
      </div>

      {/* Dégradés de continuation. `aria-hidden` : ils ne disent rien qu'un
          lecteur d'écran ne sache déjà — il parcourt la liste entière. */}
      <div
        aria-hidden="true"
        className={`${fade} left-0 bg-gradient-to-r from-[rgb(var(--color-background))] to-transparent ${
          overflowLeft ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden="true"
        className={`${fade} right-0 bg-gradient-to-l from-[rgb(var(--color-background))] to-transparent ${
          overflowRight ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};

export default OrgTabsBar;
